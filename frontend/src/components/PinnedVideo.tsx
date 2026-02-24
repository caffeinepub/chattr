import type { MessageWithReactions } from '../backend';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useUnpinVideo } from '../hooks/useQueries';
import { 
  getYouTubeVideoId, 
  getTwitchEmbedUrl,
  isYouTubeUrl, 
  isTwitchUrl 
} from '../lib/videoUtils';

interface PinnedVideoProps {
  message: MessageWithReactions;
  chatroomId: bigint;
}

export default function PinnedVideo({ message, chatroomId }: PinnedVideoProps) {
  const unpinVideo = useUnpinVideo();

  const handleUnpin = async () => {
    await unpinVideo.mutateAsync(chatroomId);
  };

  if (!message.mediaUrl || !message.mediaType) return null;

  const renderVideo = () => {
    const mediaUrl = message.mediaUrl!;

    if (message.mediaType === 'youtube' && isYouTubeUrl(mediaUrl)) {
      const videoId = getYouTubeVideoId(mediaUrl);
      if (videoId) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Pinned YouTube video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
    }

    if (message.mediaType === 'twitch' && isTwitchUrl(mediaUrl)) {
      const embedUrl = getTwitchEmbedUrl(mediaUrl);
      if (embedUrl) {
        return (
          <iframe
            src={embedUrl}
            title="Pinned Twitch video"
            className="h-full w-full"
            allowFullScreen
          />
        );
      }
    }

    return null;
  };

  return (
    <div className="relative mx-auto w-full max-w-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img 
            src="/assets/generated/pin-icon-transparent.dim_24x24.png" 
            alt="Pinned" 
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-foreground">Pinned Video</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUnpin}
          disabled={unpinVideo.isPending}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        {renderVideo()}
      </div>
    </div>
  );
}

