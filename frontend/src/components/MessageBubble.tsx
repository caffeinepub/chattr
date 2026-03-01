import React, { useState } from 'react';
import { Reply, Smile, Share2, Flag, Pin } from 'lucide-react';
import { useAddReaction, useRemoveReaction, useReportMessage } from '../hooks/useQueries';
import { MessageWithReactions, Reaction } from '../backend';

interface MessageBubbleProps {
  message: MessageWithReactions;
  isOwnMessage: boolean;
  chatroomId: bigint;
  isPinned?: boolean;
  onReply: (messageId: bigint, sender: string, contentSnippet: string, mediaThumbnail?: string) => void;
  onScrollToMessage?: (messageId: bigint) => void;
  allMessages?: MessageWithReactions[];
  isHighlighted?: boolean;
}

function listToArray<T>(list: any): T[] {
  const result: T[] = [];
  let current = list;
  while (current !== null && Array.isArray(current) && current.length === 2) {
    result.push(current[0]);
    current = current[1];
  }
  return result;
}

function formatTimestamp(timestamp: bigint): string {
  const ms = Number(timestamp) / 1_000_000;
  const date = new Date(ms);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMediaType(mediaType?: string): 'image' | 'youtube' | 'twitch' | 'twitter' | 'audio' | 'gif' | 'giphy' | null {
  if (!mediaType) return null;
  if (mediaType === 'image') return 'image';
  if (mediaType === 'youtube') return 'youtube';
  if (mediaType === 'twitch') return 'twitch';
  if (mediaType === 'twitter') return 'twitter';
  if (mediaType === 'audio') return 'audio';
  if (mediaType === 'gif') return 'gif';
  if (mediaType === 'giphy') return 'giphy';
  return null;
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return url;
}

function getTwitchEmbedUrl(url: string): string {
  const channelMatch = url.match(/twitch\.tv\/([^/?]+)/);
  const clipMatch = url.match(/clips\.twitch\.tv\/([^/?]+)/);
  const parent = window.location.hostname;
  if (clipMatch) return `https://clips.twitch.tv/embed?clip=${clipMatch[1]}&parent=${parent}`;
  if (channelMatch) return `https://player.twitch.tv/?channel=${channelMatch[1]}&parent=${parent}`;
  return url;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({
  message,
  isOwnMessage,
  chatroomId,
  isPinned = false,
  onReply,
  onScrollToMessage,
  allMessages = [],
  isHighlighted = false,
}: MessageBubbleProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showActions, setShowActions] = useState(false);

  const userId = localStorage.getItem('chatUserId') || 'anonymous';
  const chatroomIdStr = chatroomId.toString();

  const addReactionMutation = useAddReaction();
  const removeReactionMutation = useRemoveReaction();
  const reportMessageMutation = useReportMessage();

  const reactions = listToArray<Reaction>(message.reactions);

  const isCreatorMessage = message.sender === 'Creator' && message.senderId === 'creator';

  const replyToMessage = message.replyToMessageId
    ? allMessages.find(m => m.id === message.replyToMessageId)
    : null;

  const handleReaction = (emoji: string) => {
    const existingReaction = reactions.find(r => r.emoji === emoji);
    const hasReacted = existingReaction
      ? listToArray<string>(existingReaction.users).includes(userId)
      : false;

    if (hasReacted) {
      removeReactionMutation.mutate({ messageId: message.id, emoji, chatroomId: chatroomIdStr });
    } else {
      addReactionMutation.mutate({ messageId: message.id, emoji, chatroomId: chatroomIdStr });
    }
    setShowEmojiPicker(false);
  };

  const handleReport = () => {
    if (!reportReason.trim()) return;
    reportMessageMutation.mutate(
      { messageId: message.id, reason: reportReason },
      {
        onSuccess: () => {
          setShowReportDialog(false);
          setReportReason('');
        },
      }
    );
  };

  const handleShare = () => {
    const paddedMessageId = message.id.toString().padStart(9, '0');
    const url = `${window.location.origin}/chatroom/${chatroomId}?messageId=${paddedMessageId}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  const handleReplyClick = () => {
    const contentSnippet = message.mediaUrl ? '📎 Media' : message.content;
    onReply(message.id, message.sender, contentSnippet, message.mediaUrl ?? undefined);
  };

  const mediaType = getMediaType(message.mediaType);
  const avatarUrl = message.avatarUrl;
  const senderInitial = message.sender ? message.sender.charAt(0).toUpperCase() : '?';

  return (
    <div
      className={`flex gap-2 group mb-1 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${
        isHighlighted ? 'rounded-xl bg-primary/10 transition-colors duration-500' : ''
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* Avatar - other user */}
      {!isOwnMessage && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold self-end mb-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt={message.sender} className="w-full h-full object-cover" />
          ) : (
            <span>{senderInitial}</span>
          )}
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {/* Sender name + timestamp */}
        {!isOwnMessage && !isCreatorMessage && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-xs font-semibold text-foreground">{message.sender}</span>
            <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
            {isPinned && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Pin className="w-3 h-3" />
              </span>
            )}
          </div>
        )}

        {isOwnMessage && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
          </div>
        )}

        {/* Reply preview */}
        {replyToMessage && (
          <button
            onClick={() => onScrollToMessage && onScrollToMessage(replyToMessage.id)}
            className={`mb-1 px-2 py-1 rounded-lg border-l-2 border-primary bg-muted/50 text-xs text-muted-foreground max-w-full text-left hover:bg-muted transition-colors ${isOwnMessage ? 'self-end' : 'self-start'}`}
          >
            <span className="font-semibold text-foreground">{replyToMessage.sender}</span>
            <span className="ml-1 truncate block max-w-[200px]">
              {replyToMessage.mediaUrl ? '📎 Media' : replyToMessage.content}
            </span>
          </button>
        )}

        {/* Message bubble */}
        <div
          className={`relative rounded-2xl px-3 py-2 text-sm break-words ${
            isCreatorMessage
              ? 'bg-transparent p-0'
              : isOwnMessage
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border text-foreground rounded-tl-sm'
          }`}
        >
          {/* Media content */}
          {message.mediaUrl && (mediaType === 'image') && (
            <div className="mb-1 rounded-xl overflow-hidden max-w-[280px]">
              <img
                src={message.mediaUrl}
                alt="Shared image"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          )}

          {message.mediaUrl && (mediaType === 'gif' || mediaType === 'giphy') && (
            <div className="mb-1 rounded-xl overflow-hidden max-w-[280px]">
              <img
                src={message.mediaUrl}
                alt="GIF"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          )}

          {message.mediaUrl && mediaType === 'youtube' && (
            <div className="mb-1 rounded-xl overflow-hidden w-[280px]">
              <div className="relative" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={getYouTubeEmbedUrl(message.mediaUrl)}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="YouTube video"
                />
              </div>
            </div>
          )}

          {message.mediaUrl && mediaType === 'twitch' && (
            <div className="mb-1 rounded-xl overflow-hidden w-[280px]">
              <div className="relative" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={getTwitchEmbedUrl(message.mediaUrl)}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  title="Twitch stream"
                />
              </div>
            </div>
          )}

          {message.mediaUrl && mediaType === 'audio' && (
            <div className="mb-1">
              <audio controls src={message.mediaUrl} className="max-w-[240px]" />
            </div>
          )}

          {/* Text content */}
          {!isCreatorMessage && message.content && (
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {reactions
              .filter(r => Number(r.count) > 0)
              .map(reaction => {
                const users = listToArray<string>(reaction.users);
                const hasReacted = users.includes(userId);
                return (
                  <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                      hasReacted
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{Number(reaction.count)}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Action buttons — Reply, React, Share, Report all use text-muted-foreground to match timestamp */}
        {!isCreatorMessage && (
          <div
            className={`flex items-center gap-1 mt-1 px-1 transition-opacity duration-150 ${
              showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
            } ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Reply */}
            <button
              onClick={handleReplyClick}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Reply className="w-3 h-3" />
              <span>Reply</span>
            </button>

            {/* React */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(prev => !prev)}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Smile className="w-3 h-3" />
                <span>React</span>
              </button>

              {showEmojiPicker && (
                <div
                  className={`absolute bottom-full mb-1 bg-card border border-border rounded-xl shadow-lg p-1.5 flex gap-1 z-50 ${
                    isOwnMessage ? 'right-0' : 'left-0'
                  }`}
                >
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="text-base hover:scale-125 transition-transform p-0.5"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Share2 className="w-3 h-3" />
              <span>Share</span>
            </button>

            {/* Report */}
            <button
              onClick={() => setShowReportDialog(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Flag className="w-3 h-3" />
              <span>Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Avatar - own message */}
      {isOwnMessage && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold self-end mb-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt={message.sender} className="w-full h-full object-cover" />
          ) : (
            <span>{senderInitial}</span>
          )}
        </div>
      )}

      {/* Report Dialog */}
      {showReportDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowReportDialog(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-4 w-80 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-foreground mb-2">Report Message</h3>
            <p className="text-xs text-muted-foreground mb-3">Why are you reporting this message?</p>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full border border-border rounded-xl p-2 text-sm bg-background text-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => { setShowReportDialog(false); setReportReason(''); }}
                className="px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason.trim() || reportMessageMutation.isPending}
                className="px-3 py-1.5 rounded-full text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {reportMessageMutation.isPending ? 'Reporting...' : 'Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
