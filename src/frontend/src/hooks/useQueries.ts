import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Message, ChatroomWithLiveStatus, UserProfile, MessageWithReactions, Reaction } from '../backend';
import { toast } from 'sonner';

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

// Chatroom queries
export function useGetChatrooms() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['chatrooms'],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useGetChatrooms] Actor not available');
        return [];
      }
      
      try {
        console.log('[useGetChatrooms] Fetching chatrooms...');
        const chatrooms = await actor.getChatrooms();
        console.log('[useGetChatrooms] Fetched chatrooms:', chatrooms.length);
        return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
      } catch (error) {
        console.error('[useGetChatrooms] Error fetching chatrooms:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    refetchInterval: 5000,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useSearchChatrooms(searchTerm: string) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['chatrooms', 'search', searchTerm],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useSearchChatrooms] Actor not available');
        return [];
      }
      
      try {
        if (!searchTerm.trim()) {
          const chatrooms = await actor.getChatrooms();
          return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
        }
        
        const chatrooms = await actor.searchChatrooms(searchTerm.trim());
        return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
      } catch (error) {
        console.error('[useSearchChatrooms] Error searching chatrooms:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useFilterChatroomsByCategory(category: string) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['chatrooms', 'category', category],
    queryFn: async () => {
      if (!actor) {
        console.warn('[useFilterChatroomsByCategory] Actor not available');
        return [];
      }
      
      try {
        if (!category.trim()) {
          const chatrooms = await actor.getChatrooms();
          return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
        }
        
        const chatrooms = await actor.filterChatroomsByCategory(category.trim());
        return chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
      } catch (error) {
        console.error('[useFilterChatroomsByCategory] Error filtering chatrooms:', error);
        return [];
      }
    },
    enabled: !!actor && !actorFetching,
    retry: 3,
    retryDelay: 1000,
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
      
      try {
        console.log('[useGetChatroom] Fetching chatroom:', chatroomId.toString(), 'from deep link');
        const chatroom = await actor.getChatroom(chatroomId);
        console.log('[useGetChatroom] Fetched chatroom:', chatroom ? 'found' : 'not found', chatroom);
        return chatroom;
      } catch (error) {
        console.error('[useGetChatroom] Error fetching chatroom:', error);
        throw error;
      }
    },
    enabled: !!actor && !actorFetching,
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
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
      toast.success('Chat created successfully');
    },
    onError: (error: Error) => {
      console.error('[CreateChatroom] Error:', error);
      toast.error(error.message || 'Failed to create chat');
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
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
    },
    onError: (error: Error) => {
      console.error('[IncrementViewCount] Error:', error);
    },
  });
}

// Upload image file and return a data URL that includes blob-storage identifier
export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    console.log('[UploadImage] Starting upload for file:', file.name, 'size:', file.size, 'type:', file.type);
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }
    
    if (onProgress) {
      onProgress(10);
    }
    
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    console.log('[UploadImage] File read as data URL, length:', dataUrl.length);
    
    if (onProgress) {
      onProgress(50);
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
    
    const blobStorageUrl = `data:${file.type};blob-storage-id=${imageId};base64,${dataUrl.split(',')[1]}`;
    
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
      queryClient.invalidateQueries({ queryKey: ['chatrooms'] });
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

// Username management with retroactive backend updates
export function useUpdateUsername() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      if (!newUsername.trim()) {
        throw new Error('Username cannot be empty');
      }
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      const oldUsername = getUsername();
      
      // Update username in localStorage
      localStorage.setItem('chatUsername', newUsername.trim());
      
      // Get current profile from backend or create new one
      const currentProfile = await actor.getCallerUserProfile();
      const avatarUrl = getAvatarUrl();
      
      // Save updated profile to backend
      const updatedProfile: UserProfile = {
        name: newUsername.trim(),
        anonId: userId,
        avatarUrl: avatarUrl || undefined,
        presetAvatar: currentProfile?.presetAvatar || undefined,
      };
      
      await actor.saveCallerUserProfile(updatedProfile);
      
      // Call backend to retroactively update all messages
      await actor.updateUsernameRetroactively(userId, newUsername.trim());
      
      return { oldUsername, newUsername: newUsername.trim() };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['currentUsername'] });
      toast.success('Username updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update username');
    },
  });
}

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

export function useUpdateAvatar() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { avatarUrl: string | null; isPreset: boolean }) => {
      if (!actor) throw new Error('Actor not available');
      
      const userId = getUserId();
      const username = getUsername();
      
      // Update localStorage
      if (params.avatarUrl) {
        localStorage.setItem('chatAvatarUrl', params.avatarUrl);
      } else {
        localStorage.removeItem('chatAvatarUrl');
      }
      
      // Get current profile or create new one
      const currentProfile = await actor.getCallerUserProfile();
      
      // Save updated profile to backend
      const updatedProfile: UserProfile = {
        name: username,
        anonId: userId,
        avatarUrl: params.avatarUrl || undefined,
        presetAvatar: params.isPreset && params.avatarUrl ? params.avatarUrl : undefined,
      };
      
      await actor.saveCallerUserProfile(updatedProfile);
      
      // Retroactively update all messages with new avatar
      await actor.updateAvatarRetroactively(userId, params.avatarUrl);
      
      return params.avatarUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentAvatar'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Avatar updated successfully');
    },
    onError: (error: Error) => {
      console.error('[UpdateAvatar] Error:', error);
      toast.error(error.message || 'Failed to update avatar');
    },
  });
}

