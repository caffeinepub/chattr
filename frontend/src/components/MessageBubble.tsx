import React, { useState, useEffect, useRef } from 'react';
import type { MessageWithReactions, Reaction } from '../backend';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { X, Pin, Smile, Reply, Share2, ExternalLink, Flag, Check } from 'lucide-react';
import { Button } from './ui/button';
import { usePinVideo, useUnpinVideo, useAddReaction, useRemoveReaction, useReportMessage } from '../hooks/useQueries';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  getYouTubeVideoId,
  getTwitchEmbedUrl,
  getTwitterPostId,
  isYouTubeUrl,
  isTwitchUrl,
  isTwitterUrl,
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

// ─── Report Button ────────────────────────────────────────────────────────────

function ReportButton({ messageId }: { messageId: bigint }) {
  const reportMutation = useReportMessage();
  const [reported, setReported] = useState(false);

  const handleReport = async (reason: string) => {
    if (reported) return;
    try {
      await reportMutation.mutateAsync({ messageId, reason });
      setReported(true);
      setTimeout(() => setReported(false), 3000);
    } catch {
      // silent
    }
  };

  if (reported) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 px-1">
        <Check className="h-3 w-3" />
        Reported
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Flag"
          disabled={reportMutation.isPending}
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs">Report reason</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REPORT_REASONS.map((reason) => (
          <DropdownMenuItem
            key={reason}
            onClick={() => handleReport(reason)}
            className="cursor-pointer text-sm"
          >
            {reason}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  isHighlighted,
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

  const hasVideo =
    message.mediaType &&
    ((message.mediaType === 'youtube' && message.mediaUrl && isYouTubeUrl(message.mediaUrl)) ||
      (message.mediaType === 'twitch' && message.mediaUrl && isTwitchUrl(message.mediaUrl)));

  const handlePinToggle = async () => {
    if (isPinned) {
      await unpinVideo.mutateAsync(chatroomId);
    } else {
      await pinVideo.mutateAsync({ chatroomId, messageId: message.id });
    }
  };

  const handleReaction = async (emoji: string) => {
    const userId = getUserId();
    const reactionsList = listToArray<Reaction>(message.reactions);
    const existingReaction = reactionsList.find((r) => r.emoji === emoji);
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

              window.twttr.widgets
                .createTweet(tweetId, tweetContainerRef.current, {
                  theme: isDark ? 'dark' : 'light',
                  align: 'center',
                  conversation: 'none',
                  dnt: true,
                })
                .then(() => {
                  setTweetLoading(false);
                })
                .catch(() => {
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
  const parentMessage =
    message.replyToMessageId && allMessages
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

  return (
    <div
      className={`group flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${
        isHighlighted ? 'rounded-lg bg-primary/10 px-2 py-1 transition-colors' : ''
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 self-end">
        <Avatar className="h-7 w-7">
          {message.avatarUrl ? (
            <AvatarImage src={message.avatarUrl} alt={message.sender} />
          ) : null}
          <AvatarFallback className="text-xs">{getInitials(message.sender)}</AvatarFallback>
        </Avatar>
      </div>

      {/* Bubble + actions */}
      <div className={`flex max-w-[75%] flex-col gap-1 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {/* Sender name + timestamp */}
        <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs font-medium text-foreground">{message.sender}</span>
          <span className="text-[10px] text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
          {isPinned && <Pin className="h-3 w-3 text-primary" />}
        </div>

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-3 py-2 text-sm ${
            isOwnMessage
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-muted text-foreground'
          }`}
        >
          {/* ── Quoted reply INSIDE the bubble ── */}
          {parentMessage && (
            <div
              className={`mb-2 cursor-pointer rounded-lg px-2 py-1.5 text-xs ${
                isOwnMessage
                  ? 'border-l-2 border-primary-foreground/40 bg-primary-foreground/10'
                  : 'border-l-2 border-primary bg-background/40'
              }`}
              onClick={() => parentMessage && onScrollToMessage && onScrollToMessage(parentMessage.id)}
            >
              <p className={`font-semibold ${isOwnMessage ? 'text-primary-foreground/80' : 'text-primary'}`}>
                {parentMessage.sender}
              </p>
              {parentMessage.mediaUrl &&
                (parentMessage.mediaType === 'image' || parentMessage.mediaType === 'giphy') && (
                  <img
                    src={parentMessage.mediaUrl}
                    alt="reply media"
                    className="mt-1 h-10 w-10 rounded object-cover"
                  />
                )}
              <p className={`mt-0.5 line-clamp-2 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {parentMessage.content !== 'Media content posted by creator'
                  ? parentMessage.content
                  : parentMessage.mediaType
                  ? `[${parentMessage.mediaType}]`
                  : '[media]'}
              </p>
            </div>
          )}

          {/* Message text */}
          {message.content && message.content !== 'Media content posted by creator' && (
            <p className="break-words whitespace-pre-wrap leading-relaxed">
              {renderTextWithLinks(message.content, handleLinkClick, isOwnMessage)}
            </p>
          )}

          {/* Media */}
          {renderMedia()}

          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {reactions.map((reaction) => {
                const reactionUsers = listToArray<string>(reaction.users);
                const hasReacted = reactionUsers.includes(userId);
                return (
                  <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                      hasReacted
                        ? isOwnMessage
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-primary/20 text-primary'
                        : isOwnMessage
                        ? 'bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20'
                        : 'bg-background/60 text-muted-foreground hover:bg-background'
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

        {/* ── Action buttons — always visible, icon only ── */}
        <div className={`flex items-center gap-0.5 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Reply */}
          <button
            onClick={handleReplyClick}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Reply"
          >
            <Reply className="h-3.5 w-3.5" />
          </button>

          {/* React */}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <button
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="React"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-2"
              align={isOwnMessage ? 'end' : 'start'}
              side="top"
            >
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

          {/* Share */}
          <button
            onClick={handleShareClick}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Share"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          {/* Flag */}
          <ReportButton messageId={message.id} />
        </div>
      </div>

      {/* Expanded media overlay */}
      {renderExpandedMedia()}

      {/* External link disclaimer — uses isOpen and targetUrl props */}
      <ExternalLinkDisclaimerModal
        isOpen={disclaimerOpen}
        targetUrl={pendingUrl}
        onConfirm={handleDisclaimerConfirm}
        onClose={handleDisclaimerClose}
      />
    </div>
  );
}
