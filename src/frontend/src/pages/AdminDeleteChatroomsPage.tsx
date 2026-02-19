import { useState, useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useGetChatrooms, useDeleteChatroom } from '../hooks/useQueries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_PASSWORD = 'lunasimbaliamsammy1987!';

export default function AdminDeleteChatroomsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { data: chatrooms, isLoading, refetch } = useGetChatrooms();
  const deleteChatroom = useDeleteChatroom();

  useEffect(() => {
    const storedAuth = sessionStorage.getItem('adminAuthenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
      refetch();
    }
  }, [refetch]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuthenticated', 'true');
      refetch();
    } else {
      toast.error('Incorrect password');
    }
  };

  const handleDelete = async (chatroomId: bigint) => {
    if (!confirm('Are you sure you want to delete this chatroom?')) {
      return;
    }

    try {
      await deleteChatroom.mutateAsync({ chatroomId, password: ADMIN_PASSWORD });
      toast.success('Chatroom deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete chatroom');
    }
  };

  const handleBackToLobby = () => {
    router.navigate({ to: '/' });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground">Admin Access</h1>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full">
              Authenticate
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const categories = chatrooms
    ? Array.from(new Set(chatrooms.map((c) => c.category)))
    : [];

  const filteredChatrooms =
    categoryFilter === 'all'
      ? chatrooms
      : chatrooms?.filter((c) => c.category === categoryFilter);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleBackToLobby}
              variant="ghost"
              size="icon"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              Admin: Delete Chatrooms
            </h1>
          </div>
          <div className="w-48">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredChatrooms && filteredChatrooms.length > 0 ? (
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChatrooms.map((chatroom) => (
                  <TableRow key={chatroom.id.toString()}>
                    <TableCell className="font-mono text-sm">
                      {chatroom.id.toString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {chatroom.topic}
                    </TableCell>
                    <TableCell>{chatroom.category}</TableCell>
                    <TableCell>{chatroom.messageCount.toString()}</TableCell>
                    <TableCell>{chatroom.viewCount.toString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(chatroom.id)}
                        disabled={deleteChatroom.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No chatrooms found</p>
          </div>
        )}
      </div>
    </div>
  );
}
