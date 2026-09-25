import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import type { Test } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthSession, OtpVerifyResult, RoleView, UploadTicket } from '@taskin/contracts';
import { OPENAPI_FILE } from '../../src/openapi.js';
import {
  bearer,
  createTestApp,
  idempotencyKey,
  invite,
  lastCode,
  localForm,
  ownerWithWorkspace,
  randomIp,
  randomPhone,
  refreshCookies,
  type Session,
  signIn,
  sqlCount,
  STRONG_PASSWORD,
  type TestApp,
  withAdminPassword,
} from './harness.js';

interface Call {
  readonly template: string;
  readonly requestId: string;
  readonly traceId: string;
}

const ORIGIN = 'https://app.taskin.test';

describe('M1 checklist: audit trail and correlation', () => {
  let t: TestApp;
  const calls: Call[] = [];

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t?.close();
  });

  /** Sends one request with a fresh request id and trace, and records which route it exercised. */
  async function traced(method: 'post' | 'put' | 'patch' | 'delete', template: string, path: string, setup: (request: Test) => Test = (r) => r) {
    const requestId = `req-${randomBytes(6).toString('hex')}`;
    const traceId = randomBytes(16).toString('hex');
    const request = t
      .http()
      .set('X-Forwarded-For', randomIp())
      [method](path)
      .set('X-Request-Id', requestId)
      .set('traceparent', `00-${traceId}-${randomBytes(8).toString('hex')}-01`);
    const response = await setup(request);
    expect(response.status, `${method.toUpperCase()} ${path}: ${JSON.stringify(response.body)}`).toBeLessThan(300);
    expect(response.headers['x-request-id']).toBe(requestId);
    calls.push({ template: `${method.toUpperCase()} ${template}`, requestId, traceId });
    return response;
  }

  it('writes an audit row, with request id and trace id, for every mutating route', async () => {
    // Auth: sign-up through the OTP flow, then every other auth mutation.
    const phone = randomPhone();
    const challenge = await traced('post', '/api/v1/auth/otp/request', '/api/v1/auth/otp/request', (r) => r.send({ phone: localForm(phone) }));
    const verify = await traced('post', '/api/v1/auth/otp/verify', '/api/v1/auth/otp/verify', (r) =>
      r.send({ challengeId: challenge.body.challengeId, code: lastCode(t, phone) }),
    );
    const signup = await traced('post', '/api/v1/auth/signup', '/api/v1/auth/signup', (r) =>
      r.send({ signupToken: (verify.body as Extract<OtpVerifyResult, { status: 'signup_required' }>).signupToken, fullName: 'سارا کاظمی' }),
    );
    let user: Session = {
      userId: (signup.body as AuthSession).user.id,
      phone,
      accessToken: (signup.body as AuthSession).accessToken,
      sessionId: (signup.body as AuthSession).sessionId,
      cookies: '',
      csrf: '',
    };
    refreshCookies(user, signup.headers['set-cookie']);
    const refreshed = await traced('post', '/api/v1/auth/refresh', '/api/v1/auth/refresh', (r) =>
      r.set('Cookie', user.cookies).set('X-CSRF-Token', user.csrf).set('Origin', ORIGIN),
    );
    refreshCookies(user, refreshed.headers['set-cookie']);
    user = { ...user, accessToken: (refreshed.body as AuthSession).accessToken };
    await traced('post', '/api/v1/auth/password', '/api/v1/auth/password', (r) => r.set(bearer(user)).send({ newPassword: STRONG_PASSWORD }));
    const stepped = await traced('post', '/api/v1/auth/step-up', '/api/v1/auth/step-up', (r) => r.set(bearer(user)).send({ password: STRONG_PASSWORD }));
    user = { ...user, accessToken: (stepped.body as AuthSession).accessToken };
    await traced('patch', '/api/v1/me', '/api/v1/me', (r) => r.set(bearer(user)).send({ fullName: 'سارا کاظمی‌نژاد', email: 'sara@rahnama.ir' }));
    const extra = await signIn(t, phone);
    await traced('delete', '/api/v1/auth/sessions/{id}', `/api/v1/auth/sessions/${extra.sessionId}`, (r) => r.set(bearer(user)));
    await signIn(t, phone);
    await traced('delete', '/api/v1/auth/sessions', '/api/v1/auth/sessions?others=true', (r) => r.set(bearer(user)));

    // Workspaces.
    const created = await traced('post', '/api/v1/workspaces', '/api/v1/workspaces', (r) =>
      r.set(bearer(user)).set('Idempotency-Key', idempotencyKey()).send({ name: 'ردیابی' }),
    );
    const ws = `/api/v1/workspaces/${created.body.id}`;
    const ticket = (await traced('post', '/api/v1/uploads/workspace-icon', '/api/v1/uploads/workspace-icon', (r) => r.set(bearer(user)))).body as UploadTicket;
    expect(ticket.key).toMatch(/^tmp\/icons\//);
    await traced('patch', '/api/v1/workspaces/{workspaceId}', ws, (r) => r.set(bearer(user)).send({ description: 'برای آزمون ردیابی' }));
    await traced('patch', '/api/v1/workspaces/{workspaceId}/me/presence', `${ws}/me/presence`, (r) => r.set(bearer(user)).send({ presence: 'away' }));
    const department = await traced('post', '/api/v1/workspaces/{workspaceId}/departments', `${ws}/departments`, (r) => r.set(bearer(user)).send({ name: 'حقوقی' }));
    await traced('patch', '/api/v1/workspaces/{workspaceId}/departments/{id}', `${ws}/departments/${department.body.id}`, (r) => r.set(bearer(user)).send({ position: 9 }));
    await traced('delete', '/api/v1/workspaces/{workspaceId}/departments/{id}', `${ws}/departments/${department.body.id}`, (r) => r.set(bearer(user)));

    // Invitations: one revoked, one accepted by a new member who is then changed and removed.
    const revocable = await traced('post', '/api/v1/workspaces/{workspaceId}/invitations', `${ws}/invitations`, (r) =>
      r.set(bearer(user)).set('Idempotency-Key', idempotencyKey()).send({ recipients: [{ address: 'temp@rahnama.ir' }], role: 'member' }),
    );
    await traced('delete', '/api/v1/workspaces/{workspaceId}/invitations/{id}', `${ws}/invitations/${revocable.body.created[0].id}`, (r) => r.set(bearer(user)));
    const joinerPhone = randomPhone();
    await invite(t, user, created.body.id, [localForm(joinerPhone)]);
    await t.flushNotifications();
    const inviteSms = [...t.sms.sent].reverse().find((sms) => sms.to === joinerPhone && sms.template === 'invite');
    const token = new URL(inviteSms?.tokens.link ?? '').searchParams.get('token');
    const joiner = await withAdminPassword(t, await signIn(t, joinerPhone));
    await traced('post', '/api/v1/invitations/accept', '/api/v1/invitations/accept', (r) => r.set(bearer(joiner)).send({ token }));
    await traced('patch', '/api/v1/workspaces/{workspaceId}/members/{userId}', `${ws}/members/${joiner.userId}`, (r) => r.set(bearer(user)).send({ role: 'admin' }));

    // Roles.
    const roles = (await t.http().get(`${ws}/roles`).set(bearer(user))).body as RoleView[];
    const guest = roles.find((role) => role.key === 'guest') as RoleView;
    await traced('put', '/api/v1/workspaces/{workspaceId}/roles/{roleId}/permissions', `${ws}/roles/${guest.id}/permissions`, (r) =>
      r.set(bearer(user)).set('If-Match', `"${guest.version}"`).send({ permissions: guest.permissions }),
    );
    await traced('post', '/api/v1/workspaces/{workspaceId}/roles/reset-defaults', `${ws}/roles/reset-defaults`, (r) => r.set(bearer(user)));

    // Ownership, removal, deletion, and finally signing out.
    await traced('post', '/api/v1/workspaces/{workspaceId}/transfer-ownership', `${ws}/transfer-ownership`, (r) => r.set(bearer(user)).send({ userId: joiner.userId }));
    const newOwner = { ...joiner };
    await traced('delete', '/api/v1/workspaces/{workspaceId}/members/{userId}', `${ws}/members/${user.userId}`, (r) => r.set(bearer(newOwner)));
    await traced('delete', '/api/v1/workspaces/{workspaceId}', ws, (r) => r.set(bearer(newOwner)).send({ confirmName: 'ردیابی' }));
    await traced('post', '/api/v1/auth/logout', '/api/v1/auth/logout', (r) => r.set(bearer(user)).set('Cookie', user.cookies).set('X-CSRF-Token', user.csrf).set('Origin', ORIGIN));

    // Every mutating operation in the API was exercised…
    const document = JSON.parse(await readFile(OPENAPI_FILE, 'utf8')) as { paths: Record<string, Record<string, unknown>> };
    const mutating = Object.entries(document.paths).flatMap(([path, operations]) =>
      Object.keys(operations)
        .filter((method) => ['post', 'put', 'patch', 'delete'].includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(new Set(calls.map((call) => call.template))).toEqual(new Set(mutating));

    // …and each call left at least one audit row carrying its request id and trace id.
    const { rows } = await t.admin.query<{ request_id: string; trace_id: string; action: string }>(
      'select request_id, trace_id, action from audit_logs where request_id = any($1)',
      [calls.map((call) => call.requestId)],
    );
    for (const call of calls) {
      const audited = rows.filter((row) => row.request_id === call.requestId);
      expect({ route: call.template, audited: audited.length > 0 }).toEqual({ route: call.template, audited: true });
      for (const row of audited) expect({ route: call.template, traceId: row.trace_id }).toEqual({ route: call.template, traceId: call.traceId });
    }
  });

  it('carries the request id and trace id through every log line of a request, and into its jobs', async () => {
    const { owner, workspace } = await ownerWithWorkspace(t);
    const requestId = `corr-${randomBytes(6).toString('hex')}`;
    const traceId = randomBytes(16).toString('hex');
    const phone = randomPhone();
    const response = await t
      .http()
      .post(`/api/v1/workspaces/${workspace.id}/invitations`)
      .set(bearer(owner))
      .set('Idempotency-Key', idempotencyKey())
      .set('X-Request-Id', requestId)
      .set('traceparent', `00-${traceId}-${randomBytes(8).toString('hex')}-01`)
      .send({ recipients: [{ address: localForm(phone) }], role: 'member' });
    expect(response.status).toBe(201);
    await t.flushNotifications();

    const lines = t.logs.filter((line) => line.requestId === requestId || (line.req as { id?: string } | undefined)?.id === requestId);
    const completed = lines.find((line) => line.msg === 'request completed');
    expect(completed).toMatchObject({ traceId, userId: owner.userId, workspaceId: workspace.id });
    // The worker's SMS log line belongs to the same request and trace.
    const sent = t.logs.find((line) => line.msg === 'SMS (console driver)' && line.requestId === requestId);
    expect(sent).toMatchObject({ traceId });
    // No line writes a correlation key twice.
    for (const raw of t.rawLogs) {
      for (const key of ['requestId', 'traceId', 'userId', 'workspaceId']) {
        expect({ key, count: raw.split(`"${key}":`).length - 1 <= 1 }).toEqual({ key, count: true });
      }
    }
    // Phone numbers are masked, secrets never appear.
    const serialized = JSON.stringify(t.logs);
    expect(serialized).not.toContain(phone);
    expect(serialized).not.toContain(owner.accessToken);
  });
});

describe('M1 checklist: query budgets (no N+1)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await t?.close();
  });

  it('holds the hot read endpoints to a fixed number of statements, whatever the data size', async () => {
    const { owner, workspace } = await ownerWithWorkspace(t);
    const phones = Array.from({ length: 6 }, () => randomPhone());
    await invite(t, owner, workspace.id, phones.map(localForm));
    await t.flushNotifications();
    for (const phone of phones) {
      const member = await signIn(t, phone);
      const link = [...t.sms.sent].reverse().find((sms) => sms.to === phone && sms.template === 'invite')?.tokens.link ?? '';
      await t.http().post('/api/v1/invitations/accept').set(bearer(member)).send({ token: new URL(link).searchParams.get('token') });
    }
    const budget = async (path: string, max: number) => {
      await t.http().get(path).set(bearer(owner)); // warm the permission caches
      const response = await t.http().get(path).set(bearer(owner));
      expect(response.status).toBe(200);
      expect({ path, statements: sqlCount(response) }).toEqual({ path, statements: expect.any(Number) });
      expect(sqlCount(response), path).toBeLessThanOrEqual(max);
    };
    await budget('/api/v1/me', 3);
    await budget(`/api/v1/workspaces/${workspace.id}/members`, 2);
    await budget(`/api/v1/workspaces/${workspace.id}/roles`, 3);
    await budget(`/api/v1/workspaces/${workspace.id}/departments`, 2);
    await budget(`/api/v1/workspaces/${workspace.id}/invitations`, 2);
  });

  it('reports ready when every dependency answers', async () => {
    const response = await t.http().get('/health/ready');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body.info)).toEqual(['database', 'redisCore', 'redisRt', 'storage']);
  });
});
