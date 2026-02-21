import { useState, useEffect, useRef } from 'react';
import type { MessageWithReactions, Reaction } from '../backend';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Smile, Pin, Reply } from 'lucide-react';
import { useAddReaction, useRemoveReaction, usePinVideo, useUnpinVideo, useCurrentUsername } from '../hooks/useQueries';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { getYouTubeVideoId, getTwitchChannelName, getYouTubeThumbnailUrl, getTwitchThumbnailUrl, detectMediaType } from '../lib/videoUtils';

interface MessageBubbleProps {
  message: MessageWithReactions;
  isOwnMessage: boolean;
  chatroomId: bigint;
  isPinned?: boolean;
  onReply?: (messageId: bigint, sender: string, contentSnippet: string, mediaThumbnail?: string) => void;
  onScrollToMessage?: (messageId: bigint) => void;
  allMessages?: MessageWithReactions[];
  isHighlighted?: boolean;
  isArchived?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'];

function listToArray<T>(list: any): T[] {
  const result: T[] = [];
  let current = list;
  while (current !== null && Array.isArray(current) && current.length === 2) {
    result.push(current[0]);
    current = current[1];
  }
  return result;
}

export default function MessageBubble({ 
  message, 
  isOwnMessage, 
  chatroomId, 
  isPinned = false,
  onReply,
  onScrollToMessage,
  allMessages = [],
  isHighlighted = false,
  isArchived = false,
}: MessageBubbleProps) {
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();
  const pinVideo = usePinVideo();
  const unpinVideo = useUnpinVideo();
  const currentUsername = useCurrentUsername();
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [localReactions, setLocalReactions] = useState<Reaction[]>([]);
  const [userId] = useState(() => {
    let id = localStorage.getItem('chatUserId');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatUserId', id);
    }
    return id;
  });

  useEffect(() => {
    const reactions = listToArray<Reaction>(message.reactions);
    setLocalReactions(reactions);
  }, [message.reactions]);

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1_000_000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleReactionClick = async (emoji: string) => {
    if (isArchived) return;

    const existingReaction = localReactions.find((r) => r.emoji === emoji);
    const userReacted = existingReaction && listToArray<string>(existingReaction.users).includes(userId);

    setLocalReactions((prev) => {
      if (userReacted) {
        return prev.map((r) =>
          r.emoji === emoji
            ? {
                ...r,
                count: r.count > 0n ? r.count - 1n : 0n,
                users: listToArray<string>(r.users).filter((u) => u !== userId) as any,
              }
            : r
        ).filter((r) => r.count > 0n);
      } else {
        const existing = prev.find((r) => r.emoji === emoji);
        if (existing) {
          return prev.map((r) =>
            r.emoji === emoji
              ? {
                  ...r,
                  count: r.count + 1n,
                  users: [userId, ...listToArray<string>(r.users)] as any,
                }
              : r
          );
        } else {
          return [
            ...prev,
            {
              emoji,
              count: 1n,
              users: [userId] as any,
            },
          ];
        }
      }
    });

    setIsEmojiPickerOpen(false);

    try {
      if (userReacted) {
        await removeReaction.mutateAsync({
          messageId: message.id,
          emoji,
          chatroomId: chatroomId.toString(),
        });
      } else {
        await addReaction.mutateAsync({
          messageId: message.id,
          emoji,
          chatroomId: chatroomId.toString(),
        });
      }
    } catch (error) {
      const reactions = listToArray<Reaction>(message.reactions);
      setLocalReactions(reactions);
    }
  };

