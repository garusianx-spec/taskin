'use client';

import { usePathname } from 'next/navigation';
import { MODULES } from '@/data/reference';
import { WORKSPACE, WORKSPACES } from '@/data/workspace';
import { formatCount } from '@/lib/format';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { CountPill, IconButton, Popover } from '@/components/ui';
import { MenuItem, MenuList } from '@/components/ui/Menu';
import { AddIcon, ChevronDownIcon, NotificationIcon, SearchIcon } from '@/components/icons';

export interface TopAppBarProps {
  readonly onSearch: () => void;
}

/**
 * Mobile top bar: workspace badge + switcher, global search and the notification bell.
 * Replaced by `NavRail` from `lg` upward.
 */
export function TopAppBar({ onSearch }: TopAppBarProps) {
  const pathname = usePathname();
  const { totalUnread } = useWorkspace();
  const activeModule = MODULES.find((module) => pathname.startsWith(module.href));

  return (
    <header className="sticky top-0 z-sticky flex h-14 shrink-0 items-center gap-2 border-b border-secondary bg-surface/95 px-3 backdrop-blur lg:hidden">
      <Popover
        label="تعویض فضای کاری"
        align="start"
        panelClassName="min-w-60"
        trigger={
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-start transition-colors hover:bg-hover"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-solid text-micro font-bold text-fg-on-brand">
              {WORKSPACE.initials}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body-sm font-bold leading-tight text-fg-primary">
                {WORKSPACE.name}
              </span>
              <span className="truncate text-micro leading-tight text-fg-tertiary">
                {activeModule?.label ?? 'فضای کاری'}
              </span>
            </span>
            <ChevronDownIcon size={16} className="shrink-0 text-fg-quaternary" />
          </button>
        }
      >
        {(close) => (
          <MenuList>
            {WORKSPACES.map((workspace) => (
              <MenuItem
                key={workspace.id}
                selected={workspace.id === WORKSPACE.id}
                onSelect={close}
                icon={
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sunken text-micro font-bold text-fg-secondary">
                    {workspace.initials}
                  </span>
                }
              >
                {workspace.name}
              </MenuItem>
            ))}
            <MenuItem onSelect={close} icon={<AddIcon size={18} />}>
              ایجاد فضای کاری جدید
            </MenuItem>
          </MenuList>
        )}
      </Popover>

      <div className="flex-1" />

      <IconButton label="جستجوی سراسری" icon={<SearchIcon size={20} />} onClick={onSearch} />
      <span className="relative inline-flex">
        <IconButton label="اعلان‌ها" icon={<NotificationIcon size={20} />} />
        {totalUnread > 0 && (
          <CountPill
            value={formatCount(totalUnread)}
            tone="error"
            className="pointer-events-none absolute -top-1 -end-1 ring-2 ring-surface"
          />
        )}
      </span>
    </header>
  );
}
