import type { ProcessedMessageWithReactions } from '../hooks/useQueries';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useUnpinVideo } from '../hooks/useQueries';
import { getYouTubeVideoId, getTwitchEmbedUrl, isYouTubeUrl, isTwitchUrl } from '../lib/videoUtils';

interface PinnedVideoProps {
  message: ProcessedMessageWithReactions;
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
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {renderVideo()}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pinned by <span className="font-medium text-foreground">{message.sender}</span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUnpin}
          disabled={unpinVideo.isPending}
          className="gap-2 text-xs"
        >
          <X className="h-3 w-3" />
          Unpin
        </Button>
      </div>
    </div>
  );
}
