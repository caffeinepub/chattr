import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Message, ChatroomWithLiveStatus, UserProfile, MessageWithReactions, Reaction } from '../backend';
import { toast } from 'sonner';
import { compressImage } from '../lib/imageCompression';

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

// Upload image helper function
export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    // Report initial progress
    if (onProgress) onProgress(10);
    
    // Compress the image
    const compressedFile = await compressImage(file);
    if (onProgress) onProgress(50);
    
    // Convert to data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (onProgress) onProgress(90);
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
    
    if (onProgress) onProgress(100);
    return dataUrl;
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image');
  }
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
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
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
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
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
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
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
      if (!actor) throw new Error('Actor not available');
      return actor.getChatroom(chatroomId);
    },
    enabled: !!actor && !actorFetching,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5000,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useGetLobbyChatroomCards() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery({
    queryKey: ['lobbyChatroomCards'],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useGetLobbyChatroomCards] Actor not available');
        throw new Error('Actor not available');
      }
      
      console.log('[useGetLobbyChatroomCards] Fetching lobby cards...');
      const cards = await actor.getLobbyChatroomCards();
      console.log('[useGetLobbyChatroomCards] Fetched lobby cards:', cards.length);
      
      return cards;
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

export function useCreateChatroom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      topic: string;
      description: string;
      mediaUrl: string;
      mediaType: string;
      category: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createChatroom(
        params.topic,
        params.description,
        params.mediaUrl,
        params.mediaType,
        params.category
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      queryClient.invalidateQueries({ queryKey: ['lobbyChatroomCards'] });
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
      return actor.getMessageWithReactionsAndReplies(chatroomId);
    },
    enabled: !!actor && !actorFetching,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 3000,
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
      mediaUrl?: string;
      mediaType?: string;
      replyToMessageId?: string | null;
    }) => {
      if (!actor) throw new Error('Actor not available');

      const username = getUsername();
      const userId = getUserId();
      const avatarUrl = getAvatarUrl();

      await actor.sendMessage(
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      queryClient.invalidateQueries({ queryKey: ['lobbyChatroomCards'] });
      queryClient.invalidateQueries({ queryKey: ['chatroom', variables.chatroomId.toString()] });
    },
  });
}

export function usePinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatroomId, messageId }: { chatroomId: bigint; messageId: string }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.pinVideo(chatroomId, messageId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', variables.chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      queryClient.invalidateQueries({ queryKey: ['lobbyChatroomCards'] });
    },
  });
}

export function useUnpinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatroomId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      await actor.unpinVideo(chatroomId);
    },
    onSuccess: (_, chatroomId) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      queryClient.invalidateQueries({ queryKey: ['lobbyChatroomCards'] });
    },
  });
}

export function useIncrementViewCount() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (chatroomId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.incrementViewCount(chatroomId, userId);
    },
  });
}

// Username management
export function useCurrentUsername(): string {
  return getUsername();
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

      // Update username retroactively in backend
      await actor.updateUsernameRetroactively(userId, newUsername);

      // Update localStorage
      localStorage.setItem('chatUsername', newUsername);
    },
    onSuccess: () => {
      // Invalidate all message queries to refresh with new username
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Username updated successfully');
    },
    onError: (error: Error) => {
      if (error.message.includes('already exists')) {
        toast.error('Username already taken. Please choose another.');
      } else if (error.message.includes('alphanumeric')) {
        toast.error('Username must contain only letters and numbers');
      } else if (error.message.includes('15 characters')) {
        toast.error('Username must be 15 characters or less');
      } else {
        toast.error('Failed to update username');
      }
    },
  });
}

// Avatar management
export function useCurrentAvatarUrl(): string | null {
  return getAvatarUrl();
}

