'use client';

import type { AccentId, ThemeMode } from '@/types';
import { ACCENTS, THEME_MODES } from '@/lib/theme';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/cn';
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from '@/components/icons';

const MODE_ICONS: Readonly<Record<ThemeMode, typeof SunIcon>> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

/**
 * Theme picker body. Rendered inside the rail popover on desktop and inside the "بیشتر" tab
 * on mobile, so it is a plain block with no positioning of its own.
 */
export function ThemePicker({ className }: { readonly className?: string }) {
  const { theme, setMode, setAccent } = useTheme();

  return (
    <div className={cn('flex w-72 flex-col gap-4 p-1', className)}>
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-micro font-semibold uppercase tracking-wide text-fg-quaternary">
          حالت نمایش
        </h3>
        <div role="radiogroup" aria-label="حالت نمایش" className="grid grid-cols-3 gap-1.5">
          {THEME_MODES.map(({ id, label }) => {
            const Icon = MODE_ICONS[id];
            const selected = theme.mode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-caption font-medium transition-colors',
                  selected
                    ? 'border-brand bg-brand-subtle text-fg-brand'
                    : 'border-secondary bg-surface text-fg-tertiary hover:bg-hover hover:text-fg-secondary',
                )}
              >
                <Icon size={18} variant={selected ? 'twotone' : 'linear'} />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-micro font-semibold uppercase tracking-wide text-fg-quaternary">
          پالت برند سازمان
        </h3>
        <div role="radiogroup" aria-label="پالت برند سازمان" className="flex flex-col gap-1">
          {ACCENTS.map((accent) => (
            <AccentRow
              key={accent.id}
              id={accent.id}
              name={accent.name}
              subtitle={accent.subtitle}
              swatch={accent.swatch}
              selected={theme.accent === accent.id}
              onSelect={setAccent}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface AccentRowProps {
  readonly id: AccentId;
  readonly name: string;
  readonly subtitle: string;
  readonly swatch: readonly [string, string, string];
  readonly selected: boolean;
  readonly onSelect: (accent: AccentId) => void;
}

function AccentRow({ id, name, subtitle, swatch, selected, onSelect }: AccentRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(id)}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-2.5 py-2 text-start transition-colors',
        selected
          ? 'border-brand bg-brand-subtle'
          : 'border-transparent hover:border-secondary hover:bg-hover',
      )}
    >
      <span className="flex shrink-0 flex-row-reverse" aria-hidden="true">
        {swatch.map((color, index) => (
          <span
            key={color}
            className={cn('size-5 rounded-full ring-2 ring-surface', index > 0 && '-ms-2')}
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate text-body-sm font-semibold', selected ? 'text-fg-brand' : 'text-fg-primary')}>
          {name}
        </span>
        <span className="truncate text-micro text-fg-tertiary">{subtitle}</span>
      </span>
      {selected && <CheckIcon size={16} className="shrink-0 text-fg-brand" />}
    </button>
  );
}
