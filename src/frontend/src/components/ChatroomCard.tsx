import type { ChatroomWithLiveStatus } from '../backend';
import { MessageCircle, Users, Eye } from 'lucide-react';
import { Badge } from './ui/badge';
import { formatCompactNumber } from '../lib/formatters';
import { getYouTubeVideoId, getTwitchChannelName, getYouTubeThumbnailUrl, getTwitchThumbnailUrl, detectMediaType } from '../lib/videoUtils';

interface ChatroomCardProps {
  chatroom: ChatroomWithLiveStatus;
  onClick: () => void;
}

export default function ChatroomCard({ chatroom, onClick }: ChatroomCardProps) {
  const getThumbnailUrl = () => {
    if (!chatroom.mediaUrl) {
      return '/assets/generated/default-chatroom-thumbnail.dim_200x150.png';
    }

    const mediaType = chatroom.mediaType || detectMediaType(chatroom.mediaUrl);

    if (mediaType === 'youtube') {
      const videoId = getYouTubeVideoId(chatroom.mediaUrl);
      if (videoId) {
        return getYouTubeThumbnailUrl(videoId);
      }
    }

    if (mediaType === 'twitch') {
      const thumbnailUrl = getTwitchThumbnailUrl(chatroom.mediaUrl);
      if (thumbnailUrl) {
        return thumbnailUrl;
      }
    }

    if (mediaType === 'twitter') {
      // Twitter thumbnails are handled client-side, use placeholder
      return '/assets/generated/twitter-placeholder.dim_200x150.png';
    }

    if (mediaType === 'image') {
      return chatroom.mediaUrl;
    }

    return '/assets/generated/default-chatroom-thumbnail.dim_200x150.png';
  };

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/50"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={getThumbnailUrl()}
          alt={chatroom.topic}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          {chatroom.archived && (
            <Badge variant="secondary" className="bg-gray-600 text-white px-2 py-0.5 text-xs font-semibold">
              ARCHIVED
            </Badge>
          )}
          {chatroom.category && (
            <Badge variant="secondary" className="px-2 py-0.5 text-xs">
              {chatroom.category.toLowerCase()}
            </Badge>
          )}
          {chatroom.isLive && !chatroom.archived && (
            <div className="flex items-center gap-1.5 rounded-md bg-primary px-2 py-0.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              <span className="text-xs font-bold uppercase tracking-wide text-white">
                LIVE
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
          {chatroom.topic}
        </h3>
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
          {chatroom.description}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            <span>{formatCompactNumber(chatroom.messageCount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{formatCompactNumber(chatroom.activeUserCount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{formatCompactNumber(chatroom.viewCount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
