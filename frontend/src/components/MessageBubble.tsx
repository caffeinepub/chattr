import React, { useState } from 'react';
import { Pin, Reply, Smile } from 'lucide-react';
import { MessageWithReactions } from '../backend';
import { useAddReaction, useRemoveReaction } from '../hooks/useQueries';
import VoiceMessagePlayer from './VoiceMessagePlayer';

interface MessageBubbleProps {
  message: MessageWithReactions;
  isOwnMessage: boolean;
  chatroomId: bigint;
  isPinned?: boolean;
  onReply?: (messageId: bigint, sender: string, contentSnippet: string, mediaThumbnail?: string) => void;
  onScrollToMessage?: (messageId: bigint) => void;
  onPin?: (messageId: bigint) => void;
  isAdmin?: boolean;
  allMessages?: MessageWithReactions[];
  replyPreview?: {
    sender: string;
    contentSnippet: string;
    mediaThumbnail?: string;
  } | null;
  isHighlighted?: boolean;
}

function listToArray<T>(list: [T, any] | null): T[] {
  const result: T[] = [];
  let current = list;
  while (current !== null) {
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

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({
  message,
  isOwnMessage,
  chatroomId,
  isPinned,
  onReply,
  onScrollToMessage,
  onPin,
  isAdmin,
  allMessages,
  replyPreview,
  isHighlighted,
}: MessageBubbleProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();

  const userId = localStorage.getItem('chatUserId') || 'anonymous';
  const reactions = listToArray(message.reactions);
  const chatroomIdStr = chatroomId.toString();

  const handleReaction = (emoji: string) => {
    const existingReaction = reactions.find((r) => r.emoji === emoji);
    const usersList = existingReaction ? listToArray(existingReaction.users) : [];
    const hasReacted = usersList.includes(userId);

    if (hasReacted) {
      removeReaction.mutate({ messageId: message.id, emoji, chatroomId: chatroomIdStr });
    } else {
      addReaction.mutate({ messageId: message.id, emoji, chatroomId: chatroomIdStr });
    }
    setShowEmojiPicker(false);
  };

  const isCreatorMessage = message.sender === 'Creator' && message.senderId === 'creator';

  // Find parent message for reply preview if allMessages provided
  const parentMessage = message.replyToMessageId && allMessages
    ? allMessages.find((m) => m.id === message.replyToMessageId)
    : null;

  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    if (message.mediaType === 'audio') {
      return (
        <div className="mt-2 max-w-xs">
          <VoiceMessagePlayer audioUrl={message.mediaUrl} isOwnMessage={isOwnMessage} />
        </div>
      );
    }

    if (message.mediaType === 'image') {
      return (
        <img
          src={message.mediaUrl}
          alt="Message media"
          className="mt-2 max-w-xs rounded-lg object-cover cursor-pointer"
          onClick={() => setLightboxUrl(message.mediaUrl!)}
        />
      );
    }

    if (message.mediaType === 'gif' || message.mediaType === 'giphy') {
      return (
        <img
          src={message.mediaUrl}
          alt="GIF"
          className="mt-2 max-w-xs rounded-lg"
        />
      );
    }

    return null;
  };

  const renderContent = () => {
    if (!message.content || message.content === 'Media content posted by creator') {
      return null;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.content.split(urlRegex);

    return (
      <p className="text-sm break-words whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (/^https?:\/\/[^\s]+$/.test(part)) {
            return (
              <span
                key={i}
                className="underline cursor-pointer opacity-80 hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault();
                  setLightboxUrl(part);
                }}
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </p>
    );
  };

  const avatarUrl = message.avatarUrl;
  const senderInitial = message.sender ? message.sender[0].toUpperCase() : '?';

  const renderAvatar = () => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={message.sender}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-primary-foreground">{senderInitial}</span>
      </div>
    );
  };

  if (isCreatorMessage) {
    return null;
  }

  const handleReplyClick = () => {
    if (!onReply) return;
    const snippet = message.content && message.content !== 'Media content posted by creator'
      ? message.content.slice(0, 100)
      : '';
    onReply(message.id, message.sender, snippet, message.mediaUrl ?? undefined);
  };

  return (
    <>
      <div
        className={`flex items-end gap-2 group mb-1 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} ${isHighlighted ? 'bg-yellow-100/20 rounded-lg px-2 py-1 transition-colors duration-300' : ''}`}
      >
        {/* Avatar */}
        {renderAvatar()}

        {/* Message content */}
        <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {/* Header: Message ID → Timestamp → Username (own) or Username → Timestamp → Message ID (others) */}
          <div className="flex items-center gap-1.5 mb-0.5">
            {isOwnMessage ? (
              <>
                <span className="text-[10px] text-muted-foreground font-mono opacity-60">#{message.messageId}</span>
                <span className="text-[10px] text-muted-foreground opacity-60">{formatTimestamp(message.timestamp)}</span>
                <span className="text-xs font-semibold text-foreground">{message.sender}</span>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-foreground">{message.sender}</span>
                <span className="text-[10px] text-muted-foreground opacity-60">{formatTimestamp(message.timestamp)}</span>
                <span className="text-[10px] text-muted-foreground font-mono opacity-60">#{message.messageId}</span>
              </>
            )}
          </div>

          {/* Reply preview (from parent message) */}
          {parentMessage && (
            <div
              className={`mb-1 px-2 py-1 rounded text-xs border-l-2 border-primary bg-muted/50 max-w-full cursor-pointer hover:bg-muted/70 transition-colors ${isOwnMessage ? 'text-right' : 'text-left'}`}
              onClick={() => onScrollToMessage && onScrollToMessage(parentMessage.id)}
            >
              <span className="font-semibold text-primary">{parentMessage.sender}: </span>
              <span className="text-muted-foreground">
                {parentMessage.content && parentMessage.content !== 'Media content posted by creator'
                  ? parentMessage.content.slice(0, 80)
                  : '📎 Media'}
              </span>
            </div>
          )}

          {/* Inline reply preview (passed as prop) */}
          {replyPreview && !parentMessage && (
            <div className={`mb-1 px-2 py-1 rounded text-xs border-l-2 border-primary bg-muted/50 max-w-full ${isOwnMessage ? 'text-right' : 'text-left'}`}>
              <span className="font-semibold text-primary">{replyPreview.sender}: </span>
              <span className="text-muted-foreground truncate">{replyPreview.contentSnippet}</span>
            </div>
          )}

          {/* Bubble */}
          <div
            className={`relative px-3 py-2 rounded-2xl text-sm ${
              isOwnMessage
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
            }`}
          >
            {renderContent()}
            {renderMedia()}
          </div>

          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {reactions
                .filter((r) => Number(r.count) > 0)
                .map((reaction) => {
                  const usersList = listToArray(reaction.users);
                  const hasReacted = usersList.includes(userId);
                  return (
                    <button
                      key={reaction.emoji}
                      onClick={() => handleReaction(reaction.emoji)}
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                        hasReacted
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-muted border-border text-foreground hover:bg-muted/80'
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

        {/* Action buttons - visible on group hover */}
        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Emoji reaction button */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border"
              title="React"
            >
              <Smile size={14} />
            </button>
            {showEmojiPicker && (
              <div
                className={`absolute bottom-8 ${isOwnMessage ? 'right-0' : 'left-0'} bg-popover border border-border rounded-xl shadow-lg p-2 flex gap-1 z-50`}
              >
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="text-lg hover:scale-125 transition-transform p-0.5"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply button */}
          {onReply && (
            <button
              onClick={handleReplyClick}
              className="p-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border"
              title="Reply"
            >
              <Reply size={14} />
            </button>
          )}

          {/* Pin button (admin only, for video messages) */}
          {isAdmin && onPin && message.mediaType && ['youtube', 'twitch'].includes(message.mediaType) && (
            <button
              onClick={() => onPin(message.id)}
              className={`p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors border border-border ${isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title={isPinned ? 'Unpin video' : 'Pin video'}
            >
              <Pin size={14} className={isPinned ? 'fill-current' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* Lightbox / external link confirmation */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="max-w-2xl max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}>
            {/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(lightboxUrl) ? (
              <img src={lightboxUrl} alt="Full size" className="max-w-full max-h-[70vh] rounded-lg" />
            ) : (
              <div className="bg-popover border border-border rounded-xl p-6 text-center space-y-4">
                <p className="text-sm font-semibold text-foreground">You are about to leave Chattr</p>
                <p className="text-xs text-muted-foreground">External links may be unsafe — proceed with caution.</p>
                <p className="text-xs text-muted-foreground break-all bg-muted rounded px-2 py-1">{lightboxUrl}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setLightboxUrl(null)}
                    className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors text-sm border border-border"
                  >
                    Cancel
                  </button>
                  <a
                    href={lightboxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
                    onClick={() => setLightboxUrl(null)}
                  >
                    Continue
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
