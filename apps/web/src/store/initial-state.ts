import type { WorkspaceState } from './workspace-reducer';
import {
  ACTIVITY,
  CALENDAR_EVENTS,
  CONVERSATIONS,
  CURRENT_USER,
  INVITATIONS,
  LOGIN_SESSIONS,
  MESSAGES,
  NOTES,
  NOTIFICATIONS,
  PASSWORD_CHANGED_AT,
  PRIMARY_WORKSPACE_ID,
  TASKS,
  WORKSPACES,
} from '@/data/workspace';
import { BUILT_IN_COLUMNS, BUILT_IN_NOTE_CATEGORIES, DEFAULT_PERMISSION_MATRIX } from '@/data/reference';

/**
 * The state a fresh session starts from. Kept apart from the provider so the reducer can
 * return to it on sign-out without importing React.
 */
export const INITIAL_WORKSPACE_STATE: WorkspaceState = {
  session: 'active',
  workspaces: WORKSPACES,
  activeWorkspaceId: PRIMARY_WORKSPACE_ID,
  // The other seeded workspaces have not been worked in yet; they open empty.
  parkedWorkspaces: {},
  activity: ACTIVITY,
  tasks: TASKS,
  archivedTasks: [],
  boardColumns: BUILT_IN_COLUMNS,
  conversations: CONVERSATIONS,
  messages: MESSAGES,
  calendarEvents: CALENDAR_EVENTS,
  calendarFocusDate: null,
  notes: NOTES,
  noteCategories: BUILT_IN_NOTE_CATEGORIES,
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
