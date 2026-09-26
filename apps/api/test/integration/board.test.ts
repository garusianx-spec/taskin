import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BoardView, ColumnView, ProjectView, TaskCard, WorkflowView, WorkspaceView } from '@taskin/contracts';
import { bearer, createTestApp, idempotencyKey, ownerWithWorkspace, type Session, type TestApp } from './harness.js';
import { createProject, createTask, expectStatus, getWorkflow, outboxEvents, usePlan, wsPath } from './work-helpers.js';

describe('M2 checklist: board columns and moves', () => {
  let t: TestApp;
  let owner: Session;
  let workspace: WorkspaceView;
  let project: ProjectView;

  beforeAll(async () => {
    t = await createTestApp();
    ({ owner, workspace } = await ownerWithWorkspace(t));
    await usePlan(t, workspace.id, 'team');
    project = await createProject(t, owner, workspace.id, { key: 'BRD', name: 'تابلو' });
  });
  afterAll(async () => {
    await t?.close();
  });

  const base = () => wsPath(workspace.id);
  const board = async (projectId = project.id) => {
    const response = await t.http().get(`${base()}/board?projectId=${projectId}`).set(bearer(owner));
    expectStatus(response, 200);
    return response.body as BoardView;
  };
  const addColumn = async (title: string, extra: Record<string, unknown> = {}) => {
    const response = await t.http().post(`${base()}/workflow/columns`).set(bearer(owner)).set('Idempotency-Key', idempotencyKey()).send({ title, ...extra });
    expectStatus(response, 201);
    return (response.body as WorkflowView).columns.find((column) => column.title === title) as ColumnView;
  };
  const move = (task: TaskCard, columnId: string, extra: Record<string, unknown> = {}) =>
    t.http().post(`${base()}/tasks/${task.id}/move`).set(bearer(owner)).send({ columnId, expectedVersion: task.version, ...extra });
  const inColumn = (view: BoardView, columnId: string) => view.tasks.filter((task) => task.columnId === columnId).sort((a, b) => (a.position < b.position ? -1 : 1));

  it('starts every workspace with the four built-in columns', async () => {
    const workflow = await getWorkflow(t, owner, workspace.id);
    expect(workflow.columns.map((column) => [column.status, column.builtIn])).toEqual([
      ['todo', true],
      ['in-progress', true],
      ['review', true],
      ['done', true],
    ]);
  });

  it('adds, renames, recolours and reorders columns, bumping the workflow version', async () => {
    const before = await getWorkflow(t, owner, workspace.id);
    const qa = await addColumn('تست کیفیت', { tone: 'violet', afterColumnId: before.columns[1]?.id });
    let workflow = await getWorkflow(t, owner, workspace.id);
    expect(workflow.version).toBe(before.version + 1);
    expect(workflow.columns.map((column) => column.id).indexOf(qa.id)).toBe(2);
    expect(qa).toMatchObject({ status: 'in-progress', tone: 'violet', builtIn: false });

    const renamed = await t.http().patch(`${base()}/workflow/columns/${qa.id}`).set(bearer(owner)).send({ title: 'QA', tone: 'red', afterColumnId: null });
    expectStatus(renamed, 200);
    workflow = renamed.body as WorkflowView;
    expect(workflow.columns[0]).toMatchObject({ id: qa.id, title: 'QA', tone: 'red' });
    const duplicate = await t.http().post(`${base()}/workflow/columns`).set(bearer(owner)).set('Idempotency-Key', idempotencyKey()).send({ title: 'qa' });
    expectStatus(duplicate, 409);
    expect((await outboxEvents(t, 'board.column.updated')).length).toBeGreaterThan(0);
  });

  it('deletes an empty column at once, and refuses the last to-do or done column', async () => {
    const empty = await addColumn('موقت');
    expectStatus(await t.http().delete(`${base()}/workflow/columns/${empty.id}`).set(bearer(owner)).send({}), 204);
    const workflow = await getWorkflow(t, owner, workspace.id);
    expect(workflow.columns.map((column) => column.id)).not.toContain(empty.id);
    const done = workflow.columns.find((column) => column.status === 'done') as ColumnView;
    const refused = await t.http().delete(`${base()}/workflow/columns/${done.id}`).set(bearer(owner)).send({});
    expectStatus(refused, 409);
    expect(refused.body.code).toBe('WORKFLOW_CATEGORY_REQUIRED');
  });

  it('migrates a deleted column’s cards, in order, taking the target’s status; or archives them', async () => {
    const staging = await addColumn('صف انتشار');
    const cards: TaskCard[] = [];
    for (let index = 0; index < 3; index += 1) {
      const task = await createTask(t, owner, workspace.id, { projectId: project.id, title: `انتشار ${index}` });
      const moved = await move(task, staging.id);
      expectStatus(moved, 200);
      cards.push(moved.body as TaskCard);
    }
    const needsDisposition = await t.http().delete(`${base()}/workflow/columns/${staging.id}`).set(bearer(owner)).send({});
    expectStatus(needsDisposition, 409);

    const done = (await getWorkflow(t, owner, workspace.id)).columns.find((column) => column.status === 'done') as ColumnView;
    const migrate = await t.http().delete(`${base()}/workflow/columns/${staging.id}`).set(bearer(owner)).send({ disposition: { kind: 'migrate', targetColumnId: done.id } });
    expectStatus(migrate, 204);
    const after = inColumn(await board(), done.id);
    const migrated = after.filter((task) => cards.some((card) => card.id === task.id));
    expect(migrated.map((task) => task.id)).toEqual(cards.map((card) => card.id));
    for (const task of migrated) expect(task).toMatchObject({ status: 'done', completedAt: expect.any(String) });
    const event = (await outboxEvents(t, 'board.column.removed')).find((entry) => entry.payload.columnId === staging.id);
    expect(event?.payload).toMatchObject({ columnId: staging.id, disposition: 'migrate', targetColumnId: done.id, taskIds: cards.map((card) => card.id) });

    const shelf = await addColumn('بایگانی موقت');
    const shelved = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'بایگانی شود', columnId: shelf.id });
    expectStatus(await t.http().delete(`${base()}/workflow/columns/${shelf.id}`).set(bearer(owner)).send({ disposition: { kind: 'archive' } }), 204);
    expect((await board()).tasks.map((task) => task.id)).not.toContain(shelved.id);
    const archived = await t.http().get(`${base()}/tasks/${shelved.id}`).set(bearer(owner));
    expect(archived.body).toMatchObject({ archived: true });
  });

  it('gives 20 parallel moves into one column a consistent, gapless order', async () => {
    const target = await addColumn('موازی');
    const tasks = await Promise.all(Array.from({ length: 20 }, (_, index) => createTask(t, owner, workspace.id, { projectId: project.id, title: `موازی ${index}` })));
    const anchor = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'لنگر', columnId: target.id });
    // Half append at the end, half squeeze in right after the same anchor card.
    const responses = await Promise.all(tasks.map((task, index) => move(task, target.id, index % 2 === 0 ? {} : { afterId: anchor.id })));
    for (const response of responses) expectStatus(response, 200);
    const cards = inColumn(await board(), target.id);
    expect(cards).toHaveLength(21);
    expect(new Set(cards.map((card) => card.position)).size).toBe(21);
    expect(new Set(cards.map((card) => card.id))).toEqual(new Set([anchor.id, ...tasks.map((task) => task.id)]));
    // Everything placed "after the anchor" sits between the anchor and the appended cards.
    const anchorIndex = cards.findIndex((card) => card.id === anchor.id);
    const squeezed = new Set(tasks.filter((_, index) => index % 2 === 1).map((task) => task.id));
    expect(cards.slice(anchorIndex + 1, anchorIndex + 1 + squeezed.size).every((card) => squeezed.has(card.id))).toBe(true);
  });

  it('refuses a stale version with 412 and the current card', async () => {
    const task = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'نسخه' });
    const inProgress = (await getWorkflow(t, owner, workspace.id)).columns.find((column) => column.status === 'in-progress') as ColumnView;
    const moved = await move(task, inProgress.id);
    expectStatus(moved, 200);
    expect((await outboxEvents(t, 'task.moved', task.id)).map((event) => event.payload)).toEqual([
      { taskId: task.id, projectId: project.id, fromColumnId: task.columnId, toColumnId: inProgress.id, position: moved.body.position, version: task.version + 1 },
    ]);
    const stale = await move(task, inProgress.id);
    expectStatus(stale, 412);
    expect(stale.body.current).toMatchObject({ id: task.id, version: task.version + 1, columnId: inProgress.id });
    expect(stale.headers.etag).toBe(`"${task.version + 1}"`);
    const patch = await t.http().patch(`${base()}/tasks/${task.id}`).set(bearer(owner)).set('If-Match', `"${task.version}"`).send({ title: 'قدیمی' });
    expectStatus(patch, 412);
    const missing = await t.http().patch(`${base()}/tasks/${task.id}`).set(bearer(owner)).send({ title: 'بی‌نسخه' });
    expectStatus(missing, 428);
  });

  it('answers 409 COLUMN_GONE to a move into a column deleted meanwhile, and never strands a card', async () => {
    const doomed = await addColumn('رو به حذف');
    const refuge = (await getWorkflow(t, owner, workspace.id)).columns.find((column) => column.status === 'todo') as ColumnView;
    const tasks = await Promise.all(Array.from({ length: 8 }, (_, index) => createTask(t, owner, workspace.id, { projectId: project.id, title: `هم‌زمان ${index}` })));
    const [removal, ...moves] = await Promise.all([
      t.http().delete(`${base()}/workflow/columns/${doomed.id}`).set(bearer(owner)).send({ disposition: { kind: 'migrate', targetColumnId: refuge.id } }),
      ...tasks.map((task) => move(task, doomed.id)),
    ]);
    expectStatus(removal as Awaited<ReturnType<typeof move>>, 204);
    for (const response of moves) expect([200, 409]).toContain(response.status);
    for (const response of moves.filter((entry) => entry.status === 409)) expect(response.body.code).toBe('COLUMN_GONE');
    const { rows } = await t.admin.query('select count(*)::int as n from tasks where column_id = $1 and deleted_at is null and archived_at is null', [doomed.id]);
    expect(rows[0].n).toBe(0);
    const late = await move(tasks[0] as TaskCard, doomed.id);
    expect([409, 412]).toContain(late.status);
  });

  it('completes a card into the first done column and reopens it where it was', async () => {
    const review = (await getWorkflow(t, owner, workspace.id)).columns.find((column) => column.status === 'review') as ColumnView;
    const task = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'تیک', columnId: review.id });
    const done = await t.http().post(`${base()}/tasks/${task.id}/complete`).set(bearer(owner)).send({ completed: true });
    expectStatus(done, 200);
    expect(done.body).toMatchObject({ status: 'done', completedAt: expect.any(String) });
    const reopened = await t.http().post(`${base()}/tasks/${task.id}/complete`).set(bearer(owner)).send({ completed: false });
    expectStatus(reopened, 200);
    expect(reopened.body).toMatchObject({ status: 'review', columnId: review.id, completedAt: null });
    expect((await outboxEvents(t, 'task.status_changed', task.id)).map((event) => [event.payload.from, event.payload.to])).toEqual([
      ['review', 'done'],
      ['done', 'review'],
    ]);
  });

  it('reopens into the first to-do column when the remembered column is gone', async () => {
    const temporary = await addColumn('گذرا');
    const task = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'بی‌خانمان', columnId: temporary.id });
    expectStatus(await t.http().post(`${base()}/tasks/${task.id}/complete`).set(bearer(owner)).send({ completed: true }), 200);
    expectStatus(await t.http().delete(`${base()}/workflow/columns/${temporary.id}`).set(bearer(owner)).send({}), 204);
    const reopened = await t.http().post(`${base()}/tasks/${task.id}/complete`).set(bearer(owner)).send({ completed: false });
    expectStatus(reopened, 200);
    expect(reopened.body.status).toBe('todo');
  });

  it('rewrites a column’s keys once they grow past 50 characters, keeping the order', async () => {
    const column = await addColumn('فشرده');
    const first = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'اول', columnId: column.id });
    const last = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'آخر', columnId: column.id });
    // Two neighbours whose keys leave no short key between them.
    await t.admin.query('update tasks set position = $2 where id = $1', [first.id, `a0${'V'.repeat(50)}`]);
    await t.admin.query('update tasks set position = $2 where id = $1', [last.id, `a0${'V'.repeat(49)}W`]);
    const mover = await createTask(t, owner, workspace.id, { projectId: project.id, title: 'میانه' });
    const moved = await move(mover, column.id, { afterId: first.id, beforeId: last.id });
    expectStatus(moved, 200);
    const cards = inColumn(await board(), column.id);
    expect(cards.map((card) => card.id)).toEqual([first.id, mover.id, last.id]);
    for (const card of cards) expect(card.position.length).toBeLessThanOrEqual(4);
  });
});
