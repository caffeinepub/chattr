import { useState, useEffect } from 'react';
import type { ChatroomWithLiveStatus } from '../backend';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Play, Eye } from 'lucide-react';
import { SiX, SiTwitch } from 'react-icons/si';
import { Badge } from './ui/badge';
import { formatCompactNumber } from '../lib/formatters';
import { 
  getYouTubeVideoId, 
  getYouTubeThumbnailUrl, 
  getTwitchClipSlug,
  getTwitchVideoId,
  getTwitchChannelName,
  getTwitchThumbnailUrl,
  isYouTubeUrl, 
  isTwitchUrl, 
  isTwitterUrl,
  getTwitterPostId
} from '../lib/videoUtils';

interface ChatroomCardProps {
  chatroom: ChatroomWithLiveStatus;
  onClick: () => void;
}

export default function ChatroomCard({ chatroom, onClick }: ChatroomCardProps) {
  const [twitchThumbnail, setTwitchThumbnail] = useState<string | null>(null);
  const [twitterThumbnail, setTwitterThumbnail] = useState<string | null>(null);

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    const distance = formatDistanceToNow(date, { addSuffix: true });
    return distance.replace(/^about\s+/i, '');
  };

  // Fetch Twitch thumbnail
  useEffect(() => {
    if (chatroom.mediaType === 'twitch' && isTwitchUrl(chatroom.mediaUrl)) {
      const thumbnailUrl = getTwitchThumbnailUrl(chatroom.mediaUrl);
      
      if (thumbnailUrl) {
        // Test if thumbnail is available
        const img = new Image();
        img.onload = () => setTwitchThumbnail(thumbnailUrl);
        img.onerror = () => setTwitchThumbnail(null);
        img.src = thumbnailUrl;
      }
    }
  }, [chatroom.mediaUrl, chatroom.mediaType]);

  // Fetch Twitter thumbnail via oEmbed
  useEffect(() => {
    if (chatroom.mediaType === 'twitter' && isTwitterUrl(chatroom.mediaUrl)) {
      const fetchTwitterThumb = async () => {
        try {
          const response = await fetch(
            `https://publish.twitter.com/oembed?url=${encodeURIComponent(chatroom.mediaUrl)}&omit_script=true`
          );
          
          if (response.ok) {
            const data = await response.json();
            
            // Extract thumbnail from HTML if available
            if (data.html) {
              const imgMatch = data.html.match(/src="([^"]+)"/);
              if (imgMatch && imgMatch[1]) {
                setTwitterThumbnail(imgMatch[1]);
              }
            }
            
            // Try author profile image as fallback
            if (!twitterThumbnail && data.author_url) {
              setTwitterThumbnail(data.author_url);
            }
          }
        } catch (error) {
          console.error('Failed to fetch Twitter thumbnail:', error);
        }
      };
      
      fetchTwitterThumb();
    }
  }, [chatroom.mediaUrl, chatroom.mediaType]);

  const renderThumbnail = () => {
    if (!chatroom.mediaUrl) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
          <MessageCircle className="h-12 w-12 text-primary/40" />
        </div>
      );
    }

    // YouTube thumbnail
    if (chatroom.mediaType === 'youtube' && isYouTubeUrl(chatroom.mediaUrl)) {
      const videoId = getYouTubeVideoId(chatroom.mediaUrl);
      if (videoId) {
        const thumbnailUrl = getYouTubeThumbnailUrl(videoId);
        return (
          <div className="relative h-full w-full">
            <img
              src={thumbnailUrl}
              alt={chatroom.topic}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = '/assets/generated/default-chatroom-thumbnail.dim_200x150.png';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:bg-black/30">
              <div className="rounded-full bg-red-600 p-3 shadow-lg">
                <Play className="h-6 w-6 fill-white text-white" />
              </div>
            </div>
          </div>
        );
      }
    }

    // Twitch thumbnail with enhanced detection and type labels
    if (chatroom.mediaType === 'twitch' && isTwitchUrl(chatroom.mediaUrl)) {
      const clipSlug = getTwitchClipSlug(chatroom.mediaUrl);
      const videoId = getTwitchVideoId(chatroom.mediaUrl);
      const channelName = getTwitchChannelName(chatroom.mediaUrl);
      
      let contentType = 'Stream';
      if (clipSlug) {
        contentType = 'Clip';
      } else if (videoId) {
        contentType = 'VOD';
      }
      
      // If we have a thumbnail, show it
      if (twitchThumbnail) {
        return (
          <div className="relative h-full w-full">
            <img
              src={twitchThumbnail}
              alt={chatroom.topic}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                setTwitchThumbnail(null);
              }}
            />
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              <span className="text-white text-xs font-bold px-2 py-1 bg-purple-600/90 rounded shadow-md">
                {contentType}
              </span>
              {channelName && (
                <span className="text-white/90 text-[10px] font-medium px-2 py-0.5 bg-black/60 rounded">
                  {channelName}
                </span>
              )}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity group-hover:bg-black/20">
              <div className="rounded-full bg-purple-600 p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="h-6 w-6 fill-white text-white" />
              </div>
            </div>
          </div>
        );
      }
      
      // Fallback to icon-based thumbnail
      return (
        <div className="relative h-full w-full bg-gradient-to-br from-purple-900/50 to-purple-600/50">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <SiTwitch className="h-16 w-16 text-purple-400 drop-shadow-lg" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-white text-xs font-bold px-3 py-1 bg-purple-600/90 rounded-full shadow-md">
                {contentType}
              </span>
              {channelName && (
                <span className="text-white/80 text-[10px] font-medium px-2 py-0.5 bg-black/40 rounded">
                  {channelName}
                </span>
              )}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity group-hover:bg-black/20">
            <div className="rounded-full bg-purple-600 p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="h-6 w-6 fill-white text-white" />
            </div>
          </div>
        </div>
      );
    }

    // Twitter/X thumbnail with enhanced preview
    if (chatroom.mediaType === 'twitter' && isTwitterUrl(chatroom.mediaUrl)) {
      const tweetId = getTwitterPostId(chatroom.mediaUrl);
      
      // If we have a fetched thumbnail, show it
      if (twitterThumbnail) {
        return (
          <div className="relative h-full w-full">
            <img
              src={twitterThumbnail}
              alt={chatroom.topic}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                setTwitterThumbnail(null);
              }}
            />
            <div className="absolute top-2 left-2">
              <span className="text-white text-xs font-bold px-2 py-1 bg-slate-800/90 rounded shadow-md">
                Post
              </span>
            </div>
            <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:bg-black/20" />
          </div>
        );
      }
      
      // Fallback to icon-based thumbnail
      return (
        <div className="relative h-full w-full bg-gradient-to-br from-slate-900/60 to-slate-700/60">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <SiX className="h-16 w-16 text-white drop-shadow-lg" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-white text-xs font-bold px-3 py-1 bg-slate-800/90 rounded-full shadow-md">
                Post
              </span>
              {tweetId && (
                <span className="text-white/70 text-[10px] font-mono px-2 py-0.5 bg-black/40 rounded">
                  ID: {tweetId.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>
          <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:bg-black/20" />
        </div>
      );
    }

    // Image or other media
    return (
      <img
        src={chatroom.mediaUrl}
        alt={chatroom.topic}
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
        onError={(e) => {
          e.currentTarget.src = '/assets/generated/default-chatroom-thumbnail.dim_200x150.png';
        }}
      />
    );
  };

  return (
    <div
      className="group cursor-pointer transition-opacity hover:opacity-80"
      onClick={onClick}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
        {renderThumbnail()}
        {chatroom.isLive && (
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 shadow-lg">
            <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
            <span className="text-xs font-bold uppercase tracking-wide text-white">
              {formatCompactNumber(chatroom.activeUserCount)} LIVE
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="line-clamp-2 text-base font-semibold leading-tight text-foreground md:text-base flex-1">
            {chatroom.topic}
          </h3>
          {chatroom.category && (
            <Badge variant="secondary" className="text-xs">
              {chatroom.category}
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground md:text-sm">
          {chatroom.description}
        </p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground md:text-sm">
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            <span>{Number(chatroom.messageCount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{Number(chatroom.viewCount)}</span>
          </div>
          <span>•</span>
          <span>{formatTimestamp(chatroom.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
