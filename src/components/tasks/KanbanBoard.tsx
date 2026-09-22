'use client';

import { useCallback, useRef, useState } from 'react';
import type { Task, TaskStatus } from '@/types';
import { TASK_STATUSES, statusLabel } from '@/data/reference';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { tasksByStatus } from '@/store/selectors';
import { Badge, EmptyState, IconButton, Tooltip } from '@/components/ui';
import { TaskCard } from './TaskCard';
import { AddIcon, TaskSquareIcon } from '@/components/icons';

export interface KanbanBoardProps {
  readonly tasks: readonly Task[];
  readonly onOpenTask: (taskId: string) => void;
  readonly onMoveTask: (taskId: string, status: TaskStatus) => void;
  readonly onCreateTask: (status: TaskStatus) => void;
  readonly selectedTaskId: string | null;
  readonly onAnnounce: (message: string) => void;
}

const COLUMN_TONE: Readonly<Record<TaskStatus, string>> = {
  todo: 'bg-status-todo',
  'in-progress': 'bg-status-progress',
  review: 'bg-status-review',
  done: 'bg-status-done',
};

/**
 * Kanban board with two equivalent reordering paths:
 *
 *  - Pointer: native HTML5 drag and drop between columns.
 *  - Keyboard: focus a card, Space/Enter picks it up, ArrowLeft/ArrowRight (direction-aware
 *    in RTL) move it between columns, Space drops it and Escape cancels. Every transition is
 *    announced through the shell's live region, so the operation is fully non-visual.
 */
export function KanbanBoard({
  tasks,
  onOpenTask,
  onMoveTask,
  onCreateTask,
  selectedTaskId,
  onAnnounce,
}: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const commitMove = useCallback(
    (taskId: string, status: TaskStatus, viaKeyboard: boolean) => {
      onMoveTask(taskId, status);
      const task = tasks.find((entry) => entry.id === taskId);
      if (task) {
        onAnnounce(`وظیفه «${task.title}» به ستون ${statusLabel(status)} منتقل شد.`);
      }
      if (viaKeyboard) {
        // Focus follows the card across the DOM move.
        requestAnimationFrame(() => cardRefs.current.get(taskId)?.focus());
      }
    },
    [onMoveTask, onAnnounce, tasks],
  );

  const handleCardKeyDown = useCallback(
    (task: Task) => (event: React.KeyboardEvent<HTMLElement>) => {
      const columnIndex = TASK_STATUSES.findIndex((entry) => entry.id === task.status);

      if (event.key === ' ') {
        event.preventDefault();
        if (grabbedId === task.id) {
          setGrabbedId(null);
          onAnnounce(`وظیفه «${task.title}» در ستون ${statusLabel(task.status)} رها شد.`);
        } else {
          setGrabbedId(task.id);
          onAnnounce(
            `وظیفه «${task.title}» برداشته شد. با کلیدهای جهت‌نما جابه‌جا کنید و با فاصله رها کنید.`,
          );
        }
        return;
      }

      if (event.key === 'Escape' && grabbedId === task.id) {
        event.preventDefault();
        setGrabbedId(null);
        onAnnounce('جابه‌جایی لغو شد.');
        return;
      }

      if (grabbedId !== task.id) return;

      // RTL board: ArrowLeft advances to the next column, ArrowRight goes back.
      const delta = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
      if (delta === 0) return;

      event.preventDefault();
      const nextIndex = columnIndex + delta;
      const nextColumn = TASK_STATUSES[nextIndex];
      if (!nextColumn) {
        onAnnounce('انتهای بورد است.');
        return;
      }
      commitMove(task.id, nextColumn.id, true);
    },
    [grabbedId, commitMove, onAnnounce],
  );

  return (
    <div
      className="scrollbar-thin flex h-full min-h-0 gap-4 overflow-x-auto p-4"
      role="application"
      aria-label="بورد کانبان وظایف"
    >
      {TASK_STATUSES.map((column) => {
        const columnTasks = tasksByStatus(tasks, column.id);
        const isDropTarget = dropTarget === column.id;

        return (
          <section
            key={column.id}
            aria-label={`ستون ${column.label}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(column.id);
            }}
            onDragLeave={() => setDropTarget((current) => (current === column.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData('text/plain');
              setDropTarget(null);
              setDraggingId(null);
              if (taskId) commitMove(taskId, column.id, false);
            }}
            className={cn(
              // Columns share the row and only overflow once they hit their minimum, so a
              // 1440px viewport shows all four without a horizontal scrollbar.
              'flex min-w-[15rem] flex-1 flex-col rounded-2xl border bg-sunken/60 transition-colors',
              isDropTarget ? 'border-brand bg-brand-subtle/50' : 'border-secondary',
            )}
          >
            <header className="flex items-center gap-2 px-3 py-3">
              <span className={cn('size-2 shrink-0 rounded-full', COLUMN_TONE[column.id])} aria-hidden="true" />
              <h3 className="text-title-sm font-semibold text-fg-primary">{column.label}</h3>
              <Badge tone="neutral" size="sm" numeric>
                {formatCount(columnTasks.length)}
              </Badge>
              <Tooltip content={`افزودن وظیفه به ${column.label}`}>
                <IconButton
                  label={`افزودن وظیفه به ${column.label}`}
                  icon={<AddIcon size={16} />}
                  size="xs"
                  className="ms-auto"
                  onClick={() => onCreateTask(column.id)}
                />
              </Tooltip>
            </header>

            <div className="scrollbar-thin flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
              {columnTasks.length === 0 ? (
                <EmptyState
                  compact
                  icon={<TaskSquareIcon size={18} />}
                  title="ستون خالی است"
                  description="کارتی را به اینجا بکشید یا وظیفه جدیدی بسازید."
                />
              ) : (
                columnTasks.map((task) => (
                  <div
                    key={task.id}
                    ref={(node) => {
                      const element = node?.firstElementChild;
                      if (element instanceof HTMLElement) {
                        cardRefs.current.set(task.id, element);
                      } else {
                        cardRefs.current.delete(task.id);
                      }
                    }}
                    className={cn('transition-opacity', draggingId === task.id && 'opacity-40')}
                  >
                    <TaskCard
                      task={task}
                      onOpen={onOpenTask}
                      selected={selectedTaskId === task.id}
                      grabbed={grabbedId === task.id}
                      onKeyDown={handleCardKeyDown(task)}
                      dragHandlers={{
                        onDragStart: (event) => {
                          event.dataTransfer.setData('text/plain', task.id);
                          event.dataTransfer.effectAllowed = 'move';
                          setDraggingId(task.id);
                        },
                        onDragEnd: () => {
                          setDraggingId(null);
                          setDropTarget(null);
                        },
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
