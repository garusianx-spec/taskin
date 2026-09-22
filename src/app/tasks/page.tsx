'use client';

import { useMemo, useState } from 'react';
import type { Task, TaskViewMode } from '@/types';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { filterTasks } from '@/store/selectors';
import { formatJalali } from '@/lib/jalali';
import { formatCount } from '@/lib/format';
import { AppShell, useShellActions } from '@/components/layout/AppShell';
import { TaskSidebar } from '@/components/tasks/TaskSidebar';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskListView } from '@/components/tasks/TaskListView';
import { GanttView } from '@/components/tasks/GanttView';
import { SwipeableTaskRow } from '@/components/tasks/SwipeableTaskRow';
import { PostponeSheet } from '@/components/tasks/PostponeSheet';
import { Badge, Button, EmptyState, SegmentedControl } from '@/components/ui';
import { AddIcon, FilterIcon, GanttIcon, KanbanIcon, ListIcon, TaskSquareIcon } from '@/components/icons';

export default function TasksPage() {
  const { state, dispatch, currentUser } = useWorkspace();
  // Mobile only: the contextual sidebar is a togglable panel rather than the tab body,
  // so the task list itself is what the "وظایف من" tab opens on.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const tasks = useMemo(
    () =>
      filterTasks(state.tasks, {
        smartView: state.smartView,
        projectId: state.projectFilterId,
        search: state.taskSearch,
        currentUserId: currentUser.id,
      }),
    [state.tasks, state.smartView, state.projectFilterId, state.taskSearch, currentUser.id],
  );

  return (
    <AppShell
      sidebar={
        <TaskSidebarContainer
          tasks={state.tasks}
          currentUserId={currentUser.id}
          onNavigate={() => setMobileFiltersOpen(false)}
        />
      }
      mobileShowsDetail={!mobileFiltersOpen}
    >
      <TaskWorkspace
        tasks={tasks}
        view={state.taskView}
        onViewChange={(view) => dispatch({ type: 'set-task-view', view })}
        onOpenMobileFilters={() => setMobileFiltersOpen(true)}
      />
    </AppShell>
  );
}

function TaskSidebarContainer({
  tasks,
  currentUserId,
  onNavigate,
}: {
  readonly tasks: readonly Task[];
  readonly currentUserId: string;
  /** Closes the mobile filter panel once a selection is made. */
  readonly onNavigate: () => void;
}) {
  const { state, dispatch } = useWorkspace();
  const { openTaskComposer } = useShellActions();

  return (
    <TaskSidebar
      tasks={tasks}
      smartView={state.smartView}
      projectFilterId={state.projectFilterId}
      search={state.taskSearch}
      currentUserId={currentUserId}
      onSmartViewChange={(view) => {
        dispatch({ type: 'set-smart-view', view });
        onNavigate();
      }}
      onProjectChange={(projectId) => {
        dispatch({ type: 'set-project-filter', projectId });
        onNavigate();
      }}
      onSearchChange={(query) => dispatch({ type: 'set-task-search', query })}
      onCreateTask={() => {
        onNavigate();
        openTaskComposer(null);
      }}
    />
  );
}

interface TaskWorkspaceProps {
  readonly tasks: readonly Task[];
  readonly view: TaskViewMode;
  readonly onViewChange: (view: TaskViewMode) => void;
  readonly onOpenMobileFilters: () => void;
}

