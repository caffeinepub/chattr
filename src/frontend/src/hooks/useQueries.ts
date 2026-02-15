import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Message, ChatroomWithLiveStatus, UserProfile, MessageWithReactions, Reaction } from '../backend';
import { toast } from 'sonner';
import { compressImage } from '../lib/imageCompression';

// Processed message type with array-based reactions for easier frontend use
export type ProcessedMessageWithReactions = Omit<MessageWithReactions, 'reactions'> & {
  reactions: Array<{
    emoji: string;
    count: bigint;
    users: string[];
  }>;
};

// Get username from localStorage or generate a random anonymous ID
function getUsername(): string {
  const stored = localStorage.getItem('chatUsername');
  if (stored) return stored;
  
  const randomId = Math.floor(1000 + Math.random() * 9000);
  const anonName = `Anon${randomId}`;
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

// Track recent chatroom creation to guard against transient empty results
let lastChatroomCreationTime = 0;
const POST_CREATE_GUARD_WINDOW = 3000; // 3 seconds

function isInPostCreateWindow(): boolean {
  return Date.now() - lastChatroomCreationTime < POST_CREATE_GUARD_WINDOW;
}

function markChatroomCreated(): void {
  lastChatroomCreationTime = Date.now();
}

// Chatroom queries
export function useGetChatrooms() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();

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
      
      // Guard against transient empty results during post-create window
      if (chatrooms.length === 0 && isInPostCreateWindow()) {
        const previousData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms']);
        if (previousData && previousData.length > 0) {
          console.warn('[useGetChatrooms] Rejecting empty result during post-create window, keeping previous data');
          throw new Error('Transient empty result rejected');
        }
      }
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 5000,
    retry: (failureCount, error) => {
      // Don't retry transient empty result errors
      if (error.message === 'Transient empty result rejected') {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: 1000,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
  });
}

export function useSearchChatrooms(searchTerm: string) {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['chatrooms', 'search', searchTerm],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useSearchChatrooms] Actor not available');
        throw new Error('Actor not available');
      }
      
      let chatrooms: ChatroomWithLiveStatus[];
      
      if (!searchTerm.trim()) {
        chatrooms = await actor.getChatrooms();
      } else {
        chatrooms = await actor.searchChatrooms(searchTerm.trim());
      }
      
      // Guard against transient empty results during post-create window
      if (chatrooms.length === 0 && isInPostCreateWindow()) {
        const previousData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms', 'search', searchTerm]);
        if (previousData && previousData.length > 0) {
          console.warn('[useSearchChatrooms] Rejecting empty result during post-create window, keeping previous data');
          throw new Error('Transient empty result rejected');
        }
      }
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
    },
    enabled: !!actor && !actorFetching,
    retry: (failureCount, error) => {
      if (error.message === 'Transient empty result rejected') {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useFilterChatroomsByCategory(category: string) {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['chatrooms', 'category', category],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useFilterChatroomsByCategory] Actor not available');
        throw new Error('Actor not available');
      }
      
      let chatrooms: ChatroomWithLiveStatus[];
      
      if (!category.trim()) {
        chatrooms = await actor.getChatrooms();
      } else {
        chatrooms = await actor.filterChatroomsByCategory(category.trim());
      }
      
      // Guard against transient empty results during post-create window
      if (chatrooms.length === 0 && isInPostCreateWindow()) {
        const previousData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms', 'category', category]);
        if (previousData && previousData.length > 0) {
          console.warn('[useFilterChatroomsByCategory] Rejecting empty result during post-create window, keeping previous data');
          throw new Error('Transient empty result rejected');
        }
      }
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
    },
    enabled: !!actor && !actorFetching,
    retry: (failureCount, error) => {
      if (error.message === 'Transient empty result rejected') {
        return false;
      }
      return failureCount < 3;
    },
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
    onSuccess: () => {
      // Mark that we just created a chatroom to activate the guard window
      markChatroomCreated();
      
      // Invalidate all chatroom queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      
      toast.success('Chat created successfully');
    },
    onError: (error: Error) => {
      console.error('[CreateChatroom] Error:', error);
      toast.error(error.message || 'Failed to create chat');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      toast.success('Chatroom deleted successfully');
    },
    onError: (error: Error) => {
      console.error('[DeleteChatroom] Error:', error);
      toast.error(error.message || 'Failed to delete chatroom');
    },
  });
}