// Reaction management with optimistic updates
export function useAddReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { messageId: bigint; emoji: string; chatroomId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.addReaction(params.messageId, params.emoji, userId);
      return { ...params, userId };
    },
    onMutate: async (params) => {
      const userId = getUserId();
      const queryKey = ['messages', params.chatroomId.toString()];
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithReactions[]>(queryKey);
      
      // Optimistically update
      if (previousMessages) {
        queryClient.setQueryData<MessageWithReactions[]>(queryKey, (old) => {
          if (!old) return old;
          
          return old.map((msg) => {
            if (msg.id === params.messageId) {
              const reactions = listToArray<Reaction>(msg.reactions);
              const existingReaction = reactions.find((r) => r.emoji === params.emoji);
              
              let updatedReactions: Reaction[];
              if (existingReaction) {
                const users = listToArray<string>(existingReaction.users);
                if (!users.includes(userId)) {
                  updatedReactions = reactions.map((r) =>
                    r.emoji === params.emoji
                      ? { ...r, count: r.count + 1n, users: [userId, r.users] as any }
                      : r
                  );
                } else {
                  updatedReactions = reactions;
                }
              } else {
                updatedReactions = [
                  ...reactions,
                  { emoji: params.emoji, count: 1n, users: [userId, null] as any },
                ];
              }
              
              // Convert back to List format
              let reactionsList: any = null;
              for (let i = updatedReactions.length - 1; i >= 0; i--) {
                reactionsList = [updatedReactions[i], reactionsList];
              }
              
              return { ...msg, reactions: reactionsList };
            }
            return msg;
          });
        });
      }
      
      return { previousMessages };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ['messages', params.chatroomId.toString()],
          context.previousMessages
        );
      }
      toast.error('Failed to add reaction');
    },
    onSettled: (data, error, params) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['messages', params.chatroomId.toString()] });
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
      return { ...params, userId };
    },
    onMutate: async (params) => {
      const userId = getUserId();
      const queryKey = ['messages', params.chatroomId.toString()];
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<MessageWithReactions[]>(queryKey);
      
      // Optimistically update
      if (previousMessages) {
        queryClient.setQueryData<MessageWithReactions[]>(queryKey, (old) => {
          if (!old) return old;
          
          return old.map((msg) => {
            if (msg.id === params.messageId) {
              const reactions = listToArray<Reaction>(msg.reactions);
              const updatedReactions = reactions
                .map((r) => {
                  if (r.emoji === params.emoji) {
                    const users = listToArray<string>(r.users);
                    const filteredUsers = users.filter((u) => u !== userId);
                    
                    // Convert back to List format
                    let usersList: any = null;
                    for (let i = filteredUsers.length - 1; i >= 0; i--) {
                      usersList = [filteredUsers[i], usersList];
                    }
                    
                    return {
                      ...r,
                      count: r.count > 0n ? r.count - 1n : 0n,
                      users: usersList,
                    };
                  }
                  return r;
                })
                .filter((r) => r.count > 0n);
              
              // Convert back to List format
              let reactionsList: any = null;
              for (let i = updatedReactions.length - 1; i >= 0; i--) {
                reactionsList = [updatedReactions[i], reactionsList];
              }
              
              return { ...msg, reactions: reactionsList };
            }
            return msg;
          });
        });
      }
      
      return { previousMessages };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ['messages', params.chatroomId.toString()],
          context.previousMessages
        );
      }
      toast.error('Failed to remove reaction');
    },
    onSettled: (data, error, params) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['messages', params.chatroomId.toString()] });
    },
  });
}

// Fetch Twitch thumbnail
export function useFetchTwitchThumbnail() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (url: string) => {
      if (!actor) throw new Error('Actor not available');
      
      // Extract clip slug or video ID
      const clipMatch = url.match(/clips\.twitch\.tv\/([^/?]+)/);
      const videoMatch = url.match(/twitch\.tv\/videos\/(\d+)/);
      
      if (clipMatch) {
        return actor.fetchTwitchThumbnail(clipMatch[1]);
      } else if (videoMatch) {
        // For VODs, construct thumbnail URL
        return `https://static-cdn.jtvnw.net/cf_vods/${videoMatch[1]}/thumb/thumb0-640x360.jpg`;
      }
      
      return null;
    },
  });
}

// Fetch Twitter oEmbed
export function useFetchTwitterOEmbed() {
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (tweetUrl: string) => {
      if (!actor) throw new Error('Actor not available');
      return actor.fetchTwitterOEmbed(tweetUrl);
    },
  });
}