export function useUpdateAvatar() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newAvatarUrl: string | null) => {
      if (!actor) throw new Error('Actor not available');

      const userId = getUserId();

      // Update avatar retroactively in backend
      await actor.updateAvatarRetroactively(userId, newAvatarUrl);

      // Update localStorage
      if (newAvatarUrl) {
        localStorage.setItem('chatAvatarUrl', newAvatarUrl);
      } else {
        localStorage.removeItem('chatAvatarUrl');
      }
    },
    onSuccess: () => {
      // Invalidate all message queries to refresh with new avatar
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

// Reaction mutations
export function useAddReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, chatroomId }: { messageId: string; emoji: string; chatroomId: string }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.addReaction(messageId, emoji, userId);
    },
    onMutate: async ({ messageId, emoji, chatroomId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', chatroomId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithReactions[]>(['messages', chatroomId]);

      // Optimistically update
      if (previousMessages) {
        const userId = getUserId();
        queryClient.setQueryData<MessageWithReactions[]>(['messages', chatroomId], (old) => {
          if (!old) return old;
          return old.map((msg) => {
            if (msg.id === messageId) {
              const reactions = listToArray<Reaction>(msg.reactions);
              const existingReaction = reactions.find((r) => r.emoji === emoji);

              if (existingReaction) {
                const users = listToArray<string>(existingReaction.users);
                if (!users.includes(userId)) {
                  // Add user to existing reaction
                  return {
                    ...msg,
                    reactions: [
                      ...reactions.filter((r) => r.emoji !== emoji),
                      {
                        emoji,
                        count: existingReaction.count + BigInt(1),
                        users: [userId, existingReaction.users] as any,
                      },
                    ] as any,
                  };
                }
              } else {
                // Add new reaction
                return {
                  ...msg,
                  reactions: [
                    ...reactions,
                    {
                      emoji,
                      count: BigInt(1),
                      users: [userId, null] as any,
                    },
                  ] as any,
                };
              }
            }
            return msg;
          });
        });
      }

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', variables.chatroomId], context.previousMessages);
      }
    },
    onSettled: (_, __, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      queryClient.invalidateQueries({ queryKey: ['lobbyChatroomCards'] });
    },
  });
}

export function useRemoveReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, chatroomId }: { messageId: string; emoji: string; chatroomId: string }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.removeReaction(messageId, emoji, userId);
    },
    onMutate: async ({ messageId, emoji, chatroomId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', chatroomId] });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithReactions[]>(['messages', chatroomId]);

      // Optimistically update
      if (previousMessages) {
        const userId = getUserId();
        queryClient.setQueryData<MessageWithReactions[]>(['messages', chatroomId], (old) => {
          if (!old) return old;
          return old.map((msg) => {
            if (msg.id === messageId) {
              const reactions = listToArray<Reaction>(msg.reactions);
              return {
                ...msg,
                reactions: reactions
                  .map((r) => {
                    if (r.emoji === emoji) {
                      const users = listToArray<string>(r.users);
                      return {
                        ...r,
                        count: r.count > BigInt(0) ? r.count - BigInt(1) : BigInt(0),
                        users: users.filter((u) => u !== userId).reduce((acc, u) => [u, acc], null as any),
                      };
                    }
                    return r;
                  })
                  .filter((r) => r.count > BigInt(0)) as any,
              };
            }
            return msg;
          });
        });
      }

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', variables.chatroomId], context.previousMessages);
      }
    },
    onSettled: (_, __, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      queryClient.invalidateQueries({ queryKey: ['lobbyChatroomCards'] });
    },
  });
}

// Reply preview query
export function useGetReplyPreview(chatroomId: bigint, messageId: string | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery({
    queryKey: ['replyPreview', chatroomId.toString(), messageId],
    queryFn: async () => {
      if (!actor || !messageId) return null;
      return actor.getReplyPreview(chatroomId, messageId);
    },
    enabled: !!actor && !actorFetching && !!messageId,
  });
}

// Admin mutations
export function useDeleteChatroom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatroomId, password }: { chatroomId: bigint; password: string }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.deleteChatroomWithPassword(chatroomId, password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      queryClient.invalidateQueries({ queryKey: ['lobbyChatroomCards'] });
      toast.success('Chatroom deleted successfully');
    },
    onError: (error: Error) => {
      if (error.message.includes('Unauthorized')) {
        toast.error('Invalid password or insufficient permissions');
      } else {
        toast.error('Failed to delete chatroom');
      }
    },
  });
}
