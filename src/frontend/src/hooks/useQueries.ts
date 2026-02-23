import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Message, ChatroomWithLiveStatus, UserProfile, MessageWithReactions as BackendMessageWithReactions, Reaction as BackendReaction, List_1, List } from '../backend';
import { toast } from 'sonner';
import { compressImage } from '../lib/imageCompression';

// Frontend-friendly types with arrays instead of linked lists
export interface Reaction {
  emoji: string;
  count: bigint;
  users: string[];
}

export interface MessageWithReactions {
  id: bigint;
  content: string;
  timestamp: bigint;
  sender: string;
  chatroomId: bigint;
  mediaUrl?: string;
  mediaType?: string;
  avatarUrl?: string;
  senderId: string;
  reactions: Reaction[];
  replyToMessageId?: bigint;
}

// Generate 8-character alphanumeric username (uppercase + lowercase + numbers)
function generateUsername(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get username from localStorage or generate a random anonymous ID
function getUsername(): string {
  const stored = localStorage.getItem('chatUsername');
  if (stored) return stored;
  
  const anonName = generateUsername();
  localStorage.setItem('chatUsername', anonName);
  return anonName;
}

// Get user ID for tracking messages across username changes
function getUserId(): string {
  let userId = localStorage.getItem('chatUserId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatUserId', userId);
  }
  return userId;
}

// Get avatar URL from localStorage
function getAvatarUrl(): string | null {
  return localStorage.getItem('chatAvatarUrl');
}

// Convert List_1 (Reaction list) to array helper
function reactionListToArray(list: List_1 | null): BackendReaction[] {
  const result: BackendReaction[] = [];
  let current = list;
  while (current !== null && Array.isArray(current) && current.length === 2) {
    result.push(current[0] as BackendReaction);
    current = current[1];
  }
  return result;
}

// Convert List (string list) to array helper
function stringListToArray(list: List | null): string[] {
  const result: string[] = [];
  let current = list;
  while (current !== null && Array.isArray(current) && current.length === 2) {
    result.push(current[0] as string);
    current = current[1];
  }
  return result;
}

// Normalize query key: empty/whitespace search should use base key
function normalizeSearchQueryKey(searchTerm: string): readonly unknown[] {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return ['chatrooms'];
  }
  return ['chatrooms', 'search', trimmed];
}

// Category query key: always use distinct key, even when empty
function normalizeCategoryQueryKey(category: string): readonly unknown[] {
  const trimmed = category.trim();
  if (!trimmed) {
    return ['chatrooms', 'category', '__none__'];
  }
  return ['chatrooms', 'category', trimmed];
}

