import { useState, useEffect, useRef } from 'react';
import type { MessageWithReactions, Reaction, Message } from '../backend';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { X, Pin, Smile, Reply } from 'lucide-react';
import { Button } from './ui/button';
import { usePinVideo, useUnpinVideo, useAddReaction, useRemoveReaction, useGetImage } from '../hooks/useQueries';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { 
  getYouTubeVideoId, 
  getTwitchEmbedUrl,
  getTwitterPostId,
  isYouTubeUrl, 
  isTwitchUrl, 
  isTwitterUrl 
} from '../lib/videoUtils';
import VoiceMessagePlayer from './VoiceMessagePlayer';

interface MessageBubbleProps {
  message: MessageWithReactions;
  isOwnMessage: boolean;
  chatroomId: bigint;
  isPinned: boolean;
  onReply?: (messageId: bigint, sender: string, contentSnippet: string, mediaThumbnail?: string) => void;
  onScrollToMessage?: (messageId: bigint) => void;
  allMessages?: MessageWithReactions[];
  isHighlighted?: boolean;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

// Declare Twitter widgets type
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void;
        createTweet: (
          tweetId: string,
          targetElement: HTMLElement,
          options?: {
            theme?: 'light' | 'dark';
            align?: 'left' | 'center' | 'right';
            conversation?: 'none' | 'all';
            dnt?: boolean;
          }
        ) => Promise<HTMLElement | undefined>;
      };
      ready?: (callback: () => void) => void;
    };
  }
}

// Load Twitter widgets script
function loadTwitterScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.twttr) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Twitter widgets script'));
    document.body.appendChild(script);
  });
}

// Convert List to array helper
function listToArray<T>(list: any): T[] {
  const result: T[] = [];
  let current = list;
  while (current !== null && Array.isArray(current) && current.length === 2) {
    result.push(current[0]);
    current = current[1];
  }
  return result;
}

// Get user ID from localStorage
function getUserId(): string {
  let userId = localStorage.getItem('chatUserId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatUserId', userId);
  }
  return userId;
}

