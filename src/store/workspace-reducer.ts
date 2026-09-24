import type {
  AppNotification,
  AvatarTone,
  BoardColumn,
  CalendarEvent,
  CalendarEventDraft,
  ChatFilterId,
  Conversation,
  DepartmentId,
  InspectorTarget,
  Invitation,
  LoginSession,
  Message,
  Note,
  NotebookId,
  NotePatch,
  PermissionActionId,
  PermissionMatrix,
  PermissionModuleId,
  ProfileSettings,
  RoleId,
  SessionStatus,
  SmartViewId,
  TagTone,
  Task,
  TaskDraft,
  TaskPlacement,
  TaskStatus,
  TaskViewMode,
} from '@/types';
import {
  CUSTOM_COLUMN_STATUS,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  statusLabel,
} from '@/data/reference';
import { toPersianDigits } from '@/lib/jalali';
import { nextLocalId as nextId } from './ids';
import { INITIAL_WORKSPACE_STATE } from './initial-state';

export interface WorkspaceState {
  readonly session: SessionStatus;
  readonly tasks: readonly Task[];
  readonly boardColumns: readonly BoardColumn[];
  readonly conversations: readonly Conversation[];
  readonly messages: readonly Message[];
  readonly calendarEvents: readonly CalendarEvent[];
  /** Date the calendar should open on after an event is created elsewhere; cleared on read. */
  readonly calendarFocusDate: string | null;
  readonly notes: readonly Note[];
  readonly notifications: readonly AppNotification[];
  readonly invitations: readonly Invitation[];
  readonly loginSessions: readonly LoginSession[];
  readonly twoFactorEnabled: boolean;
  readonly passwordChangedAt: string;
  readonly profile: ProfileSettings;
  readonly permissions: PermissionMatrix;
  readonly pinnedConversationIds: readonly string[];
  readonly mutedConversationIds: readonly string[];
  readonly unreadByConversation: Readonly<Record<string, number>>;
  readonly activeConversationId: string;
  readonly inspector: InspectorTarget;
  readonly taskView: TaskViewMode;
  readonly chatFilter: ChatFilterId;
  readonly smartView: SmartViewId;
  readonly projectFilterId: string | null;
  readonly chatSearch: string;
  readonly taskSearch: string;
  /** Text pushed to the shell's `aria-live` region after a non-visual state change. */
  readonly announcement: string;
}

