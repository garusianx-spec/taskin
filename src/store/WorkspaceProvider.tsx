'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Conversation, User } from '@/types';
import {
  CONVERSATIONS,
  CURRENT_USER,
  MESSAGES,
  TASKS,
} from '@/data/workspace';
import { DEFAULT_PERMISSION_MATRIX } from '@/data/reference';
import { workspaceReducer, type WorkspaceAction, type WorkspaceState } from './workspace-reducer';

interface WorkspaceContextValue {
  readonly state: WorkspaceState;
  readonly dispatch: Dispatch<WorkspaceAction>;
  readonly currentUser: User;
  readonly conversations: readonly Conversation[];
  /** Unread count with local "mark as read" applied on top of the seed value. */
  readonly unreadFor: (conversationId: string) => number;
  readonly isPinned: (conversationId: string) => boolean;
  readonly isMuted: (conversationId: string) => boolean;
  readonly totalUnread: number;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const initialState: WorkspaceState = {
  tasks: TASKS,
  messages: MESSAGES,
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

/**
 * Single stateful container for the workspace. Every presentation component below this point
 * is pure: it receives data and callbacks and owns no domain state of its own.
 *
 * In production this is where the transport layer would live (React Query / server actions
 * feeding the same reducer); the reducer contract would not change.
 */
export function WorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  const unreadFor = useCallback(
    (conversationId: string) => state.unreadByConversation[conversationId] ?? 0,
    [state.unreadByConversation],
  );

  const isPinned = useCallback(
    (conversationId: string) => state.pinnedConversationIds.includes(conversationId),
    [state.pinnedConversationIds],
  );

  const isMuted = useCallback(
    (conversationId: string) => state.mutedConversationIds.includes(conversationId),
    [state.mutedConversationIds],
  );

  const totalUnread = useMemo(
    () => Object.values(state.unreadByConversation).reduce((sum, count) => sum + count, 0),
    [state.unreadByConversation],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      dispatch,
      currentUser: CURRENT_USER,
      conversations: CONVERSATIONS,
      unreadFor,
      isPinned,
      isMuted,
      totalUnread,
    }),
    [state, unreadFor, isPinned, isMuted, totalUnread],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>.');
  return context;
}