export function useDeleteAllChatrooms() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      console.log('[DeleteAllChatrooms] Deleting all chatrooms');
      
      await actor.deleteAllChatrooms();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      toast.success('All chatrooms deleted successfully');
    },
    onError: (error: Error) => {
      console.error('[DeleteAllChatrooms] Error:', error);
      toast.error(error.message || 'Failed to delete all chatrooms');
    },
  });
}

// Message queries - Returns processed messages with array-based reactions
export function useGetMessages(chatroomId: bigint) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ProcessedMessageWithReactions[]>({
    queryKey: ['messages', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      
      const messages = await actor.getMessageWithReactionsAndReplies(chatroomId);
      
      return messages.map(msg => ({
        ...msg,
        reactions: listToArray<Reaction>(msg.reactions).map(reaction => ({
          emoji: reaction.emoji,
          count: reaction.count,
          users: listToArray<string>(reaction.users),
        })),
      }));
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 3000,
  });
}

// Shared image upload function with compression and progress tracking
export async function uploadImage(
  file: File,
  onProgress?: (percentage: number) => void
): Promise<string> {
  try {
    // Compress the image before uploading
    const compressedBlob = await compressImage(file);
    
    // Convert blob to array buffer
    const arrayBuffer = await compressedBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Store in localStorage with progress tracking
    const base64 = btoa(String.fromCharCode(...uint8Array));
    const dataUrl = `data:${compressedBlob.type};base64,${base64}`;
    
    // Simulate progress for localStorage operation
    if (onProgress) {
      onProgress(50);
    }
    
    // Store with a unique key
    const storageKey = `uploaded_image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, dataUrl);
    
    if (onProgress) {
      onProgress(100);
    }
    
    return dataUrl;
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image');
  }
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
      replyToMessageId?: bigint;
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
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message');
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

export function usePinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { chatroomId: bigint; messageId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.pinVideo(params.chatroomId, params.messageId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', variables.chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      toast.success('Video pinned successfully');
    },
    onError: (error: Error) => {
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
      await actor.unpinVideo(chatroomId);
    },
    onSuccess: (_, chatroomId) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      toast.success('Video unpinned successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unpin video');
    },
  });
}

// User profile queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error('Actor not available');
      await actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      toast.success('Profile saved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save profile');
    },
  });
}

// Helper hooks for username and avatar
export function useGetCurrentUsername() {
  return useQuery<string>({
    queryKey: ['currentUsername'],
    queryFn: () => getUsername(),
    staleTime: Infinity,
  });
}

export function useGetCurrentAvatar() {
  return useQuery<string | null>({
    queryKey: ['currentAvatar'],
    queryFn: () => getAvatarUrl(),
    staleTime: Infinity,
  });
}

export function useUpdateUsername() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      localStorage.setItem('chatUsername', newUsername);
      
      await actor.updateUsernameRetroactively(userId, newUsername);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUsername'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Username updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update username');
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
      
      if (newAvatarUrl) {
        localStorage.setItem('chatAvatarUrl', newAvatarUrl);
      } else {
        localStorage.removeItem('chatAvatarUrl');
      }
      
      await actor.updateAvatarRetroactively(userId, newAvatarUrl || null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentAvatar'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
      toast.success('Avatar updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update avatar');
    },
  });
}

// Reaction mutations
export function useAddReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { messageId: bigint; emoji: string; chatroomId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      await actor.addReaction(params.messageId, params.emoji, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId.toString()] });
    },
  });
}

export function useRemoveReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { messageId: bigint; emoji: string; chatroomId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      await actor.removeReaction(params.messageId, params.emoji, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId.toString()] });
    },
  });
}