// Chatroom queries
export function useGetChatrooms() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['chatrooms'],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useGetChatrooms] Actor not available');
        throw new Error('Actor not available');
      }
      
      console.log('[useGetChatrooms] Fetching chatrooms...');
      const chatrooms = await actor.getChatrooms();
      console.log('[useGetChatrooms] Fetched chatrooms:', chatrooms.length);
      
      // Backend returns rooms sorted by lastActivity (bump-based), preserve that order
      return chatrooms;
    },
    enabled: !!actor && !actorFetching,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5000,
    retry: 3,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useSearchChatrooms(searchTerm: string) {
  const { actor, isFetching: actorFetching } = useActor();

  const trimmedSearchTerm = searchTerm.trim();
  const queryKey = normalizeSearchQueryKey(searchTerm);

  const shouldExecute = !!trimmedSearchTerm;

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey,
    queryFn: async () => {
      if (!actor) {
        console.warn('[useSearchChatrooms] Actor not available');
        throw new Error('Actor not available');
      }
      
      if (!trimmedSearchTerm) {
        console.warn('[useSearchChatrooms] Called with empty search term, returning empty array');
        return [];
      }
      
      const chatrooms = await actor.searchChatrooms(trimmedSearchTerm);
      
      // Backend returns rooms sorted by lastActivity (bump-based), preserve that order
      return chatrooms;
    },
    enabled: !!actor && !actorFetching && shouldExecute,
    retry: 3,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useFilterChatroomsByCategory(category: string) {
  const { actor, isFetching: actorFetching } = useActor();

  const trimmedCategory = category.trim();
  const queryKey = normalizeCategoryQueryKey(category);

  const shouldExecute = !!trimmedCategory;

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey,
    queryFn: async () => {
      if (!actor) {
        console.warn('[useFilterChatroomsByCategory] Actor not available');
        throw new Error('Actor not available');
      }
      
      if (!trimmedCategory) {
        console.warn('[useFilterChatroomsByCategory] Called with empty category, returning empty array');
        return [];
      }
      
      const chatrooms = await actor.filterChatroomsByCategory(trimmedCategory);
      
      // Backend returns rooms sorted by lastActivity (bump-based), preserve that order
      return chatrooms;
    },
    enabled: !!actor && !actorFetching && shouldExecute,
    retry: 3,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useGetChatroom(chatroomId: bigint) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus | null>({
    queryKey: ['chatroom', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useGetChatroom] Actor not available for chatroom:', chatroomId.toString());
        throw new Error('Backend connection not available');
      }
      
      console.log('[useGetChatroom] Fetching chatroom:', chatroomId.toString(), 'from deep link');
      const chatroom = await actor.getChatroom(chatroomId);
      console.log('[useGetChatroom] Fetched chatroom:', chatroom ? 'found' : 'not found', chatroom);
      return chatroom;
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 5000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    staleTime: 30000,
  });
}

export function useCreateChatroom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { topic: string; description: string; mediaUrl: string; mediaType: string; category: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[CreateChatroom] Submitting to backend:', {
        topic: params.topic,
        description: params.description,
        mediaUrl: params.mediaUrl.substring(0, 100) + '...',
        mediaType: params.mediaType,
        category: params.category,
      });
      
      return actor.createChatroom(params.topic, params.description, params.mediaUrl, params.mediaType, params.category);
    },
    onSuccess: async () => {
      console.log('[CreateChatroom] Success, invalidating and refetching chatrooms...');
      
      await queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'all'
      });
      
      toast.success('Chat created successfully');
    },
    onError: (error: Error) => {
      console.error('[CreateChatroom] Error:', error);
      
      // Check if error is room limit error
      if (error.message && error.message.includes('Room limit reached')) {
        toast.error('Room limit reached. Maximum of 154 rooms allowed.');
      } else {
        toast.error(error.message || 'Failed to create chat');
      }
    },
  });
}

export function useDeleteChatroom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatroomId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      
      const password = 'lunasimbaliamsammy1987!';
      
      console.log('[DeleteChatroom] Deleting chatroom:', chatroomId.toString());
      
      await actor.deleteChatroomWithPassword(chatroomId, password);
    },
    onSuccess: async () => {
      console.log('[DeleteChatroom] Success, invalidating and refetching chatrooms...');
      
      await queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'all'
      });
      
      toast.success('Chat deleted successfully');
    },
    onError: (error: Error) => {
      console.error('[DeleteChatroom] Error:', error);
      toast.error(error.message || 'Failed to delete chat');
    },
  });
}

