import { AbilityBuilder, createMongoAbility, type ForcedSubject, type MongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import {
  PERMISSION_ACTION_IDS,
  PERMISSION_MODULE_IDS,
  type PermissionActionId,
  type PermissionModuleId,
  type RolePermissions,
  rowFromCells,
} from '@taskin/contracts';
import type { MembershipContext } from '../../platform/http/request.js';

/**
 * Workspace-scope authorisation (RFC §5.3). Each module of the permission matrix governs a set
 * of CASL subjects; a granted cell `module:action` becomes `can(action, subject)` for each of
 * them. Project and channel overlays arrive with those modules (M2, M3).
 */
export const MODULE_SUBJECTS = {
  messages: ['Conversation', 'Message', 'Reaction'],
  boards: ['Project', 'BoardColumn', 'Task', 'Subtask', 'TaskComment', 'CalendarEvent'],
  files: ['File'],
  reports: ['Report'],
  members: ['Member', 'Invitation', 'Role', 'WorkspaceSettings', 'Department'],
} as const satisfies Record<PermissionModuleId, readonly string[]>;

export type SubjectName = (typeof MODULE_SUBJECTS)[PermissionModuleId][number] | 'Workspace' | 'all';
export type Action = PermissionActionId | 'manage';

/** Condition fields the rules use; CASL matches them against plain objects tagged with `subject()`. */
export interface MemberSubject {
  readonly userId: string;
}

export type AppSubject = SubjectName | (MemberSubject & ForcedSubject<'Member'>);
export type AppAbility = MongoAbility<[Action, AppSubject]>;

export const cell = (module: PermissionModuleId, action: PermissionActionId) => `${module}:${action}`;

/** Every cell, as the owner holds them. */
export const ALL_CELLS: readonly string[] = PERMISSION_MODULE_IDS.flatMap((module) =>
  PERMISSION_ACTION_IDS.map((action) => cell(module, action)),
);

/** A member's grants as a matrix row, for `GET /me/permissions` and the RBAC screen. */
export function grantsToRow(grants: readonly string[]): RolePermissions {
  return rowFromCells(
    grants.map((entry) => {
      const [module, action] = entry.split(':') as [PermissionModuleId, PermissionActionId];
      return { module, action };
    }),
  );
}

@Injectable()
export class AbilityFactory {
  forMember(member: MembershipContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    // Membership alone lets you see the workspace you belong to.
    can('view', 'Workspace');
    if (member.isOwner) {
      can('manage', 'all');
      // Ownership must be transferred before the owner can leave or be removed.
      cannot('delete', 'Member', { userId: member.userId });
      return build();
    }
    for (const entry of member.grants) {
      const [module, action] = entry.split(':') as [PermissionModuleId, PermissionActionId];
      const subjects = MODULE_SUBJECTS[module];
      if (!subjects) continue;
      for (const subject of subjects) can(action, subject);
    }
    return build();
  }
}
