import { useState, useEffect, useRef } from 'react';
import type { MessageWithReactions, Reaction } from '../hooks/useQueries';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { X, Pin, Smile, Reply } from 'lucide-react';
import { Button } from './ui/button';
import { usePinVideo, useUnpinVideo, useAddReaction, useRemoveReaction } from '../hooks/useQueries';
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
  const tweetContainerRef = useRef<HTMLDivElement>(null);
  const pinVideo = usePinVideo();
  const unpinVideo = useUnpinVideo();
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

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

  const handlePinToggle = async () => {
    if (isPinned) {
      await unpinVideo.mutateAsync(chatroomId);
    } else {
      await pinVideo.mutateAsync({ chatroomId, messageId: message.id });
    }
  };

  const handleReaction = async (emoji: string) => {
    const userId = getUserId();
    const reactions = message.reactions;
    const existingReaction = reactions.find((r) => r.emoji === emoji);
    
    if (existingReaction) {
      const users = existingReaction.users;
      if (users.includes(userId)) {
        // User already reacted, remove reaction
        await removeReaction.mutateAsync({ messageId: message.id, emoji, chatroomId });
      } else {
        // Add reaction
        await addReaction.mutateAsync({ messageId: message.id, emoji, chatroomId });
      }
    } else {
      // Add new reaction
      await addReaction.mutateAsync({ messageId: message.id, emoji, chatroomId });
    }
    
    setShowEmojiPicker(false);
  };

  const handleReplyClick = () => {
    if (!onReply) return;
    
    // Generate content snippet (first 100 characters)
    const contentSnippet = truncateText(message.content, 100);
    
    // Get media thumbnail if available
    let mediaThumbnail: string | undefined;
    if (message.mediaUrl && message.mediaType) {
      if (message.mediaType === 'image') {
        mediaThumbnail = message.mediaUrl;
      } else if (message.mediaType === 'youtube' && isYouTubeUrl(message.mediaUrl)) {
        const videoId = getYouTubeVideoId(message.mediaUrl);
        if (videoId) {
          mediaThumbnail = `https://img.youtube.com/vi/${videoId}/default.jpg`;
        }
      } else if (message.mediaType === 'twitch' && isTwitchUrl(message.mediaUrl)) {
        // Use a generic Twitch icon for thumbnails
        mediaThumbnail = '/assets/generated/twitch-icon-transparent.dim_32x32.png';
      } else if (message.mediaType === 'twitter' && isTwitterUrl(message.mediaUrl)) {
        // Use a generic Twitter icon for thumbnails
        mediaThumbnail = '/assets/generated/twitter-icon-transparent.dim_32x32.png';
      } else if (message.mediaType === 'audio') {
        // Use audio waveform icon for audio thumbnails
        mediaThumbnail = '/assets/generated/audio-waveform-icon-transparent.dim_24x24.png';
      }
    }
    
    onReply(message.id, message.sender, contentSnippet, mediaThumbnail);
  };

  // Load Twitter embed when message contains Twitter URL
  useEffect(() => {
    if (message.mediaType === 'twitter' && message.mediaUrl && isTwitterUrl(message.mediaUrl)) {
      const tweetId = getTwitterPostId(message.mediaUrl);
      if (tweetId && tweetContainerRef.current) {
        setTweetLoading(true);
        
        loadTwitterScript()
          .then(() => {
            if (window.twttr && tweetContainerRef.current) {
              // Detect theme from document
              const isDark = document.documentElement.classList.contains('dark');
              
              window.twttr.widgets.createTweet(
                tweetId,
                tweetContainerRef.current,
                {
                  theme: isDark ? 'dark' : 'light',
                  align: 'center',
                  conversation: 'none',
                  dnt: true,
                }
              ).then(() => {
                setTweetLoading(false);
              }).catch(() => {
                setTweetLoading(false);
              });
            }
          })
          .catch(() => {
            setTweetLoading(false);
          });
      }
    }
  }, [message.mediaType, message.mediaUrl]);

  // Find the message this is replying to
  const parentMessage = message.replyToMessageId && allMessages
    ? allMessages.find((m) => m.id === message.replyToMessageId)
    : null;

  const renderMedia = () => {
    if (!message.mediaUrl || !message.mediaType) return null;

    const mediaUrl = message.mediaUrl;

    if (message.mediaType === 'youtube' && isYouTubeUrl(mediaUrl)) {
      const videoId = getYouTubeVideoId(mediaUrl);
      if (videoId) {
        return (
          <div className="mt-2 w-full max-w-[600px]">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePinToggle}
                disabled={pinVideo.isPending || unpinVideo.isPending}
                className="gap-2 text-xs"
              >
                <Pin className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
                {isPinned ? 'Unpin' : 'Pin'}
              </Button>
            </div>
          </div>
        );
      }
    }

    if (message.mediaType === 'twitch' && isTwitchUrl(mediaUrl)) {
      const embedUrl = getTwitchEmbedUrl(mediaUrl);
      if (embedUrl) {
        return (
          <div className="mt-2 w-full max-w-[600px]">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <iframe
                src={embedUrl}
                title="Twitch video"
                className="h-full w-full"
                allowFullScreen
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePinToggle}
                disabled={pinVideo.isPending || unpinVideo.isPending}
                className="gap-2 text-xs"
              >
                <Pin className={`h-3 w-3 ${isPinned ? 'fill-current' : ''}`} />
                {isPinned ? 'Unpin' : 'Pin'}
              </Button>
            </div>
          </div>
        );
      }
    }

    if (message.mediaType === 'twitter' && isTwitterUrl(mediaUrl)) {
      const postId = getTwitterPostId(mediaUrl);
      if (postId) {
        return (
          <div className="mt-2 w-full max-w-[550px]">
            <div 
              ref={tweetContainerRef}
              className="rounded-lg overflow-hidden"
            />
            {tweetLoading && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading tweet...</span>
                </div>
              </div>
            )}
          </div>
        );
      }
    }

    if (message.mediaType === 'audio') {
      return <VoiceMessagePlayer audioUrl={mediaUrl} isOwnMessage={isOwnMessage} />;
    }

    if (message.mediaType === 'image') {
      return (
        <div className="mt-2 w-full max-w-[400px]">
          <img
            src={mediaUrl}
            alt="Uploaded media"
            className="w-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsExpanded(true)}
          />
        </div>
      );
    }

    return null;
  };

  const renderExpandedMedia = () => {
    if (!isExpanded || !message.mediaUrl || !message.mediaType) return null;

    if (message.mediaType !== 'image') return null;

    const mediaUrl = message.mediaUrl;

    return (
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
          <img
            src={mediaUrl}
            alt="Expanded media"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />
        </div>
      </div>
    );
  };

  const reactions = message.reactions;
  const userId = getUserId();

  return (
    <>
      <div 
        className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} transition-all duration-300 ${
          isHighlighted ? 'bg-primary/10 -mx-2 px-2 py-1 rounded-lg' : ''
        }`}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          {message.avatarUrl ? (
            <AvatarImage src={message.avatarUrl} alt={message.sender} />
          ) : null}
          <AvatarFallback
            className={`text-xs ${
              isOwnMessage
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {getInitials(message.sender)}
          </AvatarFallback>
        </Avatar>

        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} ${hasVideo ? 'w-full max-w-[600px]' : 'max-w-[70%]'}`}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{message.sender}</span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          <div
            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
              isOwnMessage
                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                : 'rounded-tl-sm bg-card text-card-foreground border border-border'
            } ${hasVideo ? 'w-full' : ''}`}
          >
            {/* Quoted reply block */}
            {parentMessage && onScrollToMessage && (
              <div 
                onClick={() => onScrollToMessage(parentMessage.id)}
                className={`mb-2 cursor-pointer rounded-lg border-l-4 border-primary/50 bg-muted/30 p-2 transition-colors hover:bg-muted/50 ${
                  isOwnMessage ? 'border-primary-foreground/30' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {parentMessage.mediaUrl && parentMessage.mediaType && (
                    <div className="flex-shrink-0">
                      {parentMessage.mediaType === 'image' && (
                        <img 
                          src={parentMessage.mediaUrl} 
                          alt="Reply thumbnail" 
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      {parentMessage.mediaType === 'youtube' && isYouTubeUrl(parentMessage.mediaUrl) && (
                        <img 
                          src={`https://img.youtube.com/vi/${getYouTubeVideoId(parentMessage.mediaUrl)}/default.jpg`}
                          alt="YouTube thumbnail" 
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      {parentMessage.mediaType === 'twitch' && (
                        <img 
                          src="/assets/generated/twitch-icon-transparent.dim_32x32.png"
                          alt="Twitch" 
                          className="h-10 w-10 rounded object-contain"
                        />
                      )}
                      {parentMessage.mediaType === 'twitter' && (
                        <img 
                          src="/assets/generated/twitter-icon-transparent.dim_32x32.png"
                          alt="Twitter" 
                          className="h-10 w-10 rounded object-contain"
                        />
                      )}
                      {parentMessage.mediaType === 'audio' && (
                        <img 
                          src="/assets/generated/audio-waveform-icon-transparent.dim_24x24.png"
                          alt="Audio" 
                          className="h-10 w-10 rounded object-contain"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold ${isOwnMessage ? 'text-primary-foreground' : 'text-primary'}`}>
                      {parentMessage.sender}
                    </div>
                    <div className={`text-xs ${isOwnMessage ? 'text-primary-foreground/80' : 'text-muted-foreground'} line-clamp-2`}>
                      {truncateText(parentMessage.content, 100)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content}
            </p>
            {renderMedia()}
          </div>

          {/* Reactions display */}
          {reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {reactions.map((reaction) => {
                const users = reaction.users;
                const hasReacted = users.includes(userId);
                
                return (
                  <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                      hasReacted
                        ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span className="font-medium">{Number(reaction.count)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-1 flex items-center gap-1">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Smile className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align={isOwnMessage ? 'end' : 'start'}>
                <div className="grid grid-cols-4 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="rounded p-2 text-2xl transition-colors hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {onReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReplyClick}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
          </div>
        </div>
      </div>

      {renderExpandedMedia()}
    </>
  );
}
