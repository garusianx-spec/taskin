'use client';

import { useMemo } from 'react';
import type { Conversation, Message } from '@/types';
import { formatJalali } from '@/lib/jalali';
import { formatCount, formatFileSize } from '@/lib/format';
import { roleLabel } from '@/data/reference';
import { conversationMessages, userById, usersByIds } from '@/store/selectors';
import { Avatar, Badge, Button, IconButton, SwitchField } from '@/components/ui';
import {
  ArchiveIcon,
  CloseIcon,
  DocumentIcon,
  DownloadIcon,
  HashIcon,
  ImageIcon,
  SheetIcon,
  UserAddIcon,
} from '@/components/icons';

const ATTACHMENT_ICONS = {
  image: ImageIcon,
  document: DocumentIcon,
  sheet: SheetIcon,
  archive: ArchiveIcon,
  audio: DocumentIcon,
  link: DocumentIcon,
} as const;

export interface ConversationInspectorProps {
  readonly conversation: Conversation;
  readonly messages: readonly Message[];
  readonly muted: boolean;
  readonly pinned: boolean;
  readonly onTogglePin: () => void;
  readonly onToggleMute: () => void;
  readonly onClose: () => void;
}

/** Conversation details: members, the shared file drawer and notification preferences. */
export function ConversationInspector({
  conversation,
  messages,
  muted,
  pinned,
  onTogglePin,
  onToggleMute,
  onClose,
}: ConversationInspectorProps) {
  const members = useMemo(() => usersByIds(conversation.memberIds), [conversation.memberIds]);

  const files = useMemo(
    () =>
      conversationMessages(messages, conversation.id)
        .filter((message) => message.body.kind === 'file')
        .map((message) => (message.body.kind === 'file' ? { message, attachment: message.body.attachment } : null))
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .reverse(),
    [messages, conversation.id],
  );

  return (
    <>
      <header className="flex shrink-0 items-start gap-2 border-b border-secondary p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            {conversation.kind === 'channel' && <HashIcon size={16} className="text-fg-tertiary" />}
            <h2 className="truncate text-title font-bold text-fg-primary">{conversation.title}</h2>
          </div>
          <p className="numeric text-caption text-fg-tertiary">
            {`${formatCount(members.length)} عضو، ${conversation.topic}`}
          </p>
        </div>
        <IconButton label="بستن پنل جزئیات" icon={<CloseIcon size={20} />} size="sm" onClick={onClose} />
      </header>

      <div className="flex flex-col gap-6 p-4">
        <section aria-label="اعضای گفتگو">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-title-sm font-semibold text-fg-primary">اعضا</h3>
            <span className="numeric text-caption text-fg-tertiary">{formatCount(members.length)}</span>
            <Button size="xs" variant="secondary" className="ms-auto" iconStart={<UserAddIcon size={14} />}>
              افزودن عضو
            </Button>
          </div>
          <ul className="flex flex-col gap-1">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-hover">
                <Avatar
                  name={member.fullName}
                  initials={member.initials}
                  tone={member.avatarTone}
                  size="sm"
                  presence={member.presence}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-sm font-medium text-fg-primary">{member.fullName}</span>
                  <span className="truncate text-micro text-fg-tertiary">{member.jobTitle}</span>
                </span>
                <Badge tone="neutral" size="sm">
                  {roleLabel(member.role)}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="کشوی فایل‌های گفتگو">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-title-sm font-semibold text-fg-primary">فایل‌های مشترک</h3>
            <span className="numeric text-caption text-fg-tertiary">{formatCount(files.length)}</span>
          </div>

          {files.length === 0 ? (
            <p className="rounded-lg border border-dashed border-primary px-3 py-4 text-center text-caption text-fg-tertiary">
              هنوز فایلی در این گفتگو به اشتراک گذاشته نشده است.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {files.map(({ message, attachment }) => {
                const Icon = ATTACHMENT_ICONS[attachment.kind];
                const sender = userById(message.authorId);
                return (
                  <li
                    key={message.id}
                    className="flex items-center gap-2.5 rounded-lg border border-secondary bg-surface p-2"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-brand">
                      <Icon size={18} variant="twotone" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-caption font-semibold text-fg-primary">
                        {attachment.name}
                      </span>
                      <span className="numeric truncate text-micro text-fg-tertiary">
                        {`${formatFileSize(attachment.size)}، ${sender?.fullName ?? ''}، ${formatJalali(message.sentAt, 'day-month')}`}
                      </span>
                    </span>
                    <IconButton
                      label={`دانلود ${attachment.name}`}
                      icon={<DownloadIcon size={16} />}
                      size="xs"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="تنظیمات گفتگو" className="flex flex-col gap-3">
          <h3 className="text-title-sm font-semibold text-fg-primary">تنظیمات</h3>
          <SwitchField
            title="سنجاق کردن در بالای فهرست"
            description="این گفتگو همیشه بالای فهرست گفتگوها نمایش داده می‌شود."
            checked={pinned}
            onCheckedChange={onTogglePin}
          />
          <SwitchField
            title="بی‌صدا کردن اعلان‌ها"
            description="اعلان پیام‌های این گفتگو دریافت نمی‌شود."
            checked={muted}
            onCheckedChange={onToggleMute}
          />
        </section>
      </div>
    </>
  );
}
