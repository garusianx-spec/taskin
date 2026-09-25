import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue, type ConnectionOptions } from 'bullmq';
import { AppConfig } from '../../config/app-config.js';
import type { OutboxEventMap } from '../outbox/outbox-writer.js';

/** Job names and payloads, per queue. */
export interface NotificationJobs {
  'sms.send': OutboxEventMap['notification.sms'];
  'mail.send': OutboxEventMap['notification.email'];
}

export type MaintenanceJob = 'audit.partitions' | 'workspace.purge' | 'cleanup';

/** Correlation carried from the request (or outbox row) that caused a job. */
export interface JobHeaders {
  readonly requestId?: string;
  readonly traceId?: string;
  readonly eventId?: number;
}

export interface NotificationJobData<N extends keyof NotificationJobs = keyof NotificationJobs> {
  readonly headers: JobHeaders;
  readonly payload: NotificationJobs[N];
}

export const QUEUE_NAMES = { notifications: 'notifications', maintenance: 'maintenance' } as const;

/** BullMQ on `redis-core`. Blocking worker connections need `maxRetriesPerRequest: null`. */
export function queueConnection(config: AppConfig): ConnectionOptions {
  return { url: config.env.REDIS_CORE_URL, maxRetriesPerRequest: null, enableOfflineQueue: true };
}

export function queuePrefix(config: AppConfig): string {
  return `${config.redisPrefix}:bull`;
}

@Injectable()
export class Queues implements OnModuleDestroy {
  readonly notifications: Queue<NotificationJobData, void, keyof NotificationJobs>;
  readonly maintenance: Queue<Record<string, never>, unknown, string>;

  constructor(config: AppConfig) {
    const options = {
      connection: queueConnection(config),
      prefix: queuePrefix(config),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential' as const, delay: 2_000 },
        removeOnComplete: { age: 24 * 3600, count: 5_000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    };
    this.notifications = new Queue(QUEUE_NAMES.notifications, options);
    this.maintenance = new Queue(QUEUE_NAMES.maintenance, options);
    this.notifications.on('error', () => undefined);
    this.maintenance.on('error', () => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.notifications.close(), this.maintenance.close()]);
  }
}