function TaskWorkspace({ tasks, view, onViewChange, onOpenMobileFilters }: TaskWorkspaceProps) {
  const { state, dispatch } = useWorkspace();
  const { openTaskComposer } = useShellActions();
  const [postponeTarget, setPostponeTarget] = useState<Task | null>(null);

  const selectedTaskId = state.inspector.kind === 'task' ? state.inspector.taskId : null;
  const openTask = (taskId: string) => dispatch({ type: 'open-task', taskId });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-secondary bg-surface px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h1 className="text-heading-sm font-bold text-fg-primary">پروژه‌ها و وظایف</h1>
          <span className="numeric text-caption text-fg-tertiary">
            {`${formatCount(tasks.length)} وظیفه در نمای فعلی`}
          </span>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            iconStart={<FilterIcon size={16} />}
            onClick={onOpenMobileFilters}
            className="lg:hidden"
          >
            فیلترها
          </Button>
          <SegmentedControl
            ariaLabel="حالت نمایش وظایف"
            size="md"
            value={view}
            onValueChange={onViewChange}
            className="hidden md:inline-flex"
            options={[
              { value: 'board', label: 'بورد', icon: <KanbanIcon size={16} /> },
              { value: 'list', label: 'فهرست', icon: <ListIcon size={16} /> },
              { value: 'gantt', label: 'گانت', icon: <GanttIcon size={16} /> },
            ]}
          />
          <Button
            iconStart={<AddIcon size={18} />}
            onClick={() => openTaskComposer(null)}
            className="hidden sm:inline-flex"
          >
            وظیفه جدید
          </Button>
        </div>
      </header>

      {/* Desktop and tablet: board / list / gantt */}
      <div className="hidden min-h-0 flex-1 md:flex md:flex-col">
        {view === 'board' && (
          <KanbanBoard
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onOpenTask={openTask}
            onMoveTask={(taskId, status) => dispatch({ type: 'move-task', taskId, status })}
            onCreateTask={(status) =>
              openTaskComposer({
                title: '',
                description: '',
                projectId: state.projectFilterId ?? tasks[0]?.projectId ?? '',
                status,
                priority: 'medium',
                assigneeIds: [],
                dueDate: null,
                sourceMessageId: null,
                attachments: [],
              })
            }
            onAnnounce={(message) => dispatch({ type: 'announce', message })}
          />
        )}
        {view === 'list' && (
          <TaskListView tasks={tasks} onOpenTask={openTask} selectedTaskId={selectedTaskId} />
        )}
        {view === 'gantt' && (
          <GanttView tasks={tasks} onOpenTask={openTask} selectedTaskId={selectedTaskId} />
        )}
      </div>

      {/*
        Mobile: a single swipeable list. Board columns do not fit a 375px viewport, so the
        board's semantics move into per-row gestures instead of a horizontal scroller.
      */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
        {tasks.length === 0 ? (
          <EmptyState
            icon={<TaskSquareIcon size={26} />}
            title="وظیفه‌ای یافت نشد"
            description="فیلتر پروژه یا نمای هوشمند را تغییر دهید."
            action={
              <Button size="sm" iconStart={<AddIcon size={16} />} onClick={() => openTaskComposer(null)}>
                وظیفه جدید
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-2 flex items-center gap-2 px-1">
              <Badge tone="neutral" size="sm">
                برای انجام‌شدن به راست و برای تعویق به چپ بکشید
              </Badge>
            </p>
            <ul className="flex flex-col gap-2.5">
              {tasks.map((task) => (
                <SwipeableTaskRow
                  key={task.id}
                  task={task}
                  onOpen={openTask}
                  onComplete={(taskId) => {
                    dispatch({ type: 'move-task', taskId, status: 'done' });
                    dispatch({ type: 'announce', message: `وظیفه «${task.title}» انجام شد.` });
                  }}
                  onPostpone={setPostponeTarget}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <PostponeSheet
        task={postponeTarget}
        onClose={() => setPostponeTarget(null)}
        onPostpone={(taskId, dueDate) => {
          dispatch({ type: 'patch-task', taskId, patch: { dueDate } });
          dispatch({
            type: 'announce',
            message: `مهلت وظیفه تا ${formatJalali(dueDate, 'medium')} تمدید شد.`,
          });
        }}
        onReassign={(taskId, userId) => {
          dispatch({ type: 'patch-task', taskId, patch: { assigneeIds: [userId] } });
          dispatch({ type: 'announce', message: 'وظیفه به همکار جدید ارجاع شد.' });
        }}
      />
    </div>
  );
}
