import { useParams, useNavigate } from '@tanstack/react-router';
import { useGetChatroom, useIncrementViewCount } from '../hooks/useQueries';
import { useActor } from '../hooks/useActor';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import ChatArea from '../components/ChatArea';
import { useEffect, useRef } from 'react';

export default function ChatroomPage() {
  const { chatroomId } = useParams({ from: '/chatroom/$chatroomId' });
  const navigate = useNavigate();
  const chatroomIdBigInt = BigInt(chatroomId);
  const { actor, isFetching: actorFetching } = useActor();
  const { 
    data: chatroom, 
    isLoading: chatroomLoading, 
    error, 
    isError,
    isFetched 
  } = useGetChatroom(chatroomIdBigInt);
  const incrementViewCount = useIncrementViewCount();
  const hasIncrementedView = useRef(false);
  const previousChatroomExists = useRef(false);

  // Track if chatroom existed before
  useEffect(() => {
    if (chatroom) {
      previousChatroomExists.current = true;
    }
  }, [chatroom]);

  // Increment view count when chatroom is loaded
  useEffect(() => {
    if (chatroom && !hasIncrementedView.current) {
      hasIncrementedView.current = true;
      incrementViewCount.mutate(chatroomIdBigInt);
    }
  }, [chatroom, chatroomIdBigInt, incrementViewCount]);

  // Show loading while actor is initializing or chatroom is being fetched
  const isLoading = actorFetching || chatroomLoading;

  console.log('[ChatroomPage] State:', {
    chatroomId,
    actorFetching,
    chatroomLoading,
    isLoading,
    isFetched,
    hasChatroom: !!chatroom,
    previouslyExisted: previousChatroomExists.current,
    isError,
    error: error ? String(error) : null,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            {actorFetching ? 'Connecting to backend...' : 'Loading chat...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error if chatroom not found after fetching is complete
  // This handles both initial not-found and expired rooms (backend returns null)
  if (isFetched && (isError || !chatroom)) {
    const errorMessage = previousChatroomExists.current 
      ? 'This chat has expired and is no longer available.'
      : 'The chat you are looking for does not exist or has been removed.';

    return (
      <div className="flex h-full items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Chat Not Found</AlertTitle>
          <AlertDescription>
            {errorMessage}
            <div className="mt-4">
              <Button onClick={() => navigate({ to: '/' })} variant="outline">
                Back to Lobby
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Don't render ChatArea until we have the chatroom data
  if (!chatroom) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatArea chatroomId={chatroomIdBigInt} chatroom={chatroom} />
    </div>
  );
}
