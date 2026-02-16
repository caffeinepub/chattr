import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Message, ChatroomWithLiveStatus, UserProfile, MessageWithReactions, Reaction } from '../backend';
import { toast } from 'sonner';
import { compressImage } from '../lib/imageCompression';

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

// Normalize query key: empty/whitespace search or category should use base key
function normalizeChatroomQueryKey(type: 'search' | 'category', value: string): readonly unknown[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return ['chatrooms'];
  }
  return ['chatrooms', type, trimmed];
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
    refetchOnMount: 'always', // Always refetch on mount to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnReconnect: true, // Refetch when network reconnects
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

  const trimmedSearchTerm = searchTerm.trim();
  const queryKey = normalizeChatroomQueryKey('search', searchTerm);

  // If search term is empty, don't execute this query - let the base query handle it
  const shouldExecute = !!trimmedSearchTerm;

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey,
    queryFn: async () => {
      if (!actor) {
        console.warn('[useSearchChatrooms] Actor not available');
        throw new Error('Actor not available');
      }
      
      // This should never be called with empty search term due to enabled condition
      if (!trimmedSearchTerm) {
        console.warn('[useSearchChatrooms] Called with empty search term, returning empty array');
        return [];
      }
      
      const chatrooms = await actor.searchChatrooms(trimmedSearchTerm);
      
      // Guard against transient empty results during post-create window
      if (chatrooms.length === 0 && isInPostCreateWindow()) {
        const previousData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(queryKey);
        if (previousData && previousData.length > 0) {
          console.warn('[useSearchChatrooms] Rejecting empty result during post-create window, keeping previous data');
          throw new Error('Transient empty result rejected');
        }
      }
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
    },
    enabled: !!actor && !actorFetching && shouldExecute,
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

  const trimmedCategory = category.trim();
  const queryKey = normalizeChatroomQueryKey('category', category);

  // If category is empty, don't execute this query - let the base query handle it
  const shouldExecute = !!trimmedCategory;

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey,
    queryFn: async () => {
      if (!actor) {
        console.warn('[useFilterChatroomsByCategory] Actor not available');
        throw new Error('Actor not available');
      }
      
      // This should never be called with empty category due to enabled condition
      if (!trimmedCategory) {
        console.warn('[useFilterChatroomsByCategory] Called with empty category, returning empty array');
        return [];
      }
      
      const chatrooms = await actor.filterChatroomsByCategory(trimmedCategory);
      
      // Guard against transient empty results during post-create window
      if (chatrooms.length === 0 && isInPostCreateWindow()) {
        const previousData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(queryKey);
        if (previousData && previousData.length > 0) {
          console.warn('[useFilterChatroomsByCategory] Rejecting empty result during post-create window, keeping previous data');
          throw new Error('Transient empty result rejected');
        }
      }
      
      return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
    },
    enabled: !!actor && !actorFetching && shouldExecute,
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
    onSuccess: async () => {
      // Mark that we just created a chatroom to activate the guard window
      markChatroomCreated();
      
      console.log('[CreateChatroom] Success, invalidating and refetching chatrooms...');
      
      // Invalidate entire chatrooms namespace (non-exact) to refresh all variants
      await queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      
      // Explicitly refetch the base chatrooms query to ensure it updates immediately
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'active' 
      });
      
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
    onSuccess: async () => {
      console.log('[DeleteChatroom] Success, invalidating and refetching chatrooms...');
      
      // Invalidate entire chatrooms namespace (non-exact) to refresh all variants
      await queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      
      // Explicitly refetch the base chatrooms query to ensure it updates immediately
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'active' 
      });
      
      toast.success('Chatroom deleted successfully');
    },
    onError: (error: Error) => {
      console.error('[DeleteChatroom] Error:', error);
      const errorMessage = error.message || 'Failed to delete chatroom';
      
      if (errorMessage.includes('Incorrect password')) {
        toast.error('Authentication failed');
      } else if (errorMessage.includes('does not exist')) {
        toast.error('Chatroom not found');
      } else if (errorMessage.includes('Unauthorized')) {
        toast.error('You do not have permission to delete chatrooms');
      } else {
        toast.error(errorMessage);
      }
    },
  });
}

// Increment view count when chatroom is accessed
export function useIncrementViewCount() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatroomId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.incrementViewCount(chatroomId, userId);
      return chatroomId;
    },
    onSuccess: (chatroomId) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', chatroomId.toString()] });
      // Invalidate entire chatrooms namespace (non-exact) to refresh all variants
      queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
    },
    onError: (error: Error) => {
      console.error('[IncrementViewCount] Error:', error);
    },
  });
}

/**
 * Upload image file with compression and return a data URL that includes blob-storage identifier
 * This is the canonical image upload function used across the app
 */