export type WorkspaceAction =
  | { readonly type: 'select-conversation'; readonly conversationId: string }
  | { readonly type: 'open-task'; readonly taskId: string }
  | { readonly type: 'open-conversation-details'; readonly conversationId: string }
  | { readonly type: 'close-inspector' }
  | { readonly type: 'set-task-view'; readonly view: TaskViewMode }
  | { readonly type: 'set-chat-filter'; readonly filter: ChatFilterId }
  | { readonly type: 'set-smart-view'; readonly view: SmartViewId }
  | { readonly type: 'set-project-filter'; readonly projectId: string | null }
  | { readonly type: 'set-chat-search'; readonly query: string }
  | { readonly type: 'set-task-search'; readonly query: string }
  | { readonly type: 'move-task'; readonly taskId: string; readonly status: TaskStatus }
  | { readonly type: 'move-task-to-column'; readonly taskId: string; readonly columnId: string }
  | { readonly type: 'set-task-completed'; readonly taskId: string; readonly completed: boolean }
  | { readonly type: 'add-board-column'; readonly title: string; readonly tone: TagTone }
  | { readonly type: 'remove-board-column'; readonly columnId: string }
  | { readonly type: 'patch-task'; readonly taskId: string; readonly patch: TaskPatch }
  | { readonly type: 'toggle-task-star'; readonly taskId: string }
  | { readonly type: 'toggle-subtask'; readonly taskId: string; readonly subtaskId: string }
  | { readonly type: 'add-subtask'; readonly taskId: string; readonly title: string }
  | { readonly type: 'remove-subtask'; readonly taskId: string; readonly subtaskId: string }
  | { readonly type: 'move-subtask'; readonly taskId: string; readonly subtaskId: string; readonly delta: number }
  | { readonly type: 'add-task-comment'; readonly taskId: string; readonly authorId: string; readonly body: string; readonly replyToId: string | null }
  | { readonly type: 'create-task'; readonly draft: TaskDraft; readonly authorId: string }
  | { readonly type: 'create-conversation'; readonly draft: ConversationDraft; readonly authorId: string }
  | { readonly type: 'send-message'; readonly conversationId: string; readonly authorId: string; readonly text: string; readonly replyToId: string | null }
  | { readonly type: 'toggle-reaction'; readonly messageId: string; readonly emoji: string; readonly userId: string }
  | { readonly type: 'mark-conversation-read'; readonly conversationId: string }
  | { readonly type: 'toggle-conversation-pin'; readonly conversationId: string }
  | { readonly type: 'toggle-conversation-mute'; readonly conversationId: string }
  | { readonly type: 'create-calendar-event'; readonly draft: CalendarEventDraft }
  | { readonly type: 'clear-calendar-focus' }
  | { readonly type: 'create-note'; readonly noteId: string; readonly notebook: NotebookId }
  | { readonly type: 'update-note'; readonly noteId: string; readonly patch: NotePatch }
  | { readonly type: 'delete-note'; readonly noteId: string }
  | { readonly type: 'mark-notification-read'; readonly notificationId: string }
  | { readonly type: 'mark-all-notifications-read' }
  | { readonly type: 'invite-members'; readonly draft: InvitationDraft; readonly invitedById: string }
  | { readonly type: 'revoke-invitation'; readonly invitationId: string }
  | { readonly type: 'update-profile'; readonly profile: ProfileSettings }
  | { readonly type: 'set-two-factor'; readonly enabled: boolean }
  | { readonly type: 'record-password-change' }
  | { readonly type: 'revoke-login-session'; readonly sessionId: string }
  | { readonly type: 'revoke-other-login-sessions' }
  | { readonly type: 'sign-out' }
  | { readonly type: 'sign-in' }
  | { readonly type: 'set-permission'; readonly role: RoleId; readonly module: PermissionModuleId; readonly action: PermissionActionId; readonly value: boolean }
  | { readonly type: 'set-module-permissions'; readonly role: RoleId; readonly module: PermissionModuleId; readonly value: boolean }
  | { readonly type: 'set-action-permissions'; readonly role: RoleId; readonly action: PermissionActionId; readonly value: boolean }
  | { readonly type: 'set-role-permissions'; readonly role: RoleId; readonly value: boolean }
  | { readonly type: 'replace-permissions'; readonly permissions: PermissionMatrix }
  | { readonly type: 'announce'; readonly message: string };

export interface ConversationDraft {
  readonly kind: 'direct' | 'group';
  readonly title: string;
  readonly topic: string;
  /** Every member, the author included. */
  readonly memberIds: readonly string[];
  readonly tone: AvatarTone;
}

export interface InvitationDraft {
  readonly emails: readonly string[];
  readonly role: RoleId;
  readonly department: DepartmentId;
  readonly message: string;
}

/**
 * Field edits. Status is deliberately absent: it is part of a task's board placement and
 * only changes through `move-task`, `move-task-to-column` or `set-task-completed`, which keep
 * the custom column and the reopen target consistent with it.
 */
export interface TaskPatch {
  readonly priority?: Task['priority'];
  readonly assigneeIds?: readonly string[];
  readonly reviewerId?: string | null;
  readonly dueDate?: string;
  readonly startDate?: string;
  readonly title?: string;
  readonly description?: string;
}

const LOCKED_ROLES: readonly RoleId[] = ['owner'];

const isLocked = (role: RoleId): boolean => LOCKED_ROLES.includes(role);

const mapTask = (
  tasks: readonly Task[],
  taskId: string,
  update: (task: Task) => Task,
): readonly Task[] => tasks.map((task) => (task.id === taskId ? update(task) : task));

const nowIso = (): string => new Date().toISOString();

/**
 * The one place a task changes status. Entering "done" from anywhere else records where the
 * task came from, so unchecking it later returns it there; any other move clears that record.
 */
function placeTask(task: Task, next: TaskPlacement): Task {
  if (task.status === next.status && task.boardColumnId === next.boardColumnId) return task;
  const enteringDone = next.status === 'done' && task.status !== 'done';
  return {
    ...task,
    status: next.status,
    boardColumnId: next.boardColumnId,
    reopenTo: enteringDone
      ? { status: task.status, boardColumnId: task.boardColumnId }
      : next.status === 'done'
        ? task.reopenTo
        : null,
  };
}

