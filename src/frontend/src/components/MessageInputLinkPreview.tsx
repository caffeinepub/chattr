import { useState, useEffect } from 'react';
import { fetchTwitterOEmbedPreview, type TwitterPreview } from '../lib/twitterOEmbedPreview';
import { getYouTubeVideoId, getTwitchThumbnailUrl, getTwitchChannelName, getTwitchClipSlug, getTwitchVideoId } from '../lib/videoUtils';
import { Loader2, X as XIcon } from 'lucide-react';
import { SiX } from 'react-icons/si';

interface MessageInputLinkPreviewProps {
  url: string;
  type: 'youtube' | 'twitch' | 'twitter';
}

export default function MessageInputLinkPreview({ url, type }: MessageInputLinkPreviewProps) {
  const [twitterPreview, setTwitterPreview] = useState<TwitterPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    if (type === 'twitter') {
      fetchTwitterOEmbedPreview(url)
        .then((preview) => {
          setTwitterPreview(preview);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('[MessageInputLinkPreview] Error fetching Twitter preview:', err);
          setError('Failed to load preview');
          setIsLoading(false);
        });
    } else {
      // For YouTube and Twitch, we don't need to fetch anything
      setIsLoading(false);
    }
  }, [url, type]);

  if (isLoading) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading preview...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <XIcon className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (type === 'twitter' && twitterPreview) {
    return (
      <div className="mt-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <SiX className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {twitterPreview.authorName}
            </div>
            <div className="mt-1 text-sm text-muted-foreground line-clamp-3">
              {twitterPreview.text}
            </div>
            {twitterPreview.imageUrl && (
              <div className="mt-2">
                <img
                  src={twitterPreview.imageUrl}
                  alt="Tweet preview"
                  className="max-h-32 rounded-lg object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'youtube') {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return (
        <div className="mt-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <img
                src={thumbnailUrl}
                alt="YouTube thumbnail"
                className="h-20 w-32 rounded-lg object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">YouTube Video</div>
              <div className="mt-1 text-xs text-muted-foreground break-all line-clamp-2">
                {url}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  if (type === 'twitch') {
    const channelName = getTwitchChannelName(url);
    const clipSlug = getTwitchClipSlug(url);
    const videoId = getTwitchVideoId(url);
    const thumbnailUrl = getTwitchThumbnailUrl(url);

    let title = 'Twitch Stream';
    if (clipSlug) {
      title = 'Twitch Clip';
    } else if (videoId) {
      title = 'Twitch VOD';
    } else if (channelName) {
      title = `Twitch: ${channelName}`;
    }

    return (
      <div className="mt-2 rounded-lg border border-border bg-card p-3">
        <div className="flex items-start gap-3">
          {thumbnailUrl ? (
            <div className="flex-shrink-0">
              <img
                src={thumbnailUrl}
                alt="Twitch thumbnail"
                className="h-20 w-32 rounded-lg object-cover"
                onError={(e) => {
                  // Fallback to placeholder on error
                  e.currentTarget.src = '/assets/generated/twitch-placeholder.dim_200x150.png';
                }}
              />
            </div>
          ) : (
            <div className="flex h-20 w-32 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
              <img
                src="/assets/generated/twitch-icon-transparent.dim_32x32.png"
                alt="Twitch"
                className="h-8 w-8"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground break-all line-clamp-2">
              {url}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
