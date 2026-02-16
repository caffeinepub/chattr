import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Upload, Trash2, Search } from 'lucide-react';
import { useCurrentAvatar, useUpdateAvatar, uploadImage } from '../hooks/useQueries';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { searchGiphy, fetchTrendingGiphy, GiphyGif } from '../lib/giphy';
import { ScrollArea } from './ui/scroll-area';

interface AvatarPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AvatarPickerDialog({ open, onOpenChange }: AvatarPickerDialogProps) {
  const currentAvatar = useCurrentAvatar();
  const updateAvatar = useUpdateAvatar();
  const [isUploading, setIsUploading] = useState(false);
  const [giphySearchTerm, setGiphySearchTerm] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyGif[]>([]);
  const [giphyError, setGiphyError] = useState<string | null>(null);
  const [isSearchingGiphy, setIsSearchingGiphy] = useState(false);
  const debouncedSearchTerm = useDebouncedValue(giphySearchTerm, 500);
  const requestIdRef = useRef(0);

  // Perform Giphy search or fetch trending when debounced term changes
  useEffect(() => {
    // Only fetch if dialog is open
    if (!open) {
      return;
    }

    // Increment request ID to track this specific request
    const currentRequestId = ++requestIdRef.current;
    
    setIsSearchingGiphy(true);
    setGiphyError(null);

    // If search term is empty, fetch trending; otherwise search
    const fetchPromise = debouncedSearchTerm.trim()
      ? searchGiphy(debouncedSearchTerm)
      : fetchTrendingGiphy();

    fetchPromise
      .then((result) => {
        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setGiphyResults(result.gifs);
          setGiphyError(result.error || null);
          setIsSearchingGiphy(false);
        }
      })
      .catch((error) => {
        // Only update state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          console.error('[AvatarPickerDialog] Giphy fetch error:', error);
          setGiphyError('Failed to load GIFs. Please try again.');
          setIsSearchingGiphy(false);
        }
      });
  }, [debouncedSearchTerm, open]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setGiphySearchTerm('');
      setGiphyResults([]);
      setGiphyError(null);
    }
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setIsUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      await updateAvatar.mutateAsync(imageUrl);
      onOpenChange(false);
    } catch (error) {
      console.error('[AvatarPickerDialog] Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await updateAvatar.mutateAsync(null);
      onOpenChange(false);
    } catch (error) {
      console.error('[AvatarPickerDialog] Remove error:', error);
      toast.error('Failed to remove avatar');
    }
  };

  const handleSelectGif = async (gifUrl: string) => {
    try {
      await updateAvatar.mutateAsync(gifUrl);
      onOpenChange(false);
    } catch (error) {
      console.error('[AvatarPickerDialog] Select GIF error:', error);
      toast.error('Failed to set avatar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Avatar</DialogTitle>
          <DialogDescription>
            Upload an image or select a GIF from Giphy
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {currentAvatar ? (
                <AvatarImage src={currentAvatar} alt="Current avatar" />
              ) : null}
              <AvatarFallback className="bg-primary text-primary-foreground">
                ?
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">Current Avatar</p>
              <p className="text-xs text-muted-foreground">
                {currentAvatar ? 'Custom avatar set' : 'No avatar set'}
              </p>
            </div>
            {currentAvatar && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={updateAvatar.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            )}
          </div>

          {/* Upload Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Image</label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="w-full"
                disabled={isUploading || updateAvatar.isPending}
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Choose File'}
              </Button>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Giphy Search Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Giphy</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search for GIFs..."
                value={giphySearchTerm}
                onChange={(e) => setGiphySearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Giphy Results */}
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-4">
                {isSearchingGiphy ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">Loading GIFs...</p>
                  </div>
                ) : giphyError ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-destructive">{giphyError}</p>
                  </div>
                ) : giphyResults.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {giphyResults.map((gif) => (
                      <button
                        key={gif.id}
                        onClick={() => handleSelectGif(gif.originalUrl)}
                        disabled={updateAvatar.isPending}
                        className="group relative aspect-square overflow-hidden rounded-md border border-border transition-all hover:border-primary hover:ring-2 hover:ring-primary disabled:opacity-50"
                      >
                        <img
                          src={gif.previewUrl}
                          alt={gif.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-110"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">
                      {giphySearchTerm.trim()
                        ? 'No GIFs found. Try a different search.'
                        : 'Start typing to search for GIFs'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
