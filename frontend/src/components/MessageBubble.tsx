import { useState, useEffect, useRef } from 'react';
import type { MessageWithReactions, Reaction } from '../backend';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { X, Pin, Smile, Reply, Share2, ExternalLink } from 'lucide-react';
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
import { toast } from 'sonner';
import ExternalLinkDisclaimerModal from './ExternalLinkDisclaimerModal';

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

// URL detection regex
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

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

// Check if URL is a Giphy GIF URL
function isGiphyUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('giphy.com') || lowerUrl.includes('media.giphy.com') || lowerUrl.includes('i.giphy.com');
}

// Replace X/Twitter URLs in text with plain text "X Post"
function replaceTwitterUrlsWithText(text: string): string {
  const twitterUrlPattern = /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s]+/gi;
  return text.replace(twitterUrlPattern, 'X Post');
}

// Render text with detected links
function renderTextWithLinks(
  text: string,
  onLinkClick: (url: string) => void,
  isOwnMessage: boolean
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    const start = match.index;

    // Push text before the URL
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    // Push the link element
    parts.push(
      <span
        key={start}
        className="inline-flex items-center gap-0.5 cursor-pointer underline underline-offset-2 break-all"
        style={{ color: isOwnMessage ? 'inherit' : undefined }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onLinkClick(url);
        }}
      >
        <ExternalLink className="inline h-3.5 w-3.5 flex-shrink-0" />
        {url}
      </span>
    );

    lastIndex = start + url.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
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
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
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
    const reactions = listToArray<Reaction>(message.reactions);
    const existingReaction = reactions.find((r) => r.emoji === emoji);
    const chatroomIdStr = chatroomId.toString();
    
    if (existingReaction) {
      const users = listToArray<string>(existingReaction.users);
      if (users.includes(userId)) {
        await removeReaction.mutateAsync({ messageId: message.id, emoji, chatroomId: chatroomIdStr });
      } else {
        await addReaction.mutateAsync({ messageId: message.id, emoji, chatroomId: chatroomIdStr });
      }
    } else {
      await addReaction.mutateAsync({ messageId: message.id, emoji, chatroomId: chatroomIdStr });
    }
    
    setShowEmojiPicker(false);
  };

  const handleReplyClick = () => {
    if (!onReply) return;
    
    const contentSnippet = truncateText(message.content, 100);
    
    let mediaThumbnail: string | undefined;
    if (message.mediaUrl && message.mediaType) {
      if (message.mediaType === 'image') {
        mediaThumbnail = message.mediaUrl;
      } else if (message.mediaType === 'giphy' && isGiphyUrl(message.mediaUrl)) {
        mediaThumbnail = message.mediaUrl;
      } else if (message.mediaType === 'youtube' && isYouTubeUrl(message.mediaUrl)) {
        const videoId = getYouTubeVideoId(message.mediaUrl);
        if (videoId) {
          mediaThumbnail = `https://img.youtube.com/vi/${videoId}/default.jpg`;
        }
      } else if (message.mediaType === 'twitch' && isTwitchUrl(message.mediaUrl)) {
        mediaThumbnail = '/assets/generated/twitch-icon-transparent.dim_32x32.png';
      } else if (message.mediaType === 'twitter' && isTwitterUrl(message.mediaUrl)) {
        mediaThumbnail = '/assets/generated/twitter-icon-transparent.dim_32x32.png';
      } else if (message.mediaType === 'audio') {
        mediaThumbnail = '/assets/generated/audio-waveform-icon-transparent.dim_24x24.png';
      }
    }
    
    onReply(message.id, message.sender, contentSnippet, mediaThumbnail);
  };

  const handleShareClick = async () => {
    // Zero-pad the message ID to 9 digits for the share link
    const paddedMessageId = message.id.toString().padStart(9, '0');
    const url = `${window.location.origin}/chatroom/${chatroomId}?messageId=${paddedMessageId}`;
    
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleLinkClick = (url: string) => {
    setPendingUrl(url);
    setDisclaimerOpen(true);
  };

  const handleDisclaimerConfirm = () => {
    if (pendingUrl) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    }
    setDisclaimerOpen(false);
    setPendingUrl(null);
  };

  const handleDisclaimerClose = () => {
    setDisclaimerOpen(false);
    setPendingUrl(null);
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

    if (message.mediaType === 'giphy' && isGiphyUrl(mediaUrl)) {
      return (
        <div className="mt-2 w-full max-w-[300px]">
          <img
            src={mediaUrl}
            alt="GIF"
            className="w-full rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setIsExpanded(true)}
          />
        </div>
      );
    }

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
          <div className="mt-2 w-full twitter-embed-container" style={{ maxWidth: '300px' }}>
            <div 
              ref={tweetContainerRef}
              className="rounded-lg overflow-hidden"
              style={{ maxWidth: '300px', overflow: 'hidden' }}
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
        <div className="mt-2 w-full max-w-[300px]">
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

    if (message.mediaType !== 'image' && message.mediaType !== 'giphy') return null;

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

  const reactions = listToArray<Reaction>(message.reactions);
  const userId = getUserId();

  // Process message content to replace X/Twitter URLs with plain text
  const displayContent = replaceTwitterUrlsWithText(message.content);

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
          {/* Message header: for own messages order is Message ID → Timestamp → Username (left to right);
              for other messages order is Username → Timestamp → Message ID (left to right) */}
          <div className="mb-1 flex items-center gap-2">
            {isOwnMessage ? (
              <>
                {message.messageId && (
                  <span className="text-xs font-mono text-muted-foreground">
                    #{message.messageId}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(message.timestamp)}
                </span>
                <span className="text-xs font-medium text-foreground">{message.sender}</span>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-foreground">{message.sender}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(message.timestamp)}
                </span>
                {message.messageId && (
                  <span className="text-xs font-mono text-muted-foreground">
                    #{message.messageId}
                  </span>
                )}
              </>
            )}
          </div>

          <div
            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
              isOwnMessage
                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                : 'rounded-tl-sm bg-card text-card-foreground border border-border'
            } ${hasVideo ? 'w-full' : ''}`}
          >
            {/* Reply preview inside bubble */}
            {parentMessage && (
              <div
                className={`mb-2 rounded-lg px-3 py-2 text-xs cursor-pointer ${
                  isOwnMessage
                    ? 'bg-primary-foreground/10 border border-primary-foreground/20'
                    : 'bg-muted border border-border'
                }`}
                onClick={() => onScrollToMessage && onScrollToMessage(parentMessage.id)}
              >
                <div className={`font-semibold mb-0.5 ${isOwnMessage ? 'text-primary-foreground/80' : 'text-foreground'}`}>
                  {parentMessage.sender}
                </div>
                {parentMessage.mediaUrl && parentMessage.mediaType === 'image' && (
                  <img
                    src={parentMessage.mediaUrl}
                    alt="Reply media"
                    className="mb-1 h-10 w-10 rounded object-cover"
                  />
                )}
                <div className={`line-clamp-2 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {truncateText(replaceTwitterUrlsWithText(parentMessage.content), 80)}
                </div>
              </div>
            )}

            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
              {renderTextWithLinks(displayContent, handleLinkClick, isOwnMessage)}
            </p>
            {renderMedia()}
          </div>

          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {reactions.map((reaction) => {
                const reactionUsers = listToArray<string>(reaction.users);
                const hasReacted = reactionUsers.includes(userId);
                return (
                  <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                      hasReacted
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
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
          <div className={`mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Smile className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align={isOwnMessage ? 'end' : 'start'}>
                <div className="flex gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="rounded p-1 text-lg hover:bg-muted transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {onReply && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReplyClick}>
                <Reply className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleShareClick}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {renderExpandedMedia()}

      <ExternalLinkDisclaimerModal
        isOpen={disclaimerOpen}
        targetUrl={pendingUrl ?? ''}
        onConfirm={handleDisclaimerConfirm}
        onClose={handleDisclaimerClose}
      />
    </>
  );
}
