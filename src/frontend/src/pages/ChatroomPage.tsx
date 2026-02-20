import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useGetChatroom, useIncrementViewCount, useSendMessage } from '../hooks/useQueries';
import ChatArea from '../components/ChatArea';
import type { GifData } from '../backend';

function getUserId(): string {
  let userId = localStorage.getItem('chatUserId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatUserId', userId);
  }
  return userId;
}

export default function ChatroomPage() {
  const { chatroomId } = useParams({ from: '/chatroom/$chatroomId' });
  const navigate = useNavigate();
  const chatroomIdBigInt = BigInt(chatroomId);
  const { data: chatroom, isLoading, error, isFetched } = useGetChatroom(chatroomIdBigInt);
  const incrementViewCount = useIncrementViewCount();
  const sendMessage = useSendMessage();
  const hasIncrementedView = useRef(false);
  const [replyToMessageId, setReplyToMessageId] = useState<bigint | null>(null);

  useEffect(() => {
    if (chatroom && !hasIncrementedView.current) {
      const userId = getUserId();
      incrementViewCount.mutate(chatroomIdBigInt);
      hasIncrementedView.current = true;
    }
  }, [chatroom, chatroomIdBigInt, incrementViewCount]);

  const handleSendMessage = async (content: string, mediaUrl?: string, mediaType?: string, gifData?: GifData) => {
    await sendMessage.mutateAsync({
      content,
      chatroomId: chatroomIdBigInt,
      mediaUrl,
      mediaType,
      replyToMessageId: replyToMessageId || undefined,
      gifData,
    });
    setReplyToMessageId(null);
  };

  const handleCancelReply = () => {
    setReplyToMessageId(null);
  };

  const handleBackToLobby = () => {
    navigate({ to: '/' });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Connection Error</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Unable to connect to the backend. Please check your connection and try again.
          </p>
          <button
            onClick={handleBackToLobby}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 border bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2 rounded-md"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (isFetched && !chatroom) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <div className="mb-4 text-4xl">🔍</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Chat Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This chat room doesn't exist or has been removed.
          </p>
          <button
            onClick={handleBackToLobby}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 border bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2 rounded-md"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!chatroom) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <ChatArea
      chatroom={chatroom}
      onSendMessage={handleSendMessage}
      isSending={sendMessage.isPending}
      replyToMessageId={replyToMessageId}
      onReply={setReplyToMessageId}
      onCancelReply={handleCancelReply}
    />
  );
}
