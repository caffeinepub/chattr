import { useState } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { Button } from './ui/button';
import { MessageCircle, Check, X, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { useCurrentUsername, useUpdateUsername, useCurrentAvatar } from '../hooks/useQueries';
import AvatarPickerDialog from './AvatarPickerDialog';

export default function Header() {
  const router = useRouter();
  const routerState = useRouterState();
  const currentUsername = useCurrentUsername();
  const currentAvatar = useCurrentAvatar();
  const updateUsername = useUpdateUsername();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const isInChatroom = routerState.location.pathname.startsWith('/chatroom/');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleStartEdit = () => {
    setEditValue(currentUsername || '');
    setIsEditing(true);
  };

  const handleSaveUsername = async () => {
    if (editValue.trim()) {
      await updateUsername.mutateAsync(editValue.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveUsername();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleBackToLobby = () => {
    router.navigate({ to: '/' });
  };

  const progressPercentage = (editValue.length / 15) * 100;

  return (
    <>
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {isInChatroom && (
              <Button
                onClick={handleBackToLobby}
                variant="ghost"
                size="icon"
                className="mr-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Chattr</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAvatarPickerOpen(true)}
              className="transition-opacity hover:opacity-80"
            >
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarImage src={currentAvatar || undefined} alt={currentUsername || 'User'} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {currentUsername ? getInitials(currentUsername) : 'U'}
                </AvatarFallback>
              </Avatar>
            </button>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <div className="space-y-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter username"
                    maxLength={15}
                    className="h-9 w-40"
                    autoFocus
                    style={{ fontSize: '16px' }}
                  />
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent transition-all duration-200"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSaveUsername}
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  disabled={!editValue.trim()}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleCancelEdit}
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleStartEdit}
                variant="outline"
                className="h-9 px-3"
              >
                {currentUsername || 'Set Username'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <AvatarPickerDialog
        open={isAvatarPickerOpen}
        onOpenChange={setIsAvatarPickerOpen}
      />
    </>
  );
}
