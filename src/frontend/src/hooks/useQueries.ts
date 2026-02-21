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

export function useGetArchivedChatrooms() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['archivedChatrooms'],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useGetArchivedChatrooms] Actor not available');
        throw new Error('Actor not available');
      }
      
      console.log('[useGetArchivedChatrooms] Fetching archived chatrooms...');
      const chatrooms = await actor.getArchivedChatrooms();
      console.log('[useGetArchivedChatrooms] Fetched archived chatrooms:', chatrooms.length);
      
      return chatrooms;
    },
    enabled: !!actor && !actorFetching,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10000,
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000,
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
      
      await queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      
      await queryClient.refetchQueries({ 
        queryKey: ['chatrooms'], 
        exact: true,
        type: 'all'
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
      queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
    },
    onError: (error: Error) => {
      console.error('[IncrementViewCount] Error:', error);
    },
  });
}

export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    console.log('[UploadImage] Starting upload for file:', file.name, 'size:', file.size, 'type:', file.type);
    
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }
    
    if (onProgress) {
      onProgress(5);
    }
    
    let processedFile = file;
    try {
      console.log('[UploadImage] Attempting compression...');
      processedFile = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
      }, (compressionProgress) => {
        if (onProgress) {
          onProgress(5 + (compressionProgress * 0.35));
        }
      });
      console.log('[UploadImage] Compression complete, using', processedFile === file ? 'original' : 'compressed', 'file');
    } catch (compressionError) {
      console.warn('[UploadImage] Compression failed, using original file:', compressionError);
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
      queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to send message';
      if (errorMessage.includes('archived')) {
        toast.error('This room is archived and read-only');
      } else {
        toast.error(errorMessage);
      }
    },
  });
}

export function usePinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatroomId, messageId }: { chatroomId: bigint; messageId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.pinVideo(chatroomId, messageId);
      return chatroomId;
    },
    onSuccess: (chatroomId) => {
      queryClient.invalidateQueries({ queryKey: ['chatroom', chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['messages', chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      toast.success('Video pinned successfully');
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to pin video';
      if (errorMessage.includes('archived')) {
        toast.error('Cannot pin videos in archived rooms');
      } else {
        toast.error(errorMessage);
      }
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
      queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      toast.success('Video unpinned successfully');
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to unpin video';
      if (errorMessage.includes('archived')) {
        toast.error('Cannot unpin videos in archived rooms');
      } else {
        toast.error(errorMessage);
      }
    },
  });
}

export function useAddReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, chatroomId }: { messageId: bigint; emoji: string; chatroomId: string }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.addReaction(messageId, emoji, userId);
      return { messageId, chatroomId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages', data.chatroomId] });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to add reaction';
      if (errorMessage.includes('archived')) {
        toast.error('Cannot add reactions in archived rooms');
      } else {
        toast.error(errorMessage);
      }
    },
  });
}

export function useRemoveReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji, chatroomId }: { messageId: bigint; emoji: string; chatroomId: string }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.removeReaction(messageId, emoji, userId);
      return { messageId, chatroomId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['messages', data.chatroomId] });
    },
    onError: (error: Error) => {
      const errorMessage = error.message || 'Failed to remove reaction';
      if (errorMessage.includes('archived')) {
        toast.error('Cannot remove reactions in archived rooms');
      } else {
        toast.error(errorMessage);
      }
    },
  });
}

export function useCurrentUsername() {
  return getUsername();
}

export function useCurrentAvatar() {
  return getAvatarUrl();
}

export function useUpdateUsername() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      if (!actor) throw new Error('Actor not available');
      
      const trimmedUsername = newUsername.trim();
      
      if (trimmedUsername.length === 0) {
        throw new Error('Username cannot be empty');
      }
      
      if (trimmedUsername.length > 15) {
        throw new Error('Username must be 15 characters or less');
      }
      
      const alphanumericRegex = /^[A-Za-z0-9]+$/;
      if (!alphanumericRegex.test(trimmedUsername)) {
        throw new Error('Username must contain only letters and numbers');
      }
      
      const oldUsername = getUsername();
      const userId = getUserId();
      
      localStorage.setItem('chatUsername', trimmedUsername);
      
      try {
        await actor.updateUsernameRetroactively(userId, trimmedUsername);
      } catch (error: any) {
        localStorage.setItem('chatUsername', oldUsername);
        
        if (error.message && error.message.includes('already exists')) {
          throw new Error('This username is already taken. Please choose another one.');
        }
        
        throw error;
      }
      
      return trimmedUsername;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'], exact: false });
      toast.success('Username updated successfully');
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
      
      await actor.updateAvatarRetroactively(userId, newAvatarUrl);
      
      return newAvatarUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'], exact: false });
      toast.success('Avatar updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update avatar');
    },
  });
}
