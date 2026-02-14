import type { MessageWithConvertedReactions } from '../types/message';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { useUnpinVideo } from '../hooks/useQueries';
import { getYouTubeVideoId, getTwitchEmbedUrl, isYouTubeUrl, isTwitchUrl } from '../lib/videoUtils';

interface PinnedVideoProps {
  message: MessageWithConvertedReactions;
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
        <div className="flex items-center gap-2">
          <img
            src="/assets/generated/pin-icon-transparent.dim_24x24.png"
            alt="Pinned"
            className="h-4 w-4"
          />
          <span className="text-sm font-medium text-foreground">Pinned by {message.sender}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUnpin}
          disabled={unpinVideo.isPending}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Unpin
        </Button>
      </div>
    </div>
  );
}
