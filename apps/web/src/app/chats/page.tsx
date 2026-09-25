'use client';

import { useMemo, useState } from 'react';
import { useWorkspace } from '@/store/WorkspaceProvider';
import { conversationById, filterConversations } from '@/store/selectors';
import { PROJECTS } from '@/data/workspace';
import { AppShell } from '@/components/layout/AppShell';
import { useOverlays } from '@/components/overlays/OverlayProvider';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatView } from '@/components/chat/ChatView';
import { EmptyState } from '@/components/ui';
import { MessagesIcon } from '@/components/icons';

export default function ChatsPage() {
  return (
    <ChatsShell />
  );
}

function ChatsShell() {
  const { state, dispatch, currentUser, conversations, unreadFor, isPinned, totalUnread } = useWorkspace();
  const { open } = useOverlays();
  // Mobile: the sidebar is the list screen until a conversation is opened.
  const [mobileDetail, setMobileDetail] = useState(false);

  const visible = useMemo(
    () =>
      filterConversations(conversations, state.messages, {
        filter: state.chatFilter,
        search: state.chatSearch,
        unreadByConversation: state.unreadByConversation,
        pinnedIds: state.pinnedConversationIds,
      }),
    [conversations, state.messages, state.chatFilter, state.chatSearch, state.unreadByConversation, state.pinnedConversationIds],
  );

  const active = conversationById(conversations, state.activeConversationId);
  const defaultProjectId = PROJECTS[0]?.id ?? '';

  return (
    <AppShell
      mobileShowsDetail={mobileDetail}
      sidebar={
        <ChatSidebar
          conversations={visible}
          messages={state.messages}
          activeConversationId={state.activeConversationId}
          filter={state.chatFilter}
          search={state.chatSearch}
          unreadFor={unreadFor}
          isPinned={isPinned}
          unreadTotal={totalUnread}
          onFilterChange={(filter) => dispatch({ type: 'set-chat-filter', filter })}
          onSearchChange={(query) => dispatch({ type: 'set-chat-search', query })}
          onTogglePin={(conversationId) => dispatch({ type: 'toggle-conversation-pin', conversationId })}
          onNewConversation={() => open({ kind: 'conversation-composer' })}
          onSelect={(conversationId) => {
            dispatch({ type: 'select-conversation', conversationId });
            setMobileDetail(true);
          }}
        />
      }
    >
      {active ? (
        <ChatContent
          onBack={() => setMobileDetail(false)}
          defaultProjectId={defaultProjectId}
          currentUserId={currentUser.id}
        />
      ) : (
        <EmptyState
          icon={<MessagesIcon size={26} />}
          title="گفتگویی انتخاب نشده است"
          description="از ستون کناری یک گفتگو را انتخاب کنید تا پیام‌ها نمایش داده شوند."
        />
      )}
    </AppShell>
  );
}

interface ChatContentProps {
  readonly onBack: () => void;
  readonly defaultProjectId: string;
  readonly currentUserId: string;
}

/** Split out so the composer hook resolves inside the `AppShell` provider. */
function ChatContent({ onBack, defaultProjectId, currentUserId }: ChatContentProps) {
  const { state, dispatch } = useWorkspace();
  const { openTaskComposer } = useOverlays();
  const conversation = conversationById(state.conversations, state.activeConversationId);

  if (!conversation) return null;

  return (
    <ChatView
      conversation={conversation}
      messages={state.messages}
      currentUserId={currentUserId}
      defaultProjectId={defaultProjectId}
      onBack={onBack}
      onSend={(text, replyToId) =>
        dispatch({
          type: 'send-message',
          conversationId: conversation.id,
          authorId: currentUserId,
          text,
          replyToId,
        })
      }
      onToggleReaction={(messageId, emoji) =>
        dispatch({ type: 'toggle-reaction', messageId, emoji, userId: currentUserId })
      }
      onConvertToTask={(draft) => openTaskComposer(draft)}
      onOpenTask={(taskId) => dispatch({ type: 'open-task', taskId })}
      onOpenDetails={() =>
        dispatch({ type: 'open-conversation-details', conversationId: conversation.id })
      }
    />
  );
}
