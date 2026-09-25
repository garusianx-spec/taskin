import { pgEnum } from 'drizzle-orm/pg-core';
import { PERMISSION_ACTION_IDS, PERMISSION_MODULE_IDS } from '@taskin/contracts';

/** Enum literals match `@taskin/contracts` exactly, so rows map to API types without translation. */

export const userStatus = pgEnum('user_status', ['active', 'suspended', 'deleted']);

export const otpPurpose = pgEnum('otp_purpose', ['login', 'step_up', 'phone_change']);

export const sessionRevokeReason = pgEnum('session_revoke_reason', [
  'logout',
  'user_revoked',
  'reuse_detected',
  'password_changed',
  'admin_action',
  'expired',
  'workspace_removed',
]);

export const memberStatus = pgEnum('member_status', ['active', 'suspended', 'left']);

/** `offline` is derived from socket connectivity and never stored. */
export const presenceStatus = pgEnum('presence_status', ['online', 'busy', 'away']);

export const avatarTone = pgEnum('avatar_tone', ['brand', 'teal', 'violet', 'amber', 'rose', 'slate']);

export const invitationChannel = pgEnum('invitation_channel', ['email', 'sms']);

export const invitationStatus = pgEnum('invitation_status', ['pending', 'accepted', 'revoked', 'expired']);

export const permissionModule = pgEnum('permission_module', PERMISSION_MODULE_IDS);

export const permissionAction = pgEnum('permission_action', PERMISSION_ACTION_IDS);
