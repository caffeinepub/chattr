import { useParams, useNavigate, useSearch } from '@tanstack/react-router';
import { useGetChatroom, useIncrementViewCount } from '../hooks/useQueries';
import ChatArea from '../components/ChatArea';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useEffect } from 'react';

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
  const search = useSearch({ from: '/chatroom/$chatroomId' });
  const chatroomIdBigInt = BigInt(chatroomId);
  
  const { data: chatroom, isLoading, error } = useGetChatroom(chatroomIdBigInt);
  const incrementViewCount = useIncrementViewCount();

  // Extract messageId from search params (if present)
  const targetMessageId = search.messageId || undefined;

  // Increment view count on page load
  useEffect(() => {
    const userId = getUserId();
    incrementViewCount.mutate(chatroomIdBigInt);
  }, [chatroomIdBigInt]);

  const handleBackToLobby = () => {
    navigate({ to: '/' });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg text-muted-foreground">Loading chatroom...</p>
        </div>
      </div>
    );
  }

  if (error || !chatroom) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Chatroom Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            The chatroom you're looking for doesn't exist or has been removed.
          </p>
        </div>
        <Button onClick={handleBackToLobby} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Lobby
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <ChatArea chatroomId={chatroomIdBigInt} chatroom={chatroom} targetMessageId={targetMessageId} />
    </div>
  );
}
