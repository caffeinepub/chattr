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
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-9 w-9"
              aria-label="Back to lobby"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center" style={{ gap: '0.5rem' }}>
              <img
                src="/assets/generated/chat-icon-transparent.dim_64x64.png"
                alt="Chattr"
                className="h-8 w-8"
              />
              <h1 className="text-xl font-bold text-foreground">Chattr</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Avatar */}
            <button
              onClick={handleAvatarClick}
              className="flex-shrink-0 transition-opacity hover:opacity-80"
              aria-label="Change avatar"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={avatarUrl || undefined} alt={username || 'User'} />
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
            </button>

            {/* Username */}
            {isEditingUsername ? (
              <form onSubmit={handleUsernameSubmit} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={editedUsername}
                  onChange={(e) => setEditedUsername(e.target.value)}
                  onBlur={handleUsernameBlur}
                  autoFocus
                  className="h-9 w-32"
                  maxLength={20}
                />
              </form>
            ) : (
              <Button
                variant="ghost"
                onClick={handleUsernameClick}
                className="h-9 px-3 font-medium"
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
