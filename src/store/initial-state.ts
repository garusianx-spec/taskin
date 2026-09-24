import type { WorkspaceState } from './workspace-reducer';
import {
  CALENDAR_EVENTS,
  CONVERSATIONS,
  CURRENT_USER,
  INVITATIONS,
  LOGIN_SESSIONS,
  MESSAGES,
  NOTES,
  NOTIFICATIONS,
  PASSWORD_CHANGED_AT,
  TASKS,
} from '@/data/workspace';
import { BUILT_IN_COLUMNS, DEFAULT_PERMISSION_MATRIX } from '@/data/reference';

/**
 * The state a fresh session starts from. Kept apart from the provider so the reducer can
 * return to it on sign-out without importing React.
 */
export const INITIAL_WORKSPACE_STATE: WorkspaceState = {
  session: 'active',
  tasks: TASKS,
  boardColumns: BUILT_IN_COLUMNS,
  conversations: CONVERSATIONS,
  messages: MESSAGES,
  calendarEvents: CALENDAR_EVENTS,
  calendarFocusDate: null,
  notes: NOTES,
  notifications: NOTIFICATIONS,
  invitations: INVITATIONS,
  loginSessions: LOGIN_SESSIONS,
  twoFactorEnabled: false,
  passwordChangedAt: PASSWORD_CHANGED_AT,
  profile: { presence: CURRENT_USER.presence, statusMessage: '' },
  permissions: DEFAULT_PERMISSION_MATRIX,
  pinnedConversationIds: CONVERSATIONS.filter((conversation) => conversation.pinned).map((c) => c.id),
  mutedConversationIds: CONVERSATIONS.filter((conversation) => conversation.muted).map((c) => c.id),
  unreadByConversation: Object.fromEntries(
    CONVERSATIONS.map((conversation) => [conversation.id, conversation.unreadCount]),
  ),
  activeConversationId: CONVERSATIONS[0]?.id ?? '',
  inspector: { kind: 'none' },
  taskView: 'board',
  chatFilter: 'all',
  smartView: 'all',
  projectFilterId: null,
  chatSearch: '',
  taskSearch: '',
  announcement: '',
};