// Truncate text to specified length
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export default function MessageBubble({ 
  message, 
  isOwnMessage, 
  chatroomId, 
  isPinned, 
  onReply,
  onScrollToMessage,
  allMessages,
  isHighlighted 
}: MessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [tweetLoading, setTweetLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const tweetContainerRef = useRef<HTMLDivElement>(null);
  const pinVideo = usePinVideo();
  const unpinVideo = useUnpinVideo();
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

  // Cast message to include Message fields (imageId, giphyUrl)
  const fullMessage = message as MessageWithReactions & Pick<Message, 'imageId' | 'giphyUrl'>;

  // Fetch image if imageId is present
  const { data: imageBlob, isLoading: imageLoading } = useGetImage(fullMessage.imageId);

  useEffect(() => {
    if (imageBlob) {
      try {
        const url = imageBlob.getDirectURL();
        setImageUrl(url);
      } catch (error) {
        console.error('Failed to get image URL:', error);
        setImageUrl(null);
      }
    } else {
      setImageUrl(null);
    }
  }, [imageBlob]);

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTimestamp = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000);
    const distance = formatDistanceToNow(date, { addSuffix: true });
    return distance.replace(/^about\s+/i, '');
  };

  const hasVideo = message.mediaType && (
    (message.mediaType === 'youtube' && message.mediaUrl && isYouTubeUrl(message.mediaUrl)) ||
    (message.mediaType === 'twitch' && message.mediaUrl && isTwitchUrl(message.mediaUrl))
  );

  const hasTwitter = message.mediaType === 'twitter' && message.mediaUrl && isTwitterUrl(message.mediaUrl);
  const hasAudio = message.mediaType === 'audio' && message.mediaUrl;
  const hasImage = fullMessage.imageId !== undefined && fullMessage.imageId !== null;
  const hasGif = fullMessage.giphyUrl !== undefined && fullMessage.giphyUrl !== null && fullMessage.giphyUrl.length > 0;

  const handlePin = () => {
    if (hasVideo) {
      pinVideo.mutate({ chatroomId, messageId: message.id });
    }
  };

  const handleUnpin = () => {
    unpinVideo.mutate(chatroomId);
  };

  const handleReaction = (emoji: string) => {
    const userId = getUserId();
    const reactions = listToArray<Reaction>(message.reactions);
    const existingReaction = reactions.find((r) => r.emoji === emoji);
    
    if (existingReaction) {
      const users = listToArray<string>(existingReaction.users);
      const hasReacted = users.includes(userId);
      
      if (hasReacted) {
        removeReaction.mutate({ messageId: message.id, emoji, chatroomId });
      } else {
        addReaction.mutate({ messageId: message.id, emoji, chatroomId });
      }
    } else {
      addReaction.mutate({ messageId: message.id, emoji, chatroomId });
    }
    
    setShowEmojiPicker(false);
  };

  const handleReplyClick = () => {
    if (onReply) {
      const contentSnippet = truncateText(message.content, 100);
      const mediaThumbnail = message.mediaUrl || undefined;
      onReply(message.id, message.sender, contentSnippet, mediaThumbnail);
    }
  };

  // Load Twitter embed
  useEffect(() => {
    if (hasTwitter && tweetContainerRef.current) {
      const tweetId = getTwitterPostId(message.mediaUrl!);
      if (!tweetId) {
        setTweetLoading(false);
        return;
      }

      loadTwitterScript()
        .then(() => {
          if (window.twttr && tweetContainerRef.current) {
            tweetContainerRef.current.innerHTML = '';
            
            window.twttr.widgets
              .createTweet(tweetId, tweetContainerRef.current, {
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                align: 'center',
                conversation: 'none',
                dnt: true,
              })
              .then(() => {
                setTweetLoading(false);
              })
              .catch((error) => {
                console.error('Failed to load tweet:', error);
                setTweetLoading(false);
              });
          }
        })
        .catch((error) => {
          console.error('Failed to load Twitter script:', error);
          setTweetLoading(false);
        });
    }
  }, [hasTwitter, message.mediaUrl]);

  // Find replied message
  const repliedMessage = message.replyToMessageId && allMessages
    ? allMessages.find((m) => m.id === message.replyToMessageId)
    : null;

  const reactions = listToArray<Reaction>(message.reactions);
  const userId = getUserId();

  return (
    <>
      <div
        className={`flex gap-3 px-4 py-2 transition-colors ${
          isHighlighted ? 'bg-primary/10' : ''
        } ${isOwnMessage ? 'flex-row-reverse' : ''}`}
      >
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={message.avatarUrl || undefined} alt={message.sender} />
          <AvatarFallback className="bg-primary/10 text-sm">
            {getInitials(message.sender)}
          </AvatarFallback>
        </Avatar>

        <div className={`flex flex-col gap-1 ${isOwnMessage ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{message.sender}</span>
            <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
          </div>

          {/* Replied message preview */}
          {repliedMessage && (
            <button
              onClick={() => onScrollToMessage?.(repliedMessage.id)}
              className={`mb-1 max-w-md rounded-lg border-l-4 border-primary/50 bg-muted/50 p-2 text-left transition-colors hover:bg-muted ${
                isOwnMessage ? 'self-end' : 'self-start'
              }`}
            >
              <div className="text-xs font-medium text-primary">{repliedMessage.sender}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {truncateText(repliedMessage.content, 100)}
              </div>
            </button>
          )}

          <div
            className={`max-w-md rounded-2xl px-4 py-2 ${
              isOwnMessage
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            {/* Uploaded image */}
            {hasImage && (
              <div className="mb-2">
                {imageLoading && (
                  <div className="flex items-center justify-center p-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  </div>
                )}
                {!imageLoading && imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Uploaded image"
                    className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: '300px' }}
                    onClick={() => setIsExpanded(true)}
                    onError={(e) => {
                      console.error('Failed to load image');
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {!imageLoading && !imageUrl && (
                  <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
                    Failed to load image
                  </div>
                )}
              </div>
            )}

            {/* Giphy GIF */}
            {hasGif && fullMessage.giphyUrl && (
              <div className="mb-2">
                <img
                  src={fullMessage.giphyUrl}
                  alt="GIF"
                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: '300px' }}
                  onClick={() => setIsExpanded(true)}
                  onError={(e) => {
                    console.error('Failed to load GIF');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Voice message */}
            {hasAudio && (
              <div className="mb-2">
                <VoiceMessagePlayer audioUrl={message.mediaUrl!} isOwnMessage={isOwnMessage} />
              </div>
            )}

            {/* YouTube video */}
            {hasVideo && message.mediaType === 'youtube' && message.mediaUrl && (
              <div className="mb-2 overflow-hidden rounded-lg">
                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(message.mediaUrl)}`}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube video"
                  />
                </div>
              </div>
            )}

            {/* Twitch video */}
            {hasVideo && message.mediaType === 'twitch' && message.mediaUrl && (
              <div className="mb-2 overflow-hidden rounded-lg">
                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={getTwitchEmbedUrl(message.mediaUrl) || undefined}
                    className="absolute inset-0 h-full w-full"
                    allowFullScreen
                    title="Twitch video"
                  />
                </div>
              </div>
            )}

            {/* Twitter embed */}
            {hasTwitter && (
              <div className="mb-2">
                {tweetLoading && (
                  <div className="flex items-center justify-center p-4">
                    <div className="text-sm text-muted-foreground">Loading tweet...</div>
                  </div>
                )}
                <div ref={tweetContainerRef} className="twitter-embed-container" />
              </div>
            )}

            {/* Message text */}
            {message.content && (
              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
            )}
          </div>

          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {reactions.map((reaction) => {
                const users = listToArray<string>(reaction.users);
                const hasReacted = users.includes(userId);
                
                return (
                  <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                      hasReacted
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{Number(reaction.count)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Reply button */}
            {onReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReplyClick}
                className="h-7 px-2 text-xs"
              >
                <Reply className="h-3 w-3" />
              </Button>
            )}

            {/* Reaction picker */}
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Smile className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="rounded p-1 text-xl transition-colors hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Pin/Unpin button */}
            {hasVideo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={isPinned ? handleUnpin : handlePin}
                className="h-7 px-2 text-xs"
                disabled={pinVideo.isPending || unpinVideo.isPending}
              >
                {isPinned ? <X className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded media modal */}
      {isExpanded && (hasImage || hasGif) && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setIsExpanded(false)}
        >
          <button
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setIsExpanded(false)}
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          <div 
            className="relative max-h-[90vh] max-w-[90vw] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {hasImage && imageUrl && (
              <img
                src={imageUrl}
                alt="Expanded image"
                className="max-h-[90vh] max-w-full rounded-lg object-contain"
              />
            )}
            {hasGif && fullMessage.giphyUrl && (
              <img
                src={fullMessage.giphyUrl}
                alt="Expanded GIF"
                className="max-h-[90vh] max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
