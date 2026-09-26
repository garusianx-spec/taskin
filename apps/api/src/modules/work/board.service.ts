import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { ColumnDisposition, ColumnView, CreateColumnBody, UpdateColumnBody, WorkflowView } from '@taskin/contracts';
import { AuditWriter } from '../../platform/audit/audit-writer.js';
import type { Tx } from '../../platform/db/database.js';
import { isUniqueViolation } from '../../platform/db/pg-errors.js';
import { boardColumns, tasks, workflows } from '../../platform/db/schema/all.js';
import { UnitOfWork } from '../../platform/db/unit-of-work.js';
import { ApiError } from '../../platform/http/api-error.js';
import type { MembershipContext } from '../../platform/http/request.js';
import { OutboxWriter } from '../../platform/outbox/outbox-writer.js';
import { AbilityFactory } from '../rbac/ability.js';
import { keyBetween, keysBetween } from './positions.js';

type ColumnRow = typeof boardColumns.$inferSelect;
type WorkflowRow = typeof workflows.$inferSelect;

/** Tasks listed in a `board.column.removed` event; beyond this, clients resync the board. */
const EVENT_TASK_LIMIT = 500;

export function columnView(row: ColumnRow): ColumnView {
  return { id: row.id, title: row.title, status: row.status, tone: row.tone, builtIn: row.isBuiltin, position: row.position };
}

/**
 * The workspace workflow's columns (every project shares it in v1). Column changes lock the
 * workflow row first (the canonical lock order: workflow → column → task) and bump its version.
 */
