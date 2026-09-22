'use client';

import { cn } from '@/lib/cn';
import { formatJalali, toPersianDigits } from '@/lib/jalali';
import type { CalendarCell } from '@/lib/jalali';
import type { DayBucket } from './day-index';
import { bucketTotal } from './day-index';
import { AddIcon } from '@/components/icons';

export interface CalendarDayCellProps {
  readonly cell: CalendarCell;
  readonly bucket: DayBucket;
  readonly selected: boolean;
  readonly onSelect: (iso: string) => void;
  /** Double-click, or the hover "+", opens the composer pre-filled with this date. */
  readonly onQuickCreate: (iso: string) => void;
}

/**
 * A single day in the month grid.
 *
 * The cell is one button so the whole surface is a single keyboard target; the quick-create
 * "+" is a nested button that stops propagation. Because a nested button cannot live inside
 * a button, the cell itself is a `div` with `role="gridcell"` semantics driven by an inner
 * pressable region — keeping both actions independently reachable by keyboard.
 */
export function CalendarDayCell({
  cell,
  bucket,
  selected,
  onSelect,
  onQuickCreate,
}: CalendarDayCellProps) {
  const total = bucketTotal(bucket);
  const isFriday = cell.weekdayIndex === 6;
  const pendingCount = bucket.pending.length + bucket.recurring.length;
  const doneCount = bucket.completed.length;
  const eventCount = bucket.entries.length;

  const summary = [
    pendingCount > 0 ? `${toPersianDigits(pendingCount)} وظیفه باز` : null,
    doneCount > 0 ? `${toPersianDigits(doneCount)} انجام‌شده` : null,
    eventCount > 0 ? `${toPersianDigits(eventCount)} رویداد` : null,
  ]
    .filter(Boolean)
    .join('، ');

  return (
    <div
      role="gridcell"
      aria-selected={selected}
      className={cn(
        'group/day relative flex min-h-16 flex-col rounded-lg border transition-colors sm:min-h-20',
        selected
          ? 'border-brand bg-brand-subtle'
          : 'border-transparent hover:border-secondary hover:bg-hover',
        !cell.inCurrentMonth && 'opacity-40',
      )}
    >
      <button
        type="button"
        aria-current={cell.isToday ? 'date' : undefined}
        aria-label={`${formatJalali(cell.iso, 'long')}${summary ? ` — ${summary}` : ' — بدون برنامه'}`}
        onClick={() => onSelect(cell.iso)}
        onDoubleClick={() => onQuickCreate(cell.iso)}
        className="flex flex-1 flex-col items-center gap-1 rounded-lg p-1.5"
      >
        <span
          className={cn(
            'numeric flex size-7 items-center justify-center rounded-full text-body-sm font-semibold',
            cell.isToday && 'bg-brand-solid text-fg-on-brand',
            !cell.isToday && isFriday && 'text-status-blocked',
            !cell.isToday && !isFriday && 'text-fg-primary',
          )}
        >
          {toPersianDigits(cell.jalali.day)}
        </span>

        {total > 0 && (
          <span className="flex flex-wrap items-center justify-center gap-1" aria-hidden="true">
            {pendingCount > 0 && (
              <span className="numeric inline-flex items-center gap-0.5 rounded-full bg-status-progress-subtle px-1 text-[0.5625rem] font-semibold leading-4 text-status-progress">
                <span className="size-1 rounded-full bg-status-progress" />
                {toPersianDigits(pendingCount)}
              </span>
            )}
            {doneCount > 0 && (
              <span className="numeric inline-flex items-center gap-0.5 rounded-full bg-status-done-subtle px-1 text-[0.5625rem] font-semibold leading-4 text-status-done">
                <span className="size-1 rounded-full bg-status-done" />
                {toPersianDigits(doneCount)}
              </span>
            )}
            {eventCount > 0 && (
              <span className="numeric inline-flex items-center gap-0.5 rounded-full bg-status-review-subtle px-1 text-[0.5625rem] font-semibold leading-4 text-status-review">
                <span className="size-1 rounded-full bg-status-review" />
                {toPersianDigits(eventCount)}
              </span>
            )}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onQuickCreate(cell.iso);
        }}
        aria-label={`ثبت وظیفه یا رویداد برای ${formatJalali(cell.iso, 'long')}`}
        title="ثبت وظیفه / رویداد برای این روز"
        className={cn(
          'absolute end-1 top-1 flex size-5 items-center justify-center rounded-md bg-surface text-fg-tertiary shadow-xs ring-1 ring-inset ring-black/[0.06] transition-opacity',
          'opacity-0 hover:text-fg-brand focus-visible:opacity-100 group-hover/day:opacity-100',
        )}
      >
        <AddIcon size={13} />
      </button>
    </div>
  );
}
