'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { ActivityKind } from '@/types';
import { ACTIVITY, WORKSPACE } from '@/data/workspace';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { useNow } from '@/hooks/useNow';
import { isOverdue, subtaskProgress, userById } from '@/store/selectors';
import { describeDeadline, formatJalali } from '@/lib/jalali';
import { formatCount, formatPercent } from '@/lib/format';
import { statusLabel, statusTone } from '@/data/reference';
import { cn } from '@/lib/cn';
import { AppShell, useShellActions } from '@/components/layout/AppShell';
import { Avatar, Badge, Button, ProgressBar, RelativeTime } from '@/components/ui';
import {
  AddIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentIcon,
  MessagesIcon,
  TaskSquareIcon,
  UserAddIcon,
  WarningIcon,
} from '@/components/icons';

const ACTIVITY_ICONS: Readonly<Record<ActivityKind, typeof TaskSquareIcon>> = {
  'task-assigned': TaskSquareIcon,
  'task-completed': CheckCircleIcon,
  'task-commented': MessagesIcon,
  'message-mention': MessagesIcon,
  'file-shared': DocumentIcon,
  'member-joined': UserAddIcon,
};

const ACTIVITY_VERBS: Readonly<Record<ActivityKind, string>> = {
  'task-assigned': 'وظیفه‌ای را به شما ارجاع داد',
  'task-completed': 'وظیفه‌ای را انجام‌شده علامت زد',
  'task-commented': 'روی وظیفه‌ای دیدگاه گذاشت',
  'message-mention': 'در گفتگویی به شما اشاره کرد',
  'file-shared': 'فایلی را به اشتراک گذاشت',
  'member-joined': 'به فضای کاری پیوست',
};

export default function FeedPage() {
  return (
    <AppShell>
      <FeedContent />
    </AppShell>
  );
}