  const handlePinToggle = async () => {
    if (isArchived) return;

    try {
      if (isPinned) {
        await unpinVideo.mutateAsync(chatroomId);
      } else {
        await pinVideo.mutateAsync({ chatroomId, messageId: message.id });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleReplyClick = () => {
    if (isArchived || !onReply) return;

    const contentSnippet = message.content.length > 100 
      ? message.content.substring(0, 100) + '...' 
      : message.content;
    
    let mediaThumbnail: string | undefined;
    if (message.mediaUrl) {
      const mediaType = message.mediaType || detectMediaType(message.mediaUrl);
      if (mediaType === 'youtube') {
        const videoId = getYouTubeVideoId(message.mediaUrl);
        if (videoId) mediaThumbnail = getYouTubeThumbnailUrl(videoId);
      } else if (mediaType === 'twitch') {
        const thumbnailUrl = getTwitchThumbnailUrl(message.mediaUrl);
        if (thumbnailUrl) mediaThumbnail = thumbnailUrl;
      } else if (mediaType === 'twitter') {
        mediaThumbnail = '/assets/generated/twitter-placeholder.dim_200x150.png';
      } else if (message.mediaType === 'image') {
        mediaThumbnail = message.mediaUrl;
      }
    }

    onReply(message.id, message.sender, contentSnippet, mediaThumbnail);
  };

  const replyToMessage = message.replyToMessageId 
    ? allMessages.find((m) => m.id === message.replyToMessageId)
    : null;

  const handleReplyPreviewClick = () => {
    if (message.replyToMessageId && onScrollToMessage) {
      onScrollToMessage(message.replyToMessageId);
    }
  };

  const canPinVideo = message.mediaType === 'youtube' || message.mediaType === 'twitch';

  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    const mediaType = message.mediaType || detectMediaType(message.mediaUrl);

    if (message.mediaType === 'image') {
      return (
        <img
          src={message.mediaUrl}
          alt="Shared image"
          className="mt-2 max-w-full rounded-lg"
          style={{ maxHeight: '400px', objectFit: 'contain' }}
        />
      );
    }

    if (mediaType === 'youtube') {
      const videoId = getYouTubeVideoId(message.mediaUrl);
      if (videoId) {
        return (
          <div className="mt-2 overflow-hidden rounded-lg">
            <iframe
              width="100%"
              height="315"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="aspect-video"
            />
          </div>
        );
      }
    }

    if (mediaType === 'twitch') {
      const channelName = getTwitchChannelName(message.mediaUrl);
      if (channelName) {
        const isClip = message.mediaUrl.includes('clips.twitch.tv');
        const embedUrl = isClip
          ? `https://clips.twitch.tv/embed?clip=${channelName}&parent=${window.location.hostname}`
          : `https://player.twitch.tv/?channel=${channelName}&parent=${window.location.hostname}`;

        return (
          <div className="mt-2 overflow-hidden rounded-lg">
            <iframe
              src={embedUrl}
              height="315"
              width="100%"
              allowFullScreen
              className="aspect-video"
            />
          </div>
        );
      }
    }

    if (mediaType === 'twitter') {
      return (
        <a
          href={message.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block overflow-hidden rounded-lg border border-border hover:border-primary transition-colors"
        >
          <img
            src="/assets/generated/twitter-placeholder.dim_200x150.png"
            alt="Twitter post preview"
            className="w-full"
            style={{ maxHeight: '400px', objectFit: 'contain' }}
          />
        </a>
      );
    }

    if (message.mediaType === 'audio') {
      return (
        <div className="mt-2">
          <VoiceMessagePlayer audioUrl={message.mediaUrl} isOwnMessage={isOwnMessage} />
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${
        isHighlighted ? 'animate-pulse' : ''
      }`}
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={message.avatarUrl || undefined} alt={message.sender} />
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          {getInitials(message.sender)}
        </AvatarFallback>
      </Avatar>

      <div className={`flex min-w-0 flex-1 flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{message.sender}</span>
          <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
        </div>

        <div
          className={`mt-1 max-w-[85%] rounded-lg px-3 py-2 ${
            isOwnMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          } ${isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        >
          {replyToMessage && (
            <div
              onClick={handleReplyPreviewClick}
              className={`mb-2 cursor-pointer border-l-2 pl-2 py-1 text-xs opacity-75 hover:opacity-100 transition-opacity ${
                isOwnMessage ? 'border-primary-foreground/50' : 'border-primary/50'
              }`}
            >
              <div className="font-medium">{replyToMessage.sender}</div>
              <div className="line-clamp-2">{replyToMessage.content}</div>
            </div>
          )}

          <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
          {renderMedia()}
        </div>

        {localReactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {localReactions.map((reaction) => {
              const userReacted = listToArray<string>(reaction.users).includes(userId);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReactionClick(reaction.emoji)}
                  disabled={isArchived}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                    userReacted
                      ? 'bg-primary/20 ring-1 ring-primary'
                      : 'bg-muted hover:bg-muted/80'
                  } ${isArchived ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-xs font-medium">{Number(reaction.count)}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-1 flex items-center gap-1">
          {!isArchived && (
            <>
              <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <Smile className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align={isOwnMessage ? 'end' : 'start'}>
                  <div className="grid grid-cols-4 gap-1">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReactionClick(emoji)}
                        className="rounded p-2 text-xl transition-colors hover:bg-muted"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {onReply && (
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleReplyClick}>
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              )}

              {canPinVideo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handlePinToggle}
                  disabled={pinVideo.isPending || unpinVideo.isPending}
                >
                  <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-current' : ''}`} />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
