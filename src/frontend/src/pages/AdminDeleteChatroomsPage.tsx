import { useState, useEffect } from 'react';
import { useGetChatrooms, useDeleteChatroom } from '../hooks/useQueries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loader2, Trash2 } from 'lucide-react';
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

const ADMIN_PASSWORD_KEY = 'adminPassword';

export default function AdminDeleteChatroomsPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { data: chatrooms, isLoading, refetch } = useGetChatrooms();
  const deleteChatroom = useDeleteChatroom();

  // Check if password is stored in sessionStorage
  useEffect(() => {
    const storedPassword = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
    if (storedPassword) {
      setPassword(storedPassword);
      setIsAuthenticated(true);
    }
  }, []);

  // Refetch chatrooms after successful authentication
  useEffect(() => {
    if (isAuthenticated) {
      refetch();
    }
  }, [isAuthenticated, refetch]);

  const handleAuthenticate = () => {
    if (password.trim()) {
      sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
      setIsAuthenticated(true);
    }
  };

  const handleDelete = async (chatroomId: bigint) => {
    if (!password) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this chatroom? This action cannot be undone.'
    );

    if (confirmed) {
      await deleteChatroom.mutateAsync({ chatroomId, password });
    }
  };

  // Get unique categories
  const categories = chatrooms
    ? Array.from(new Set(chatrooms.map((c) => c.category))).sort()
    : [];

  // Filter chatrooms by category
  const filteredChatrooms =
    categoryFilter === 'all'
      ? chatrooms
      : chatrooms?.filter((c) => c.category === categoryFilter);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground">
            Enter the admin password to access the chatroom management panel.
          </p>
          <Input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
          />
          <Button onClick={handleAuthenticate} className="w-full">
            Authenticate
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-lg text-muted-foreground">Loading chatrooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Manage Chatrooms</h1>
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
              setIsAuthenticated(false);
              setPassword('');
            }}
          >
            Logout
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
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
          <div className="text-sm text-muted-foreground">
            {filteredChatrooms?.length || 0} chatroom(s)
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
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
              {filteredChatrooms && filteredChatrooms.length > 0 ? (
                filteredChatrooms.map((chatroom) => (
                  <TableRow key={chatroom.id.toString()}>
                    <TableCell className="font-mono text-xs">
                      {chatroom.id.toString()}
                    </TableCell>
                    <TableCell className="font-medium">{chatroom.topic}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs">
                        {chatroom.category}
                      </span>
                    </TableCell>
                    <TableCell>{Number(chatroom.messageCount)}</TableCell>
                    <TableCell>{Number(chatroom.viewCount)}</TableCell>
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No chatrooms found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