export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    console.log('[UploadImage] Starting upload for file:', file.name, 'size:', file.size, 'type:', file.type);
    
    // Check file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }
    
    if (onProgress) {
      onProgress(5);
    }
    
    // Attempt compression
    let processedFile = file;
    try {
      console.log('[UploadImage] Attempting compression...');
      processedFile = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
      }, (compressionProgress) => {
        // Map compression progress to 5-40% of total progress
        if (onProgress) {
          onProgress(5 + (compressionProgress * 0.35));
        }
      });
      console.log('[UploadImage] Compression complete, using', processedFile === file ? 'original' : 'compressed', 'file');
    } catch (compressionError) {
      console.warn('[UploadImage] Compression failed, using original file:', compressionError);
      // Continue with original file
    }
    
    if (onProgress) {
      onProgress(40);
    }
    
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(processedFile);
    });
    
    console.log('[UploadImage] File read as data URL, length:', dataUrl.length);
    
    if (onProgress) {
      onProgress(70);
    }
    
    const imageId = `blob-storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const storageKey = `image_${imageId}`;
    
    try {
      localStorage.setItem(storageKey, dataUrl);
      console.log('[UploadImage] Image stored in localStorage with key:', storageKey);
    } catch (e) {
      console.warn('[UploadImage] localStorage full, using data URL directly');
    }
    
    if (onProgress) {
      onProgress(100);
    }
    
    const blobStorageUrl = `data:${processedFile.type};blob-storage-id=${imageId};base64,${dataUrl.split(',')[1]}`;
    
    console.log('[UploadImage] Upload complete, blob-storage URL created');
    
    return blobStorageUrl;
  } catch (error) {
    console.error('[UploadImage] Error processing image:', error);
    throw error instanceof Error ? error : new Error('Failed to upload image');
  }
}

// Message queries - now using MessageWithReactions
export function useGetMessages(chatroomId: bigint) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<MessageWithReactions[]>({
    queryKey: ['messages', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useGetMessages] Actor not available');
        return [];
      }
      
      try {
        const messages = await actor.getMessageWithReactionsAndReplies(chatroomId);
        const sortedMessages = messages.sort((a, b) => Number(a.timestamp - b.timestamp));
        return sortedMessages;
      } catch (error) {
        console.error('[useGetMessages] Error fetching messages:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 3000,
    retry: 3,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { content: string; chatroomId: bigint; mediaUrl?: string; mediaType?: string; replyToMessageId?: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      const username = getUsername();
      const userId = getUserId();
      const avatarUrl = getAvatarUrl();
      
      console.log('[SendMessage] Sending message:', {
        content: params.content,
        chatroomId: params.chatroomId.toString(),
        hasMedia: !!params.mediaUrl,
        mediaType: params.mediaType,
        replyToMessageId: params.replyToMessageId?.toString(),
      });
      
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
      
      return { userId, chatroomId: params.chatroomId };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatroom', variables.chatroomId.toString()] });
      // Invalidate entire chatrooms namespace (non-exact) to refresh all variants
      queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message');
    },
  });
}

// Pin/unpin video
export function usePinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { chatroomId: bigint; messageId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.pinVideo(params.chatroomId, params.messageId);
      return params.chatroomId;
    },
    onSuccess: (chatroomId) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['messages', chatroomId.toString()] });
      toast.success('Video pinned');
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
      return chatroomId;
    },
    onSuccess: (chatroomId) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['messages', chatroomId.toString()] });
      toast.success('Video unpinned');
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

  // Return custom state that properly reflects actor dependency
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
      toast.success('Profile saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save profile');
    },
  });
}

// Username management - localStorage-based hooks for anonymous users
export function useGetCurrentUsername() {
  return useQuery<string>({
    queryKey: ['currentUsername'],
    queryFn: () => {
      return getUsername();
    },
    staleTime: Infinity, // Username doesn't change unless explicitly updated
  });
}

export function useUpdateUsername() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      
      // Update backend
      await actor.updateUsernameRetroactively(userId, newUsername);
      
      // Update localStorage
      localStorage.setItem('chatUsername', newUsername);
      
      return newUsername;
    },
    onSuccess: () => {
      // Invalidate username query and all message queries to show updated username
      queryClient.invalidateQueries({ queryKey: ['currentUsername'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Username updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update username');
    },
  });
}

// Avatar management - localStorage-based hooks for anonymous users
export function useGetCurrentAvatar() {
  return useQuery<string | null>({
    queryKey: ['currentAvatar'],
    queryFn: () => {
      return getAvatarUrl();
    },
    staleTime: Infinity, // Avatar doesn't change unless explicitly updated
  });
}

export function useUpdateAvatar() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newAvatarUrl: string | null) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      
      // Update backend
      await actor.updateAvatarRetroactively(userId, newAvatarUrl);
      
      // Update localStorage
      if (newAvatarUrl) {
        localStorage.setItem('chatAvatarUrl', newAvatarUrl);
      } else {
        localStorage.removeItem('chatAvatarUrl');
      }
      
      return newAvatarUrl;
    },
    onSuccess: () => {
      // Invalidate avatar query and all message queries to show updated avatar
      queryClient.invalidateQueries({ queryKey: ['currentAvatar'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
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
      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({ queryKey: ['messages', params.chatroomId.toString()] });
    },
    onError: (error: Error) => {
      console.error('[AddReaction] Error:', error);
      toast.error('Failed to add reaction');
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
      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({ queryKey: ['messages', params.chatroomId.toString()] });
    },
    onError: (error: Error) => {
      console.error('[RemoveReaction] Error:', error);
      toast.error('Failed to remove reaction');
    },
  });
}

// Reply preview query
export function useGetReplyPreview(chatroomId: bigint, messageId: bigint | null) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery({
    queryKey: ['replyPreview', chatroomId.toString(), messageId?.toString()],
    queryFn: async () => {
      if (!actor || !messageId) return null;
      return actor.getReplyPreview(chatroomId, messageId);
    },
    enabled: !!actor && !actorFetching && !!messageId,
    staleTime: 60000, // Reply previews don't change often
  });
}
