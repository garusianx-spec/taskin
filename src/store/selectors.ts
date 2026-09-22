import type {
  ChatFilterId,
  Conversation,
  Message,
  Project,
  SmartViewId,
  Task,
  TaskStatus,
  User,
} from '@/types';
import { CONVERSATIONS, PROJECTS, USERS } from '@/data/workspace';
import { daysBetween, parseISODate, toISODate } from '@/lib/jalali';

/* ------------------------------ People & projects ------------------------------ */

export const userById = (id: string): User | undefined => USERS.find((user) => user.id === id);

export const usersByIds = (ids: readonly string[]): User[] =>
  ids.map(userById).filter((user): user is User => user !== undefined);

export const projectById = (id: string): Project | undefined =>
  PROJECTS.find((project) => project.id === id);

export const conversationById = (id: string): Conversation | undefined =>
  CONVERSATIONS.find((conversation) => conversation.id === id);

/** Root projects with their children attached, for the sidebar tree. */
export interface ProjectNode {
  readonly project: Project;
  readonly children: readonly Project[];
}

export function buildProjectTree(): readonly ProjectNode[] {
  return PROJECTS.filter((project) => project.parentId === null).map((project) => ({
    project,
    children: PROJECTS.filter((child) => child.parentId === project.id),
  }));
}

/** A project id plus every descendant id — used when filtering the board by a parent. */
export function projectWithDescendants(projectId: string): readonly string[] {
  const children = PROJECTS.filter((project) => project.parentId === projectId).map((p) => p.id);
  return [projectId, ...children];
}

/* ------------------------------ Tasks ------------------------------ */

export interface TaskFilter {
  readonly smartView: SmartViewId;
  readonly projectId: string | null;
  readonly search: string;
  readonly currentUserId: string;
}

export function filterTasks(tasks: readonly Task[], filter: TaskFilter): readonly Task[] {
  const query = filter.search.trim().toLowerCase();
  const scope = filter.projectId ? projectWithDescendants(filter.projectId) : null;
  const today = new Date();

  return tasks.filter((task) => {
    if (scope && !scope.includes(task.projectId)) return false;

    switch (filter.smartView) {
      case 'my-tasks':
        if (!task.assigneeIds.includes(filter.currentUserId)) return false;
        break;
      case 'starred':
        if (!task.starred) return false;
        break;
      case 'due-soon': {
        if (task.status === 'done') return false;
        const delta = daysBetween(today, parseISODate(task.dueDate));
        if (delta > 3) return false;
        break;
      }
      case 'all':
        break;
      default: {
        const exhaustive: never = filter.smartView;
        return exhaustive;
      }
    }

    if (!query) return true;
    const haystack = `${task.title} ${task.code} ${task.description} ${task.labels.join(' ')}`.toLowerCase();
    return haystack.includes(query);
  });
}

export const tasksByStatus = (tasks: readonly Task[], status: TaskStatus): readonly Task[] =>
  tasks.filter((task) => task.status === status);

export const taskById = (tasks: readonly Task[], id: string): Task | undefined =>
  tasks.find((task) => task.id === id);

export const subtaskProgress = (task: Task): { readonly done: number; readonly total: number } => ({
  done: task.subtasks.filter((subtask) => subtask.done).length,
  total: task.subtasks.length,
});

export const isOverdue = (task: Task, now: Date = new Date()): boolean =>
  task.status !== 'done' && daysBetween(now, parseISODate(task.dueDate)) < 0;

/* ------------------------------ Conversations ------------------------------ */

export const conversationMessages = (
  messages: readonly Message[],
  conversationId: string,
): readonly Message[] =>
  messages
    .filter((message) => message.conversationId === conversationId)
    .slice()
    .sort((a, b) => parseISODate(a.sentAt).getTime() - parseISODate(b.sentAt).getTime());

export const lastMessage = (
  messages: readonly Message[],
  conversationId: string,
): Message | undefined => {
  const thread = conversationMessages(messages, conversationId);
  return thread[thread.length - 1];
};

export const messageById = (messages: readonly Message[], id: string): Message | undefined =>
  messages.find((message) => message.id === id);

/** One-line preview for the chat list; voice and file messages get a descriptive stand-in. */
export function messagePreview(message: Message | undefined): string {
  if (!message) return 'هنوز پیامی ارسال نشده است';
  switch (message.body.kind) {
    case 'text':
      return message.body.text;
    case 'voice':
      return 'پیام صوتی';
    case 'file':
      return message.body.attachment.name;
    case 'system':
      return message.body.text;
    default: {
      const exhaustive: never = message.body;
      return exhaustive;
    }
  }
}

export interface ConversationFilter {
  readonly filter: ChatFilterId;
  readonly search: string;
  readonly unreadByConversation: Readonly<Record<string, number>>;
  readonly pinnedIds: readonly string[];
}

export function filterConversations(
  conversations: readonly Conversation[],
  messages: readonly Message[],
  options: ConversationFilter,
): readonly Conversation[] {
  const query = options.search.trim().toLowerCase();

  const matched = conversations.filter((conversation) => {
    switch (options.filter) {
      case 'direct':
        if (conversation.kind !== 'direct') return false;
        break;
      case 'groups':
        if (conversation.kind === 'direct') return false;
        break;
      case 'unread':
        if ((options.unreadByConversation[conversation.id] ?? 0) === 0) return false;
        break;
      case 'all':
        break;
      default: {
        const exhaustive: never = options.filter;
        return exhaustive;
      }
    }

    if (!query) return true;
    const preview = messagePreview(lastMessage(messages, conversation.id));
    return `${conversation.title} ${conversation.topic} ${preview}`.toLowerCase().includes(query);
  });

  // Pinned first, then most recent activity.
  return matched.slice().sort((a, b) => {
    const aPinned = options.pinnedIds.includes(a.id) ? 1 : 0;
    const bPinned = options.pinnedIds.includes(b.id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    const aTime = lastMessage(messages, a.id)?.sentAt;
    const bTime = lastMessage(messages, b.id)?.sentAt;
    if (!aTime || !bTime) return 0;
    return parseISODate(bTime).getTime() - parseISODate(aTime).getTime();
  });
}

/** Groups a thread into day buckets so the view can insert Jalali date dividers. */
export interface MessageGroup {
  readonly isoDate: string;
  readonly messages: readonly Message[];
}

export function groupMessagesByDay(messages: readonly Message[]): readonly MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const isoDate = toISODate(parseISODate(message.sentAt));
    const last = groups[groups.length - 1];
    if (last && last.isoDate === isoDate) {
      groups[groups.length - 1] = { isoDate, messages: [...last.messages, message] };
    } else {
      groups.push({ isoDate, messages: [message] });
    }
  }
  return groups;
}

/** True when the previous message is from the same author within five minutes. */
export function isGroupedWithPrevious(current: Message, previous: Message | undefined): boolean {
  if (!previous) return false;
  if (previous.authorId !== current.authorId) return false;
  if (previous.body.kind === 'system' || current.body.kind === 'system') return false;
  const gapMs = parseISODate(current.sentAt).getTime() - parseISODate(previous.sentAt).getTime();
  return gapMs < 5 * 60 * 1000;
}
