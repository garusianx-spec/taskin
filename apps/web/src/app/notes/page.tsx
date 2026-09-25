'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type { Note, NoteCategory, TagTone } from '@taskin/contracts';
import { DEFAULT_NOTE_CATEGORY_ID } from '@/data/reference';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { filterNotes, noteCategoryLabel, taskById } from '@/store/selectors';
import { taskDraft } from '@/store/drafts';
import { nextLocalId } from '@/store/ids';
import { cn } from '@/lib/cn';
import { formatCount, formatFraction } from '@/lib/format';
import { TAG_DOT } from '@/lib/tag-tone';
import { checklistProgress, notePreview, splitForTask, stripInline } from '@taskin/text';
import { AppShell } from '@/components/layout/AppShell';
import { useOverlays } from '@/components/overlays/OverlayProvider';
import { NotesSidebar, categoryIcon } from '@/components/notes/NotesSidebar';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { Button, EmptyState, ExpandableSearch, IconButton, Input, Popover, RelativeTime, Tooltip } from '@/components/ui';
import {
  AddIcon,
  ChecklistIcon,
  CloseIcon,
  ConvertToTaskIcon,
  FilterIcon,
  FolderAddIcon,
  NotebookIcon,
  PinIcon,
} from '@/components/icons';

/**
 * "دفترچه یادداشت": categories and the pinned shelf in the context column; the note list —
 * with its action hub and category chips — and the editor in the workspace.
 */
