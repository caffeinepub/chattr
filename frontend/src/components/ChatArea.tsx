import { useEffect, useRef, useState, useCallback } from 'react';
import { useGetMessages, useSendMessage, useCurrentUsername, useGetPinnedVideo, getUserId } from '../hooks/useQueries';
import type { ChatroomWithLiveStatus, MessageWithReactions } from '../backend';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { Loader2, MessageCircle, Users, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from './ui/badge';
import PinnedVideo from './PinnedVideo';
import { formatCompactNumber } from '../lib/formatters';
import { Button } from './ui/button';

interface ChatAreaProps {
  chatroomId: bigint;
  chatroom: ChatroomWithLiveStatus;
  targetMessageId?: bigint;
}

interface ReplyContext {
  messageId: bigint;
  sender: string;
  contentSnippet: string;
  mediaThumbnail?: string;
}

export default function ChatArea({ chatroomId, chatroom, targetMessageId }: ChatAreaProps) {
  const { data: messages, isLoading } = useGetMessages(chatroomId);
  const currentUsername = useCurrentUsername();
  const sendMessage = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyContext | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<bigint | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousMessageCountRef = useRef<number>(0);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);
  const hasScrolledToTarget = useRef(false);

  // Get stable userId for per-user pinned video
  const userId = getUserId();
  const { data: pinnedVideoMessageId } = useGetPinnedVideo(chatroomId, userId);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Filter out Creator messages that don't have media
  const filteredMessages = messages?.filter((message) => {
    if (message.sender === 'Creator' && !message.mediaUrl) {
      return false;
    }
    return true;
  });

  // Find pinned video message using per-user pinnedVideoMessageId
  const pinnedVideoMessage = pinnedVideoMessageId != null
    ? filteredMessages?.find((msg) => msg.id === pinnedVideoMessageId)
    : undefined;

  // Auto-scroll to bottom when new messages arrive (only if no target message)
  useEffect(() => {
    if (filteredMessages && !targetMessageId) {
      const currentMessageCount = filteredMessages.length;
      const previousMessageCount = previousMessageCountRef.current;

      if (previousMessageCount === 0 || currentMessageCount > previousMessageCount) {
        scrollToBottom();
      }

      previousMessageCountRef.current = currentMessageCount;
    }
  }, [filteredMessages, targetMessageId]);

  // Scroll to target message when messages load
  useEffect(() => {
    if (targetMessageId && filteredMessages && filteredMessages.length > 0 && !hasScrolledToTarget.current) {
      const messageElement = messageRefs.current.get(targetMessageId.toString());
      if (messageElement && scrollContainerRef.current) {
        setTimeout(() => {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedMessageId(targetMessageId);

          setTimeout(() => {
            setHighlightedMessageId(null);
          }, 3000);
        }, 100);

        hasScrolledToTarget.current = true;
      }
    }
  }, [targetMessageId, filteredMessages]);

  const handleSendMessage = async (content: string, mediaUrl?: string, mediaType?: string) => {
    if (!content.trim() && !mediaUrl) return;

    await sendMessage.mutateAsync({
      content: content.trim() || (
        mediaType === 'image' ? 'Image' :
        mediaType === 'youtube' ? 'YouTube Video' :
        mediaType === 'twitch' ? 'Twitch Video' :
        mediaType === 'twitter' ? 'Twitter Post' :
        mediaType === 'audio' ? 'Voice message' :
        'Message'
      ),
      chatroomId,
      mediaUrl,
      mediaType,
      replyToMessageId: replyingTo?.messageId,
    });

    scrollToBottom();
    setReplyingTo(null);
  };

  const handleReply = (messageId: bigint, sender: string, contentSnippet: string, mediaThumbnail?: string) => {
    setReplyingTo({ messageId, sender, contentSnippet, mediaThumbnail });
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleScrollToMessage = (messageId: bigint) => {
    const messageElement = messageRefs.current.get(messageId.toString());
    if (messageElement && scrollContainerRef.current) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  const toggleHeader = () => {
    setIsHeaderExpanded(!isHeaderExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Chatroom Info Header - Collapsible */}
      <div className="flex-shrink-0 border-b border-border bg-card">
        {isHeaderExpanded ? (
          <div className="px-4 py-3">
            <div className="md:flex md:items-center md:justify-center md:gap-8">
              <div className="md:text-center">
                <div className="flex items-center gap-2 md:justify-center">
                  <h2 className="text-base font-semibold text-foreground">{chatroom.topic}</h2>
                  {chatroom.category && (
                    <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                      {chatroom.category.toLowerCase()}
                    </Badge>
                  )}
                  {chatroom.isLive && (
                    <div className="flex items-center gap-1.5 rounded-md bg-primary px-2 py-0.5">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      <span className="text-xs font-bold uppercase tracking-wide text-white">
                        LIVE
                      </span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleHeader}
                    className="h-7 w-7 flex-shrink-0"
                    aria-label="Collapse header"
                    aria-expanded={isHeaderExpanded}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{chatroom.description}</p>
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground md:mt-0">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>{formatCompactNumber(chatroom.messageCount)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>{formatCompactNumber(chatroom.activeUserCount)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 px-4 py-2 md:justify-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-initial md:min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">{chatroom.topic}</h2>
              {chatroom.isLive && (
                <div className="flex items-center gap-1.5 rounded-md bg-primary px-2 py-0.5">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  <span className="text-xs font-bold uppercase tracking-wide text-white">
                    LIVE
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{formatCompactNumber(chatroom.messageCount)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>{formatCompactNumber(chatroom.activeUserCount)}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleHeader}
              className="h-7 w-7 flex-shrink-0"
              aria-label="Expand header"
              aria-expanded={isHeaderExpanded}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Pinned Video Area - Fixed above messages, per-user */}
      {pinnedVideoMessage && (
        <div className="flex-shrink-0 border-b border-border bg-card/50">
          <PinnedVideo message={pinnedVideoMessage} chatroomId={chatroomId} userId={userId} />
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {filteredMessages && filteredMessages.length > 0 ? (
            filteredMessages.map((message) => (
              <div
                key={message.id.toString()}
                ref={(el) => {
                  if (el) {
                    messageRefs.current.set(message.id.toString(), el);
                  } else {
                    messageRefs.current.delete(message.id.toString());
                  }
                }}
              >
                <MessageBubble
                  message={message}
                  isOwnMessage={currentUsername === message.sender}
                  chatroomId={chatroomId}
                  isPinned={pinnedVideoMessageId === message.id}
                  onReply={handleReply}
                  onScrollToMessage={handleScrollToMessage}
                  allMessages={filteredMessages}
                  isHighlighted={highlightedMessageId === message.id}
                  userId={userId}
                />
              </div>
            ))
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="flex-shrink-0 border-t border-border bg-card/50 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {replyingTo.mediaThumbnail && (
                <img
                  src={replyingTo.mediaThumbnail}
                  alt="Reply preview"
                  className="h-10 w-10 flex-shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Replying to {replyingTo.sender}
                </p>
                <p className="truncate text-sm text-foreground">
                  {replyingTo.contentSnippet}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelReply}
              className="h-8 w-8 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="flex-shrink-0 border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <MessageInput
            onSendMessage={handleSendMessage}
            disabled={sendMessage.isPending}
            isSending={sendMessage.isPending}
          />
        </div>
      </div>
    </div>
  );
}
