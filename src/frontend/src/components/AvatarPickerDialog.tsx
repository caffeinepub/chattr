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
          console.error('Giphy fetch error:', error);
          setGiphyError('Failed to load GIFs');
          setGiphyResults([]);
          setIsSearchingGiphy(false);
        }
      });
  }, [debouncedSearchTerm, open]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
      console.error('Upload error:', error);
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
      console.error('Remove avatar error:', error);
      toast.error('Failed to remove avatar');
    }
  };

  const handleSelectGif = async (gifUrl: string) => {
    try {
      await updateAvatar.mutateAsync(gifUrl);
      onOpenChange(false);
    } catch (error) {
      console.error('Select GIF error:', error);
      toast.error('Failed to set avatar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Change Avatar</DialogTitle>
          <DialogDescription>
            Upload an image or search for a GIF from Giphy
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Current Avatar Preview */}
          <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/30">
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
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>

          {/* Upload Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Image</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={isUploading || updateAvatar.isPending}
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
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
          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <label className="text-sm font-medium">Search Giphy</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for GIFs..."
                value={giphySearchTerm}
                onChange={(e) => setGiphySearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Giphy Results */}
            <ScrollArea className="flex-1 min-h-0 border border-border rounded-lg">
              <div className="p-2">
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
                        className="relative aspect-square overflow-hidden rounded-lg border border-border hover:border-primary transition-colors disabled:opacity-50"
                      >
                        <img
                          src={gif.previewUrl}
                          alt={gif.title}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">
                      {giphySearchTerm.trim() ? 'No GIFs found' : 'Trending GIFs'}
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
