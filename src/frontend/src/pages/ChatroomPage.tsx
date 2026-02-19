import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import ChatArea from '../components/ChatArea';
import { useGetChatroom, useIncrementViewCount } from '../hooks/useQueries';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ChatroomPage() {
  const { chatroomId } = useParams({ from: '/chatroom/$chatroomId' });
  const navigate = useNavigate();
  const chatroomIdBigInt = chatroomId ? BigInt(chatroomId) : undefined;
  const { data: chatroom, isLoading, error } = useGetChatroom(chatroomIdBigInt);
  const incrementViewCount = useIncrementViewCount();
  const hasIncrementedRef = useRef(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (chatroomIdBigInt && !hasIncrementedRef.current && chatroom) {
      incrementViewCount.mutate(chatroomIdBigInt);
      hasIncrementedRef.current = true;
    }
  }, [chatroomIdBigInt, chatroom, incrementViewCount]);

  useEffect(() => {
    if (!isLoading) {
      setIsInitialLoad(false);
    }
  }, [isLoading]);

  if (isInitialLoad || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading chatroom...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">Failed to load chatroom</p>
          <Button onClick={() => navigate({ to: '/' })} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  if (!chatroom) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Chatroom not found</p>
          <Button onClick={() => navigate({ to: '/' })} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  return <ChatArea chatroomId={chatroomIdBigInt!} chatroom={chatroom} />;
}
