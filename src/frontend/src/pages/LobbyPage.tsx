import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGetChatrooms, useSearchChatrooms, useFilterChatroomsByCategory } from '../hooks/useQueries';
import { useActor } from '../hooks/useActor';
import { Loader2, Plus, AlertCircle, Search, Filter, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import ChatroomCard from '../components/ChatroomCard';
import CreateChatroomDialog from '../components/CreateChatroomDialog';

const CATEGORIES = [
  'General',
  'Gaming',
  'Technology',
  'Music',
  'Art',
  'Sports',
  'Entertainment',
  'Education',
  'News',
  'Politics',
  'Finance',
  'Other',
];

export default function LobbyPage() {
  const { actor, isFetching: actorFetching } = useActor();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Use appropriate query based on filters
  const { data: allChatrooms, isLoading: allLoading, error: allError, isError: isAllError } = useGetChatrooms();
  const { data: searchResults, isLoading: searchLoading, isError: isSearchError } = useSearchChatrooms(debouncedSearchTerm);
  const { data: categoryResults, isLoading: categoryLoading, isError: isCategoryError } = useFilterChatroomsByCategory(selectedCategory);

  // Determine which data to display
  let chatrooms = allChatrooms;
  let isLoading = allLoading;
  let error = allError;
  let isError = isAllError;

  if (debouncedSearchTerm.trim()) {
    chatrooms = searchResults;
    isLoading = searchLoading;
    isError = isSearchError;
  } else if (selectedCategory) {
    chatrooms = categoryResults;
    isLoading = categoryLoading;
    isError = isCategoryError;
  }

  const handleChatroomClick = (chatroomId: bigint) => {
    navigate({ to: '/chatroom/$chatroomId', params: { chatroomId: chatroomId.toString() } });
  };

  const handleCategoryClick = (category: string) => {
    if (selectedCategory === category.toLowerCase()) {
      setSelectedCategory('');
    } else {
      setSelectedCategory(category.toLowerCase());
      setSearchTerm('');
      setDebouncedSearchTerm('');
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedCategory('');
    // Restore focus to search input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  const hasActiveFilters = searchTerm.trim() || selectedCategory;

  if (actorFetching || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            {actorFetching ? 'Connecting...' : 'Loading chats...'}
          </p>
        </div>
      </div>
    );
  }

  if (isError && !actor && !chatrooms) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Failed to connect to the backend. Please refresh the page to try again.
            {error && <div className="mt-2 text-xs">{String(error)}</div>}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-[1800px] px-4 py-6">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Chats</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Join or create anonymous chats
              </p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-5 w-5" />
              Create Chat
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-[25rem]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedCategory('');
                }}
                placeholder="Search chats by topic, description, or category..."
                className="pl-9"
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Categories:</span>
            {CATEGORIES.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category.toLowerCase() ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => handleCategoryClick(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        {isError && chatrooms && chatrooms.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Refresh Error</AlertTitle>
            <AlertDescription>
              There was a problem refreshing chats. Showing cached data.
            </AlertDescription>
          </Alert>
        )}

        {chatrooms && chatrooms.length === 0 ? (
          <div className="flex h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <img
                  src="/assets/generated/chat-icon-transparent.dim_64x64.png"
                  alt="Chat"
                  className="h-12 w-12"
                />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {hasActiveFilters ? 'No chats found' : 'No chats found yet'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters 
                  ? 'Try adjusting your search or filters' 
                  : 'Be the first to create a chat!'}
              </p>
              {!hasActiveFilters && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4 gap-2">
                  <Plus className="h-5 w-5" />
                  Create Chat
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {chatrooms?.map((chatroom) => (
              <ChatroomCard
                key={chatroom.id.toString()}
                chatroom={chatroom}
                onClick={() => handleChatroomClick(chatroom.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateChatroomDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
