import { useState, useEffect, useRef } from 'react';
import type { MessageWithReactions, Reaction } from '../backend';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { X, Pin, Smile, Reply, Share2, ExternalLink, Flag, Check } from 'lucide-react';
import { Button } from './ui/button';
import { usePinVideo, useUnpinVideo, useAddReaction, useRemoveReaction, useReportMessage } from '../hooks/useQueries';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './ui/context-menu';
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
const REPORT_REASONS = ['Spam', 'Inappropriate', 'Harassment', 'Other'];

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

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

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

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

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
  const [tweetLoading, setTweetLoading] = useState(true);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [reportedMessageId, setReportedMessageId] = useState<bigint | null>(null);
  const tweetContainerRef = useRef<HTMLDivElement>(null);
  const pinVideo = usePinVideo();
  const unpinVideo = useUnpinVideo();
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();
  const reportMutation = useReportMessage();

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
    const paddedMessageId = message.id.toString().padStart(9, '0');
    const url = `${window.location.origin}/chatroom/${chatroomId}?messageId=${paddedMessageId}`;
    
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleReportClick = async (reason: string) => {
    if (reportedMessageId === message.id) return;
    try {
      await reportMutation.mutateAsync({ messageId: message.id, reason });
      setReportedMessageId(message.id);
      setTimeout(() => setReportedMessageId(null), 3000);
    } catch {
      // silent
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

  // Check if Creator message without media (filter these out)
  if (message.sender === 'Creator' && message.senderId === 'creator' && !message.mediaUrl) {
    return null;
  }

  const isReported = reportedMessageId === message.id;

  return (
    <>
      <div
        className={`group flex gap-2 px-4 py-1 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${
          isHighlighted ? 'bg-primary/10 rounded-lg transition-colors duration-300' : ''
        }`}
        id={`message-${message.id}`}
      >
        {/* Avatar */}
        {!isOwnMessage && (
          <div className="flex-shrink-0 self-end mb-1">
            <Avatar className="h-7 w-7">
              {message.avatarUrl ? (
                <AvatarImage src={message.avatarUrl} alt={message.sender} />
              ) : null}
              <AvatarFallback className="text-xs bg-muted">
                {getInitials(message.sender)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <div className={`flex flex-col max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {/* Sender name + timestamp */}
          {!isOwnMessage && (
            <div className="flex items-center gap-1.5 mb-0.5 px-1">
              <span className="text-xs font-medium text-foreground/80">{message.sender}</span>
              <span className="text-[10px] text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
            </div>
          )}
          {isOwnMessage && (
            <div className="flex items-center gap-1.5 mb-0.5 px-1">
              <span className="text-[10px] text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
            </div>
          )}

          {/* Reply preview */}
          {parentMessage && (
            <div
              className={`mb-1 px-2 py-1 rounded-lg border-l-2 border-primary/50 bg-muted/50 cursor-pointer max-w-full ${
                isOwnMessage ? 'self-end' : 'self-start'
              }`}
              onClick={() => onScrollToMessage && onScrollToMessage(parentMessage.id)}
            >
              <p className="text-[10px] font-medium text-primary/80">{parentMessage.sender}</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                {truncateText(parentMessage.content, 60)}
              </p>
            </div>
          )}

          {/* Message bubble wrapped in ContextMenu */}
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                className={`relative rounded-2xl px-3 py-2 text-sm select-none ${
                  isOwnMessage
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}
              >
                {/* Message content */}
                {message.content && message.content !== 'Media content posted by creator' && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {renderTextWithLinks(message.content, handleLinkClick, isOwnMessage)}
                  </p>
                )}

                {/* Media */}
                {renderMedia()}
              </div>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
              {/* Reply */}
              {onReply && (
                <ContextMenuItem
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={handleReplyClick}
                >
                  <Reply className="h-4 w-4" />
                  <span>Reply</span>
                </ContextMenuItem>
              )}

              {/* React (emoji submenu) */}
              <ContextMenuSub>
                <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                  <Smile className="h-4 w-4" />
                  <span>React</span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="p-2">
                  <div className="flex flex-wrap gap-1 max-w-[160px]">
                    {COMMON_EMOJIS.map((emoji) => {
                      const existingReaction = reactions.find((r) => r.emoji === emoji);
                      const users = existingReaction ? listToArray<string>(existingReaction.users) : [];
                      const hasReacted = users.includes(userId);
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(emoji)}
                          className={`text-lg p-1 rounded hover:bg-muted transition-colors ${
                            hasReacted ? 'bg-primary/20' : ''
                          }`}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                </ContextMenuSubContent>
              </ContextMenuSub>

              {/* Share */}
              <ContextMenuItem
                className="flex items-center gap-2 cursor-pointer"
                onClick={handleShareClick}
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </ContextMenuItem>

              <ContextMenuSeparator />

              {/* Flag / Report */}
              {isReported ? (
                <ContextMenuItem disabled className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span>Reported</span>
                </ContextMenuItem>
              ) : (
                <ContextMenuSub>
                  <ContextMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                    <Flag className="h-4 w-4" />
                    <span>Flag</span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-40">
                    {REPORT_REASONS.map((reason) => (
                      <ContextMenuItem
                        key={reason}
                        onClick={() => handleReportClick(reason)}
                        className="cursor-pointer text-sm"
                        disabled={reportMutation.isPending}
                      >
                        {reason}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}
            </ContextMenuContent>
          </ContextMenu>

          {/* Reactions display */}
          {reactions.length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
              {reactions
                .filter((r) => r.count > 0)
                .map((reaction) => {
                  const users = listToArray<string>(reaction.users);
                  const hasReacted = users.includes(userId);
                  return (
                    <button
                      key={reaction.emoji}
                      onClick={() => handleReaction(reaction.emoji)}
                      className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-colors ${
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
        </div>
      </div>

      {/* Expanded media overlay */}
      {renderExpandedMedia()}

      {/* External link disclaimer */}
      <ExternalLinkDisclaimerModal
        isOpen={disclaimerOpen}
        targetUrl={pendingUrl}
        onConfirm={handleDisclaimerConfirm}
        onClose={handleDisclaimerClose}
      />
    </>
  );
}
