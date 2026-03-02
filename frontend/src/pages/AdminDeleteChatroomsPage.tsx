import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetChatrooms, useDeleteChatroom, useFlaggedMessages } from '../hooks/useQueries';
import { useForceFreshChatroomsOnActorReady } from '../hooks/useForceFreshChatroomsOnActorReady';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, Trash2, Lock, AlertCircle, Filter, Flag } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import type { ChatroomWithLiveStatus, Message } from '../backend';

const ADMIN_PASSWORD = 'lunasimbaliamsammy1987!';
const SESSION_KEY = 'admin_authenticated';

export default function AdminDeleteChatroomsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const queryClient = useQueryClient();

  // Check session storage on mount
  useEffect(() => {
    const authenticated = sessionStorage.getItem(SESSION_KEY);
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
    setIsCheckingAuth(false);
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAuthenticated(true);
      setPasswordError('');
      setPasswordInput('');
      
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'all'
      });
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Moderation Access</CardTitle>
            </div>
            <CardDescription>
              Enter the admin password to access moderation tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter admin password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError('');
                  }}
                  autoFocus
                  className="w-full"
                />
                {passwordError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <Button type="submit" className="w-full">
                Authenticate
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ModerationPanel />;
}

function ModerationPanel() {
  const { data: chatrooms, isLoading: chatroomsLoading, isError } = useGetChatrooms();
  const { data: flaggedMessages, isLoading: flaggedLoading } = useFlaggedMessages();
  const deleteChatroom = useDeleteChatroom();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Force fresh refetch if cached list is empty after actor is ready
  useForceFreshChatroomsOnActorReady();

  // On mount, if base query has empty cached data, force a refetch even if inactive
  useEffect(() => {
    const cachedData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms']);
    if (cachedData && cachedData.length === 0) {
      queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'all'
      });
    }
  }, [queryClient]);

  // Derive unique categories from chatrooms with normalization
  const categoryOptions = useMemo(() => {
    if (!chatrooms || chatrooms.length === 0) return [];

    const categoryMap = new Map<string, string>();
    
    chatrooms.forEach((chatroom) => {
      const normalizedKey = chatroom.category.trim().toLowerCase();
      if (!categoryMap.has(normalizedKey)) {
        categoryMap.set(normalizedKey, chatroom.category.trim());
      }
    });

    return Array.from(categoryMap.entries()).map(([key, label]) => ({
      key,
      label,
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [chatrooms]);

  // Filter chatrooms by selected category
  const filteredChatrooms = useMemo(() => {
    if (!chatrooms) return [];
    if (selectedCategory === 'all') return chatrooms;

    return chatrooms.filter((chatroom) => {
      const normalizedCategory = chatroom.category.trim().toLowerCase();
      return normalizedCategory === selectedCategory;
    });
  }, [chatrooms, selectedCategory]);

  const handleDelete = async (chatroomId: bigint) => {
    setDeletingId(chatroomId);
    try {
      await deleteChatroom.mutateAsync(chatroomId);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1_000_000);
    return date.toLocaleString();
  };

  const hasChatrooms = chatrooms && chatrooms.length > 0;

  // Sort flagged messages by flag count descending
  const sortedFlaggedMessages = useMemo(() => {
    if (!flaggedMessages) return [];
    return [...flaggedMessages].sort((a, b) => Number(b.flagCount) - Number(a.flagCount));
  }, [flaggedMessages]);

  const hasFlaggedMessages = sortedFlaggedMessages.length > 0;

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage flagged messages and chatrooms.</p>
      </div>

      {/* ── Flagged Messages Section ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            <CardTitle>Flagged Messages</CardTitle>
            {hasFlaggedMessages && (
              <Badge variant="destructive" className="ml-1">
                {sortedFlaggedMessages.length}
              </Badge>
            )}
          </div>
          <CardDescription>
            Messages reported by users, sorted by flag count.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flaggedLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasFlaggedMessages ? (
            <div className="space-y-3">
              {sortedFlaggedMessages.map((msg) => {
                const chatroom = chatrooms?.find((r) => r.id === msg.chatroomId);
                return (
                  <FlaggedMessageCard
                    key={msg.id.toString()}
                    message={msg}
                    chatroomTopic={chatroom?.topic}
                  />
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No flagged messages.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Chatroom Management Section ── */}
      <Card>
        <CardHeader>
          <CardTitle>Chatroom Management</CardTitle>
          <CardDescription>
            View and delete chatrooms. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError && !hasChatrooms && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load chatrooms. Please refresh the page.
              </AlertDescription>
            </Alert>
          )}

          {chatroomsLoading && !hasChatrooms ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : hasChatrooms ? (
            <>
              {/* Category Filter */}
              <div className="mb-4 flex items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCategory !== 'all' && (
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredChatrooms.length} of {chatrooms!.length} chatrooms
                  </span>
                )}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChatrooms.map((chatroom) => (
                      <TableRow key={chatroom.id.toString()}>
                        <TableCell className="font-mono text-xs">
                          {chatroom.id.toString()}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate font-medium">
                          {chatroom.topic}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{chatroom.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(chatroom.createdAt)}
                        </TableCell>
                        <TableCell>{chatroom.messageCount.toString()}</TableCell>
                        <TableCell>{chatroom.viewCount.toString()}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deletingId === chatroom.id}
                              >
                                {deletingId === chatroom.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Chatroom?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{chatroom.topic}" and all its
                                  messages. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(chatroom.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No chatrooms found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── FlaggedMessageCard ───────────────────────────────────────────────────────

function FlaggedMessageCard({
  message,
  chatroomTopic,
}: {
  message: Message;
  chatroomTopic?: string;
}) {
  const uniqueReasons = Array.from(new Set(message.reportReasons));

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">{message.sender}</p>
          <p className="text-sm text-foreground break-words line-clamp-3">{message.content}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-destructive">
          <Flag className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">{message.flagCount.toString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chatroomTopic && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            📍 {chatroomTopic}
          </span>
        )}
        {uniqueReasons.map((reason, i) => (
          <Badge key={i} variant="destructive" className="text-xs px-2 py-0.5">
            {reason}
          </Badge>
        ))}
      </div>
    </div>
  );
}
