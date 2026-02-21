import { useState, useMemo } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useGetChatrooms } from '../hooks/useQueries';
import ChatroomCard from '../components/ChatroomCard';
import CreateChatroomDialog from '../components/CreateChatroomDialog';
import { Loader2, Search, Archive, Plus } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export default function LobbyPage() {
  const router = useRouter();
  const { data: chatrooms, isLoading } = useGetChatrooms();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  const categories = useMemo(() => {
    if (!chatrooms) return [];
    const uniqueCategories = new Set(chatrooms.map((room) => room.category));
    return Array.from(uniqueCategories).sort();
  }, [chatrooms]);

  const filteredChatrooms = useMemo(() => {
    if (!chatrooms) return [];

    let filtered = chatrooms;

    if (debouncedSearchTerm.trim()) {
      const lowerSearch = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (room) =>
          room.topic.toLowerCase().includes(lowerSearch) ||
          room.description.toLowerCase().includes(lowerSearch) ||
          room.category.toLowerCase().includes(lowerSearch)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((room) => room.category === selectedCategory);
    }

    return filtered;
  }, [chatrooms, debouncedSearchTerm, selectedCategory]);

  const handleChatroomClick = (chatroomId: bigint) => {
    router.navigate({ to: `/chatroom/${chatroomId}` });
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(selectedCategory === category ? '' : category);
  };

  const handleNavigateToArchive = () => {
    router.navigate({ to: '/archive' });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading chatrooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Lobby</h1>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleNavigateToArchive}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">View Archive</span>
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create Chat</span>
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search chatrooms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              style={{ fontSize: '16px' }}
            />
          </div>

          {categories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  className="cursor-pointer px-3 py-1 text-xs"
                  onClick={() => handleCategoryClick(category)}
                >
                  {category.toLowerCase()}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {filteredChatrooms.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredChatrooms.map((chatroom) => (
                <ChatroomCard
                  key={chatroom.id.toString()}
                  chatroom={chatroom}
                  onClick={() => handleChatroomClick(chatroom.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium text-foreground">No chatrooms found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchTerm || selectedCategory
                    ? 'Try adjusting your search or filters'
                    : 'Create a new chatroom to get started'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateChatroomDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
