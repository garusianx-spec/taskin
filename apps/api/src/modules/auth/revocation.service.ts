import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AppConfig } from '../../config/app-config.js';
import { Database } from '../../platform/db/database.js';
import { authSessions, users } from '../../platform/db/schema/all.js';
import { RedisClients } from '../../platform/redis/redis.js';

export interface UserStanding {
  readonly securityVersion: number;
  readonly active: boolean;
}

const STANDING_TTL_SECONDS = 300;

/**
 * The per-request checks behind every access token: is its session revoked, and does its
 * security version still match the user's? Both are answered from redis-core, with the
 * database as the fallback when Redis cannot answer, so a Redis outage never lets a revoked
 * token through.
 */
@Injectable()
export class RevocationService {
  private readonly logger = new Logger('RevocationService');

  constructor(
    private readonly config: AppConfig,
    private readonly redis: RedisClients,
    private readonly database: Database,
  ) {}

  /** Revoked session ids live in Redis for as long as any access token for them can be valid. */
  async markRevoked(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) return;
    const ttl = this.config.env.ACCESS_TOKEN_TTL_SECONDS + 120;
    const pipeline = this.redis.core.pipeline();
    for (const id of sessionIds) pipeline.set(this.redis.key('revoked', 'sid', id), '1', 'EX', ttl);
    await pipeline.exec();
  }

  async isRevoked(sessionId: string): Promise<boolean> {
    try {
      if ((await this.redis.core.exists(this.redis.key('revoked', 'sid', sessionId))) === 1) return true;
    } catch (error) {
      this.logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'revocation cache unavailable; asking the database');
      const [row] = await this.database.db
        .select({ revokedAt: authSessions.revokedAt })
        .from(authSessions)
        .where(eq(authSessions.id, sessionId));
      return !row || row.revokedAt !== null;
    }
    return false;
  }

  async standing(userId: string): Promise<UserStanding> {
    const key = this.redis.key('user', 'standing', userId);
    try {
      const cached = await this.redis.core.get(key);
      if (cached) return JSON.parse(cached) as UserStanding;
    } catch {
      // Fall through to the database.
    }
    const [row] = await this.database.db
      .select({ securityVersion: users.securityVersion, status: users.status, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId));
    const standing: UserStanding = {
      securityVersion: row?.securityVersion ?? -1,
      active: row?.status === 'active' && row.deletedAt === null,
    };
    await this.redis.core.set(key, JSON.stringify(standing), 'EX', STANDING_TTL_SECONDS).catch(() => undefined);
    return standing;
  }

  /** Call after committing a change to a user's security version or status. */
  async forgetStanding(userId: string): Promise<void> {
    await this.redis.core.del(this.redis.key('user', 'standing', userId));
  }
}
