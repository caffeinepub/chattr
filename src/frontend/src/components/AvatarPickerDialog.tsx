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

export default function AvatarPickerDialog({ open, onOpenChange }: AvatarPickerDialogProps) {
  const { data: currentAvatar } = useGetCurrentAvatar();
  const updateAvatar = useUpdateAvatar();
  const [isUploading, setIsUploading] = useState(false);

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
            Upload a custom image to personalize your profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
