import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Upload, Trash2 } from 'lucide-react';
import { useGetCurrentAvatar, useUpdateAvatar, uploadImage } from '../hooks/useQueries';
import { toast } from 'sonner';

interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AVATARS = [
  '/assets/generated/avatar-preset-1-chattr-blue.dim_64x64.png',
  '/assets/generated/avatar-preset-2-chattr-green.dim_64x64.png',
  '/assets/generated/avatar-preset-3-chattr-red.dim_64x64.png',
  '/assets/generated/avatar-preset-4-chattr-purple.dim_64x64.png',
  '/assets/generated/avatar-preset-5-chattr-orange.dim_64x64.png',
  '/assets/generated/avatar-preset-6-chattr-yellow.dim_64x64.png',
];

export default function AvatarPickerDialog({ open, onOpenChange }: AvatarPickerDialogProps) {
  const { data: currentAvatar } = useGetCurrentAvatar();
  const updateAvatar = useUpdateAvatar();
  const [isUploading, setIsUploading] = useState(false);

  const handlePresetSelect = async (presetUrl: string) => {
    try {
      await updateAvatar.mutateAsync({ avatarUrl: presetUrl, isPreset: true });
      onOpenChange(false);
    } catch (error) {
      console.error('Error selecting preset avatar:', error);
      toast.error('Failed to select preset avatar');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      const avatarUrl = await uploadImage(file);
      await updateAvatar.mutateAsync({ avatarUrl, isPreset: false });
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await updateAvatar.mutateAsync({ avatarUrl: null, isPreset: false });
      onOpenChange(false);
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove avatar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Avatar</DialogTitle>
          <DialogDescription>
            Select a preset avatar or upload your own image
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preset Avatars - Displayed at the top */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">Preset Avatars</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {PRESET_AVATARS.map((presetUrl, index) => (
                <button
                  key={index}
                  onClick={() => handlePresetSelect(presetUrl)}
                  disabled={updateAvatar.isPending}
                  className="group relative aspect-square overflow-hidden rounded-lg border-2 border-border transition-all hover:border-primary hover:scale-105 disabled:opacity-50"
                >
                  <img
                    src={presetUrl}
                    alt={`Preset ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {currentAvatar === presetUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Current Avatar */}
          {currentAvatar && (
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={currentAvatar} alt="Current avatar" />
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">Current avatar</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveAvatar}
                disabled={updateAvatar.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload Custom Avatar */}
          <div>
            <label
              htmlFor="avatar-upload"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {isUploading ? 'Uploading...' : 'Upload Custom Avatar'}
              </span>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading || updateAvatar.isPending}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
