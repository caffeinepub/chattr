import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface ProfileSetupModalProps {
  open: boolean;
  onComplete: () => void;
}

const USERNAME_LIMIT = 15;

const PRESET_AVATARS = [
  '/assets/generated/avatar-preset-1-chattr-blue.dim_64x64.png',
  '/assets/generated/avatar-preset-2-chattr-green.dim_64x64.png',
  '/assets/generated/avatar-preset-3-chattr-red.dim_64x64.png',
  '/assets/generated/avatar-preset-4-chattr-purple.dim_64x64.png',
  '/assets/generated/avatar-preset-5-chattr-orange.dim_64x64.png',
  '/assets/generated/avatar-preset-6-chattr-yellow.dim_64x64.png',
];

export default function ProfileSetupModal({ open, onComplete }: ProfileSetupModalProps) {
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) return;

    // Store in localStorage
    localStorage.setItem('chatUsername', username.trim());
    localStorage.setItem('chatAvatarUrl', selectedAvatar);
    
    // Generate and store user ID if not exists
    let userId = localStorage.getItem('chatUserId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatUserId', userId);
    }

    onComplete();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const usernamePercentage = (username.length / USERNAME_LIMIT) * 100;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to Chattr!</DialogTitle>
          <DialogDescription>
            Choose a username and avatar to get started
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center">
            <Avatar className="h-24 w-24">
              <AvatarImage src={selectedAvatar} alt="Selected avatar" />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {username ? getInitials(username) : 'U'}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar-select">Choose Avatar</Label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_AVATARS.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`rounded-full border-2 transition-all ${
                    selectedAvatar === avatar
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={avatar} alt={`Avatar ${index + 1}`} />
                    <AvatarFallback>A{index + 1}</AvatarFallback>
                  </Avatar>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              maxLength={USERNAME_LIMIT}
              required
              autoFocus
              style={{ fontSize: '16px' }}
            />
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${usernamePercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {username.length}/{USERNAME_LIMIT} characters
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!username.trim()}
          >
            Continue
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
