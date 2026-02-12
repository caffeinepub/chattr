import { useEffect, useRef, useState } from 'react';
import { useGetMessages, useSendMessage, useGetCurrentUsername } from '../hooks/useQueries';
import type { ChatroomWithLiveStatus, MessageWithReactions } from '../backend';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { Loader2, MessageCircle, Eye, X } from 'lucide-react';
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
      {/* Chatroom Info Header - Fixed, centered on desktop */}
      <div className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="md:flex md:items-center md:justify-center md:gap-8">
          <div className="md:text-center">
            <div className="flex items-center gap-2 md:justify-center">
              <h2 className="text-base font-semibold text-foreground md:text-base">{chatroom.topic}</h2>
              {chatroom.category && (
                <Badge variant="secondary" className="text-xs">
                  {chatroom.category}
                </Badge>
              )}
              {chatroom.isLive && (
                <div className="flex items-center gap-1.5 rounded-md bg-primary px-2 py-0.5">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  <span className="text-xs font-bold uppercase tracking-wide text-white">
                    {formatCompactNumber(chatroom.activeUserCount)} LIVE
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground md:text-sm">{chatroom.description}</p>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground md:mt-0 md:text-sm">
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{Number(chatroom.messageCount)} messages</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span>{Number(chatroom.viewCount)} views</span>
            </div>
          </div>
        </div>
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
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {messages && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <img
                    src="/assets/generated/chat-icon-transparent.dim_64x64.png"
                    alt="Chat"
                    className="h-10 w-10"
                  />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No messages yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start the conversation by sending a message below
                </p>
              </div>
            </div>
          ) : (
            messages && messages.map((message) => (
              <div 
                key={message.id.toString()}
                ref={(el) => {
                  if (el) {
                    messageRefs.current.set(message.id.toString(), el);
                  }
                }}
              >
                <MessageBubble
                  message={message}
                  isOwnMessage={message.sender === currentUsername}
                  chatroomId={chatroomId}
                  isPinned={chatroom.pinnedVideoId === message.id}
                  onReply={handleReply}
                  onScrollToMessage={handleScrollToMessage}
                  allMessages={messages}
                  isHighlighted={highlightedMessageId === message.id}
                />
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input - Fixed at bottom with safe area padding for mobile */}
      <div className="flex-shrink-0 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {replyingTo && (
            <div className="mb-2 rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex items-start gap-3">
                {replyingTo.mediaThumbnail && (
                  <img 
                    src={replyingTo.mediaThumbnail} 
                    alt="Reply thumbnail" 
                    className="h-12 w-12 flex-shrink-0 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <img src="/assets/generated/reply-icon-transparent.dim_24x24.png" alt="Reply" className="h-4 w-4 opacity-60" />
                    <span className="text-xs text-muted-foreground">
                      Replying to <span className="font-medium text-foreground">{replyingTo.sender}</span>
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {replyingTo.contentSnippet}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelReply}
                  className="h-6 w-6 flex-shrink-0 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
