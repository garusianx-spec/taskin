import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { and, asc, inArray, isNull, lt, sql } from 'drizzle-orm';
import pg from 'pg';
import { AppConfig } from '../../config/app-config.js';
import { Database } from '../db/database.js';
import { outboxEvents } from '../db/schema/all.js';
import { type JobHeaders, type NotificationJobs, Queues } from '../queue/queues.js';
import type { OutboxEventMap, OutboxEventType } from './outbox-writer.js';

type OutboxRow = typeof outboxEvents.$inferSelect;

interface Publication {
  readonly name: keyof NotificationJobs;
  readonly payload: NotificationJobs[keyof NotificationJobs];
}

/** What each event turns into. Events without work (yet) are simply marked published. */
function publicationsFor(row: OutboxRow): readonly Publication[] {
  const type = row.eventType as OutboxEventType;
  switch (type) {
    case 'notification.sms':
      return [{ name: 'sms.send', payload: row.payload as unknown as OutboxEventMap['notification.sms'] }];
    case 'notification.email':
      return [{ name: 'mail.send', payload: row.payload as unknown as OutboxEventMap['notification.email'] }];
    // Realtime fan-out for these arrives with the Socket.IO gateway (M3).
    case 'workspace.created':
    case 'workspace.deleted':
    case 'workspace.purged':
    case 'member.joined':
    case 'member.removed':
    case 'rbac.changed':
    case 'session.revoked':
      return [];
    default:
      return [];
  }
}

const BATCH = 200;
const POLL_MS = 2_000;
const CAMPAIGN_RETRY_MS = 5_000;

/**
 * Publishes committed outbox rows, oldest first, exactly one relay at a time. Leadership is a
 * session advisory lock on a direct connection (not through PgBouncer, which cannot hold session
 * state), which also carries LISTEN for instant wake-ups; a slow poll covers a missed notify.
 *
 * Delivery is at-least-once: a crash between publishing and stamping `published_at` republishes
 * the batch, and BullMQ drops the duplicates because every job id is derived from the event id.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('OutboxRelay');
  private stopped = false;
  private leaderClient?: pg.Client;
  private draining?: Promise<void>;
  private again = false;
  private poll?: NodeJS.Timeout;
  private releaseLeadership?: () => void;

  constructor(
    private readonly config: AppConfig,
    private readonly database: Database,
    private readonly queues: Queues,
  ) {}

  get isLeader(): boolean {
    return this.leaderClient !== undefined;
  }

  onApplicationBootstrap(): void {
    if (!this.config.env.OUTBOX_RELAY_ENABLED) return;
    void this.campaign();
    this.poll = setInterval(() => this.kick(), POLL_MS);
    this.poll.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.poll) clearInterval(this.poll);
    this.releaseLeadership?.();
    await this.draining;
    await this.leaderClient?.end().catch(() => undefined);
  }

  /** Publishes everything unpublished right now. Returns how many events it handled. */
  async drainOnce(): Promise<number> {
    const rows = await this.database.db
      .select()
      .from(outboxEvents)
      .where(isNull(outboxEvents.publishedAt))
      .orderBy(asc(outboxEvents.id))
      .limit(BATCH);
    if (rows.length === 0) return 0;

    const jobs = rows.flatMap((row) =>
      publicationsFor(row).map((publication) => ({
        name: publication.name,
        data: {
          headers: { requestId: row.headers.requestId, traceId: row.headers.traceId, eventId: row.id } satisfies JobHeaders,
          payload: publication.payload,
        },
        opts: { jobId: `evt-${row.id}-${publication.name}` },
      })),
    );
    if (jobs.length > 0) await this.queues.notifications.addBulk(jobs);

    await this.database.db
      .update(outboxEvents)
      .set({ publishedAt: sql`now()` })
      .where(inArray(outboxEvents.id, rows.map((row) => row.id)));
    return rows.length;
  }

  /** Seconds the oldest unpublished event has waited: the lag metric the RFC alerts on. */
  async lagSeconds(): Promise<number> {
    const [row] = await this.database.db
      .select({ lag: sql<number>`coalesce(extract(epoch from now() - min(${outboxEvents.createdAt})), 0)::float8` })
      .from(outboxEvents)
      .where(isNull(outboxEvents.publishedAt));
    return row?.lag ?? 0;
  }

  /** Deletes rows published more than `days` ago. */
  async purgePublished(days = 7): Promise<number> {
    const deleted = await this.database.db
      .delete(outboxEvents)
      .where(and(lt(outboxEvents.publishedAt, sql`now() - make_interval(days => ${days})`)))
      .returning({ id: outboxEvents.id });
    return deleted.length;
  }

  private kick(): void {
    if (!this.isLeader || this.stopped) return;
    if (this.draining) {
      this.again = true;
      return;
    }
    this.draining = (async () => {
      try {
        do {
          this.again = false;
          while ((await this.drainOnce()) === BATCH && !this.stopped);
        } while (this.again && !this.stopped);
      } catch (error) {
        this.logger.error({ error: error instanceof Error ? error.message : String(error) }, 'outbox drain failed');
      } finally {
        this.draining = undefined;
      }
    })();
  }

  private async campaign(): Promise<void> {
    while (!this.stopped) {
      const client = new pg.Client({
        connectionString: this.config.env.DATABASE_DIRECT_URL ?? this.config.env.DATABASE_URL,
        application_name: 'taskin-outbox-relay',
      });
      try {
        await client.connect();
        const lock = await client.query<{ ok: boolean }>(
          `select pg_try_advisory_lock(hashtextextended('taskin:outbox-relay', 0)) as ok`,
        );
        if (!lock.rows[0]?.ok) {
          await client.end();
          await sleep(CAMPAIGN_RETRY_MS);
          continue;
        }
        const lost = new Promise<void>((resolve) => {
          this.releaseLeadership = resolve;
          client.once('error', () => resolve());
          client.once('end', () => resolve());
        });
        client.on('notification', () => this.kick());
        await client.query('LISTEN outbox');
        this.leaderClient = client;
        this.logger.log('outbox relay is the leader');
        this.kick();
        await lost;
      } catch (error) {
        this.logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'outbox relay campaign failed');
      } finally {
        this.leaderClient = undefined;
        await client.end().catch(() => undefined);
      }
      if (!this.stopped) await sleep(CAMPAIGN_RETRY_MS);
    }
  }
}
