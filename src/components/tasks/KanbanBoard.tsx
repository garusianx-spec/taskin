'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { BoardColumn, TagTone, Task } from '@/types';
import { TAG_TONES, statusLabel } from '@/data/reference';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { TAG_DOT, TAG_STRIPE } from '@/lib/tag-tone';
import { columnForTask, tasksInColumn } from '@/store/selectors';
import { useNamespacedId } from '@/hooks/useId';
import { useRovingFocus } from '@/hooks/useRovingFocus';
import { Badge, Button, EmptyState, IconButton, Input, Tooltip } from '@/components/ui';
import { TaskCard } from './TaskCard';
import { ColumnDot } from './ColumnDot';
import { AddIcon, CheckIcon, TaskSquareIcon, TrashIcon } from '@/components/icons';

export interface KanbanBoardProps {
  readonly tasks: readonly Task[];
  readonly columns: readonly BoardColumn[];
  readonly onOpenTask: (taskId: string) => void;
  readonly onMoveTask: (taskId: string, columnId: string) => void;
  readonly onToggleComplete: (taskId: string, completed: boolean) => void;
  readonly onCreateTask: (column: BoardColumn) => void;
  readonly onAddColumn: (title: string, tone: TagTone) => void;
  readonly onRemoveColumn: (columnId: string) => void;
  readonly selectedTaskId: string | null;
  readonly onAnnounce: (message: string) => void;
}

/**
 * Kanban board with two equivalent reordering paths:
 *
 *  - Pointer: native HTML5 drag and drop between columns.
 *  - Keyboard: focus a card, Space picks it up, ArrowLeft/ArrowRight (direction-aware in
 *    RTL) move it between columns, Space drops it and Escape cancels. Every transition is
 *    announced through the shell's live region, so the operation is fully non-visual.
 *
 * Columns come from workspace state: the four built-ins plus any the team adds from the
 * dashed "افزودن ستون جدید" card at the board's far (inline-end) edge.
 */