export default function NotesPage() {
  const { state, dispatch } = useWorkspace();
  const { openTaskComposer } = useOverlays();
  const [categoryId, setCategoryId] = useState<string>('all');
  const [color, setColor] = useState<TagTone | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => filterNotes(state.notes, { categoryId: 'all', color: null, search: '' })[0]?.id ?? null,
  );
  // Phone width: the context column opens over the list, and the editor over both.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

  const { notes, noteCategories: categories } = state;
  const visible = useMemo(() => filterNotes(notes, { categoryId, color, search }), [notes, categoryId, color, search]);
  const selected = notes.find((note) => note.id === selectedId) ?? visible[0];

  const select = (noteId: string) => {
    setSelectedId(noteId);
    setMobileSidebarOpen(false);
    setMobileEditorOpen(true);
  };

  const changeCategory = (next: string) => {
    setCategoryId(next);
    setMobileSidebarOpen(false);
    setMobileEditorOpen(false);
  };

  const createNote = () => {
    const noteId = nextLocalId('note');
    // A new note belongs to the category being viewed; under "همه" it starts as personal.
    dispatch({ type: 'create-note', noteId, categoryId: categoryId === 'all' ? DEFAULT_NOTE_CATEGORY_ID : categoryId });
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

  const heading = categoryId === 'all' ? 'همه یادداشت‌ها' : noteCategoryLabel(categories, categoryId);

  return (
    <AppShell
      mobileShowsDetail={!mobileSidebarOpen}
      sidebar={
        <NotesSidebar
          notes={notes}
          categories={categories}
          categoryId={categoryId}
          color={color}
          selectedNoteId={selected?.id ?? null}
          onCategoryChange={changeCategory}
          onColorChange={setColor}
          onSelectNote={select}
        />
      }
    >
      <div className="flex h-full min-h-0">
        <section
          aria-label={`فهرست ${heading}`}
          className={cn(
            'min-h-0 w-full shrink-0 flex-col border-e border-secondary bg-surface lg:flex lg:w-96',
            mobileEditorOpen ? 'hidden' : 'flex',
          )}
        >
          <header className="flex flex-col gap-3 border-b border-secondary px-4 pb-3 pt-3">
            <div className="flex h-10 items-center gap-2">
              {/* The title yields its room to the search field while a search is open. */}
              <div className={cn('min-w-0 flex-1 flex-col', searchOpen ? 'hidden' : 'flex')}>
                <h1 className="truncate text-heading-sm font-bold text-fg-primary">{heading}</h1>
                <span className="numeric text-caption text-fg-tertiary">{`${formatCount(visible.length)} یادداشت`}</span>
              </div>
              <div role="toolbar" aria-label="اقدام‌های یادداشت" className={cn('flex items-center gap-1.5', searchOpen && 'flex-1')}>
                <ExpandableSearch
                  label="جستجو در یادداشت‌ها"
                  placeholder="عنوان یا متن…"
                  value={search}
                  onChange={setSearch}
                  onOpenChange={setSearchOpen}
                  fill
                  className={searchOpen ? 'flex-1' : undefined}
                />
                <CreateCategoryButton
                  categories={categories}
                  onCreate={(label) => {
                    const id = nextLocalId('cat');
                    dispatch({ type: 'create-note-category', categoryId: id, label });
                    setCategoryId(id);
                  }}
                />
                <IconButton
                  label="دسته‌ها و فیلترها"
                  icon={<FilterIcon size={18} />}
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden"
                />
                <Button size="sm" iconStart={<AddIcon size={16} />} aria-label="یادداشت جدید" onClick={createNote}>
                  جدید
                </Button>
              </div>
            </div>

            <CategoryChips
              notes={notes}
              categories={categories}
              active={categoryId}
              onSelect={changeCategory}
              onDelete={(id) => {
                dispatch({ type: 'delete-note-category', categoryId: id });
                if (categoryId === id) setCategoryId('all');
              }}
            />
          </header>

          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={<NotebookIcon size={20} />}
              title="یادداشتی پیدا نشد"
              description="دسته یا فیلتر دیگری را انتخاب کنید، یا یادداشت تازه‌ای بنویسید."
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
              categories={categories}
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

interface CategoryChipsProps {
  readonly notes: readonly Note[];
  readonly categories: readonly NoteCategory[];
  readonly active: string;
  readonly onSelect: (categoryId: string) => void;
  readonly onDelete: (categoryId: string) => void;
}

/**
 * One-line, sideways-scrolling category filter. "همه" leads; a team's own category that holds
 * no notes carries a small remove control.
 */
function CategoryChips({ notes, categories, active, onSelect, onDelete }: CategoryChipsProps) {
  const chips: ReadonlyArray<{ readonly id: string; readonly label: string; readonly removable: boolean }> = [
    { id: 'all', label: 'همه', removable: false },
    ...categories.map((category) => ({
      id: category.id,
      label: category.label,
      removable: !category.builtIn && !notes.some((note) => note.categoryId === category.id),
    })),
  ];

  return (
    <div role="group" aria-label="فیلتر دسته" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {chips.map(({ id, label, removable }) => {
        const selected = active === id;
        const count = id === 'all' ? notes.length : notes.filter((note) => note.categoryId === id).length;
        const Icon = categoryIcon(id);
        return (
          <span
            key={id}
            className={cn(
              'inline-flex shrink-0 items-center rounded-full border transition-colors',
              selected ? 'border-brand bg-brand-subtle text-fg-brand' : 'border-secondary bg-surface text-fg-secondary hover:bg-hover',
            )}
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(id)}
              className={cn('inline-flex h-7 items-center gap-1.5 rounded-full ps-2.5 text-caption font-medium', removable ? 'pe-1' : 'pe-2.5')}
            >
              <Icon size={14} />
              {label}
              <span className={cn('numeric text-micro', selected ? 'text-fg-brand' : 'text-fg-quaternary')}>
                {formatCount(count)}
              </span>
            </button>
            {removable && (
              <Tooltip content="حذف دسته خالی">
                <button
                  type="button"
                  aria-label={`حذف دسته ${label}`}
                  onClick={() => onDelete(id)}
                  className="me-1 flex size-5 items-center justify-center rounded-full text-fg-quaternary transition-colors hover:bg-status-blocked-subtle hover:text-status-blocked"
                >
                  <CloseIcon size={12} />
                </button>
              </Tooltip>
            )}
          </span>
        );
      })}
    </div>
  );
}

function CreateCategoryButton({
  categories,
  onCreate,
}: {
  readonly categories: readonly NoteCategory[];
  readonly onCreate: (label: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <Popover
      label="دسته جدید"
      align="end"
      panelClassName="w-72 p-3"
      onOpenChange={(open) => {
        if (!open) return;
        setLabel('');
        setError(undefined);
      }}
      trigger={<IconButton label="دسته جدید" icon={<FolderAddIcon size={18} />} variant="secondary" />}
    >
      {(close) => (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const name = label.trim();
            if (!name) return setError('نام دسته را وارد کنید.');
            if (categories.some((category) => category.label.trim() === name)) return setError('دسته‌ای با این نام وجود دارد.');
            onCreate(name);
            close();
          }}
        >
          <Input
            label="نام دسته"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setError(undefined);
            }}
            placeholder="مثلاً: پژوهش کاربر"
            error={error}
            maxLength={24}
          />
          <Button type="submit" size="sm" iconStart={<FolderAddIcon size={16} />}>
            ایجاد دسته
          </Button>
        </form>
      )}
    </Popover>
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
