import { Archive as ArchiveIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';
import { useGetArchivedChatrooms } from '../hooks/useQueries';
import ChatroomCard from '../components/ChatroomCard';

export default function ArchivePage() {
  const router = useRouter();
  const { data: archivedChatrooms, isLoading, error } = useGetArchivedChatrooms();

  const handleChatroomClick = (chatroomId: bigint) => {
    router.navigate({ 
      to: '/chatroom/$chatroomId', 
      params: { chatroomId: chatroomId.toString() } 
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading archived chatrooms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Error Loading Archive</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Failed to load archived chatrooms. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ArchiveIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Archive</h1>
              <p className="text-sm text-muted-foreground">
                Chatrooms that have been bumped off the lobby
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {!archivedChatrooms || archivedChatrooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ArchiveIcon className="h-16 w-16 text-muted-foreground/50" />
              <h2 className="mt-4 text-xl font-semibold text-foreground">No Archived Chatrooms</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Archived chatrooms will appear here when they are bumped off the lobby.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {archivedChatrooms.map((chatroom) => (
                <ChatroomCard 
                  key={chatroom.id.toString()} 
                  chatroom={chatroom}
                  onClick={() => handleChatroomClick(chatroom.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
