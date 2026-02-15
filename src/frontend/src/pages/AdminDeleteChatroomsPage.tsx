import { useState, useEffect } from 'react';
import { useGetChatrooms, useDeleteChatroom, useDeleteAllChatrooms } from '../hooks/useQueries';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, Trash2, Lock, AlertCircle, Trash } from 'lucide-react';
import { Badge } from '../components/ui/badge';

const ADMIN_PASSWORD = 'lunasimbaliamsammy1987!';
const SESSION_KEY = 'admin_authenticated';

export default function AdminDeleteChatroomsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check session storage on mount
  useEffect(() => {
    const authenticated = sessionStorage.getItem(SESSION_KEY);
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
    setIsCheckingAuth(false);
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setIsAuthenticated(true);
      setPasswordError('');
      setPasswordInput('');
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

  return <AdminChatroomList />;
}

function AdminChatroomList() {
  const { data: chatrooms, isLoading, isError } = useGetChatrooms();
  const deleteChatroom = useDeleteChatroom();
  const deleteAllChatrooms = useDeleteAllChatrooms();
  const [deletingId, setDeletingId] = useState<bigint | null>(null);

  const handleDelete = async (chatroomId: bigint) => {
    setDeletingId(chatroomId);
    try {
      await deleteChatroom.mutateAsync(chatroomId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    await deleteAllChatrooms.mutateAsync();
  };

  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1_000_000);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chatroom Management</CardTitle>
              <CardDescription>
                View and delete chatrooms. This action cannot be undone.
              </CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={deleteAllChatrooms.isPending || !chatrooms || chatrooms.length === 0}
                >
                  {deleteAllChatrooms.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash className="mr-2 h-4 w-4" />
                      DELETE ALL ROOMS
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Chatrooms?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL chatrooms and all their messages. This action cannot be undone.
                    {chatrooms && chatrooms.length > 0 && (
                      <span className="mt-2 block font-semibold text-destructive">
                        {chatrooms.length} chatroom{chatrooms.length !== 1 ? 's' : ''} will be deleted.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAll}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          {isError && (!chatrooms || chatrooms.length === 0) && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load chatrooms. Please refresh the page.
              </AlertDescription>
            </Alert>
          )}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !chatrooms || chatrooms.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No chatrooms found
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {chatrooms.map((chatroom) => (
                    <TableRow key={chatroom.id.toString()}>
                      <TableCell className="font-mono text-sm">
                        {chatroom.id.toString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-medium">
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
                                <>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Chatroom?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the chatroom "{chatroom.topic}" and all its messages. This action cannot be undone.
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