@Injectable()
export class BoardService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditWriter,
    private readonly outbox: OutboxWriter,
    private readonly abilities: AbilityFactory,
  ) {}

  async workflow(member: MembershipContext): Promise<WorkflowView> {
    return this.uow.run({ workspaceId: member.workspaceId, userId: member.userId }, async ({ tx }) => {
      const workflow = await this.defaultWorkflow(tx, member.workspaceId);
      return { id: workflow.id, version: workflow.version, columns: (await this.liveColumns(tx, workflow.id)).map(columnView) };
    });
  }

  async addColumn(member: MembershipContext, body: CreateColumnBody): Promise<WorkflowView> {
    if (!this.abilities.forMember(member).can('create', 'BoardColumn')) throw ApiError.forbidden();
    return this.uow.run({ workspaceId: member.workspaceId, userId: member.userId }, async ({ tx }) => {
      const workflow = await this.defaultWorkflow(tx, member.workspaceId, true);
      const columns = await this.liveColumns(tx, workflow.id);
      const position = this.positionAfter(columns, body.afterColumnId ?? null, null, body.afterColumnId === undefined || body.afterColumnId === null ? 'end' : 'after');
      try {
        const [created] = await tx
          .insert(boardColumns)
          .values({
            workspaceId: member.workspaceId,
            workflowId: workflow.id,
            title: body.title.trim(),
            status: body.status ?? 'in-progress',
            tone: body.tone ?? null,
            position,
          })
          .returning();
        if (!created) throw new Error('column insert returned nothing');
        const version = await this.bump(tx, workflow.id);
        await this.audit.write(tx, {
          action: 'board.column.create',
          workspaceId: member.workspaceId,
          resourceType: 'board_column',
          resourceId: created.id,
          changes: { after: { title: created.title, status: created.status, tone: created.tone } },
        });
        await this.outbox.add(tx, {
          type: 'board.column.added',
          aggregateType: 'workflow',
          aggregateId: workflow.id,
          workspaceId: member.workspaceId,
          payload: { workflowId: workflow.id, columnId: created.id, version },
        });
        return { id: workflow.id, version, columns: [...columns, created].sort(byPosition).map(columnView) };
      } catch (error) {
        if (isUniqueViolation(error, 'board_columns_title_uq')) throw new ApiError('CONFLICT', 'A column with that name exists.');
        throw error;
      }
    });
  }

  async updateColumn(member: MembershipContext, columnId: string, body: UpdateColumnBody): Promise<WorkflowView> {
    if (!this.abilities.forMember(member).can('edit', 'BoardColumn')) throw ApiError.forbidden();
    return this.uow.run({ workspaceId: member.workspaceId, userId: member.userId }, async ({ tx }) => {
      const workflow = await this.defaultWorkflow(tx, member.workspaceId, true);
      const columns = await this.liveColumns(tx, workflow.id);
      const column = columns.find((entry) => entry.id === columnId);
      if (!column) throw new ApiError('COLUMN_GONE');
      const others = columns.filter((entry) => entry.id !== columnId);
      const position = body.afterColumnId === undefined ? undefined : this.positionAfter(others, body.afterColumnId, columnId, body.afterColumnId === null ? 'first' : 'after');
      try {
        const [updated] = await tx
          .update(boardColumns)
          .set({
            ...(body.title !== undefined ? { title: body.title.trim() } : {}),
            ...(body.tone !== undefined ? { tone: body.tone } : {}),
            ...(position !== undefined ? { position } : {}),
          })
          .where(and(eq(boardColumns.workspaceId, member.workspaceId), eq(boardColumns.id, columnId)))
          .returning();
        if (!updated) throw new ApiError('COLUMN_GONE');
        const version = await this.bump(tx, workflow.id);
        await this.audit.write(tx, {
          action: 'board.column.update',
          workspaceId: member.workspaceId,
          resourceType: 'board_column',
          resourceId: columnId,
          changes: { before: { title: column.title, tone: column.tone, position: column.position }, after: body },
        });
        await this.outbox.add(tx, {
          type: 'board.column.updated',
          aggregateType: 'workflow',
          aggregateId: workflow.id,
          workspaceId: member.workspaceId,
          payload: { workflowId: workflow.id, columnId, version },
        });
        return { id: workflow.id, version, columns: [...others, updated].sort(byPosition).map(columnView) };
      } catch (error) {
        if (isUniqueViolation(error, 'board_columns_title_uq')) throw new ApiError('CONFLICT', 'A column with that name exists.');
        throw error;
      }
    });
  }

  /**
   * Deletes a column (RFC §12): never the last one, nor the last to-do or done column. Its cards
   * move to another column (taking its status, appended in their current order) or are archived;
   * an empty column needs no disposition.
   */
  async removeColumn(member: MembershipContext, columnId: string, disposition: ColumnDisposition | undefined): Promise<void> {
    if (!this.abilities.forMember(member).can('delete', 'BoardColumn')) throw ApiError.forbidden();
    await this.uow.run({ workspaceId: member.workspaceId, userId: member.userId }, async ({ tx }) => {
      const workflow = await this.defaultWorkflow(tx, member.workspaceId, true);
      const target = disposition?.kind === 'migrate' ? disposition.targetColumnId : null;
      if (target === columnId) throw ApiError.validation([{ field: 'disposition.targetColumnId', message: 'must be another column' }]);
      // Lock the columns involved in id order, so moves into them wait for (and then see) this change.
      const locked = await tx
        .select()
        .from(boardColumns)
        .where(and(eq(boardColumns.workspaceId, member.workspaceId), inArray(boardColumns.id, target ? [columnId, target] : [columnId])))
        .orderBy(asc(boardColumns.id))
        .for('update');
      const column = locked.find((entry) => entry.id === columnId);
      if (!column || column.deletedAt || column.workflowId !== workflow.id) throw new ApiError('COLUMN_GONE');
      const remaining = (await this.liveColumns(tx, workflow.id)).filter((entry) => entry.id !== columnId);
      if (remaining.length === 0) throw new ApiError('WORKFLOW_CATEGORY_REQUIRED', 'The last column cannot be deleted.');
      if (!remaining.some((entry) => entry.status === 'todo') || !remaining.some((entry) => entry.status === 'done')) {
        throw new ApiError('WORKFLOW_CATEGORY_REQUIRED');
      }

      const cards = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.workspaceId, member.workspaceId), eq(tasks.columnId, columnId), isNull(tasks.deletedAt), isNull(tasks.archivedAt)))
        .orderBy(asc(tasks.position), asc(tasks.id));
      let kind: 'migrate' | 'archive' | 'empty' = 'empty';
      if (cards.length > 0) {
        if (!disposition) throw new ApiError('CONFLICT', 'The column has cards: move them to another column or archive them.');
        kind = disposition.kind;
      }
      if (kind === 'migrate' && target) {
        const destination = locked.find((entry) => entry.id === target);
        if (!destination || destination.deletedAt || destination.workflowId !== workflow.id) throw new ApiError('COLUMN_GONE', 'The target column was deleted.');
        const [last] = await tx
          .select({ position: tasks.position })
          .from(tasks)
          .where(and(eq(tasks.workspaceId, member.workspaceId), eq(tasks.columnId, target), isNull(tasks.deletedAt), isNull(tasks.archivedAt)))
          .orderBy(sql`${tasks.position} desc`)
          .limit(1);
        const positions = keysBetween(last?.position ?? null, null, cards.length);
        const toDone = destination.status === 'done';
        await tx.execute(sql`
          update tasks t set column_id = ${target}, position = m.position, version = t.version + 1,
            completed_at = case when ${toDone} then coalesce(t.completed_at, now()) else null end,
            reopen_column_id = case when ${toDone} then coalesce(t.reopen_column_id, t.column_id) else null end
          from unnest(${sql.param(cards.map((card) => card.id))}::uuid[], ${sql.param(positions)}::text[]) as m(id, position)
          where t.workspace_id = ${member.workspaceId} and t.id = m.id`);
      } else if (kind === 'archive') {
        await tx.execute(sql`
          update tasks set archived_at = now(), version = version + 1
          where workspace_id = ${member.workspaceId} and column_id = ${columnId} and deleted_at is null and archived_at is null`);
      }
      await tx.update(boardColumns).set({ deletedAt: sql`now()` }).where(and(eq(boardColumns.workspaceId, member.workspaceId), eq(boardColumns.id, columnId)));
      const version = await this.bump(tx, workflow.id);
      await this.audit.write(tx, {
        action: 'board.column.delete',
        workspaceId: member.workspaceId,
        resourceType: 'board_column',
        resourceId: columnId,
        changes: { before: { title: column.title, status: column.status }, disposition: kind, targetColumnId: target, tasks: cards.length },
      });
      await this.outbox.add(tx, {
        type: 'board.column.removed',
        aggregateType: 'workflow',
        aggregateId: workflow.id,
        workspaceId: member.workspaceId,
        payload: {
          workflowId: workflow.id,
          columnId,
          version,
          disposition: kind,
          targetColumnId: kind === 'migrate' ? target : null,
          taskIds: cards.slice(0, EVENT_TASK_LIMIT).map((card) => card.id),
          resync: cards.length > EVENT_TASK_LIMIT,
        },
      });
    });
  }

  /* ------------------------------------------------------------------ helpers */

  async defaultWorkflow(tx: Tx, workspaceId: string, lock = false): Promise<WorkflowRow> {
    const query = tx
      .select()
      .from(workflows)
      .where(and(eq(workflows.workspaceId, workspaceId), eq(workflows.isDefault, true)));
    const [workflow] = lock ? await query.for('update') : await query;
    if (!workflow) throw new Error('the workspace has no default workflow');
    return workflow;
  }

  async liveColumns(tx: Tx, workflowId: string): Promise<ColumnRow[]> {
    return tx
      .select()
      .from(boardColumns)
      .where(and(eq(boardColumns.workflowId, workflowId), isNull(boardColumns.deletedAt)))
      .orderBy(asc(boardColumns.position), asc(boardColumns.id));
  }

  private async bump(tx: Tx, workflowId: string): Promise<number> {
    const [row] = await tx
      .update(workflows)
      .set({ version: sql`${workflows.version} + 1` })
      .where(eq(workflows.id, workflowId))
      .returning({ version: workflows.version });
    return row?.version ?? 0;
  }

  /** A position after `afterId` among `columns` (sorted), first, or at the end. */
  private positionAfter(columns: readonly ColumnRow[], afterId: string | null, self: string | null, where: 'after' | 'first' | 'end'): string {
    if (where === 'end') return keyBetween(columns.at(-1)?.position ?? null, null);
    if (where === 'first') return keyBetween(null, columns[0]?.position ?? null);
    const index = columns.findIndex((column) => column.id === afterId);
    if (index < 0 || afterId === self) throw ApiError.validation([{ field: 'afterColumnId', message: 'unknown column' }]);
    return keyBetween(columns[index]?.position ?? null, columns[index + 1]?.position ?? null);
  }
}

const byPosition = (a: ColumnRow, b: ColumnRow) => (a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : 1);