export function KanbanBoard({
  tasks,
  columns,
  onOpenTask,
  onMoveTask,
  onToggleComplete,
  onCreateTask,
  onAddColumn,
  onRemoveColumn,
  selectedTaskId,
  onAnnounce,
}: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
  const knownColumns = useRef<readonly string[]>(columns.map((column) => column.id));
  const hintId = useNamespacedId('kanban-hint-');

  // Bring a freshly added column into view; it lands at the scrolled-away end of the board.
  useEffect(() => {
    const added = columns.find((column) => !knownColumns.current.includes(column.id));
    knownColumns.current = columns.map((column) => column.id);
    if (added) {
      columnRefs.current.get(added.id)?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [columns]);

  const commitMove = useCallback(
    (taskId: string, column: BoardColumn, viaKeyboard: boolean) => {
      onMoveTask(taskId, column.id);
      const task = tasks.find((entry) => entry.id === taskId);
      if (task) onAnnounce(`وظیفه «${task.title}» به ستون ${column.title} منتقل شد.`);
      if (viaKeyboard) {
        // Focus follows the card across the DOM move.
        requestAnimationFrame(() => cardRefs.current.get(taskId)?.focus());
      }
    },
    [onMoveTask, onAnnounce, tasks],
  );

  const handleCardKeyDown = useCallback(
    (task: Task) => (event: React.KeyboardEvent<HTMLElement>) => {
      // Keys typed inside the card's own controls (the checkbox) are theirs to handle.
      if (event.target !== event.currentTarget) return;
      const current = columnForTask(columns, task);

      if (event.key === ' ') {
        event.preventDefault();
        if (grabbedId === task.id) {
          setGrabbedId(null);
          onAnnounce(`وظیفه «${task.title}» در ستون ${current?.title ?? statusLabel(task.status)} رها شد.`);
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
      const columnIndex = columns.findIndex((column) => column.id === current?.id);
      const nextColumn = columns[columnIndex + delta];
      if (!nextColumn) {
        onAnnounce(delta > 0 ? 'انتهای بورد است.' : 'ابتدای بورد است.');
        return;
      }
      commitMove(task.id, nextColumn, true);
    },
    [grabbedId, columns, commitMove, onAnnounce],
  );

  return (
    <div
      className="scrollbar-thin flex h-full min-h-0 gap-4 overflow-x-auto p-4"
      role="application"
      aria-label="بورد کانبان وظایف"
    >
      <p id={hintId} className="sr-only">
        Enter برای باز کردن وظیفه، فاصله برای برداشتن و جابه‌جایی با کلیدهای جهت‌نما.
      </p>

      {columns.map((column) => {
        const columnTasks = tasksInColumn(tasks, column);
        const isDropTarget = dropTarget === column.id;

        return (
          <section
            key={column.id}
            ref={(node) => {
              if (node) columnRefs.current.set(column.id, node);
              else columnRefs.current.delete(column.id);
            }}
            aria-label={`ستون ${column.title}`}
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
              if (taskId) commitMove(taskId, column, false);
            }}
            className={cn(
              // Columns share the row and only overflow once they hit their minimum, so a
              // 1440px viewport still shows the four built-ins beside the add-column card.
              'flex min-w-[13rem] flex-1 flex-col rounded-2xl border bg-sunken/60 transition-colors',
              isDropTarget ? 'border-brand bg-brand-subtle/50' : 'border-secondary',
              // A custom column carries its accent as a top stripe (declared after the
              // border colour so the stripe's top-edge colour wins).
              column.tone && cn('border-t-[3px]', TAG_STRIPE[column.tone]),
            )}
          >
            <header className="flex items-center gap-2 px-3 py-3">
              <ColumnDot column={column} />
              <h3 className="truncate text-title-sm font-semibold text-fg-primary">{column.title}</h3>
              <Badge tone="neutral" size="sm" numeric>
                {formatCount(columnTasks.length)}
              </Badge>
              <span className="ms-auto flex items-center gap-0.5">
                {column.custom && (
                  <Tooltip content="حذف ستون؛ کارت‌ها به «در حال انجام» برمی‌گردند">
                    <IconButton
                      label={`حذف ستون ${column.title}`}
                      icon={<TrashIcon size={15} />}
                      size="xs"
                      className="hover:text-status-blocked"
                      onClick={() => onRemoveColumn(column.id)}
                    />
                  </Tooltip>
                )}
                <Tooltip content={`افزودن وظیفه به ${column.title}`}>
                  <IconButton
                    label={`افزودن وظیفه به ${column.title}`}
                    icon={<AddIcon size={16} />}
                    size="xs"
                    onClick={() => onCreateTask(column)}
                  />
                </Tooltip>
              </span>
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
                      describedBy={hintId}
                      onKeyDown={handleCardKeyDown(task)}
                      onToggleComplete={(completed) => onToggleComplete(task.id, completed)}
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

      <AddColumnCard existingTitles={columns.map((column) => column.title)} onAdd={onAddColumn} />
    </div>
  );
}

interface AddColumnCardProps {
  readonly existingTitles: readonly string[];
  readonly onAdd: (title: string, tone: TagTone) => void;
}

/**
 * Dashed "+ افزودن ستون جدید" card. Collapsed it is a single button; activated it becomes an
 * inline form — column name plus an accent colour — that appends the column on submit.
 */
function AddColumnCard({ existingTitles, onAdd }: AddColumnCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [tone, setTone] = useState<TagTone>('blue');
  const [error, setError] = useState<string | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const id = useNamespacedId('add-column-');
  const { registerItem, onKeyDown } = useRovingFocus(TAG_TONES.length, 'horizontal', {
    onActivate: (index) => {
      const entry = TAG_TONES[index];
      if (entry) setTone(entry.id);
    },
  });

  const reset = () => {
    setEditing(false);
    setTitle('');
    setTone('blue');
    setError(undefined);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      setError('نام ستون را وارد کنید.');
      return;
    }
    if (existingTitles.some((existing) => existing.trim() === name)) {
      setError('ستونی با این نام وجود دارد.');
      return;
    }
    onAdd(name, tone);
    reset();
  };

  if (!editing) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          'flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary px-3 text-center',
          'text-body-sm font-semibold text-fg-tertiary transition-colors',
          'hover:border-brand hover:bg-brand-subtle/40 hover:text-fg-brand',
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-sunken" aria-hidden="true">
          <AddIcon size={20} />
        </span>
        افزودن ستون جدید
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          reset();
        }
      }}
      aria-labelledby={`${id}-title`}
      className="flex w-72 shrink-0 animate-scale-in flex-col gap-3 self-start rounded-2xl border-2 border-dashed border-brand bg-surface p-3 shadow-xs"
    >
      <h3 id={`${id}-title`} className="text-title-sm font-semibold text-fg-primary">
        ستون جدید
      </h3>
      <Input
        label="نام ستون"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          setError(undefined);
        }}
        placeholder="مثلاً: تست کیفیت"
        error={error}
        maxLength={32}
        autoFocus
      />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-body-sm font-medium text-fg-secondary">رنگ شاخص</legend>
        <div role="radiogroup" aria-label="رنگ شاخص ستون" onKeyDown={onKeyDown} className="flex flex-wrap gap-1.5">
          {TAG_TONES.map((entry, index) => {
            const selected = entry.id === tone;
            return (
              <button
                key={entry.id}
                ref={registerItem(index)}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={entry.label}
                title={entry.label}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTone(entry.id)}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-surface transition-shadow',
                  TAG_DOT[entry.id],
                  selected ? 'ring-2 ring-brand' : 'hover:ring-2 hover:ring-gray-300',
                )}
              >
                {selected && <CheckIcon size={14} />}
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className="text-micro text-fg-tertiary">کارت‌های این ستون در فیلترها و گزارش‌ها «در حال انجام» شمرده می‌شوند.</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" fullWidth iconStart={<AddIcon size={16} />}>
          افزودن ستون
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={reset}>
          انصراف
        </Button>
      </div>
    </form>
  );
}
