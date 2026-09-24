'use client';

import { useMemo, useState } from 'react';
import type { Note, TagTone } from '@/types';
import { notebookLabel } from '@/data/reference';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { filterNotes, taskById } from '@/store/selectors';
import { taskDraft } from '@/store/drafts';
import { nextLocalId } from '@/store/ids';
import { cn } from '@/lib/cn';
import { formatCount, formatFraction } from '@/lib/format';
import { TAG_DOT } from '@/lib/tag-tone';
import { checklistProgress, notePreview, splitForTask, stripInline } from '@/lib/markdown';
import { AppShell } from '@/components/layout/AppShell';
import { useOverlays } from '@/components/overlays/OverlayProvider';
import { NotesSidebar, type NotebookFilter } from '@/components/notes/NotesSidebar';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { Button, EmptyState, IconButton, RelativeTime } from '@/components/ui';
import {
  AddIcon,
  ChecklistIcon,
  ConvertToTaskIcon,
  FilterIcon,
  NotebookIcon,
  PinIcon,
} from '@/components/icons';

/**
 * "دفترچه یادداشت": notebooks and the pinned shelf in the context column, the note list and
 * the editor in the workspace. Notes left the calendar so it can stay about dates.
 */
export default function NotesPage() {
  const { state, dispatch } = useWorkspace();
  const { openTaskComposer } = useOverlays();
  const [notebook, setNotebook] = useState<NotebookFilter>('all');
  const [color, setColor] = useState<TagTone | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(() => filterNotes(state.notes, { notebook: 'all', color: null, search: '' })[0]?.id ?? null);
  // Phone width: the context column opens over the list, and the editor over both.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  const visible = useMemo(() => filterNotes(state.notes, { notebook, color, search }), [state.notes, notebook, color, search]);
  const selected = state.notes.find((note) => note.id === selectedId) ?? visible[0];

  const select = (noteId: string) => {
    setSelectedId(noteId);
    setMobileSidebarOpen(false);
    setMobileEditorOpen(true);
  };

  const createNote = () => {
    const noteId = nextLocalId('note');
    dispatch({ type: 'create-note', noteId, notebook: notebook === 'all' ? 'personal' : notebook });
    // A colour or search filter would hide the blank note; clear them so it stays in view.
    setColor(null);
    setSearch('');
    select(noteId);
  };

  const convertToTask = (note: Note) => {
    const { description, subtasks } = splitForTask(note.body);
    const title = note.title.trim() || stripInline(notePreview(note.body, 70)) || 'وظیفه از یادداشت';
    openTaskComposer(taskDraft({ title, description, subtaskTitles: subtasks, sourceNoteId: note.id }));
  };

  const heading = notebook === 'all' ? 'همه یادداشت‌ها' : notebookLabel(notebook);

  return (
    <AppShell
      mobileShowsDetail={!mobileSidebarOpen}
      sidebar={
        <NotesSidebar
          notes={state.notes}
          notebook={notebook}
          color={color}
          search={search}
          selectedNoteId={selected?.id ?? null}
          onNotebookChange={(next) => {
            setNotebook(next);
            setMobileSidebarOpen(false);
            setMobileEditorOpen(false);
          }}
          onColorChange={setColor}
          onSearchChange={setSearch}
          onSelectNote={select}
          onCreateNote={createNote}
        />
      }
    >
      <div className="flex h-full min-h-0">
        <section
          aria-label={`فهرست ${heading}`}
          className={cn(
            'min-h-0 w-full shrink-0 flex-col border-e border-secondary bg-surface lg:flex lg:w-80',
            mobileEditorOpen ? 'hidden' : 'flex',
          )}
        >
          <header className="flex items-center gap-2 border-b border-secondary px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-heading-sm font-bold text-fg-primary">{heading}</h1>
              <span className="numeric text-caption text-fg-tertiary">{`${formatCount(visible.length)} یادداشت`}</span>
            </div>
            <div className="ms-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                iconStart={<FilterIcon size={16} />}
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden"
              >
                دفترچه‌ها
              </Button>
              <IconButton label="یادداشت جدید" icon={<AddIcon size={18} />} variant="subtle" onClick={createNote} />
            </div>
          </header>

          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={<NotebookIcon size={20} />}
              title="یادداشتی پیدا نشد"
              description="دفترچه یا فیلتر دیگری را انتخاب کنید، یا یادداشت تازه‌ای بنویسید."
              action={
                <Button size="sm" iconStart={<AddIcon size={16} />} onClick={createNote}>
                  یادداشت جدید
                </Button>
              }
            />
          ) : (
            <ul className="scrollbar-thin flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              {visible.map((note) => (
                <NoteListItem key={note.id} note={note} active={note.id === selected?.id} onSelect={() => select(note.id)} />
              ))}
            </ul>
          )}
        </section>

        <div className={cn('min-h-0 min-w-0 flex-1 flex-col', mobileEditorOpen ? 'flex' : 'hidden lg:flex')}>
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              linkedTask={selected.linkedTaskId ? taskById(state.tasks, selected.linkedTaskId) : undefined}
              onPatch={(patch) => dispatch({ type: 'update-note', noteId: selected.id, patch })}
              onDelete={() => {
                const next = visible.find((note) => note.id !== selected.id);
                dispatch({ type: 'delete-note', noteId: selected.id });
                setSelectedId(next?.id ?? null);
                setMobileEditorOpen(false);
              }}
              onConvertToTask={() => convertToTask(selected)}
              onOpenTask={(taskId) => dispatch({ type: 'open-task', taskId })}
              onBack={() => setMobileEditorOpen(false)}
            />
          ) : (
            <EmptyState
              icon={<NotebookIcon size={26} />}
              title="یادداشتی انتخاب نشده است"
              description="از فهرست یک یادداشت را باز کنید یا یادداشت تازه‌ای بسازید."
              action={
                <Button size="sm" iconStart={<AddIcon size={16} />} onClick={createNote}>
                  یادداشت جدید
                </Button>
              }
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function NoteListItem({ note, active, onSelect }: { readonly note: Note; readonly active: boolean; readonly onSelect: () => void }) {
  const progress = checklistProgress(note.body);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col gap-1.5 rounded-xl border p-3 text-start transition-colors',
          active ? 'border-brand bg-brand-subtle' : 'border-transparent hover:bg-hover',
        )}
      >
        <span className="flex items-center gap-1.5">
          {note.pinned && <PinIcon size={14} className="shrink-0 text-fg-brand" label="سنجاق‌شده" />}
          <span className={cn('truncate text-body-sm font-semibold', note.title ? 'text-fg-primary' : 'text-fg-tertiary')}>
            {note.title || 'بدون عنوان'}
          </span>
          {note.linkedTaskId && (
            <ConvertToTaskIcon size={14} className="ms-auto shrink-0 text-fg-quaternary" label="تبدیل‌شده به وظیفه" />
          )}
        </span>
        <span className="line-clamp-2 text-caption text-fg-tertiary">{notePreview(note.body) || 'بدون متن'}</span>
        <span className="flex items-center gap-2 text-micro text-fg-quaternary">
          <RelativeTime iso={note.updatedAt} className="numeric" />
          {progress.total > 0 && (
            <span className="numeric inline-flex items-center gap-1">
              <ChecklistIcon size={12} />
              {formatFraction(progress.done, progress.total)}
            </span>
          )}
          {note.colors.length > 0 && (
            <span className="ms-auto flex items-center gap-1" aria-label={`${formatCount(note.colors.length)} برچسب رنگی`}>
              {note.colors.map((tone) => (
                <span key={tone} className={cn('size-2 rounded-full', TAG_DOT[tone])} aria-hidden="true" />
              ))}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
