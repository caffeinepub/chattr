import { Users, Eye, MessageSquare } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import type { LobbyChatroomCard } from '../backend';
import { getPlaceholderThumbnail } from '../lib/lobbyPlaceholderThumbnails';

interface ChatroomCardProps {
  card: LobbyChatroomCard;
  onClick: () => void;
}

export default function ChatroomCard({ card, onClick }: ChatroomCardProps) {
  const thumbnailUrl = getPlaceholderThumbnail(card.mediaType);

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        <img
          src={thumbnailUrl}
          alt={card.topic}
          className="absolute inset-0 h-full w-full object-contain"
        />
        
        {/* LIVE Badge - Bottom Left */}
        {card.isLive && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="destructive" className="bg-red-600 text-xs font-bold">
              LIVE
            </Badge>
          </div>
        )}

        {/* Twitch Play Button Overlay */}
        {card.mediaType === 'twitch' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600/90 transition-transform group-hover:scale-110">
              <div className="ml-1 h-0 w-0 border-y-8 border-l-12 border-y-transparent border-l-white" />
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        {/* Topic */}
        <h3 className="mb-2 line-clamp-2 text-base font-semibold">{card.topic}</h3>

        {/* Category Badge */}
        <Badge variant="secondary" className="mb-3 text-xs">
          {card.category}
        </Badge>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {card.isLive ? (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{Number(card.activeUserCount)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>{Number(card.presenceIndicator)}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>{Number(card.messageCount)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
