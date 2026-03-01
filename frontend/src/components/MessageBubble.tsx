import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { MessageWithReactions, Reaction } from '../backend';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { X, Pin, Smile, Reply, Share2, ExternalLink, Flag, Check, Copy, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { usePinVideo, useUnpinVideo, useAddReaction, useRemoveReaction, useReportMessage } from '../hooks/useQueries';
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

// ─── Custom Context Menu ──────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
}

interface CustomContextMenuProps {
  position: ContextMenuState;
  onClose: () => void;
  onCopyText: () => void;
  onReply?: () => void;
  onReaction: (emoji: string) => void;
  onShare: () => void;
  onPinToggle?: () => void;
  isPinned: boolean;
  hasVideo: boolean;
  pinPending: boolean;
  onReport: (reason: string) => void;
  reported: boolean;
  reportPending: boolean;
}

function CustomContextMenu({
  position,
  onClose,
  onCopyText,
  onReply,
  onReaction,
  onShare,
  onPinToggle,
  isPinned,
  hasVideo,
  pinPending,
  onReport,
  reported,
  reportPending,
}: CustomContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showReportReasons, setShowReportReasons] = useState(false);

  // Adjust position to stay within viewport
  const [adjustedPos, setAdjustedPos] = useState(position);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let { x, y } = position;

      if (x + rect.width > vw) x = vw - rect.width - 8;
      if (y + rect.height > vh) y = vh - rect.height - 8;
      if (x < 8) x = 8;
      if (y < 8) y = 8;

      setAdjustedPos({ x, y });
    }
  }, [position]);

  // Close on outside click or ESC
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const menuItemClass =
    'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors text-left';
  const separatorClass = 'my-1 h-px bg-border';

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] rounded-md border border-border bg-popover shadow-md py-1"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Copy Text */}
      <button
        className={menuItemClass}
        onClick={() => { onCopyText(); onClose(); }}
      >
        <Copy className="h-4 w-4" />
        Copy Text
      </button>

      <div className={separatorClass} />

      {/* Reply */}
      {onReply && (
        <button
          className={menuItemClass}
          onClick={() => { onReply(); onClose(); }}
        >
          <Reply className="h-4 w-4" />
          Reply
        </button>
      )}

      {/* React */}
      <div className="relative">
        <button
          className={`${menuItemClass} justify-between`}
          onClick={() => { setShowEmojis((v) => !v); setShowReportReasons(false); }}
        >
          <span className="flex items-center gap-2">
            <Smile className="h-4 w-4" />
            React
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </button>
        {showEmojis && (
          <div className="absolute left-full top-0 ml-1 rounded-md border border-border bg-popover shadow-md p-2 flex flex-wrap gap-1 w-44">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { onReaction(emoji); onClose(); }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-muted transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Share / Copy Link */}
      <button
        className={menuItemClass}
        onClick={() => { onShare(); onClose(); }}
      >
        <Share2 className="h-4 w-4" />
        Copy Link
      </button>

      {/* Pin/Unpin (only for video messages) */}
      {hasVideo && onPinToggle && (
        <button
          className={menuItemClass}
          onClick={() => { onPinToggle(); onClose(); }}
          disabled={pinPending}
        >
          <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
          {isPinned ? 'Unpin Video' : 'Pin Video'}
        </button>
      )}

      <div className={separatorClass} />

      {/* Flag / Report */}
      <div className="relative">
        <button
          className={`${menuItemClass} text-destructive hover:text-destructive justify-between`}
          onClick={() => { setShowReportReasons((v) => !v); setShowEmojis(false); }}
          disabled={reported || reportPending}
        >
          <span className="flex items-center gap-2">
            {reported ? (
              <>
                <Check className="h-4 w-4" />
                Reported
              </>
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Flag
              </>
            )}
          </span>
          {!reported && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
        </button>
        {showReportReasons && !reported && (
          <div className="absolute left-full top-0 ml-1 rounded-md border border-border bg-popover shadow-md py-1 w-40">
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground">Report reason</div>
            <div className="my-1 h-px bg-border" />
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                className={menuItemClass}
                onClick={() => { onReport(reason); onClose(); }}
                disabled={reportPending}
              >
                {reason}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
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
  isHighlighted 
}: MessageBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tweetLoading, setTweetLoading] = useState(true);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const tweetContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
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

  const hasVideo = !!(message.mediaType && (
    (message.mediaType === 'youtube' && message.mediaUrl && isYouTubeUrl(message.mediaUrl)) ||
    (message.mediaType === 'twitch' && message.mediaUrl && isTwitchUrl(message.mediaUrl))
  ));

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

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Text copied!');
    } catch {
      toast.error('Failed to copy text');
    }
  };

  const handleReport = async (reason: string) => {
    if (reported) return;
    try {
      await reportMutation.mutateAsync({ messageId: message.id, reason });
      setReported(true);
      setTimeout(() => setReported(false), 3000);
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

  const openContextMenu = useCallback((x: number, y: number) => {
    setContextMenu({ x, y });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Right-click handler — suppress native context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY);
  }, [openContextMenu]);

  // Long press handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTriggeredRef.current = false;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      openContextMenu(x, y);
    }, 500);
  }, [openContextMenu]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((_e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Load Twitter embed when message contains Twitter URL
  useEffect(() => {
    if (message.mediaType === 'twitter' && message.mediaUrl && isTwitterUrl(message.mediaUrl)) {
      const tweetId = getTwitterPostId(message.mediaUrl);
      if (tweetId && tweetContainerRef.current) {
        setTweetLoading(true);
        
        loadTwitterScript()
          .then(() => {
            if (!tweetContainerRef.current) return;
            // Clear previous tweet
            tweetContainerRef.current.innerHTML = '';
            
            return window.twttr?.widgets.createTweet(
              tweetId,
              tweetContainerRef.current,
              {
                theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                align: 'center',
                conversation: 'none',
                dnt: true,
              }
            );
          })
          .then(() => {
            setTweetLoading(false);
          })
          .catch(() => {
            setTweetLoading(false);
          });
      }
    }
  }, [message.mediaType, message.mediaUrl]);

  const reactionsList = listToArray<Reaction>(message.reactions);
  const userId = getUserId();

  // Find the replied-to message
  const repliedToMessage = message.replyToMessageId != null && allMessages
    ? allMessages.find((m) => m.id === message.replyToMessageId)
    : null;

  const isCreatorMessage = message.sender === 'Creator' && message.senderId === 'creator';

  const bubbleContainerStyle: React.CSSProperties = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    // @ts-ignore - webkit-touch-callout is valid CSS but not in TS types
    WebkitTouchCallout: 'none',
  };

  return (
    <div
      className={`flex gap-2 px-3 py-1 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${
        isHighlighted ? 'bg-primary/10 rounded-lg transition-colors duration-300' : ''
      }`}
      style={bubbleContainerStyle}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {/* Avatar — aligned to top */}
      {!isCreatorMessage && (
        <div className="flex-shrink-0 self-start mt-1">
          <Avatar className="h-8 w-8">
            {message.avatarUrl ? (
              <AvatarImage src={message.avatarUrl} alt={message.sender} />
            ) : null}
            <AvatarFallback className="text-xs bg-muted">
              {getInitials(message.sender)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Message content */}
      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {/* Sender name — slightly larger font */}
        {!isCreatorMessage && (
          <span className={`text-sm font-medium text-muted-foreground px-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
            {message.sender}
          </span>
        )}

        {/* Reply preview */}
        {repliedToMessage && (
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border-l-2 border-primary/60 bg-muted/60 cursor-pointer max-w-full ${
              isOwnMessage ? 'self-end' : 'self-start'
            }`}
            onClick={() => onScrollToMessage && onScrollToMessage(repliedToMessage.id)}
          >
            <Reply className="h-3 w-3 flex-shrink-0 text-primary/70" />
            <div className="min-w-0">
              <div className="font-semibold text-foreground/80 truncate">{repliedToMessage.sender}</div>
              <div className="text-muted-foreground truncate">
                {repliedToMessage.mediaType && repliedToMessage.mediaUrl ? (
                  <span className="italic">
                    {repliedToMessage.mediaType === 'audio' ? '🎵 Voice message' :
                     repliedToMessage.mediaType === 'image' ? '🖼️ Image' :
                     repliedToMessage.mediaType === 'giphy' ? '🎞️ GIF' :
                     repliedToMessage.mediaType === 'youtube' ? '▶️ YouTube' :
                     repliedToMessage.mediaType === 'twitch' ? '🎮 Twitch' :
                     repliedToMessage.mediaType === 'twitter' ? '🐦 Tweet' :
                     truncateText(repliedToMessage.content, 60)}
                  </span>
                ) : (
                  truncateText(repliedToMessage.content, 60)
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-3 pt-2 pb-2 text-sm leading-relaxed break-words ${
            isCreatorMessage
              ? 'bg-muted/50 text-foreground rounded-xl w-full'
              : isOwnMessage
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          }`}
        >
          {/* Media content */}
          {message.mediaUrl && message.mediaType && (
            <div className="mb-2">
              {message.mediaType === 'image' && (
                <img
                  src={message.mediaUrl}
                  alt="Shared image"
                  className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer"
                  onClick={() => window.open(message.mediaUrl!, '_blank')}
                />
              )}
              {message.mediaType === 'giphy' && isGiphyUrl(message.mediaUrl) && (
                <img
                  src={message.mediaUrl}
                  alt="GIF"
                  className="rounded-lg max-w-full max-h-48 object-cover"
                />
              )}
              {message.mediaType === 'youtube' && isYouTubeUrl(message.mediaUrl) && (
                <div className="rounded-lg overflow-hidden">
                  {isExpanded ? (
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${getYouTubeVideoId(message.mediaUrl)}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="YouTube video"
                      />
                    </div>
                  ) : (
                    <div
                      className="relative cursor-pointer group"
                      onClick={() => setIsExpanded(true)}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${getYouTubeVideoId(message.mediaUrl)}/hqdefault.jpg`}
                        alt="YouTube thumbnail"
                        className="w-full rounded-lg max-h-48 object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors rounded-lg">
                        <div className="bg-red-600 rounded-full p-3">
                          <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {message.mediaType === 'twitch' && isTwitchUrl(message.mediaUrl) && (
                <div className="rounded-lg overflow-hidden">
                  {isExpanded ? (
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={getTwitchEmbedUrl(message.mediaUrl) ?? undefined}
                        allowFullScreen
                        title="Twitch stream"
                      />
                    </div>
                  ) : (
                    <div
                      className="relative cursor-pointer group"
                      onClick={() => setIsExpanded(true)}
                    >
                      <div className="w-full h-32 bg-purple-900/30 rounded-lg flex items-center justify-center">
                        <img
                          src="/assets/generated/twitch-icon-transparent.dim_32x32.png"
                          alt="Twitch"
                          className="h-12 w-12 opacity-80"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-lg">
                        <div className="bg-purple-600 rounded-full p-3">
                          <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {message.mediaType === 'twitter' && isTwitterUrl(message.mediaUrl) && (
                <div className="rounded-lg overflow-hidden max-w-sm">
                  {tweetLoading && (
                    <div className="flex items-center justify-center h-24 bg-muted/30 rounded-lg">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                  )}
                  <div
                    ref={tweetContainerRef}
                    className={tweetLoading ? 'hidden' : 'block'}
                  />
                </div>
              )}
              {message.mediaType === 'audio' && (
                <VoiceMessagePlayer audioUrl={message.mediaUrl} isOwnMessage={isOwnMessage} />
              )}
            </div>
          )}

          {/* Message text */}
          {message.content && message.content !== 'Media content posted by creator' && (
            <p className="whitespace-pre-wrap">
              {renderTextWithLinks(message.content, handleLinkClick, isOwnMessage)}
            </p>
          )}

          {/* Timestamp inside bubble — bottom right */}
          <div className="flex justify-end mt-1">
            <span className={`text-xs opacity-60 ${isOwnMessage ? 'text-primary-foreground' : 'text-foreground'}`}>
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>

        {/* Reactions */}
        {reactionsList.length > 0 && (
          <div className={`flex flex-wrap gap-1 px-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {reactionsList.map((reaction) => {
              const users = listToArray<string>(reaction.users);
              const hasReacted = users.includes(userId);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReaction(reaction.emoji)}
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                    hasReacted
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-muted border-border hover:bg-muted/80'
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

      {/* Context menu */}
      {contextMenu && (
        <CustomContextMenu
          position={contextMenu}
          onClose={closeContextMenu}
          onCopyText={handleCopyText}
          onReply={onReply ? handleReplyClick : undefined}
          onReaction={handleReaction}
          onShare={handleShareClick}
          onPinToggle={hasVideo ? handlePinToggle : undefined}
          isPinned={isPinned}
          hasVideo={hasVideo}
          pinPending={pinVideo.isPending || unpinVideo.isPending}
          onReport={handleReport}
          reported={reported}
          reportPending={reportMutation.isPending}
        />
      )}

      {/* External link disclaimer */}
      <ExternalLinkDisclaimerModal
        isOpen={disclaimerOpen}
        targetUrl={pendingUrl || ''}
        onConfirm={handleDisclaimerConfirm}
        onClose={handleDisclaimerClose}
      />
    </div>
  );
}
