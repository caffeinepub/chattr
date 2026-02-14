import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useUnpinVideo } from '../hooks/useQueries';
import type { MessageWithReactions } from '../hooks/useQueries';
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
    if (message.mediaType === 'youtube' && isYouTubeUrl(message.mediaUrl!)) {
      const videoId = getYouTubeVideoId(message.mediaUrl!);
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

    if (message.mediaType === 'twitch' && isTwitchUrl(message.mediaUrl!)) {
      const embedUrl = getTwitchEmbedUrl(message.mediaUrl!);
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
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-lg">
        {renderVideo()}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUnpin}
          disabled={unpinVideo.isPending}
          className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70 hover:text-white"
          aria-label="Unpin video"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 text-center">
        <p className="text-xs text-muted-foreground">
          Pinned by <span className="font-medium">{message.sender}</span>
        </p>
      </div>
    </div>
  );
}