// Message queries
export function useGetMessages(chatroomId: bigint) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<MessageWithReactions[]>({
    queryKey: ['messages', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      const messages = await actor.getMessageWithReactionsAndReplies(chatroomId);
      
      // Convert backend format to frontend format
      return messages.map(msg => ({
        ...msg,
        reactions: reactionListToArray(msg.reactions).map(reaction => ({
          emoji: reaction.emoji,
          count: reaction.count,
          users: stringListToArray(reaction.users),
        })),
      }));
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 2000,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useGetMessagesWithReactions(chatroomId: bigint) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<MessageWithReactions[]>({
    queryKey: ['messagesWithReactions', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      const messages = await actor.getMessageWithReactionsAndReplies(chatroomId);
      
      // Convert backend format to frontend format
      return messages.map(msg => ({
        ...msg,
        reactions: reactionListToArray(msg.reactions).map(reaction => ({
          emoji: reaction.emoji,
          count: reaction.count,
          users: stringListToArray(reaction.users),
        })),
      }));
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 2000,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      content: string;
      chatroomId: bigint;
      mediaUrl?: string | null;
      mediaType?: string | null;
      replyToMessageId?: bigint | null;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      const username = getUsername();
      const userId = getUserId();
      const avatarUrl = getAvatarUrl();
      
      return actor.sendMessage(
        params.content,
        username,
        params.chatroomId,
        params.mediaUrl || null,
        params.mediaType || null,
        avatarUrl,
        userId,
        params.replyToMessageId || null
      );
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ 
        queryKey: ['messagesWithReactions', variables.chatroomId.toString()] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['messages', variables.chatroomId.toString()] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['chatroom', variables.chatroomId.toString()] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['chatrooms'] 
      });
    },
    onError: (error: Error) => {
      console.error('[SendMessage] Error:', error);
      toast.error(error.message || 'Failed to send message');
    },
  });
}

export function useIncrementViewCount() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatroomId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      return actor.incrementViewCount(chatroomId, userId);
    },
    onSuccess: async (_, chatroomId) => {
      await queryClient.invalidateQueries({ 
        queryKey: ['chatroom', chatroomId.toString()] 
      });
      await queryClient.invalidateQueries({ 
        queryKey: ['chatrooms'] 
      });
    },
  });
}

// Pinned video mutations
export function usePinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { chatroomId: bigint; messageId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.pinVideo(params.chatroomId, params.messageId);
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ 
        queryKey: ['chatroom', variables.chatroomId.toString()] 
      });
      toast.success('Video pinned successfully');
    },
    onError: (error: Error) => {
      console.error('[PinVideo] Error:', error);
      toast.error(error.message || 'Failed to pin video');
    },
  });
}

export function useUnpinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatroomId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      return actor.unpinVideo(chatroomId);
    },
    onSuccess: async (_, chatroomId) => {
      await queryClient.invalidateQueries({ 
        queryKey: ['chatroom', chatroomId.toString()] 
      });
      toast.success('Video unpinned successfully');
    },
    onError: (error: Error) => {
      console.error('[UnpinVideo] Error:', error);
      toast.error(error.message || 'Failed to unpin video');
    },
  });
}

export function useGetPinnedVideo(chatroomId: bigint) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint | null>({
    queryKey: ['pinnedVideo', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getPinnedVideo(chatroomId);
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 5000,
  });
}

// Username and avatar hooks
export function useUsername() {
  return getUsername();
}

export function useUserId() {
  return getUserId();
}

export function useAvatarUrl() {
  return getAvatarUrl();
}

export function useUpdateUsername() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      if (!actor) throw new Error('Actor not available');
      
      // Validate username: alphanumeric only, max 15 characters
      if (!/^[a-zA-Z0-9]+$/.test(newUsername)) {
        throw new Error('Username must contain only letters and numbers');
      }
      
      if (newUsername.length > 15) {
        throw new Error('Username must be 15 characters or less');
      }
      
      const userId = getUserId();
      
      await actor.updateUsernameRetroactively(userId, newUsername);
      
      localStorage.setItem('chatUsername', newUsername);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      await queryClient.invalidateQueries({ queryKey: ['messagesWithReactions'] });
      toast.success('Username updated successfully');
    },
    onError: (error: Error) => {
      console.error('[UpdateUsername] Error:', error);
      
      if (error.message.includes('already exists')) {
        toast.error('Username already taken. Please choose another.');
      } else {
        toast.error(error.message || 'Failed to update username');
      }
    },
  });
}

export function useUpdateAvatar() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newAvatarUrl: string | null) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      
      await actor.updateAvatarRetroactively(userId, newAvatarUrl);
      
      if (newAvatarUrl) {
        localStorage.setItem('chatAvatarUrl', newAvatarUrl);
      } else {
        localStorage.removeItem('chatAvatarUrl');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      await queryClient.invalidateQueries({ queryKey: ['messagesWithReactions'] });
      toast.success('Avatar updated successfully');
    },
    onError: (error: Error) => {
      console.error('[UpdateAvatar] Error:', error);
      toast.error(error.message || 'Failed to update avatar');
    },
  });
}

