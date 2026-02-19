import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { 
  LobbyChatroomCard, 
  MessageWithReactions, 
  ChatroomWithLiveStatus,
  UserProfile,
  ReplyPreview
} from '../backend';

// Helper to get user ID from localStorage
function getUserId(): string {
  let userId = localStorage.getItem('chatUserId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatUserId', userId);
  }
  return userId;
}

// Helper to get username from localStorage
function getUsername(): string {
  return localStorage.getItem('chatUsername') || 'Anonymous';
}

// Helper to get avatar URL from localStorage
function getAvatarUrl(): string | null {
  return localStorage.getItem('chatAvatarUrl') || null;
}

// Image upload helper
export async function uploadImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    };
    
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        
        // Compress image if needed
        const img = new Image();
        img.src = dataUrl;
        
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Calculate new dimensions (max 1920px)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        // Store in localStorage with blob-storage prefix
        const imageId = `blob-storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const storageKey = `image_${imageId}`;
        
        try {
          localStorage.setItem(storageKey, compressedDataUrl);
        } catch (e) {
          console.warn('[uploadImage] localStorage full, using data URL directly');
        }
        
        if (onProgress) {
          onProgress(100);
        }
        
        const blobStorageUrl = `data:image/jpeg;blob-storage-id=${imageId};base64,${compressedDataUrl.split(',')[1]}`;
        resolve(blobStorageUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

// Chatroom queries
export function useGetLobbyChatroomCards() {
  const { actor, isFetching } = useActor();

  return useQuery<LobbyChatroomCard[]>({
    queryKey: ['chatrooms'],
    queryFn: async () => {
      if (!actor) return [];
      const cards = await actor.getLobbyChatroomCards();
      return cards;
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useGetChatrooms() {
  const { actor, isFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus[]>({
    queryKey: ['chatrooms-all'],
    queryFn: async () => {
      if (!actor) return [];
      const chatrooms = await actor.getChatrooms();
      return chatrooms;
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

export function useGetChatroom(chatroomId: bigint | undefined) {
  const { actor, isFetching } = useActor();

  return useQuery<ChatroomWithLiveStatus | null>({
    queryKey: ['chatroom', chatroomId?.toString()],
    queryFn: async () => {
      if (!actor || chatroomId === undefined) return null;
      const chatroom = await actor.getChatroom(chatroomId);
      return chatroom;
    },
    enabled: !!actor && !isFetching && chatroomId !== undefined,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateChatroom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      topic,
      description,
      mediaUrl,
      mediaType,
      category,
    }: {
      topic: string;
      description: string;
      mediaUrl: string;
      mediaType: string;
      category: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.createChatroom(topic, description, mediaUrl, mediaType, category);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['chatrooms'], type: 'all' });
    },
  });
}

// Message queries
export function useGetMessages(chatroomId: bigint | undefined) {
  const { actor, isFetching } = useActor();

  return useQuery<MessageWithReactions[]>({
    queryKey: ['messages', chatroomId?.toString()],
    queryFn: async () => {
      if (!actor || chatroomId === undefined) return [];
      const messages = await actor.getMessageWithReactionsAndReplies(chatroomId);
      return messages;
    },
    enabled: !!actor && !isFetching && chatroomId !== undefined,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });
}

export function useSendMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      chatroomId,
      mediaUrl,
      mediaType,
      replyToMessageId,
    }: {
      content: string;
      chatroomId: bigint;
      mediaUrl?: string;
      mediaType?: string;
      replyToMessageId?: bigint;
    }) => {
      if (!actor) throw new Error('Actor not available');
      
      const sender = getUsername();
      const senderId = getUserId();
      const avatarUrl = getAvatarUrl();
      
      await actor.sendMessage(
        content,
        sender,
        chatroomId,
        mediaUrl || null,
        mediaType || null,
        avatarUrl,
        senderId,
        replyToMessageId || null
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['messages', variables.chatroomId.toString()] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['chatroom', variables.chatroomId.toString()] 
      });
    },
  });
}

// View count
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

// Pin/Unpin video
export function usePinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatroomId, messageId }: { chatroomId: bigint; messageId: bigint }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.pinVideo(chatroomId, messageId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['chatroom', variables.chatroomId.toString()] 
      });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['chatroom', variables.toString()] 
      });
    },
  });
}

// Reactions
export function useAddReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      messageId, 
      emoji,
      chatroomId 
    }: { 
      messageId: bigint; 
      emoji: string;
      chatroomId: bigint;
    }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.addReaction(messageId, emoji, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['messages', variables.chatroomId.toString()] 
      });
    },
  });
}

export function useRemoveReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      messageId, 
      emoji,
      chatroomId 
    }: { 
      messageId: bigint; 
      emoji: string;
      chatroomId: bigint;
    }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.removeReaction(messageId, emoji, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['messages', variables.chatroomId.toString()] 
      });
    },
  });
}

// Username and avatar management hooks
export function useCurrentUsername() {
  return getUsername();
}

export function useUpdateUsername() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      const oldUsername = getUsername();
      localStorage.setItem('chatUsername', newUsername);
      
      if (actor && oldUsername !== newUsername) {
        const senderId = getUserId();
        await actor.updateUsernameRetroactively(senderId, newUsername);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useCurrentAvatar() {
  return getAvatarUrl();
}

export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  const { actor } = useActor();

  return useMutation({
    mutationFn: async (newAvatarUrl: string | null) => {
      const oldAvatarUrl = getAvatarUrl();
      
      if (newAvatarUrl) {
        localStorage.setItem('chatAvatarUrl', newAvatarUrl);
      } else {
        localStorage.removeItem('chatAvatarUrl');
      }
      
      if (actor && oldAvatarUrl !== newAvatarUrl) {
        const senderId = getUserId();
        await actor.updateAvatarRetroactively(senderId, newAvatarUrl);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

// Reply preview
export function useGetReplyPreview(chatroomId: bigint | undefined, messageId: bigint | undefined) {
  const { actor, isFetching } = useActor();

  return useQuery<ReplyPreview | null>({
    queryKey: ['replyPreview', chatroomId?.toString(), messageId?.toString()],
    queryFn: async () => {
      if (!actor || chatroomId === undefined || messageId === undefined) return null;
      const preview = await actor.getReplyPreview(chatroomId, messageId);
      return preview;
    },
    enabled: !!actor && !isFetching && chatroomId !== undefined && messageId !== undefined,
  });
}

// Delete chatroom (admin)
export function useDeleteChatroom() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatroomId, password }: { chatroomId: bigint; password: string }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.deleteChatroomWithPassword(chatroomId, password);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['chatrooms'], type: 'all' });
      queryClient.refetchQueries({ queryKey: ['chatrooms-all'], type: 'all' });
    },
  });
}
