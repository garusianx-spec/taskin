'use client';

import { useCallback, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { conversationById, taskById } from '@/store/selectors';
import { NavRail } from './NavRail';
import { TopAppBar } from './TopAppBar';
import { BottomNav } from './BottomNav';
import { Drawer } from '@/components/ui';
import { TaskInspector } from '@/components/tasks/TaskInspector';
import { ConversationInspector } from '@/components/chat/ConversationInspector';

export interface AppShellProps {
  /** Contextual sidebar for the active module; `null` on modules that have none. */
  readonly sidebar?: ReactNode;
  readonly children: ReactNode;
  /**
   * Mobile only. While false the sidebar fills the screen (list view); while true the main
   * area takes over (detail view). Desktop always shows both columns.
   */
  readonly mobileShowsDetail?: boolean;
}

/**
 * Three-column desktop shell (rail، sidebar، workspace) with the inspector docking as a
 * fourth column, collapsing to a top bar + bottom tabs below `lg`.
 *
 * The inspector lives here because it docks into the layout. Every modal dialog — composers,
 * search, notifications, account — lives in the global `OverlayProvider` instead, so it can
 * be opened from anywhere via `useOverlays()`.
 */
export function AppShell({ sidebar, children, mobileShowsDetail = false }: AppShellProps) {
  const router = useRouter();
  const { state, dispatch, currentUser, isPinned, isMuted } = useWorkspace();
  const signedOut = state.session === 'signed-out';

  useEffect(() => {
    if (signedOut) router.replace('/signed-out');
  }, [signedOut, router]);

  const inspectorTask =
    state.inspector.kind === 'task' ? taskById(state.tasks, state.inspector.taskId) : undefined;
  const inspectorConversation =
    state.inspector.kind === 'conversation'
      ? conversationById(state.conversations, state.inspector.conversationId)
      : undefined;
  const inspectorOpen = Boolean(inspectorTask ?? inspectorConversation);

  const closeInspector = useCallback(() => dispatch({ type: 'close-inspector' }), [dispatch]);

  if (signedOut) return null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas">
      <a href="#workspace-main" className="focusable-sr-only">
        پرش به محتوای اصلی
      </a>

      <NavRail />

      <div className="flex min-w-0 flex-1 lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopAppBar />

          <div className="flex min-h-0 flex-1">
            {sidebar ? (
              <aside
                aria-label="ستون زمینه"
                className={[
                  'min-h-0 shrink-0 flex-col border-s border-secondary bg-surface lg:flex lg:w-sidebar',
                  mobileShowsDetail ? 'hidden lg:flex' : 'flex w-full',
                ].join(' ')}
              >
                {sidebar}
              </aside>
            ) : null}

            <main
              id="workspace-main"
              className={[
                'min-h-0 min-w-0 flex-1 flex-col',
                sidebar && !mobileShowsDetail ? 'hidden lg:flex' : 'flex',
              ].join(' ')}
            >
              {children}
            </main>
          </div>

          <BottomNav />
        </div>

        <Drawer
          open={inspectorOpen}
          onClose={closeInspector}
          title={inspectorTask ? 'جزئیات وظیفه' : 'جزئیات گفتگو'}
          className="border-s border-secondary"
        >
          {inspectorTask && (
            <TaskInspector
              task={inspectorTask}
              currentUser={currentUser}
              columns={state.boardColumns}
              onClose={closeInspector}
              onPatch={(patch) => dispatch({ type: 'patch-task', taskId: inspectorTask.id, patch })}
              onMoveToColumn={(columnId) =>
                dispatch({ type: 'move-task-to-column', taskId: inspectorTask.id, columnId })
              }
              onToggleStar={() => dispatch({ type: 'toggle-task-star', taskId: inspectorTask.id })}
              onToggleSubtask={(subtaskId) =>
                dispatch({ type: 'toggle-subtask', taskId: inspectorTask.id, subtaskId })
              }
              onAddSubtask={(title) => dispatch({ type: 'add-subtask', taskId: inspectorTask.id, title })}
              onRemoveSubtask={(subtaskId) =>
                dispatch({ type: 'remove-subtask', taskId: inspectorTask.id, subtaskId })
              }
              onMoveSubtask={(subtaskId, delta) =>
                dispatch({ type: 'move-subtask', taskId: inspectorTask.id, subtaskId, delta })
              }
              onAddComment={(body, replyToId) =>
                dispatch({
                  type: 'add-task-comment',
                  taskId: inspectorTask.id,
                  authorId: currentUser.id,
                  body,
                  replyToId,
                })
              }
            />
          )}

          {inspectorConversation && (
            <ConversationInspector
              conversation={inspectorConversation}
              messages={state.messages}
              pinned={isPinned(inspectorConversation.id)}
              muted={isMuted(inspectorConversation.id)}
              onTogglePin={() =>
                dispatch({ type: 'toggle-conversation-pin', conversationId: inspectorConversation.id })
              }
              onToggleMute={() =>
                dispatch({ type: 'toggle-conversation-mute', conversationId: inspectorConversation.id })
              }
              onClose={closeInspector}
            />
          )}
        </Drawer>
      </div>

      {/* Single live region for non-visual state changes (board moves, task creation). */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.announcement}
      </div>
    </div>
  );
}
