import { DEFAULT_PERMISSION_MATRIX, grantedCells, type RoleId, SYSTEM_ROLES } from '@taskin/contracts';
import type { Tx } from '../../platform/db/database.js';
import { departments, rolePermissions, roles } from '../../platform/db/schema/all.js';

/** The departments a new workspace starts with (the web app's defaults). */
export const DEFAULT_DEPARTMENTS: readonly string[] = [
  'مهندسی و توسعه',
  'محصول',
  'طراحی تجربه کاربری',
  'بازاریابی',
  'مالی و اداری',
  'عملیات و پشتیبانی',
];

/**
 * Seeds a new workspace's five system roles with the default matrix, and its departments.
 * The owner role gets no permission rows: it holds everything implicitly and is locked.
 * Returns role ids by key.
 */
export async function seedWorkspace(tx: Tx, workspaceId: string): Promise<Record<RoleId, string>> {
  const inserted = await tx
    .insert(roles)
    .values(SYSTEM_ROLES.map((role) => ({ workspaceId, key: role.id, rank: role.rank, isSystem: true, isLocked: role.locked })))
    .returning({ id: roles.id, key: roles.key });
  const ids = Object.fromEntries(inserted.map((row) => [row.key, row.id])) as Record<RoleId, string>;

  const grants = SYSTEM_ROLES.filter((role) => !role.locked).flatMap((role) =>
    grantedCells(DEFAULT_PERMISSION_MATRIX[role.id]).map(({ module, action }) => ({ workspaceId, roleId: ids[role.id], module, action })),
  );
  if (grants.length > 0) await tx.insert(rolePermissions).values(grants);

  await tx.insert(departments).values(DEFAULT_DEPARTMENTS.map((name, position) => ({ workspaceId, name, position })));
  return ids;
}
