import type { MessageWithReactions } from '../backend';
import { X, Pin } from 'lucide-react';
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
  userId: string;
}

export default function PinnedVideo({ message, chatroomId, userId }: PinnedVideoProps) {
  const unpinVideo = useUnpinVideo();

  const handleUnpin = async () => {
    await unpinVideo.mutateAsync({ chatroomId, userId });
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
    <div className="relative mx-auto w-full max-w-xl px-4 pt-4 pb-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        {renderVideo()}

        {/* Pin icon overlay — top-left, non-interactive */}
        <div className="pointer-events-none absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white">
          <Pin className="h-3 w-3" />
        </div>

        {/* Unpin button overlay — top-right */}
        <button
          onClick={handleUnpin}
          disabled={unpinVideo.isPending}
          aria-label="Unpin video"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 disabled:opacity-50"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
