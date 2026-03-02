import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useGetChatrooms, useDeleteChatroom, useGetFlaggedMessages, useDeleteMessage } from '../hooks/useQueries';
import type { Message } from '../backend';

const ADMIN_PASSWORD = 'lunasimbaliamsammy1987!';

function FlaggedMessageCard({
  message,
  onDelete,
  isDeleting,
}: {
  message: Message;
  onDelete: (id: bigint) => void;
  isDeleting: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-foreground">{message.sender}</span>
            <span className="text-xs text-muted-foreground">Room #{message.chatroomId.toString()}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
              <AlertTriangle className="h-3 w-3" />
              {message.flagCount.toString()} flag{Number(message.flagCount) !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-foreground break-words line-clamp-3">{message.content}</p>
          {message.reportReasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.reportReasons.slice(0, 3).map((reason, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs"
                >
                  {reason}
                </span>
              ))}
              {message.reportReasons.length > 3 && (
                <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs">
                  +{message.reportReasons.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onDelete(message.id)}
          disabled={isDeleting}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {isDeleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function AdminDeleteChatroomsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('adminAuth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deletingMessageId, setDeletingMessageId] = useState<bigint | null>(null);

  const { data: chatrooms = [], isLoading: chatroomsLoading } = useGetChatrooms();
  const { data: flaggedMessages = [], isLoading: flaggedLoading } = useGetFlaggedMessages();
  const deleteChatroom = useDeleteChatroom();
  const deleteMessage = useDeleteMessage();

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password.');
    }
  };

  const handleDeleteMessage = (messageId: bigint) => {
    setDeletingMessageId(messageId);
    deleteMessage.mutate(messageId, {
      onSettled: () => setDeletingMessageId(null),
    });
  };

  const handleDeleteChatroom = (chatroomId: bigint) => {
    if (!window.confirm('Are you sure you want to delete this chatroom? This cannot be undone.')) return;
    // useDeleteChatroom expects a bigint directly
    deleteChatroom.mutate(chatroomId);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Access</h1>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Enter admin password"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background mb-3"
          />
          {passwordError && (
            <p className="text-destructive text-sm mb-3">{passwordError}</p>
          )}
          <button
            onClick={handleLogin}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <ShieldAlert className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Moderation</h1>
        </div>

        {/* Flagged Messages Section */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Flagged Messages
            {flaggedMessages.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
                {flaggedMessages.length}
              </span>
            )}
          </h2>

          {flaggedLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : flaggedMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No flagged messages.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {flaggedMessages.map(msg => (
                <FlaggedMessageCard
                  key={msg.id.toString()}
                  message={msg}
                  onDelete={handleDeleteMessage}
                  isDeleting={deletingMessageId === msg.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Chatrooms Section */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Chatrooms</h2>

          {chatroomsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : chatrooms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No chatrooms found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Topic</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Messages</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Presence</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {chatrooms.map((chatroom, idx) => (
                    <tr
                      key={chatroom.id.toString()}
                      className={`border-b border-border last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground">#{chatroom.id.toString()}</td>
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{chatroom.topic}</td>
                      <td className="px-4 py-3 text-muted-foreground">{chatroom.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">{chatroom.messageCount.toString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{chatroom.presenceIndicator.toString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteChatroom(chatroom.id)}
                          disabled={deleteChatroom.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
