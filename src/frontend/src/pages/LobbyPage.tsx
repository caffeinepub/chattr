import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGetLobbyChatroomCards } from '../hooks/useQueries';
import { useForceFreshChatroomsOnActorReady } from '../hooks/useForceFreshChatroomsOnActorReady';
import ChatroomCard from '../components/ChatroomCard';
import CreateChatroomDialog from '../components/CreateChatroomDialog';
import { Search, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const CATEGORIES = ['All', 'Gaming', 'Music', 'Sports', 'Tech', 'Entertainment', 'Other'];

export default function LobbyPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const { isRecovering } = useForceFreshChatroomsOnActorReady();
  const { data: lobbyCards = [], isLoading, error, isError } = useGetLobbyChatroomCards();

  // Client-side filtering
  const filteredCards = useMemo(() => {
    let filtered = lobbyCards;

    // Apply category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(card => 
        card.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Apply search filter
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(card =>
        card.topic.toLowerCase().includes(searchLower) ||
        card.category.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [lobbyCards, selectedCategory, debouncedSearchTerm]);

  const handleCardClick = (chatroomId: bigint) => {
    navigate({ to: '/chatroom/$chatroomId', params: { chatroomId: chatroomId.toString() } });
  };

  const showLoading = isLoading || isRecovering;

  return (
    <div className="flex h-full flex-col">
      {/* Search and Filter Bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Create Button */}
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Chat
            </Button>
          </div>

          {/* Category Filter */}
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="rounded-full"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {showLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {isRecovering ? 'Refreshing chat list...' : 'Loading chats...'}
                </p>
              </div>
            </div>
          ) : isError ? (
            <Alert variant="destructive" className="mx-auto max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to Load Chats</AlertTitle>
              <AlertDescription>
                There was a problem loading the chat list. Please try again.
                {error && <div className="mt-2 text-xs opacity-75">Error: {String(error)}</div>}
              </AlertDescription>
            </Alert>
          ) : filteredCards.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {lobbyCards.length === 0
                    ? 'No chats yet. Create the first one!'
                    : 'No chats match your filters.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCards.map((card) => (
                <ChatroomCard
                  key={card.id.toString()}
                  card={card}
                  onClick={() => handleCardClick(card.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Chatroom Dialog */}
      <CreateChatroomDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
    </div>
  );
}
