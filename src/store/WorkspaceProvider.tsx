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
import type { Conversation, User, Workspace } from '@/types';
import { CURRENT_USER } from '@/data/workspace';
import { workspaceReducer, type WorkspaceAction, type WorkspaceState } from './workspace-reducer';
import { INITIAL_WORKSPACE_STATE } from './initial-state';

interface WorkspaceContextValue {
  readonly state: WorkspaceState;
  readonly dispatch: Dispatch<WorkspaceAction>;
  readonly currentUser: User;
  readonly activeWorkspace: Workspace;
  /** True when the signed-in member is the active workspace's Owner. */
  readonly isWorkspaceOwner: boolean;
  readonly conversations: readonly Conversation[];
  /** Unread count with local "mark as read" applied on top of the seed value. */
  readonly unreadFor: (conversationId: string) => number;
  readonly isPinned: (conversationId: string) => boolean;
  readonly isMuted: (conversationId: string) => boolean;
  readonly totalUnread: number;
  readonly unreadNotifications: number;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Single stateful container for the workspace. Every presentation component below this point
 * is pure: it receives data and callbacks and owns no domain state of its own.
 *
 * In production this is where the transport layer would live (React Query / server actions
 * feeding the same reducer); the reducer contract would not change.
 */
export function WorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, INITIAL_WORKSPACE_STATE);

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

  const unreadNotifications = useMemo(
    () => state.notifications.filter((notification) => !notification.read).length,
    [state.notifications],
  );

  // Presence is the one identity field the member edits themselves (profile modal); name,
  // email and title come from the organisation directory.
  const currentUser = useMemo<User>(
    () => ({ ...CURRENT_USER, presence: state.profile.presence }),
    [state.profile.presence],
  );

  const activeWorkspace = useMemo<Workspace>(() => {
    const found = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
    // The reducer never removes the active workspace without activating another.
    if (!found) throw new Error(`Active workspace ${state.activeWorkspaceId} is missing.`);
    return found;
  }, [state.workspaces, state.activeWorkspaceId]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      state,
      dispatch,
      currentUser,
      activeWorkspace,
      isWorkspaceOwner: activeWorkspace.ownerId === currentUser.id,
      conversations: state.conversations,
      unreadFor,
      isPinned,
      isMuted,
      totalUnread,
      unreadNotifications,
    }),
    [state, currentUser, activeWorkspace, unreadFor, isPinned, isMuted, totalUnread, unreadNotifications],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>.');
  return context;
}