function FeedContent() {
  const { state, dispatch, currentUser, totalUnread } = useWorkspace();
  const { openTaskComposer } = useShellActions();

  const myTasks = useMemo(
    () => state.tasks.filter((task) => task.assigneeIds.includes(currentUser.id)),
    [state.tasks, currentUser.id],
  );

  const openTasks = myTasks.filter((task) => task.status !== 'done');
  const overdue = myTasks.filter((task) => isOverdue(task));
  const dueToday = myTasks.filter(
    (task) => task.status !== 'done' && describeDeadline(task.dueDate).text === 'امروز',
  );
  const completionRate =
    myTasks.length === 0 ? 0 : ((myTasks.length - openTasks.length) / myTasks.length) * 100;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <header className="border-b border-secondary bg-surface px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-1">
          <p className="text-caption text-fg-tertiary">{WORKSPACE.name}</p>
          <h1 className="text-display font-extrabold text-fg-primary">
            {`سلام ${currentUser.fullName.split(' ')[0]}، روز خوبی داشته باشی`}
          </h1>
          <TodayLabel />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <section aria-label="خلاصه وضعیت" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="وظایف باز من"
            value={formatCount(openTasks.length)}
            tone="brand"
            Icon={TaskSquareIcon}
          />
          <SummaryCard
            label="سررسید امروز"
            value={formatCount(dueToday.length)}
            tone="progress"
            Icon={ClockIcon}
          />
          <SummaryCard
            label="دارای تأخیر"
            value={formatCount(overdue.length)}
            tone="blocked"
            Icon={WarningIcon}
          />
          <SummaryCard
            label="پیام خوانده‌نشده"
            value={formatCount(totalUnread)}
            tone="review"
            Icon={MessagesIcon}
          />
        </section>

        <section
          aria-label="پیشرفت کلی"
          className="rounded-xl border border-secondary bg-surface p-4 shadow-xs"
        >
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-title font-bold text-fg-primary">پیشرفت وظایف من</h2>
            <Badge tone="brand" size="md" numeric className="ms-auto">
              {formatPercent(completionRate)}
            </Badge>
          </div>
          <ProgressBar
            value={myTasks.length - openTasks.length}
            max={Math.max(myTasks.length, 1)}
            label="درصد وظایف انجام‌شده"
            tone={completionRate >= 70 ? 'done' : 'brand'}
            showFraction={false}
          />
          <p className="numeric mt-2 text-caption text-fg-tertiary">
            {`${formatCount(myTasks.length - openTasks.length)} از ${formatCount(myTasks.length)} وظیفه انجام شده است.`}
          </p>
        </section>

        <section aria-label="وظایف نیازمند اقدام" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-title font-bold text-fg-primary">نیازمند اقدام شما</h2>
            <Button
              size="sm"
              variant="secondary"
              iconStart={<AddIcon size={16} />}
              className="ms-auto"
              onClick={() => openTaskComposer(null)}
            >
              وظیفه جدید
            </Button>
          </div>

          {openTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-primary px-4 py-6 text-center text-body-sm text-fg-tertiary">
              وظیفه بازی به شما ارجاع نشده است.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {openTasks.slice(0, 5).map((task) => {
                const progress = subtaskProgress(task);
                const deadline = describeDeadline(task.dueDate);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'open-task', taskId: task.id })}
                      className="flex w-full items-center gap-3 rounded-xl border border-secondary bg-surface p-3 text-start shadow-xs transition-colors hover:border-brand"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-body-sm font-semibold text-fg-primary">
                          {task.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(task.status)} size="sm" dot>
                            {statusLabel(task.status)}
                          </Badge>
                          <Badge tone={deadline.tone} size="sm" numeric>
                            {deadline.text}
                          </Badge>
                          {progress.total > 0 && (
                            <ProgressBar
                              value={progress.done}
                              max={progress.total}
                              label={`پیشرفت ${task.title}`}
                              className="max-w-28"
                            />
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

        <section aria-label="فعالیت‌های اخیر" className="flex flex-col gap-3">
          <h2 className="text-title font-bold text-fg-primary">فعالیت‌های اخیر سازمان</h2>
          <ul className="flex flex-col gap-1">
            {ACTIVITY.map((item) => {
              const actor = userById(item.actorId);
              const Icon = ACTIVITY_ICONS[item.kind];
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-hover"
                >
                  {actor && (
                    <Avatar
                      name={actor.fullName}
                      initials={actor.initials}
                      tone={actor.avatarTone}
                      size="sm"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-body-sm text-fg-secondary">
                      <span className="font-semibold text-fg-primary">{actor?.fullName ?? 'کاربر'}</span>
                      {` ${ACTIVITY_VERBS[item.kind]}`}
                    </p>
                    <p className="truncate text-caption font-medium text-fg-primary">{item.targetTitle}</p>
                    <p className="numeric truncate text-micro text-fg-tertiary">
                      {`${item.context}، `}
                      <RelativeTime iso={item.createdAt} />
                    </p>
                  </div>
                  <Icon size={18} className="mt-1 shrink-0 text-fg-quaternary" />
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="میان‌برها" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ShortcutCard href="/chats" title="گفتگوها" description="پیام‌های خوانده‌نشده تیم" Icon={MessagesIcon} />
          <ShortcutCard href="/tasks" title="بورد وظایف" description="کانبان، فهرست و گانت شمسی" Icon={TaskSquareIcon} />
          <ShortcutCard href="/settings/roles" title="نقش‌ها و دسترسی‌ها" description="مدیریت سطوح دسترسی سازمان" Icon={UserAddIcon} />
        </section>
      </div>
    </div>
  );
}

/** The visitor's current Jalali date — resolved after mount, since this route is static. */
function TodayLabel() {
  const now = useNow();
  return (
    <p className="numeric text-body text-fg-tertiary" suppressHydrationWarning>
      {now ? formatJalali(now, 'long') : '\u00A0'}
    </p>
  );
}

interface SummaryCardProps {
  readonly label: string;
  readonly value: string;
  readonly tone: 'brand' | 'progress' | 'blocked' | 'review';
  readonly Icon: typeof TaskSquareIcon;
}

function SummaryCard({ label, value, tone, Icon }: SummaryCardProps) {
  const tones: Readonly<Record<SummaryCardProps['tone'], string>> = {
    brand: 'bg-brand-subtle text-fg-brand',
    progress: 'bg-status-progress-subtle text-status-progress',
    blocked: 'bg-status-blocked-subtle text-status-blocked',
    review: 'bg-status-review-subtle text-status-review',
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-secondary bg-surface p-3.5 shadow-xs">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
        <Icon size={20} variant="twotone" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="numeric text-heading font-extrabold leading-tight text-fg-primary">{value}</span>
        <span className="truncate text-caption text-fg-tertiary">{label}</span>
      </span>
    </div>
  );
}

interface ShortcutCardProps {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly Icon: typeof TaskSquareIcon;
}

function ShortcutCard({ href, title, description, Icon }: ShortcutCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-secondary bg-surface p-3.5 shadow-xs transition-colors hover:border-brand"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-brand">
        <Icon size={20} variant="twotone" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-sm font-semibold text-fg-primary">{title}</span>
        <span className="truncate text-micro text-fg-tertiary">{description}</span>
      </span>
    </Link>
  );
}
