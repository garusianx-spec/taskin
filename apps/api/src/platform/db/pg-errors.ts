/**
 * PostgreSQL errors reach us wrapped (drizzle's DrizzleQueryError keeps the driver error in
 * `cause`). These helpers dig out the SQLSTATE without ever touching the wrapper's message,
 * which embeds the query parameters and must not be logged.
 */

export interface PgErrorInfo {
  readonly code: string;
  readonly constraint?: string;
  readonly hint?: string;
}

export function pgError(error: unknown): PgErrorInfo | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === 'object' && current !== null) {
      const candidate = current as { code?: unknown; constraint?: unknown; hint?: unknown; cause?: unknown; severity?: unknown };
      if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code) && 'severity' in candidate) {
        return {
          code: candidate.code,
          constraint: typeof candidate.constraint === 'string' ? candidate.constraint : undefined,
          hint: typeof candidate.hint === 'string' ? candidate.hint : undefined,
        };
      }
      current = candidate.cause;
    } else {
      return undefined;
    }
  }
  return undefined;
}

export const PG = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  /** ON DELETE RESTRICT raises this, not 23503. */
  restrictViolation: '23001',
  checkViolation: '23514',
  notNullViolation: '23502',
  serializationFailure: '40001',
  deadlockDetected: '40P01',
  lockNotAvailable: '55P03',
  insufficientPrivilege: '42501',
  /** Raised by the locked-role triggers. */
  ownerImmutable: 'TK001',
} as const;

/** Failures a fresh attempt of the same transaction can succeed at. */
export function isRetryable(error: unknown): boolean {
  const code = pgError(error)?.code;
  return code === PG.serializationFailure || code === PG.deadlockDetected || code === PG.lockNotAvailable;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const info = pgError(error);
  return info?.code === PG.uniqueViolation && (constraint === undefined || info.constraint === constraint);
}
