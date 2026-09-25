'use client';

import { useMemo, useState } from 'react';
import type { Task } from '@taskin/contracts';
import { cn } from '@/lib/cn';
import {
  JALALI_WEEKDAYS_SHORT,
  addDays,
  daysBetween,
  formatJalali,
  gregorianToJalali,
  jalaliWeekdayIndex,
  parseISODate,
  toISODate,
  toPersianDigits,
} from '@taskin/jalali';
import { formatCount } from '@/lib/format';
import { statusLabel, statusTone } from '@/data/reference';
import { projectById, usersByIds } from '@/store/selectors';
import { AvatarStack, Badge, Button, EmptyState } from '@/components/ui';
import { ChevronBackwardIcon, ChevronForwardIcon, GanttIcon } from '@/components/icons';

export interface GanttViewProps {
  readonly tasks: readonly Task[];
  readonly onOpenTask: (taskId: string) => void;
  readonly selectedTaskId: string | null;
}

const BAR_TONE: Readonly<Record<Task['status'], string>> = {
  todo: 'bg-status-todo',
  'in-progress': 'bg-status-progress',
  review: 'bg-status-review',
  done: 'bg-status-done',
};

const WINDOW_DAYS = 28;
const GRID_TEMPLATE = `14rem repeat(${WINDOW_DAYS}, minmax(1.75rem, 1fr))`;

/**
 * Jalali Gantt.
 *
 * The timeline is a CSS grid of one column per day. Because the container inherits
 * `dir="rtl"`, column 1 is the right-most cell and bars naturally run right-to-left — no
 * coordinate mirroring is needed, only `gridColumnStart` / `gridColumnEnd`.
 *
 * Thursday and Friday (Jalali weekday indices 5 and 6) are shaded as the Iranian weekend.
 *
 * Layering, bottom to top, so bars glide *under* the titles when the timeline scrolls:
 *   z-0   day grid lines and weekend/today shading
 *   z-10  task duration bars
 *   z-20  the task name/code column — `sticky start-0` (the right edge in RTL), opaque
 *   z-30  the calendar header — `sticky top-0`, above everything as rows scroll under it
 */
