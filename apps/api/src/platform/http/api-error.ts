import { HttpException } from '@nestjs/common';
import type { ApiErrorCode, FieldError } from '@taskin/contracts';

/** HTTP status and a short English title for every error code (the client localises by code). */
export const ERROR_CATALOGUE: Readonly<Record<ApiErrorCode, { readonly status: number; readonly title: string }>> = {
  VALIDATION_FAILED: { status: 400, title: 'The request is not valid' },
  NOT_FOUND: { status: 404, title: 'Not found' },
  CONFLICT: { status: 409, title: 'Conflicts with the current state' },
  PRECONDITION_FAILED: { status: 412, title: 'The resource changed since you read it' },
  PRECONDITION_REQUIRED: { status: 428, title: 'This request needs If-Match' },
  RATE_LIMITED: { status: 429, title: 'Too many requests' },
  INTERNAL: { status: 500, title: 'Something went wrong' },
  SERVICE_UNAVAILABLE: { status: 503, title: 'Temporarily unavailable' },
  UNAUTHENTICATED: { status: 401, title: 'Sign in first' },
  AUTH_EXPIRED: { status: 401, title: 'The access token expired' },
  AUTH_INVALID: { status: 401, title: 'The access token is not valid' },
  SESSION_REVOKED: { status: 401, title: 'This session was signed out' },
  STEP_UP_REQUIRED: { status: 401, title: 'Confirm your password to continue' },
  CSRF_FAILED: { status: 403, title: 'The request did not come from the Taskin app' },
  OTP_INVALID: { status: 400, title: 'The code is not correct' },
  OTP_EXPIRED: { status: 400, title: 'The code expired' },
  OTP_ATTEMPTS_EXCEEDED: { status: 429, title: 'Too many wrong codes' },
  SIGNUP_TOKEN_INVALID: { status: 400, title: 'Verify your phone number again' },
  SMS_UNAVAILABLE: { status: 503, title: 'SMS delivery is unavailable' },
  PASSWORD_REQUIRED: { status: 409, title: 'Set a password first' },
  PASSWORD_INVALID: { status: 401, title: 'The password is not correct' },
  PASSWORD_TOO_WEAK: { status: 400, title: 'The password is too weak' },
  ACCOUNT_LOCKED: { status: 423, title: 'Too many wrong passwords' },
  REFRESH_INVALID: { status: 401, title: 'Sign in again' },
  FORBIDDEN: { status: 403, title: 'Not allowed' },
  OWNER_IMMUTABLE: { status: 403, title: 'The owner cannot be changed this way' },
  ROLE_RANK_VIOLATION: { status: 403, title: 'You can only manage roles below your own' },
  PRIVILEGE_ESCALATION: { status: 403, title: 'You cannot grant a permission you do not hold' },
  IDEMPOTENCY_KEY_REQUIRED: { status: 428, title: 'This request needs an Idempotency-Key' },
  IDEMPOTENCY_KEY_REUSED: { status: 422, title: 'The Idempotency-Key was used for a different request' },
  IDEMPOTENCY_IN_PROGRESS: { status: 409, title: 'The same request is still being processed' },
  WORKSPACE_NAME_MISMATCH: { status: 422, title: 'The name does not match' },
  PLAN_LIMIT_REACHED: { status: 402, title: 'The plan limit is reached' },
  INVITATION_INVALID: { status: 410, title: 'The invitation is no longer valid' },
  INVITATION_ADDRESS_MISMATCH: { status: 403, title: 'The invitation was sent to another number' },
  ALREADY_MEMBER: { status: 409, title: 'Already a member' },
  UPLOAD_INVALID: { status: 422, title: 'The uploaded file is not acceptable' },
  DEPARTMENT_IN_USE: { status: 409, title: 'The department still has members or invitations' },
};

/**
 * The one exception type domain code throws. The problem filter renders it as RFC 9457
 * `application/problem+json` with the request id attached.
 */
export class ApiError extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    readonly detail?: string,
    readonly fieldErrors?: readonly FieldError[],
    /** Extra response headers, e.g. `Retry-After`. */
    readonly headers?: Readonly<Record<string, string>>,
  ) {
    super(detail ?? ERROR_CATALOGUE[code].title, ERROR_CATALOGUE[code].status);
    this.name = 'ApiError';
  }

  static validation(fieldErrors: readonly FieldError[], detail = 'Some fields are not valid.'): ApiError {
    return new ApiError('VALIDATION_FAILED', detail, fieldErrors);
  }

  static notFound(what = 'The resource'): ApiError {
    return new ApiError('NOT_FOUND', `${what} was not found.`);
  }

  static forbidden(detail?: string): ApiError {
    return new ApiError('FORBIDDEN', detail);
  }

  static rateLimited(retryAfterSeconds: number, detail?: string): ApiError {
    return new ApiError('RATE_LIMITED', detail, undefined, { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) });
  }
}
