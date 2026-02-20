import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Users, Eye } from 'lucide-react';
import type { ChatroomWithLiveStatus, GifData } from '../backend';
import { useGetMessages } from '../hooks/useQueries';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import PinnedVideo from './PinnedVideo';

interface ChatAreaProps {
  chatroom: ChatroomWithLiveStatus;
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string, gifData?: GifData) => void;
  isSending?: boolean;
  replyToMessageId?: bigint | null;
  onReply?: (messageId: bigint) => void;
  onCancelReply?: () => void;
}

function getUserId(): string {
  let userId = localStorage.getItem('chatUserId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatUserId', userId);
  }
  return userId;
}

export default function ChatArea({ 
  chatroom, 
  onSendMessage, 
  isSending,
  replyToMessageId,
  onReply,
  onCancelReply
}: ChatAreaProps) {
  const { data: messages = [] } = useGetMessages(chatroom.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<bigint | null>(null);
  const userId = getUserId();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (messageId: bigint) => {
    const messageElement = document.getElementById(`message-${messageId.toString()}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleReply = (messageId: bigint, sender: string, contentSnippet: string, mediaThumbnail?: string) => {
    if (onReply) {
      onReply(messageId);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (msg.sender === 'Creator' && !msg.mediaUrl) {
      return false;
    }
    return true;
  });

  const pinnedMessage = chatroom.pinnedVideoId
    ? messages.find((msg) => msg.id === chatroom.pinnedVideoId)
    : null;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Collapsible Header */}
      <div className="flex-shrink-0 border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className={`flex-1 min-w-0 ${isHeaderCollapsed ? 'md:flex md:items-center md:justify-center md:gap-3' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`font-semibold text-foreground ${isHeaderCollapsed ? 'text-sm' : 'text-lg'}`}>
                  {chatroom.topic}
                </h2>
                {chatroom.isLive && (
                  <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                    LIVE
                  </span>
                )}
                {chatroom.category && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {chatroom.category.toLowerCase()}
                  </span>
                )}
              </div>
              {!isHeaderCollapsed && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {chatroom.description}
                </p>
              )}
              <div className={`flex items-center gap-3 text-xs text-muted-foreground ${isHeaderCollapsed ? '' : 'mt-2'}`}>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {Number(chatroom.activeUserCount)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {Number(chatroom.viewCount)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              className="rounded-full p-2 hover:bg-muted transition-colors flex-shrink-0"
              title={isHeaderCollapsed ? 'Expand header' : 'Collapse header'}
            >
              {isHeaderCollapsed ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Pinned Video Area */}
      {pinnedMessage && pinnedMessage.mediaUrl && (
        <PinnedVideo
          message={pinnedMessage}
          chatroomId={chatroom.id}
        />
      )}

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-background"
      >
        <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
          {filteredMessages.map((message) => (
            <div key={message.id.toString()} id={`message-${message.id.toString()}`}>
              <MessageBubble
                message={message}
                isOwnMessage={message.senderId === userId}
                chatroomId={chatroom.id}
                isPinned={chatroom.pinnedVideoId === message.id}
                onReply={handleReply}
                onScrollToMessage={scrollToMessage}
                allMessages={messages}
                isHighlighted={highlightedMessageId === message.id}
              />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply Preview */}
      {replyToMessageId && onCancelReply && (
        <div className="flex-shrink-0 border-t bg-card">
          <div className="mx-auto max-w-3xl px-4 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Replying to message
              </span>
              <button
                onClick={onCancelReply}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        isSending={isSending}
      />
    </div>
  );
}
