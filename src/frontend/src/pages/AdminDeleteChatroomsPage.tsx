import { useState, useEffect, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useGetChatrooms, useDeleteChatroom } from '../hooks/useQueries';
import { useForceFreshChatroomsOnActorReady } from '../hooks/useForceFreshChatroomsOnActorReady';
import { useActor } from '../hooks/useActor';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2, Trash2, Lock, AlertCircle, Filter, AlertTriangle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import type { ChatroomWithLiveStatus } from '../backend';

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
      
      // After successful authentication, force refetch of base chatrooms query even if inactive
      console.log('[AdminDeleteChatroomsPage] Authentication successful, forcing chatrooms refetch...');
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'all' // Changed from 'active' to 'all' to refetch even when inactive
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
              <CardTitle>Admin Access</CardTitle>
            </div>
            <CardDescription>
              Enter the admin password to access chatroom management
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

  return <AdminContent />;
}

function AdminContent() {
  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6">
      <Tabs defaultValue="chatrooms" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="chatrooms">Chatrooms</TabsTrigger>
          <TabsTrigger value="reset">Reset Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chatrooms">
          <AdminChatroomList />
        </TabsContent>
        
        <TabsContent value="reset">
          <ResetDataSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminChatroomList() {
  const { data: chatrooms, isLoading, isError } = useGetChatrooms();
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
      console.log('[AdminChatroomList] Detected empty cached base query on mount, forcing refetch...');
      queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'all' // Changed from 'active' to 'all' to refetch even when inactive
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
        // Store the first-seen trimmed value as the display label
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

  return (
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

        {isLoading && !hasChatrooms ? (
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
                  Showing {filteredChatrooms.length} of {chatrooms.length} chatrooms
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
  );
}

function ResetDataSection() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      await actor.resetData();
    },
    onSuccess: async () => {
      // Show success message
      setShowSuccess(true);
      
      // Invalidate and refetch all chatroom queries
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        type: 'all' 
      });
      
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);
    },
  });

  const handleReset = () => {
    resetMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Reset All Data
        </CardTitle>
        <CardDescription>
          Permanently delete all chatrooms, messages, reactions, user profiles, and reset the entire site to its initial state.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showSuccess && (
          <Alert className="border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              All data has been successfully reset. The site is now in its initial state.
            </AlertDescription>
          </Alert>
        )}

        {resetMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to reset data: {resetMutation.error instanceof Error ? resetMutation.error.message : 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> This action will permanently delete all data on the site including:
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>All chatrooms and their content</li>
              <li>All messages and reactions</li>
              <li>All user profiles</li>
              <li>Active user tracking data</li>
            </ul>
            <p className="mt-2">This action cannot be undone.</p>
          </AlertDescription>
        </Alert>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              size="lg"
              disabled={resetMutation.isPending}
              className="w-full"
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Data...
                </>
              ) : (
                'Reset All Data'
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Are you absolutely sure?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all data on the site. All chatrooms, messages, reactions, and user profiles will be lost forever. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Reset All Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
