import { Injectable } from '@nestjs/common';
import { RequestContext } from '../context/request-context.js';
import type { Tx } from '../db/database.js';
import { outboxEvents } from '../db/schema/all.js';

/** Every event type the outbox carries, with its payload. Consumers switch on `type`. */
export interface OutboxEventMap {
  /** An SMS the worker must send (invitation link, security alert). */
  'notification.sms': {
    readonly to: string;
    readonly template: 'invite' | 'alert';
    /** Template tokens; values marked sealed are SecretBox-encrypted until the worker sends. */
    readonly tokens: Readonly<Record<string, string>>;
    readonly sealed?: readonly string[];
  };
  /** An email the worker must send. */
  'notification.email': {
    readonly to: string;
    readonly template: 'invite';
    readonly params: Readonly<Record<string, string>>;
    readonly sealed?: readonly string[];
  };
  'workspace.created': { readonly workspaceId: string; readonly ownerId: string };
  'workspace.deleted': { readonly workspaceId: string; readonly purgeAfter: string };
  'workspace.purged': { readonly workspaceId: string };
  'member.joined': { readonly workspaceId: string; readonly userId: string };
  'member.removed': { readonly workspaceId: string; readonly userId: string };
  'rbac.changed': { readonly workspaceId: string; readonly userIds?: readonly string[] };
  'session.revoked': { readonly userId: string; readonly sessionIds: readonly string[]; readonly reason: string };
}

export type OutboxEventType = keyof OutboxEventMap;

export interface OutboxEvent<T extends OutboxEventType = OutboxEventType> {
  readonly type: T;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly workspaceId?: string | null;
  readonly payload: OutboxEventMap[T];
}

/**
 * Records domain events in the caller's transaction. They become visible to the relay only when
 * that transaction commits, and nothing is sent if it rolls back.
 */
@Injectable()
export class OutboxWriter {
  constructor(private readonly context: RequestContext) {}

  async add<T extends OutboxEventType>(tx: Tx, ...events: readonly OutboxEvent<T>[]): Promise<void> {
    if (events.length === 0) return;
    const headers: Record<string, string> = {};
    if (this.context.requestId) headers.requestId = this.context.requestId;
    if (this.context.traceId) headers.traceId = this.context.traceId;
    if (this.context.traceparent) headers.traceparent = this.context.traceparent;
    if (this.context.userId) headers.actorId = this.context.userId;
    await tx.insert(outboxEvents).values(
      events.map((event) => ({
        workspaceId: event.workspaceId ?? null,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.type,
        payload: event.payload as unknown as Record<string, unknown>,
        headers,
      })),
    );
  }
}
