import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from './ui/button';
import { useGetCurrentUsername, useUpdateUsername, useGetCurrentAvatar } from '../hooks/useQueries';
import { Input } from './ui/input';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import AvatarPickerDialog from './AvatarPickerDialog';

export default function Header() {
  const navigate = useNavigate();
  const { data: username } = useGetCurrentUsername();
  const { data: avatarUrl } = useGetCurrentAvatar();
  const updateUsername = useUpdateUsername();
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);

  const handleBack = () => {
    navigate({ to: '/' });
  };

  const handleUsernameClick = () => {
    setEditedUsername(username || '');
    setIsEditingUsername(true);
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editedUsername.trim() && editedUsername !== username) {
      await updateUsername.mutateAsync(editedUsername.trim());
    }
    setIsEditingUsername(false);
  };

  const handleUsernameBlur = () => {
    setIsEditingUsername(false);
  };

  const handleAvatarClick = () => {
    setIsAvatarDialogOpen(true);
  };

  return (
    <>
      <header className="w-full border-b border-border bg-card">
        <div className="mx-auto flex items-center justify-between px-4 py-3">
          {/* Left: Back button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="flex-shrink-0"
            aria-label="Back to lobby"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Center: Logo and Title */}
          <div className="flex flex-1 items-center justify-center gap-2">
            <img
              src="/assets/generated/chat-icon-transparent.dim_64x64.png"
              alt="Chattr"
              className="h-8 w-8"
            />
            <h1 className="text-xl font-bold text-foreground">Chattr</h1>
          </div>

          {/* Right: Avatar and Username */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={handleAvatarClick}
              className="flex-shrink-0 transition-opacity hover:opacity-80"
              aria-label="Change avatar"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl || undefined} alt={username || 'User'} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </button>

            {isEditingUsername ? (
              <form onSubmit={handleUsernameSubmit} className="flex items-center gap-1">
                <Input
                  type="text"
                  value={editedUsername}
                  onChange={(e) => setEditedUsername(e.target.value)}
                  onBlur={handleUsernameBlur}
                  autoFocus
                  className="h-8 w-24 text-sm"
                  maxLength={20}
                />
              </form>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUsernameClick}
                className="h-8 px-2 text-sm font-medium"
              >
                {username}
              </Button>
            )}
          </div>
        </div>
      </header>

      <AvatarPickerDialog
        open={isAvatarDialogOpen}
        onOpenChange={setIsAvatarDialogOpen}
      />
    </>
  );
}
