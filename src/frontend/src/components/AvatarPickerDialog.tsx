import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Upload, Trash2, Search } from 'lucide-react';
import { useGetCurrentAvatar, useUpdateAvatar, uploadImage } from '../hooks/useQueries';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { searchGiphy, GiphyGif } from '../lib/giphy';
import { ScrollArea } from './ui/scroll-area';

interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AvatarPickerDialog({ open, onOpenChange }: AvatarPickerDialogProps) {
  const { data: currentAvatar } = useGetCurrentAvatar();
  const updateAvatar = useUpdateAvatar();
  const [isUploading, setIsUploading] = useState(false);
  const [giphySearchTerm, setGiphySearchTerm] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyGif[]>([]);
  const [giphyError, setGiphyError] = useState<string | null>(null);
  const [isSearchingGiphy, setIsSearchingGiphy] = useState(false);
  const debouncedSearchTerm = useDebouncedValue(giphySearchTerm, 500);
  const requestIdRef = useRef(0);

  // Perform Giphy search when debounced term changes
  useEffect(() => {
    // Clear results and error if search term is empty
    if (!debouncedSearchTerm.trim()) {
      setGiphyResults([]);
      setGiphyError(null);
      setIsSearchingGiphy(false);
      return;
    }

    // Increment request ID to track this specific search
    const currentRequestId = ++requestIdRef.current;
    
    setIsSearchingGiphy(true);
    
    searchGiphy(debouncedSearchTerm)
      .then((result) => {
        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setGiphyResults(result.gifs);
          setGiphyError(result.error || null);
        }
      })
      .catch((error) => {
        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          console.error('Giphy search error:', error);
          setGiphyError('Failed to search Giphy. Please try again.');
          setGiphyResults([]);
        }
      })
      .finally(() => {
        // Only update loading state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setIsSearchingGiphy(false);
        }
      });

    // Cleanup function to prevent state updates after unmount or new search
    return () => {
      // The next search will increment requestIdRef, making this request stale
    };
  }, [debouncedSearchTerm]);

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

  const handleGiphySelect = async (gif: GiphyGif) => {
    try {
      await updateAvatar.mutateAsync({ avatarUrl: gif.originalUrl, isPreset: false });
      onOpenChange(false);
    } catch (error) {
      console.error('Error setting Giphy avatar:', error);
      toast.error('Failed to set avatar');
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

          {/* Giphy Search */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search Giphy for GIFs..."
                value={giphySearchTerm}
                onChange={(e) => setGiphySearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {isSearchingGiphy && (
              <div className="text-center text-sm text-muted-foreground">
                Searching...
              </div>
            )}

            {giphyError && (
              <div className="text-center text-sm text-muted-foreground">
                {giphyError}
              </div>
            )}

            {giphyResults.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border border-border">
                <div className="grid grid-cols-3 gap-2 p-2">
                  {giphyResults.map((gif) => (
                    <button
                      key={gif.id}
                      onClick={() => handleGiphySelect(gif)}
                      disabled={updateAvatar.isPending}
                      className="relative aspect-square overflow-hidden rounded-md transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <img
                        src={gif.previewUrl}
                        alt={gif.title}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