// Reaction mutations
export function useAddReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { messageId: bigint; emoji: string; chatroomId: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      return actor.addReaction(params.messageId, params.emoji, userId);
    },
    onMutate: async ({ messageId, emoji, chatroomId }) => {
      await queryClient.cancelQueries({ 
        queryKey: ['messages', chatroomId] 
      });

      const previousMessages = queryClient.getQueryData<MessageWithReactions[]>([
        'messages',
        chatroomId,
      ]);

      if (previousMessages) {
        const userId = getUserId();
        queryClient.setQueryData<MessageWithReactions[]>(
          ['messages', chatroomId],
          previousMessages.map((msg) => {
            if (msg.id === messageId) {
              const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
              if (existingReaction) {
                return {
                  ...msg,
                  reactions: msg.reactions.map((r) =>
                    r.emoji === emoji
                      ? {
                          ...r,
                          count: r.count + 1n,
                          users: [...r.users, userId],
                        }
                      : r
                  ),
                };
              } else {
                return {
                  ...msg,
                  reactions: [
                    ...msg.reactions,
                    { emoji, count: 1n, users: [userId] },
                  ],
                };
              }
            }
            return msg;
          })
        );
      }

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ['messages', variables.chatroomId],
          context.previousMessages
        );
      }
      toast.error('Failed to add reaction');
    },
    onSettled: async (_, __, variables) => {
      await queryClient.invalidateQueries({ 
        queryKey: ['messages', variables.chatroomId] 
      });
    },
  });
}

export function useRemoveReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { messageId: bigint; emoji: string; chatroomId: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      return actor.removeReaction(params.messageId, params.emoji, userId);
    },
    onMutate: async ({ messageId, emoji, chatroomId }) => {
      await queryClient.cancelQueries({ 
        queryKey: ['messages', chatroomId] 
      });

      const previousMessages = queryClient.getQueryData<MessageWithReactions[]>([
        'messages',
        chatroomId,
      ]);

      if (previousMessages) {
        const userId = getUserId();
        queryClient.setQueryData<MessageWithReactions[]>(
          ['messages', chatroomId],
          previousMessages.map((msg) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                reactions: msg.reactions
                  .map((r) =>
                    r.emoji === emoji
                      ? {
                          ...r,
                          count: r.count > 0n ? r.count - 1n : 0n,
                          users: r.users.filter((u) => u !== userId),
                        }
                      : r
                  )
                  .filter((r) => r.count > 0n),
              };
            }
            return msg;
          })
        );
      }

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ['messages', variables.chatroomId],
          context.previousMessages
        );
      }
      toast.error('Failed to remove reaction');
    },
    onSettled: async (_, __, variables) => {
      await queryClient.invalidateQueries({ 
        queryKey: ['messages', variables.chatroomId] 
      });
    },
  });
}

// File upload helper
export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    console.log('[uploadImage] Starting upload for file:', file.name, 'size:', file.size);
    
    // Compress image before upload
    const compressedFile = await compressImage(file);
    console.log('[uploadImage] Compressed file size:', compressedFile.size);
    
    const arrayBuffer = await compressedFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Import the entire module and access ExternalBlob
    const icpSdkCore = await import('@icp-sdk/core');
    const ExternalBlob = (icpSdkCore as any).ExternalBlob;
    
    if (!ExternalBlob) {
      throw new Error('ExternalBlob not found in @icp-sdk/core');
    }
    
    let blob = ExternalBlob.fromBytes(uint8Array);
    
    if (onProgress) {
      blob = blob.withUploadProgress((percentage: number) => {
        console.log('[uploadImage] Upload progress:', percentage);
        onProgress(percentage);
      });
    }
    
    const url = blob.getDirectURL();
    console.log('[uploadImage] Upload complete, URL:', url);
    
    return url;
  } catch (error) {
    console.error('[uploadImage] Upload failed:', error);
    throw error;
  }
}
