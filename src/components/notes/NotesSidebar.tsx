'use client';

import type { Note, NotebookId, TagTone } from '@/types';
import { NOTEBOOKS, TAG_TONES } from '@/data/reference';
import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { TAG_DOT } from '@/lib/tag-tone';
import { notePreview } from '@/lib/markdown';
import { Button, Input } from '@/components/ui';
import {
  AddIcon,
  BriefcaseIcon,
  CalendarIcon,
  NotebookIcon,
  PinIcon,
  SearchIcon,
  StarIcon,
  UserIcon,
} from '@/components/icons';

export type NotebookFilter = NotebookId | 'all';

const NOTEBOOK_ICONS: Readonly<Record<NotebookFilter, typeof NotebookIcon>> = {
  all: NotebookIcon,
  personal: UserIcon,
  work: BriefcaseIcon,
  ideas: StarIcon,
  meetings: CalendarIcon,
};

export interface NotesSidebarProps {
  readonly notes: readonly Note[];
  readonly notebook: NotebookFilter;
  readonly color: TagTone | null;
  readonly search: string;
  readonly selectedNoteId: string | null;
  readonly onNotebookChange: (notebook: NotebookFilter) => void;
  readonly onColorChange: (color: TagTone | null) => void;
  readonly onSearchChange: (query: string) => void;
  readonly onSelectNote: (noteId: string) => void;
  readonly onCreateNote: () => void;
}

/** Notes-context column: notebooks, colour-tag filters and the pinned shelf. */
export function NotesSidebar({
  notes,
  notebook,
  color,
  search,
  selectedNoteId,
  onNotebookChange,
  onColorChange,
  onSearchChange,
  onSelectNote,
  onCreateNote,
}: NotesSidebarProps) {
  const pinned = notes.filter((note) => note.pinned);
  const countFor = (id: NotebookFilter) =>
    id === 'all' ? notes.length : notes.filter((note) => note.notebook === id).length;

  const notebooks: ReadonlyArray<{ readonly id: NotebookFilter; readonly label: string }> = [
    { id: 'all', label: 'همه یادداشت‌ها' },
    ...NOTEBOOKS,
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-secondary p-3">
        <h2 className="text-title font-bold text-fg-primary">دفترچه یادداشت</h2>
        <Button fullWidth iconStart={<AddIcon size={18} />} onClick={onCreateNote}>
          یادداشت جدید
        </Button>
        <Input
          label="جستجو در یادداشت‌ها"
          hideLabel
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="جستجوی عنوان یا متن…"
          iconStart={<SearchIcon size={18} />}
        />
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        <nav aria-label="دفترچه‌ها" className="flex flex-col gap-0.5">
          <h3 className="px-2.5 pb-1 text-micro font-semibold uppercase tracking-wide text-fg-quaternary">
            دفترچه‌ها
          </h3>
          {notebooks.map(({ id, label }) => {
            const Icon = NOTEBOOK_ICONS[id];
            const active = notebook === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNotebookChange(id)}
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
