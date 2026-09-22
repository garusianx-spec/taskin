'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message, TaskDraft } from '@/types';
import { cn } from '@/lib/cn';
import { formatDateDivider } from '@/lib/jalali';
import { formatCount, truncate } from '@/lib/format';
import {
  conversationMessages,
  groupMessagesByDay,
  isGroupedWithPrevious,
  messageById,
  messagePreview,
  userById,
  usersByIds,
} from '@/store/selectors';
import { AvatarStack, Badge, EmptyState, IconButton, Input, Tooltip } from '@/components/ui';
import { MessageBubble } from './MessageBubble';
import { ChatComposer } from './ChatComposer';
import { MessageActionSheet } from './MessageActionSheet';
import {
  ArrowBackwardIcon,
  HashIcon,
  InfoCircleIcon,
  MessagesIcon,
  PaperclipIcon,
  SearchIcon,
} from '@/components/icons';

export interface ChatViewProps {
  readonly conversation: Conversation;
  readonly messages: readonly Message[];
  readonly currentUserId: string;
  readonly onSend: (text: string, replyToId: string | null) => void;
  readonly onToggleReaction: (messageId: string, emoji: string) => void;
  readonly onConvertToTask: (draft: TaskDraft) => void;
  readonly onOpenTask: (taskId: string) => void;
  readonly onOpenDetails: () => void;
  /** Mobile only — returns to the conversation list. */
  readonly onBack?: () => void;
  readonly defaultProjectId: string;
}

/**
 * Main chat surface: header, scrollable body with Jalali date dividers, and the composer.
 * The body auto-scrolls to the newest message whenever the thread or conversation changes.
 */
