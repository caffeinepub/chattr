import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { searchGiphy, fetchTrendingGiphy, GiphyGif } from '../lib/giphy';
import { ScrollArea } from './ui/scroll-area';

interface GifPickerDialogProps {
  onSelectGif: (gifUrl: string) => void;
  disabled?: boolean;
}

export default function GifPickerDialog({ onSelectGif, disabled }: GifPickerDialogProps) {
  const [giphySearchTerm, setGiphySearchTerm] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyGif[]>([]);
  const [giphyError, setGiphyError] = useState<string | null>(null);
  const [isSearchingGiphy, setIsSearchingGiphy] = useState(false);
  const debouncedSearchTerm = useDebouncedValue(giphySearchTerm, 500);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const currentRequestId = ++requestIdRef.current;
    
    setIsSearchingGiphy(true);
    setGiphyError(null);

    const fetchPromise = debouncedSearchTerm.trim()
      ? searchGiphy(debouncedSearchTerm)
      : fetchTrendingGiphy();

    fetchPromise
      .then((result) => {
        if (currentRequestId === requestIdRef.current) {
          setGiphyResults(result.gifs);
          setGiphyError(result.error || null);
          setIsSearchingGiphy(false);
        }
      })
      .catch((error) => {
        if (currentRequestId === requestIdRef.current) {
          console.error('Giphy fetch error:', error);
          setGiphyError('Failed to load GIFs');
          setGiphyResults([]);
          setIsSearchingGiphy(false);
        }
      });
  }, [debouncedSearchTerm]);

  return (
    <div className="space-y-3 flex flex-col h-full">
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for GIFs..."
          value={giphySearchTerm}
          onChange={(e) => setGiphySearchTerm(e.target.value)}
          className="pl-9"
          disabled={disabled}
        />
      </div>

      <div className="flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
        <ScrollArea className="h-full">
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
                    onClick={() => onSelectGif(gif.originalUrl)}
                    disabled={disabled}
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
                  {debouncedSearchTerm.trim() ? 'No GIFs found' : 'Search for GIFs or browse trending'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
