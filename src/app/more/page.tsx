'use client';

import Link from 'next/link';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { useOverlays } from '@/components/overlays/OverlayProvider';
import { WORKSPACE } from '@/data/workspace';
import { roleLabel } from '@/data/reference';
import { formatCount } from '@/lib/format';
import { AppShell } from '@/components/layout/AppShell';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { Avatar, Badge } from '@/components/ui';
import {
  ChevronForwardIcon,
  KeyIcon,
  LogoutIcon,
  NotebookIcon,
  PeopleIcon,
  SettingsIcon,
  ShieldIcon,
  UserAddIcon,
  UserIcon,
} from '@/components/icons';

const LINKS = [
  { href: '/notes', label: 'یادداشت‌ها', description: 'دفترچه‌های شخصی، کاری و صورت‌جلسه‌ها', Icon: NotebookIcon },
  { href: '/directory', label: 'اعضای سازمان', description: 'فهرست همکاران و اطلاعات تماس', Icon: PeopleIcon },
  { href: '/settings/roles', label: 'نقش‌ها و دسترسی‌ها', description: 'مدیریت سطوح دسترسی', Icon: ShieldIcon },
] as const;

/** Mobile "بیشتر" tab: profile, theme switcher, notes, directory and account actions. */
export default function MorePage() {
  return (
    <AppShell>
      <MoreContent />
    </AppShell>
  );
}

function MoreContent() {
  const { currentUser, state } = useWorkspace();
  const { open } = useOverlays();

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4">
      <section className="mb-5 flex items-center gap-3 rounded-xl border border-secondary bg-surface p-4 shadow-xs">
        <Avatar
          name={currentUser.fullName}
          initials={currentUser.initials}
          tone={currentUser.avatarTone}
          size="xl"
          presence={currentUser.presence}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-title font-bold text-fg-primary">{currentUser.fullName}</span>
          <span className="truncate text-caption text-fg-tertiary">
            {state.profile.statusMessage || currentUser.jobTitle}
          </span>
          <Badge tone="brand" size="sm" className="self-start">
            {roleLabel(currentUser.role)}
          </Badge>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-secondary bg-surface p-3 shadow-xs">
        <h2 className="mb-1 px-1 text-title-sm font-semibold text-fg-primary">فضای کاری</h2>
        <p className="numeric px-1 text-caption text-fg-tertiary">
          {`${WORKSPACE.name}، ${formatCount(WORKSPACE.memberCount)} عضو، طرح ${WORKSPACE.plan}`}
        </p>
      </section>

      <section className="mb-5 rounded-xl border border-secondary bg-surface p-3 shadow-xs">
        <h2 className="mb-2 px-1 text-title-sm font-semibold text-fg-primary">پوسته و رنگ سازمان</h2>
        <ThemePicker className="w-full" />
      </section>

      <nav aria-label="تنظیمات بیشتر" className="flex flex-col gap-2">
        {LINKS.map(({ href, label, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-secondary bg-surface p-3.5 shadow-xs transition-colors hover:border-brand"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-brand">
              <Icon size={20} variant="twotone" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-sm font-semibold text-fg-primary">{label}</span>
              <span className="truncate text-micro text-fg-tertiary">{description}</span>
            </span>
            <ChevronForwardIcon size={18} className="shrink-0 text-fg-quaternary" />
          </Link>
        ))}

        <ActionRow
          label="دعوت همکار"
          description="دعوت با ایمیل، نقش و دپارتمان"
          icon={<UserAddIcon size={20} variant="twotone" />}
          onClick={() => open({ kind: 'invite-member' })}
        />
        <ActionRow
          label="پروفایل من"
          description="وضعیت حضور و پیام وضعیت"
          icon={<UserIcon size={20} variant="twotone" />}
          onClick={() => open({ kind: 'profile' })}
        />
        <ActionRow
          label="امنیت و ورود"
          description="رمز عبور، ورود دومرحله‌ای و نشست‌ها"
          icon={<KeyIcon size={20} variant="twotone" />}
          onClick={() => open({ kind: 'security' })}
        />

        <button
          type="button"
          className="flex items-center gap-3 rounded-xl border border-secondary bg-surface p-3.5 text-start shadow-xs transition-colors hover:border-brand"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-brand">
            <SettingsIcon size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-sm font-semibold text-fg-primary">تنظیمات فضای کاری</span>
            <span className="truncate text-micro text-fg-tertiary">نام سازمان، دامنه و یکپارچه‌سازی‌ها</span>
          </span>
          <ChevronForwardIcon size={18} className="shrink-0 text-fg-quaternary" />
        </button>

        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => open({ kind: 'sign-out' })}
          className="mt-2 flex items-center gap-3 rounded-xl border border-secondary bg-surface p-3.5 text-start text-status-blocked shadow-xs transition-colors hover:border-status-blocked-line"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-status-blocked-subtle">
            <LogoutIcon size={20} />
          </span>
          <span className="flex-1 text-body-sm font-semibold">خروج از حساب کاربری</span>
        </button>
      </nav>
    </div>
  );
}

interface ActionRowProps {
  readonly label: string;
  readonly description: string;
  readonly icon: React.ReactNode;
  readonly onClick: () => void;
}

function ActionRow({ label, description, icon, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-secondary bg-surface p-3.5 text-start shadow-xs transition-colors hover:border-brand"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-brand">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-sm font-semibold text-fg-primary">{label}</span>
        <span className="truncate text-micro text-fg-tertiary">{description}</span>
      </span>
      <ChevronForwardIcon size={18} className="shrink-0 text-fg-quaternary" />
    </button>
  );
}
