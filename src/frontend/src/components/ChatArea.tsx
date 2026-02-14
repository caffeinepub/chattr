import { useEffect, useRef, useState } from 'react';
import { useGetMessages, useSendMessage, useGetCurrentUsername } from '../hooks/useQueries';
import type { ChatroomWithLiveStatus } from '../backend';
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
}

interface ReplyContext {
  messageId: bigint;
  sender: string;
  contentSnippet: string;
  mediaThumbnail?: string;
}

export default function ChatArea({ chatroomId, chatroom }: ChatAreaProps) {
  const { data: messages, isLoading } = useGetMessages(chatroomId);
  const { data: currentUsername } = useGetCurrentUsername();
  const sendMessage = useSendMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyContext | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<bigint | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const previousMessageCountRef = useRef<number>(0);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(true);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages) {
      const currentMessageCount = messages.length;
      const previousMessageCount = previousMessageCountRef.current;
      
      // If this is the first load or new messages arrived, scroll to bottom
      if (previousMessageCount === 0 || currentMessageCount > previousMessageCount) {
        scrollToBottom();
      }
      
      previousMessageCountRef.current = currentMessageCount;
    }
  }, [messages]);

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
    
    // Scroll to bottom after sending message
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
      // Scroll to message
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Highlight message
      setHighlightedMessageId(messageId);
      
      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  const toggleHeader = () => {
    setIsHeaderExpanded(!isHeaderExpanded);
  };

  // Find pinned video message
  const pinnedVideoMessage = messages?.find(
    (msg) => chatroom.pinnedVideoId && msg.id === chatroom.pinnedVideoId
  );

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
          // Expanded header
          <div className="px-4 py-3">
            <div className="md:flex md:items-center md:justify-center md:gap-8">
              <div className="md:text-center">
                <div className="flex items-center gap-2 md:justify-center">
                  <h2 className="text-base font-semibold text-foreground">{chatroom.topic}</h2>
                  {chatroom.category && (
                    <Badge variant="secondary" className="text-xs">
                      {chatroom.category}
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
          // Collapsed header - compact bar
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

      {/* Pinned Video Area - Fixed above messages */}
      {pinnedVideoMessage && (
        <div className="flex-shrink-0 border-b border-border bg-card/50">
          <PinnedVideo message={pinnedVideoMessage} chatroomId={chatroomId} />
        </div>
      )}

      {/* Messages Area - Scrollable with flex-1 and min-h-0 to constrain height */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {messages && messages.length > 0 ? (
            messages.map((message) => (
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
                  isPinned={chatroom.pinnedVideoId === message.id}
                  onReply={handleReply}
                  onScrollToMessage={handleScrollToMessage}
                  allMessages={messages}
                  isHighlighted={highlightedMessageId === message.id}
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
        <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-2">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
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
      <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <MessageInput onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
}
