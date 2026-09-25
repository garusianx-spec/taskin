import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, invite, ownerWithWorkspace, type TestApp } from './harness.js';

/** Platform tables that carry a workspace id but are read across tenants by design. */
const CROSS_TENANT_BY_DESIGN = new Set([
  // The outbox relay publishes every tenant's events in id order; the API only ever inserts.
  'outbox_events',
]);

async function asApp<T>(pool: pg.Pool, settings: { workspaceId?: string; userId?: string }, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('app.workspace_id', $1, true), set_config('app.user_id', $2, true)`, [
      settings.workspaceId ?? '',
      settings.userId ?? '',
    ]);
    const result = await work(client);
    await client.query('rollback');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

describe('M1 checklist: row-level security isolates tenants', () => {
  let t: TestApp;
  let a: { workspaceId: string };
  let b: { workspaceId: string; roleId: string };
  let tenantTables: string[];

  beforeAll(async () => {
    t = await createTestApp();
    const first = await ownerWithWorkspace(t, 'فضای الف');
    const second = await ownerWithWorkspace(t, 'فضای ب');
    // Give both tenants rows in every tenant table: invitations and audit rows included.
    await invite(t, first.owner, first.workspace.id, ['mina@alef.test']);
    await invite(t, second.owner, second.workspace.id, ['sara@beh.test']);
    a = { workspaceId: first.workspace.id };
    const { rows } = await t.admin.query<{ id: string }>(`select id from roles where workspace_id = $1 and key = 'member'`, [second.workspace.id]);
    b = { workspaceId: second.workspace.id, roleId: rows[0]?.id ?? '' };
    const tables = await t.admin.query<{ table_name: string }>(
      `select distinct c.table_name from information_schema.columns c
       join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema
       where c.table_schema = 'public' and c.column_name = 'workspace_id' and t.table_type = 'BASE TABLE'
         and c.table_name not like 'audit_logs\\_%'
       order by 1`,
    );
    tenantTables = [...tables.rows.map((row) => row.table_name), 'workspaces'].filter((name) => !CROSS_TENANT_BY_DESIGN.has(name));
  });

  afterAll(async () => {
    await t?.close();
  });

  it('forces row-level security on every tenant table', async () => {
    const { rows } = await t.admin.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname = any($1)`,
      [tenantTables],
    );
    expect(rows).toHaveLength(tenantTables.length);
    for (const row of rows) expect([row.relname, row.relrowsecurity, row.relforcerowsecurity]).toEqual([row.relname, true, true]);
    expect(tenantTables).toEqual(
      expect.arrayContaining(['audit_logs', 'departments', 'invitations', 'role_permissions', 'roles', 'workspace_members', 'workspaces']),
    );
  });

  it('shows workspace A none of workspace B’s rows, in any tenant table', async () => {
    for (const table of tenantTables) {
      const column = table === 'workspaces' ? 'id' : 'workspace_id';
      const counts = await asApp(t.appPool, { workspaceId: a.workspaceId }, async (client) => {
        const own = await client.query<{ count: string }>(`select count(*) from ${table} where ${column} = $1`, [a.workspaceId]);
        const other = await client.query<{ count: string }>(`select count(*) from ${table} where ${column} = $1`, [b.workspaceId]);
        const all = await client.query<{ count: string }>(`select count(*) from ${table} where ${column} is distinct from $1`, [a.workspaceId]);
        return { own: Number(own.rows[0]?.count), other: Number(other.rows[0]?.count), all: Number(all.rows[0]?.count) };
      });
      expect({ table, other: counts.other, foreign: counts.all }).toEqual({ table, other: 0, foreign: 0 });
      expect({ table, own: counts.own > 0 }).toEqual({ table, own: true });
    }
  });

  it('shows nothing at all without a tenant setting (fails closed)', async () => {
    for (const table of tenantTables) {
      const count = await asApp(t.appPool, {}, async (client) => Number((await client.query<{ count: string }>(`select count(*) from ${table}`)).rows[0]?.count));
      expect({ table, count }).toEqual({ table, count: 0 });
    }
    // Confirm there is data to hide.
    const { rows } = await t.admin.query<{ count: string }>('select count(*) from workspace_members');
    expect(Number(rows[0]?.count)).toBeGreaterThan(0);
  });

  it('refuses a row written into another tenant', async () => {
    await expect(
      asApp(t.appPool, { workspaceId: a.workspaceId }, (client) =>
        client.query(`insert into departments (workspace_id, name) values ($1, 'نفوذی')`, [b.workspaceId]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('refuses a cross-tenant reference through the composite foreign keys', async () => {
    // Even with RLS satisfied (the row is A's), A's member cannot point at B's role.
    await expect(
      asApp(t.appPool, { workspaceId: a.workspaceId }, (client) =>
        client.query(
          `insert into invitations (workspace_id, channel, address, role_id, token_hash, invited_by, expires_at)
           select $1, 'email', 'x@example.test', $2, sha256(gen_random_uuid()::text::bytea), owner_user_id, now() + interval '1 day' from workspaces where id = $1`,
          [a.workspaceId, b.roleId],
        ),
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('never lets the app role rewrite the audit trail', async () => {
    await expect(asApp(t.appPool, { workspaceId: a.workspaceId }, (client) => client.query(`update audit_logs set action = 'x'`))).rejects.toMatchObject({
      code: '42501',
    });
    await expect(asApp(t.appPool, { workspaceId: a.workspaceId }, (client) => client.query(`delete from audit_logs`))).rejects.toMatchObject({
      code: '42501',
    });
    await expect(asApp(t.appPool, {}, (client) => client.query(`delete from audit_logs_default`))).rejects.toMatchObject({ code: '42501' });
  });
});