/** Resolves a column id to the placement a task takes when it lands there. */
function placementForColumn(columns: readonly BoardColumn[], columnId: string): TaskPlacement | null {
  const column = columns.find((entry) => entry.id === columnId);
  if (!column) return null;
  return { status: column.status, boardColumnId: column.custom ? column.id : null };
}

function columnTitle(columns: readonly BoardColumn[], placement: TaskPlacement): string {
  const id = placement.boardColumnId ?? placement.status;
  return columns.find((column) => column.id === id)?.title ?? statusLabel(placement.status);
}

const sameMembers = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'select-conversation':
      return {
        ...state,
        activeConversationId: action.conversationId,
        unreadByConversation: { ...state.unreadByConversation, [action.conversationId]: 0 },
        inspector:
          state.inspector.kind === 'conversation'
            ? { kind: 'conversation', conversationId: action.conversationId }
            : state.inspector,
      };

    case 'open-task':
      return { ...state, inspector: { kind: 'task', taskId: action.taskId } };

    case 'open-conversation-details':
      return { ...state, inspector: { kind: 'conversation', conversationId: action.conversationId } };

    case 'close-inspector':
      return { ...state, inspector: { kind: 'none' } };

    case 'set-task-view':
      return { ...state, taskView: action.view };

    case 'set-chat-filter':
      return { ...state, chatFilter: action.filter };

    case 'set-smart-view':
      return { ...state, smartView: action.view, projectFilterId: null };

    case 'set-project-filter':
      return { ...state, projectFilterId: action.projectId, smartView: 'all' };

    case 'set-chat-search':
      return { ...state, chatSearch: action.query };

    case 'set-task-search':
      return { ...state, taskSearch: action.query };

    case 'move-task':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) =>
          placeTask(task, { status: action.status, boardColumnId: null }),
        ),
      };

    case 'move-task-to-column': {
      const placement = placementForColumn(state.boardColumns, action.columnId);
      if (!placement) return state;
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => placeTask(task, placement)),
      };
    }

    case 'set-task-completed': {
      const task = state.tasks.find((entry) => entry.id === action.taskId);
      if (!task || (task.status === 'done') === action.completed) return state;

      if (action.completed) {
        return {
          ...state,
          tasks: mapTask(state.tasks, action.taskId, (entry) =>
            placeTask(entry, { status: 'done', boardColumnId: null }),
          ),
          announcement: `وظیفه «${task.title}» انجام شد.`,
        };
      }

      // Back to where it was — unless that custom column has since been removed, in which
      // case the task falls back to the built-in column for the same status.
      const remembered = task.reopenTo;
      const rememberedColumnId = remembered?.boardColumnId ?? null;
      const columnStillExists =
        rememberedColumnId === null ||
        state.boardColumns.some((column) => column.id === rememberedColumnId);
      const target: TaskPlacement =
        remembered && remembered.status !== 'done'
          ? columnStillExists
            ? remembered
            : { status: remembered.status, boardColumnId: null }
          : { status: 'todo', boardColumnId: null };

      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (entry) => placeTask(entry, target)),
        announcement: `وظیفه «${task.title}» به ستون ${columnTitle(state.boardColumns, target)} بازگشت.`,
      };
    }

    case 'add-board-column': {
      const title = action.title.trim();
      if (!title) return state;
      const column: BoardColumn = {
        id: nextId('col'),
        title,
        status: CUSTOM_COLUMN_STATUS,
        tone: action.tone,
        custom: true,
      };
      return {
        ...state,
        boardColumns: [...state.boardColumns, column],
        announcement: `ستون «${title}» به بورد اضافه شد.`,
      };
    }

    case 'remove-board-column': {
      const column = state.boardColumns.find((entry) => entry.id === action.columnId);
      if (!column || !column.custom) return state;
      const displaced = state.tasks.filter((task) => task.boardColumnId === column.id).length;
      return {
        ...state,
        boardColumns: state.boardColumns.filter((entry) => entry.id !== column.id),
        // Cards fall back to the built-in column for the status they already carry.
        tasks: state.tasks.map((task) => {
          if (task.boardColumnId === column.id) return { ...task, boardColumnId: null };
          if (task.reopenTo?.boardColumnId === column.id) {
            return { ...task, reopenTo: { ...task.reopenTo, boardColumnId: null } };
          }
          return task;
        }),
        announcement:
          displaced > 0
            ? `ستون «${column.title}» حذف شد و ${toPersianDigits(displaced)} وظیفه به ستون ${statusLabel(column.status)} منتقل شد.`
            : `ستون «${column.title}» حذف شد.`,
      };
    }

    case 'patch-task':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => ({ ...task, ...action.patch })),
      };

    case 'toggle-task-star':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => ({ ...task, starred: !task.starred })),
      };

    case 'toggle-subtask':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => ({
          ...task,
          subtasks: task.subtasks.map((subtask) =>
            subtask.id === action.subtaskId ? { ...subtask, done: !subtask.done } : subtask,
          ),
        })),
      };

    case 'add-subtask':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => ({
          ...task,
          subtasks: [
            ...task.subtasks,
            { id: nextId('s'), title: action.title, done: false, assigneeId: null },
          ],
        })),
      };

    case 'remove-subtask':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => ({
          ...task,
          subtasks: task.subtasks.filter((subtask) => subtask.id !== action.subtaskId),
        })),
      };

    case 'move-subtask':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => {
          const index = task.subtasks.findIndex((subtask) => subtask.id === action.subtaskId);
          const target = index + action.delta;
          if (index === -1 || target < 0 || target >= task.subtasks.length) return task;
          const next = [...task.subtasks];
          const [moved] = next.splice(index, 1);
          if (!moved) return task;
          next.splice(target, 0, moved);
          return { ...task, subtasks: next };
        }),
      };

    case 'add-task-comment':
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (task) => ({
          ...task,
          comments: [
            ...task.comments,
            {
              id: nextId('c'),
              authorId: action.authorId,
              body: action.body,
              createdAt: new Date().toISOString(),
              replyToId: action.replyToId,
            },
          ],
        })),
      };

    case 'create-task': {
      const { draft } = action;
      const id = nextId('t');
      const today = new Date();
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const placement: TaskPlacement = (draft.boardColumnId
        ? placementForColumn(state.boardColumns, draft.boardColumnId)
        : null) ?? { status: draft.status, boardColumnId: null };
      const task: Task = {
        id,
        code: `NEW-${state.tasks.length + 1}`,
        title: draft.title,
        description: draft.description,
        status: placement.status,
        priority: draft.priority,
        projectId: draft.projectId,
        assigneeIds: draft.assigneeIds,
        reviewerId: null,
        startDate,
        dueDate: draft.dueDate ?? startDate,
        createdAt: nowIso(),
        subtasks: draft.subtaskTitles.map((title) => ({
          id: nextId('s'),
          title,
          done: false,
          assigneeId: null,
        })),
        attachments: draft.attachments,
        comments: [],
        labels: [],
        starred: false,
        sourceMessageId: draft.sourceMessageId,
        boardColumnId: placement.boardColumnId,
        reopenTo: null,
      };

      return {
        ...state,
        tasks: [task, ...state.tasks],
        inspector: { kind: 'task', taskId: id },
        messages: draft.sourceMessageId
          ? state.messages.map((message) =>
              message.id === draft.sourceMessageId ? { ...message, linkedTaskId: id } : message,
            )
          : state.messages,
        notes: draft.sourceNoteId
          ? state.notes.map((note) =>
              note.id === draft.sourceNoteId ? { ...note, linkedTaskId: id } : note,
            )
          : state.notes,
        announcement: `وظیفه «${draft.title}» ایجاد شد.`,
      };
    }

    case 'create-conversation': {
      const { draft } = action;
      if (draft.kind === 'direct') {
        const existing = state.conversations.find(
          (conversation) =>
            conversation.kind === 'direct' && sameMembers(conversation.memberIds, draft.memberIds),
        );
        if (existing) {
          return {
            ...state,
            activeConversationId: existing.id,
            unreadByConversation: { ...state.unreadByConversation, [existing.id]: 0 },
            announcement: `گفتگو با ${existing.title} از قبل وجود داشت و باز شد.`,
          };
        }
      }

      const conversation: Conversation = {
        id: nextId('conv'),
        kind: draft.kind,
        title: draft.title,
        memberIds: draft.memberIds,
        pinned: false,
        muted: false,
        unreadCount: 0,
        tone: draft.tone,
        topic: draft.topic || (draft.kind === 'direct' ? 'گفتگوی مستقیم' : 'گروه تیمی'),
      };
      const opener: Message | null =
        draft.kind === 'group'
          ? {
              id: nextId('m'),
              conversationId: conversation.id,
              authorId: action.authorId,
              sentAt: nowIso(),
              body: { kind: 'system', text: `گروه «${draft.title}» ایجاد شد.` },
              replyToId: null,
              reactions: [],
              edited: false,
              linkedTaskId: null,
              readByIds: [],
            }
          : null;

      return {
        ...state,
        conversations: [conversation, ...state.conversations],
        messages: opener ? [...state.messages, opener] : state.messages,
        unreadByConversation: { ...state.unreadByConversation, [conversation.id]: 0 },
        activeConversationId: conversation.id,
        announcement:
          draft.kind === 'direct'
            ? `گفتگو با ${draft.title} ایجاد شد.`
            : `گروه «${draft.title}» ایجاد شد.`,
      };
    }

    case 'send-message': {
      const message: Message = {
        id: nextId('m'),
        conversationId: action.conversationId,
        authorId: action.authorId,
        sentAt: new Date().toISOString(),
        body: { kind: 'text', text: action.text },
        replyToId: action.replyToId,
        reactions: [],
        edited: false,
        linkedTaskId: null,
        readByIds: [],
      };
      return { ...state, messages: [...state.messages, message] };
    }

    case 'toggle-reaction':
      return {
        ...state,
        messages: state.messages.map((message) => {
          if (message.id !== action.messageId) return message;
          const existing = message.reactions.find((reaction) => reaction.emoji === action.emoji);

          if (!existing) {
            return {
              ...message,
              reactions: [...message.reactions, { emoji: action.emoji, userIds: [action.userId] }],
            };
          }

          const hasReacted = existing.userIds.includes(action.userId);
          const nextUserIds = hasReacted
            ? existing.userIds.filter((id) => id !== action.userId)
            : [...existing.userIds, action.userId];

          return {
            ...message,
            reactions: nextUserIds.length
              ? message.reactions.map((reaction) =>
                  reaction.emoji === action.emoji ? { ...reaction, userIds: nextUserIds } : reaction,
                )
              : message.reactions.filter((reaction) => reaction.emoji !== action.emoji),
          };
        }),
      };

    case 'mark-conversation-read':
      return {
        ...state,
        unreadByConversation: { ...state.unreadByConversation, [action.conversationId]: 0 },
      };

    case 'toggle-conversation-pin':
      return {
        ...state,
        pinnedConversationIds: state.pinnedConversationIds.includes(action.conversationId)
          ? state.pinnedConversationIds.filter((id) => id !== action.conversationId)
          : [...state.pinnedConversationIds, action.conversationId],
      };

    case 'toggle-conversation-mute':
      return {
        ...state,
        mutedConversationIds: state.mutedConversationIds.includes(action.conversationId)
          ? state.mutedConversationIds.filter((id) => id !== action.conversationId)
          : [...state.mutedConversationIds, action.conversationId],
      };

    case 'create-calendar-event': {
      const event: CalendarEvent = { id: nextId('ev'), ...action.draft };
      return {
        ...state,
        calendarEvents: [...state.calendarEvents, event],
        calendarFocusDate: event.date,
        announcement: `«${event.title}» در تقویم ثبت شد.`,
      };
    }

    case 'clear-calendar-focus':
      return state.calendarFocusDate === null ? state : { ...state, calendarFocusDate: null };

    case 'create-note': {
      const timestamp = nowIso();
      const note: Note = {
        id: action.noteId,
        notebook: action.notebook,
        title: '',
        body: '',
        colors: [],
        pinned: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        linkedTaskId: null,
      };
      return { ...state, notes: [note, ...state.notes] };
    }

    case 'update-note':
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.noteId ? { ...note, ...action.patch, updatedAt: nowIso() } : note,
        ),
      };

    case 'delete-note': {
      const note = state.notes.find((entry) => entry.id === action.noteId);
      if (!note) return state;
      return {
        ...state,
        notes: state.notes.filter((entry) => entry.id !== action.noteId),
        announcement: `یادداشت «${note.title || 'بدون عنوان'}» حذف شد.`,
      };
    }

    case 'mark-notification-read':
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.id === action.notificationId && !notification.read
            ? { ...notification, read: true }
            : notification,
        ),
      };

    case 'mark-all-notifications-read':
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.read ? notification : { ...notification, read: true },
        ),
        announcement: 'همه اعلان‌ها خوانده‌شده علامت خوردند.',
      };

    case 'invite-members': {
      const { draft } = action;
      const pending = new Set(state.invitations.map((invitation) => invitation.email));
      const fresh = draft.emails.filter((email) => !pending.has(email));
      if (fresh.length === 0) return state;
      const invitedAt = nowIso();
      const created: Invitation[] = fresh.map((email) => ({
        id: nextId('inv'),
        email,
        role: draft.role,
        department: draft.department,
        message: draft.message,
        invitedAt,
        invitedById: action.invitedById,
      }));
      return {
        ...state,
        invitations: [...created, ...state.invitations],
        announcement: `${toPersianDigits(created.length)} دعوت‌نامه ارسال شد.`,
      };
    }

    case 'revoke-invitation':
      return {
        ...state,
        invitations: state.invitations.filter((invitation) => invitation.id !== action.invitationId),
      };

    case 'update-profile':
      return { ...state, profile: action.profile, announcement: 'پروفایل شما به‌روزرسانی شد.' };

    case 'set-two-factor':
      return {
        ...state,
        twoFactorEnabled: action.enabled,
        announcement: action.enabled ? 'ورود دومرحله‌ای فعال شد.' : 'ورود دومرحله‌ای غیرفعال شد.',
      };

    case 'record-password-change':
      return { ...state, passwordChangedAt: nowIso(), announcement: 'رمز عبور تغییر کرد.' };

    case 'revoke-login-session':
      return {
        ...state,
        loginSessions: state.loginSessions.filter(
          (session) => session.current || session.id !== action.sessionId,
        ),
      };

    case 'revoke-other-login-sessions':
      return {
        ...state,
        loginSessions: state.loginSessions.filter((session) => session.current),
        announcement: 'از همه نشست‌های دیگر خارج شدید.',
      };

    case 'sign-out':
      // Everything the member did this session is dropped; only the theme (stored by the
      // ThemeProvider, not here) survives, because it is a device preference.
      return { ...INITIAL_WORKSPACE_STATE, session: 'signed-out' };

    case 'sign-in':
      return INITIAL_WORKSPACE_STATE;

    case 'set-permission': {
      if (isLocked(action.role)) return state;
      const role = state.permissions[action.role];
      const permissionModule = role[action.module];
      return {
        ...state,
        permissions: {
          ...state.permissions,
          [action.role]: {
            ...role,
            [action.module]: { ...permissionModule, [action.action]: action.value },
          },
        },
      };
    }

    case 'set-module-permissions': {
      if (isLocked(action.role)) return state;
      const role = state.permissions[action.role];
      const filled = Object.fromEntries(
        PERMISSION_ACTIONS.map((entry) => [entry.id, action.value]),
      ) as Readonly<Record<PermissionActionId, boolean>>;
      return {
        ...state,
        permissions: { ...state.permissions, [action.role]: { ...role, [action.module]: filled } },
      };
    }

    case 'set-action-permissions': {
      if (isLocked(action.role)) return state;
      const role = state.permissions[action.role];
      const nextRole = Object.fromEntries(
        PERMISSION_MODULES.map((entry) => [
          entry.id,
          { ...role[entry.id], [action.action]: action.value },
        ]),
      ) as PermissionMatrix[RoleId];
      return { ...state, permissions: { ...state.permissions, [action.role]: nextRole } };
    }

    case 'set-role-permissions': {
      if (isLocked(action.role)) return state;
      const filled = Object.fromEntries(
        PERMISSION_ACTIONS.map((entry) => [entry.id, action.value]),
      ) as Readonly<Record<PermissionActionId, boolean>>;
      const nextRole = Object.fromEntries(
        PERMISSION_MODULES.map((entry) => [entry.id, filled]),
      ) as PermissionMatrix[RoleId];
      return { ...state, permissions: { ...state.permissions, [action.role]: nextRole } };
    }

    case 'replace-permissions':
      return { ...state, permissions: action.permissions };

    case 'announce':
      return { ...state, announcement: action.message };

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