export function ChatView({
  conversation,
  messages,
  currentUserId,
  onSend,
  onToggleReaction,
  onConvertToTask,
  onOpenTask,
  onOpenDetails,
  onBack,
  defaultProjectId,
}: ChatViewProps) {
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [inChatQuery, setInChatQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetMessage, setSheetMessage] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const thread = useMemo(
    () => conversationMessages(messages, conversation.id),
    [messages, conversation.id],
  );

  const visibleThread = useMemo(() => {
    const query = inChatQuery.trim().toLowerCase();
    if (!query) return thread;
    return thread.filter((message) => messagePreview(message).toLowerCase().includes(query));
  }, [thread, inChatQuery]);

  const groups = useMemo(() => groupMessagesByDay(visibleThread), [visibleThread]);
  const members = useMemo(() => usersByIds(conversation.memberIds), [conversation.memberIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [conversation.id, thread.length]);

  const replyTarget = replyToId ? messageById(messages, replyToId) : undefined;
  const replyPreview = replyTarget
    ? {
        authorName: userById(replyTarget.authorId)?.fullName ?? 'کاربر',
        preview: truncate(messagePreview(replyTarget), 90),
      }
    : null;

  const buildDraft = (message: Message): TaskDraft => ({
    title: truncate(messagePreview(message), 70),
    description:
      message.body.kind === 'text'
        ? message.body.text
        : `برگرفته از ${messagePreview(message)} در گفتگوی «${conversation.title}»`,
    projectId: defaultProjectId,
    status: 'todo',
    priority: 'medium',
    assigneeIds: [currentUserId],
    dueDate: null,
    sourceMessageId: message.id,
    attachments: message.body.kind === 'file' ? [message.body.attachment] : [],
  });

  const attachmentCount = thread.filter((message) => message.body.kind === 'file').length;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-canvas" aria-label={`گفتگوی ${conversation.title}`}>
      <header className="flex shrink-0 flex-col gap-2 border-b border-secondary bg-surface px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <IconButton
              label="بازگشت به فهرست گفتگوها"
              icon={<ArrowBackwardIcon size={20} />}
              size="sm"
              onClick={onBack}
              className="lg:hidden"
            />
          )}

          <button
            type="button"
            onClick={onOpenDetails}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-start transition-colors hover:bg-hover"
          >
            {conversation.kind === 'channel' ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-fg-secondary">
                <HashIcon size={18} variant="twotone" />
              </span>
            ) : (
              <AvatarStack members={members} max={3} size="sm" />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-title-sm font-bold text-fg-primary">{conversation.title}</span>
              <span className="numeric truncate text-micro text-fg-tertiary">
                {conversation.kind === 'direct'
                  ? conversation.topic
                  : `${formatCount(members.length)} عضو، ${conversation.topic}`}
              </span>
            </span>
          </button>

          <Tooltip content="جستجو در گفتگو">
            <IconButton
              label="جستجو در این گفتگو"
              icon={<SearchIcon size={20} />}
              size="sm"
              active={searchOpen}
              onClick={() => {
                setSearchOpen((open) => !open);
                if (searchOpen) setInChatQuery('');
              }}
            />
          </Tooltip>
          <Tooltip content="فایل‌های گفتگو">
            <IconButton
              label={`کشوی فایل‌ها (${attachmentCount} فایل)`}
              icon={<PaperclipIcon size={20} />}
              size="sm"
              onClick={onOpenDetails}
            />
          </Tooltip>
          <Tooltip content="جزئیات گفتگو">
            <IconButton
              label="جزئیات گفتگو"
              icon={<InfoCircleIcon size={20} />}
              size="sm"
              onClick={onOpenDetails}
            />
          </Tooltip>
        </div>

        {searchOpen && (
          <div className="flex items-center gap-2 pb-1">
            <Input
              label="جستجو در این گفتگو"
              hideLabel
              autoFocus
              type="search"
              value={inChatQuery}
              onChange={(event) => setInChatQuery(event.target.value)}
              placeholder="جستجو میان پیام‌های این گفتگو…"
              iconStart={<SearchIcon size={18} />}
              containerClassName="flex-1"
            />
            {inChatQuery && (
              <Badge tone="brand" numeric>
                {`${formatCount(visibleThread.length)} نتیجه`}
              </Badge>
            )}
          </div>
        )}
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {groups.length === 0 ? (
          <EmptyState
            icon={<MessagesIcon size={26} />}
            title={inChatQuery ? 'پیامی مطابق جستجو پیدا نشد' : 'هنوز پیامی در این گفتگو نیست'}
            description={
              inChatQuery
                ? 'عبارت دیگری را امتحان کنید یا جستجو را ببندید.'
                : 'اولین پیام را بنویسید تا گفتگو آغاز شود.'
            }
          />
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-1">
            {groups.map((group) => (
              <div key={group.isoDate} className="flex flex-col gap-1">
                <DateDivider iso={group.isoDate} />
                {group.messages.map((message, index) => {
                  const author = userById(message.authorId);
                  if (!author) return null;
                  const previous = group.messages[index - 1];
                  const replied = message.replyToId ? messageById(messages, message.replyToId) : undefined;

                  return (
                    <div key={message.id} className={cn(index > 0 && 'mt-0.5')}>
                      <MessageBubble
                        message={message}
                        author={author}
                        outgoing={message.authorId === currentUserId}
                        grouped={isGroupedWithPrevious(message, previous)}
                        repliedTo={
                          replied
                            ? {
                                authorName: userById(replied.authorId)?.fullName ?? 'کاربر',
                                preview: truncate(messagePreview(replied), 90),
                              }
                            : null
                        }
                        currentUserId={currentUserId}
                        onReply={setReplyToId}
                        onConvertToTask={(target) => onConvertToTask(buildDraft(target))}
                        onToggleReaction={onToggleReaction}
                        onOpenLinkedTask={onOpenTask}
                        onLongPress={setSheetMessage}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ChatComposer
        conversationTitle={conversation.title}
        replyPreview={replyPreview}
        onCancelReply={() => setReplyToId(null)}
        onSend={(text) => {
          onSend(text, replyToId);
          setReplyToId(null);
        }}
      />

      <MessageActionSheet
        message={sheetMessage}
        onClose={() => setSheetMessage(null)}
        onReply={(id) => {
          setReplyToId(id);
          setSheetMessage(null);
        }}
        onConvertToTask={(message) => {
          onConvertToTask(buildDraft(message));
          setSheetMessage(null);
        }}
        onToggleReaction={(id, emoji) => {
          onToggleReaction(id, emoji);
          setSheetMessage(null);
        }}
      />
    </section>
  );
}

function DateDivider({ iso }: { readonly iso: string }) {
  return (
    <div className="sticky top-0 z-sticky flex items-center gap-3 py-3">
      <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
      <span className="rounded-full border border-secondary bg-surface px-3 py-1 text-micro font-semibold text-fg-tertiary shadow-xs">
        {formatDateDivider(iso)}
      </span>
      <span className="h-px flex-1 bg-gray-200" aria-hidden="true" />
    </div>
  );
}
