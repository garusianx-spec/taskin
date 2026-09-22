import type {
  ChatFilterId,
  InspectorTarget,
  Message,
  PermissionActionId,
  PermissionMatrix,
  PermissionModuleId,
  RoleId,
  SmartViewId,
  Task,
  TaskDraft,
  TaskStatus,
  TaskViewMode,
} from '@/types';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '@/data/reference';

export interface WorkspaceState {
  readonly tasks: readonly Task[];
  readonly messages: readonly Message[];
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
  | { readonly type: 'reorder-task'; readonly taskId: string; readonly status: TaskStatus; readonly beforeTaskId: string | null }
  | { readonly type: 'patch-task'; readonly taskId: string; readonly patch: TaskPatch }
  | { readonly type: 'toggle-task-star'; readonly taskId: string }
  | { readonly type: 'toggle-subtask'; readonly taskId: string; readonly subtaskId: string }
  | { readonly type: 'add-subtask'; readonly taskId: string; readonly title: string }
  | { readonly type: 'remove-subtask'; readonly taskId: string; readonly subtaskId: string }
  | { readonly type: 'move-subtask'; readonly taskId: string; readonly subtaskId: string; readonly delta: number }
  | { readonly type: 'add-task-comment'; readonly taskId: string; readonly authorId: string; readonly body: string; readonly replyToId: string | null }
  | { readonly type: 'create-task'; readonly draft: TaskDraft; readonly authorId: string }
  | { readonly type: 'send-message'; readonly conversationId: string; readonly authorId: string; readonly text: string; readonly replyToId: string | null }
  | { readonly type: 'toggle-reaction'; readonly messageId: string; readonly emoji: string; readonly userId: string }
  | { readonly type: 'mark-conversation-read'; readonly conversationId: string }
  | { readonly type: 'toggle-conversation-pin'; readonly conversationId: string }
  | { readonly type: 'toggle-conversation-mute'; readonly conversationId: string }
  | { readonly type: 'set-permission'; readonly role: RoleId; readonly module: PermissionModuleId; readonly action: PermissionActionId; readonly value: boolean }
  | { readonly type: 'set-module-permissions'; readonly role: RoleId; readonly module: PermissionModuleId; readonly value: boolean }
  | { readonly type: 'set-action-permissions'; readonly role: RoleId; readonly action: PermissionActionId; readonly value: boolean }
  | { readonly type: 'set-role-permissions'; readonly role: RoleId; readonly value: boolean }
  | { readonly type: 'replace-permissions'; readonly permissions: PermissionMatrix }
  | { readonly type: 'announce'; readonly message: string };

export interface TaskPatch {
  readonly status?: TaskStatus;
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

let sequence = 0;
/** Monotonic id for client-created entities. Stable within a session, never collides with seeds. */
const nextId = (prefix: string): string => {
  sequence += 1;
  return `${prefix}-local-${sequence}`;
};

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

    case 'move-task': {
      const task = state.tasks.find((entry) => entry.id === action.taskId);
      if (!task || task.status === action.status) return state;
      return {
        ...state,
        tasks: mapTask(state.tasks, action.taskId, (entry) => ({ ...entry, status: action.status })),
      };
    }

    case 'reorder-task': {
      const moving = state.tasks.find((entry) => entry.id === action.taskId);
      if (!moving) return state;

      const updated: Task = { ...moving, status: action.status };
      const without = state.tasks.filter((entry) => entry.id !== action.taskId);
      const targetIndex =
        action.beforeTaskId === null
          ? without.length
          : without.findIndex((entry) => entry.id === action.beforeTaskId);

      const next = [...without];
      next.splice(targetIndex === -1 ? without.length : targetIndex, 0, updated);
      return { ...state, tasks: next };
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
      const task: Task = {
        id,
        code: `NEW-${state.tasks.length + 1}`,
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        projectId: draft.projectId,
        assigneeIds: draft.assigneeIds,
        reviewerId: null,
        startDate,
        dueDate: draft.dueDate ?? startDate,
        createdAt: new Date().toISOString(),
        subtasks: [],
        attachments: draft.attachments,
        comments: [],
        labels: [],
        starred: false,
        sourceMessageId: draft.sourceMessageId,
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
        announcement: `وظیفه «${draft.title}» ایجاد شد.`,
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