export function GanttView({ tasks, onOpenTask, selectedTaskId }: GanttViewProps) {
  const [windowStart, setWindowStart] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return toISODate(today);
  });

  const days = useMemo(
    () =>
      Array.from({ length: WINDOW_DAYS }, (_, index) => {
        const iso = addDays(windowStart, index);
        const date = parseISODate(iso);
        const jalali = gregorianToJalali(date);
        const weekdayIndex = jalaliWeekdayIndex(date);
        return {
          iso,
          jalali,
          weekdayIndex,
          isWeekend: weekdayIndex === 5 || weekdayIndex === 6,
          isToday: daysBetween(date, new Date()) === 0,
        };
      }),
    [windowStart],
  );

  const rows = useMemo(
    () =>
      tasks
        .map((task) => {
          const startOffset = daysBetween(parseISODate(windowStart), parseISODate(task.startDate));
          const endOffset = daysBetween(parseISODate(windowStart), parseISODate(task.dueDate));
          // Clip to the visible window; skip tasks entirely outside it.
          const from = Math.max(0, startOffset);
          const to = Math.min(WINDOW_DAYS - 1, endOffset);
          if (endOffset < 0 || startOffset > WINDOW_DAYS - 1) return null;
          return {
            task,
            column: from + 1,
            span: Math.max(1, to - from + 1),
            clippedStart: startOffset < 0,
            clippedEnd: endOffset > WINDOW_DAYS - 1,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    [tasks, windowStart],
  );

  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<GanttIcon size={26} />}
        title="وظیفه‌ای برای نمایش در گانت نیست"
        description="فیلترها را تغییر دهید تا بازه زمانی وظایف نمایش داده شود."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-secondary px-4 py-3">
        <h3 className="text-title-sm font-semibold text-fg-primary">نمای گانت شمسی</h3>
        {firstDay && lastDay && (
          <span className="numeric text-caption text-fg-tertiary">
            {`${formatJalali(firstDay.iso, 'medium')} تا ${formatJalali(lastDay.iso, 'medium')}`}
          </span>
        )}
        <div className="ms-auto flex items-center gap-1.5">
          <Button
            size="xs"
            variant="secondary"
            iconStart={<ChevronBackwardIcon size={16} />}
            onClick={() => setWindowStart((current) => addDays(current, -7))}
          >
            هفته قبل
          </Button>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              const today = new Date();
              today.setDate(today.getDate() - 7);
              setWindowStart(toISODate(today));
            }}
          >
            امروز
          </Button>
          <Button
            size="xs"
            variant="secondary"
            iconEnd={<ChevronForwardIcon size={16} />}
            onClick={() => setWindowStart((current) => addDays(current, 7))}
          >
            هفته بعد
          </Button>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-auto">
        <div className="min-w-[60rem]">
          {/* Header row: day numbers + weekday initials */}
          <div
            className="sticky top-0 z-30 grid border-b border-secondary bg-surface"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            {/* Corner cell: pinned on both axes, opaque over the day cells it covers. */}
            <div className="sticky start-0 z-10 border-e border-secondary bg-surface px-3 py-2 text-title-sm font-semibold text-fg-secondary">
              وظیفه
            </div>
            {days.map((day) => (
              <div
                key={day.iso}
                className={cn(
                  'flex flex-col items-center justify-center py-1.5 text-micro',
                  day.isWeekend && 'bg-sunken',
                  day.isToday && 'bg-brand-subtle',
                )}
              >
                <span className="text-fg-quaternary">{JALALI_WEEKDAYS_SHORT[day.weekdayIndex]}</span>
                <span
                  className={cn(
                    'numeric font-semibold',
                    day.isToday ? 'text-fg-brand' : 'text-fg-secondary',
                  )}
                >
                  {toPersianDigits(day.jalali.day)}
                </span>
              </div>
            ))}
          </div>

          {/* Task rows */}
          <ul>
            {rows.map(({ task, column, span, clippedStart, clippedEnd }) => {
              const assignees = usersByIds(task.assigneeIds);
              const project = projectById(task.projectId);
              const selected = selectedTaskId === task.id;

              return (
                <li
                  key={task.id}
                  className={cn(
                    'group/row grid items-center border-b border-tertiary transition-colors hover:bg-hover',
                    selected && 'bg-brand-subtle',
                  )}
                  style={{ gridTemplateColumns: GRID_TEMPLATE }}
                >
                  {/*
                    Opaque (never transparent) so a bar scrolled beneath it is fully hidden; it
                    repaints the row's hover/selected tint itself for the same reason.
                  */}
                  <div
                    className={cn(
                      'sticky start-0 z-20 flex h-full min-w-0 items-center gap-2 border-e border-secondary px-3 py-2 transition-colors',
                      selected ? 'bg-brand-subtle' : 'bg-surface group-hover/row:bg-hover',
                    )}
                    style={{ gridRow: 1, gridColumn: 1 }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-caption font-semibold text-fg-primary">{task.title}</span>
                      <span className="numeric truncate text-micro text-fg-tertiary">
                        {`${task.code}، ${project?.name ?? ''}`}
                      </span>
                    </span>
                    {assignees.length > 0 && <AvatarStack members={assignees} max={2} size="xs" />}
                  </div>

                  {/* Weekend/today shading sits under the bar as its own grid children. */}
                  {days.map((day, dayIndex) => (
                    <div
                      key={`${task.id}-${day.iso}`}
                      aria-hidden="true"
                      className={cn(
                        'relative z-0 h-10 border-e border-tertiary/60',
                        day.isWeekend && 'bg-sunken/70',
                        day.isToday && 'bg-brand-subtle/60',
                      )}
                      style={{ gridRow: 1, gridColumn: dayIndex + 2 }}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    aria-label={`${task.title} — از ${formatJalali(task.startDate, 'medium')} تا ${formatJalali(task.dueDate, 'medium')}`}
                    style={{ gridRow: 1, gridColumnStart: column + 1, gridColumnEnd: `span ${span}` }}
                    className={cn(
                      // Dark mode lifts status fills to light tints, so the label flips to ink
                      // to keep AA contrast on every bar.
                      'relative z-10 mx-0.5 flex h-6 items-center gap-1.5 px-2 text-micro font-semibold text-white transition-transform hover:scale-[1.02] dark:text-gray-950',
                      BAR_TONE[task.status],
                      // A clipped edge stays square so it reads as "continues beyond the window".
                      !clippedStart && 'rounded-s-full',
                      !clippedEnd && 'rounded-e-full',
                    )}
                  >
                    <span className="truncate">{task.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {rows.length === 0 && (
            <EmptyState
              compact
              icon={<GanttIcon size={20} />}
              title="در این بازه وظیفه‌ای نیست"
              description="با دکمه‌های هفته قبل و بعد بازه را جابه‌جا کنید."
            />
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-secondary px-4 py-2.5">
        <span className="numeric text-caption text-fg-tertiary">
          {`${formatCount(rows.length)} وظیفه در بازه نمایش`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {(['todo', 'in-progress', 'review', 'done'] as const).map((status) => (
            <Badge key={status} tone={statusTone(status)} size="sm" dot>
              {statusLabel(status)}
            </Badge>
          ))}
        </div>
      </footer>
    </div>
  );
}
