'use client';

import type { Note, NoteCategory, TagTone } from '@/types';
import { TAG_TONES } from '@/data/reference';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { TAG_DOT } from '@/lib/tag-tone';
import { notePreview } from '@/lib/markdown';
import {
  BriefcaseIcon,
  CalendarIcon,
  FolderIcon,
  NotebookIcon,
  PinIcon,
  StarIcon,
  UserIcon,
} from '@/components/icons';

/** Glyphs for the built-in categories; a team's own categories use a folder. */
const CATEGORY_ICONS: Readonly<Record<string, typeof NotebookIcon>> = {
  all: NotebookIcon,
  personal: UserIcon,
  work: BriefcaseIcon,
  ideas: StarIcon,
  meetings: CalendarIcon,
};

export const categoryIcon = (id: string): typeof NotebookIcon => CATEGORY_ICONS[id] ?? FolderIcon;

export interface NotesSidebarProps {
  readonly notes: readonly Note[];
  readonly categories: readonly NoteCategory[];
  /** Active category id, or `'all'`. */
  readonly categoryId: string;
  readonly color: TagTone | null;
  readonly selectedNoteId: string | null;
  readonly onCategoryChange: (categoryId: string) => void;
  readonly onColorChange: (color: TagTone | null) => void;
  readonly onSelectNote: (noteId: string) => void;
}

/**
 * Notes-context column: categories, colour-tag filters and the pinned shelf. Creating and
 * searching live in the list header's action hub, so the column stays a navigator.
 */
export function NotesSidebar({
  notes,
  categories,
  categoryId,
  color,
  selectedNoteId,
  onCategoryChange,
  onColorChange,
  onSelectNote,
}: NotesSidebarProps) {
  const pinned = notes.filter((note) => note.pinned);
  const countFor = (id: string) =>
    id === 'all' ? notes.length : notes.filter((note) => note.categoryId === id).length;

  const entries: ReadonlyArray<{ readonly id: string; readonly label: string }> = [
    { id: 'all', label: 'همه یادداشت‌ها' },
    ...categories,
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-secondary px-3 py-3.5">
        <h2 className="text-title font-bold text-fg-primary">دفترچه یادداشت</h2>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        <nav aria-label="دسته‌ها" className="flex flex-col gap-0.5">
          <h3 className="px-2.5 pb-1 text-micro font-semibold uppercase tracking-wide text-fg-quaternary">
            دسته‌ها
          </h3>
          {entries.map(({ id, label }) => {
            const Icon = categoryIcon(id);
            const active = categoryId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onCategoryChange(id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-body-sm font-medium transition-colors',
                  active ? 'bg-brand-subtle text-fg-brand' : 'text-fg-secondary hover:bg-hover',
                )}
              >
                <Icon size={18} variant={active ? 'twotone' : 'linear'} />
                <span className="flex-1 truncate">{label}</span>
                <span
                  className={cn(
                    'numeric rounded-full px-1.5 py-0.5 text-micro font-semibold',
                    active ? 'bg-surface text-fg-brand' : 'bg-sunken text-fg-tertiary',
                  )}
                >
                  {formatCount(countFor(id))}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="my-3 border-t border-secondary" />

        <div className="flex flex-col gap-1.5">
          <h3 className="px-2.5 text-micro font-semibold uppercase tracking-wide text-fg-quaternary">
            برچسب رنگی
          </h3>
          <div className="flex flex-wrap gap-1.5 px-2" role="group" aria-label="فیلتر برچسب رنگی">
            {TAG_TONES.map((entry) => {
              const active = color === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={`برچسب ${entry.label}`}
                  title={entry.label}
                  onClick={() => onColorChange(active ? null : entry.id)}
                  className={cn(
                    'size-6 rounded-full ring-offset-2 ring-offset-surface transition-shadow',
                    TAG_DOT[entry.id],
                    active ? 'ring-2 ring-brand' : 'hover:ring-2 hover:ring-gray-300',
                  )}
                />
              );
            })}
          </div>
        </div>

        <div className="my-3 border-t border-secondary" />

        <section aria-labelledby="pinned-notes" className="flex flex-col gap-0.5">
          <h3
            id="pinned-notes"
            className="flex items-center gap-1.5 px-2.5 pb-1 text-micro font-semibold uppercase tracking-wide text-fg-quaternary"
          >
            <PinIcon size={13} />
            سنجاق‌شده‌ها
          </h3>
          {pinned.length === 0 ? (
            <p className="px-2.5 py-1 text-caption text-fg-tertiary">یادداشت سنجاق‌شده‌ای ندارید.</p>
          ) : (
            pinned.map((note) => {
              const active = note.id === selectedNoteId;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onSelectNote(note.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-start transition-colors',
                    active ? 'bg-brand-subtle' : 'hover:bg-hover',
                  )}
                >
                  <span
                    className={cn(
                      'truncate text-body-sm font-semibold',
                      active ? 'text-fg-brand' : 'text-fg-primary',
                    )}
                  >
                    {note.title || 'بدون عنوان'}
                  </span>
                  <span className="truncate text-micro text-fg-tertiary">{notePreview(note.body, 48) || '—'}</span>
                </button>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
