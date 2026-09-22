'use client';

import { useMemo, useState } from 'react';
import type { AgendaEntry, AgendaEntryKind } from '@/types';
import { AGENDA } from '@/data/workspace';
import { useWorkspace } from '@/store/WorkspaceProvider';
import {
  JALALI_WEEKDAYS_SHORT,
  buildMonthGrid,
  formatJalali,
  gregorianToJalali,
  shiftJalaliMonth,
  toISODate,
  toPersianDigits,
} from '@/lib/jalali';
import { formatCount } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AppShell } from '@/components/layout/AppShell';
import { Badge, Button, EmptyState, IconButton } from '@/components/ui';
import {
  CalendarIcon,
  ChevronBackwardIcon,
  ChevronForwardIcon,
  ClockIcon,
  DocumentIcon,
  NotificationIcon,
  TaskSquareIcon,
} from '@/components/icons';

const KIND_ICONS: Readonly<Record<AgendaEntryKind, typeof CalendarIcon>> = {
  task: TaskSquareIcon,
  meeting: CalendarIcon,
  note: DocumentIcon,
  reminder: NotificationIcon,
};

const KIND_LABELS: Readonly<Record<AgendaEntryKind, string>> = {
  task: 'وظیفه',
  meeting: 'جلسه',
  note: 'یادداشت',
  reminder: 'یادآور',
};

export default function CalendarPage() {
  const { dispatch } = useWorkspace();
  const today = useMemo(() => new Date(), []);
  const [selectedIso, setSelectedIso] = useState(() => toISODate(today));
  const [cursor, setCursor] = useState(() => {
    const jalali = gregorianToJalali(today);
    return { year: jalali.year, month: jalali.month };
  });

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, today),
    [cursor.year, cursor.month, today],
  );

  const entriesByDate = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>();
    for (const entry of AGENDA) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, []);

  const selectedEntries = entriesByDate.get(selectedIso) ?? [];
  const monthLabel = cells.find((cell) => cell.inCurrentMonth)?.iso;

  const step = (delta: number) => {
    const next = shiftJalaliMonth(cursor.year, cursor.month, delta);
    setCursor({ year: next.year, month: next.month });
  };

  return (
    <AppShell>
      <div className="scrollbar-thin h-full overflow-y-auto">
        <header className="flex flex-wrap items-center gap-3 border-b border-secondary bg-surface px-4 py-3 sm:px-6">
          <div className="flex flex-col">
            <h1 className="text-heading-sm font-bold text-fg-primary">تقویم و یادداشت</h1>
            <span className="numeric text-caption text-fg-tertiary">
              {monthLabel ? formatJalali(monthLabel, 'month-year') : ''}
            </span>
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            <IconButton label="ماه قبل" icon={<ChevronBackwardIcon size={18} />} onClick={() => step(-1)} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const jalali = gregorianToJalali(today);
                setCursor({ year: jalali.year, month: jalali.month });
                setSelectedIso(toISODate(today));
              }}
            >
              امروز
            </Button>
            <IconButton label="ماه بعد" icon={<ChevronForwardIcon size={18} />} onClick={() => step(1)} />
          </div>
        </header>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_22rem]">
          <section aria-label="نمای ماهانه" className="rounded-xl border border-secondary bg-surface p-3 shadow-xs">
            <div role="grid" aria-label="تقویم هجری شمسی" className="grid grid-cols-7 gap-1">
              {JALALI_WEEKDAYS_SHORT.map((day) => (
                <div
                  key={day}
                  role="columnheader"
                  className="flex h-8 items-center justify-center text-caption font-semibold text-fg-quaternary"
                >
                  {day}
                </div>
              ))}

              {cells.map((cell) => {
                const entries = entriesByDate.get(cell.iso) ?? [];
                const isSelected = cell.iso === selectedIso;
                const isFriday = cell.weekdayIndex === 6;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-current={cell.isToday ? 'date' : undefined}
                    aria-label={`${formatJalali(cell.iso, 'long')} — ${formatCount(entries.length)} مورد`}
                    onClick={() => setSelectedIso(cell.iso)}
                    className={cn(
                      'flex min-h-16 flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors sm:min-h-20',
                      isSelected
                        ? 'border-brand bg-brand-subtle'
                        : 'border-transparent hover:border-secondary hover:bg-hover',
                      !cell.inCurrentMonth && 'opacity-40',
                    )}
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

                    <span className="flex flex-wrap justify-center gap-0.5">
                      {entries.slice(0, 3).map((entry) => (
                        <span
                          key={entry.id}
                          aria-hidden="true"
                          className={cn(
                            'size-1.5 rounded-full',
                            entry.tone === 'blocked' && 'bg-status-blocked',
                            entry.tone === 'progress' && 'bg-status-progress',
                            entry.tone === 'done' && 'bg-status-done',
                            entry.tone === 'review' && 'bg-status-review',
                            entry.tone === 'todo' && 'bg-status-todo',
                          )}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="برنامه روز انتخاب‌شده" className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-title font-bold text-fg-primary">{formatJalali(selectedIso, 'long')}</h2>
              <Badge tone="neutral" size="sm" numeric className="ms-auto">
                {`${formatCount(selectedEntries.length)} مورد`}
              </Badge>
            </div>

            {selectedEntries.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarIcon size={20} />}
                title="برنامه‌ای برای این روز ثبت نشده"
                description="روز دیگری را انتخاب کنید یا رویداد جدیدی بسازید."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {selectedEntries.map((entry) => {
                  const Icon = KIND_ICONS[entry.kind];
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (entry.relatedTaskId) {
                            dispatch({ type: 'open-task', taskId: entry.relatedTaskId });
                          }
                        }}
                        disabled={entry.relatedTaskId === null}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-xl border border-secondary bg-surface p-3 text-start shadow-xs transition-colors',
                          entry.relatedTaskId ? 'hover:border-brand' : 'cursor-default',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg',
                            entry.tone === 'blocked' && 'bg-status-blocked-subtle text-status-blocked',
                            entry.tone === 'progress' && 'bg-status-progress-subtle text-status-progress',
                            entry.tone === 'done' && 'bg-status-done-subtle text-status-done',
                            entry.tone === 'review' && 'bg-status-review-subtle text-status-review',
                            entry.tone === 'todo' && 'bg-status-todo-subtle text-status-todo',
                          )}
                        >
                          <Icon size={18} variant="twotone" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate text-body-sm font-semibold text-fg-primary">
                            {entry.title}
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge tone="neutral" size="sm">
                              {KIND_LABELS[entry.kind]}
                            </Badge>
                            {entry.startTime && (
                              <span className="numeric inline-flex items-center gap-1 text-micro text-fg-tertiary">
                                <ClockIcon size={12} />
                                {entry.endTime ? `${entry.startTime} تا ${entry.endTime}` : entry.startTime}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
