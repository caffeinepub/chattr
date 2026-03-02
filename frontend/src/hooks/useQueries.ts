import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { Message, UserProfile } from '../backend';
import { compressImage } from '../lib/imageCompression';

// ─── Username / Avatar (localStorage) ────────────────────────────────────────

function generateUsername(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getUsername(): string {
  const stored = localStorage.getItem('chatUsername');
  if (stored) return stored;
  const anonName = generateUsername();
  localStorage.setItem('chatUsername', anonName);
  return anonName;
}

export function getUserId(): string {
  let userId = localStorage.getItem('chatUserId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatUserId', userId);
  }
  return userId;
}

function getAvatarUrl(): string | null {
  return localStorage.getItem('chatAvatarUrl');
}

export function useCurrentUsername(): string {
  return getUsername();
}

export function useCurrentAvatar(): string | null {
  return getAvatarUrl();
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }

    if (onProgress) onProgress(5);

    let processedFile = file;
    try {
      processedFile = await compressImage(
        file,
        { maxWidth: 1920, maxHeight: 1920, quality: 0.85 },
        (compressionProgress) => {
          if (onProgress) onProgress(5 + compressionProgress * 0.35);
        }
      );
    } catch {
      // fall back to original
    }

    if (onProgress) onProgress(40);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(processedFile);
    });

    if (onProgress) onProgress(70);

    const imageId = `blob-storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const storageKey = `image_${imageId}`;
    try {
      localStorage.setItem(storageKey, dataUrl);
    } catch {
      // localStorage full, continue
    }

    if (onProgress) onProgress(100);

    return `data:${processedFile.type};blob-storage-id=${imageId};base64,${dataUrl.split(',')[1]}`;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to upload image');
  }
}

// ─── Normalize query keys ─────────────────────────────────────────────────────

function normalizeSearchQueryKey(searchTerm: string): readonly unknown[] {
  const trimmed = searchTerm.trim();
  if (!trimmed) return ['chatrooms'];
  return ['chatrooms', 'search', trimmed];
}

function normalizeCategoryQueryKey(category: string): readonly unknown[] {
  const trimmed = category.trim();
  if (!trimmed) return ['chatrooms', 'category', '__none__'];
  return ['chatrooms', 'category', trimmed];
}

// ─── Chatroom queries ─────────────────────────────────────────────────────────

export function useGetChatrooms() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery({
    queryKey: ['chatrooms'],
    queryFn: async () => {
      if (!actor) {
        throw new Error('Actor not available');
      }
      return actor.getLobbyChatroomCards();
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

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      if (!trimmedSearchTerm) return [];
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

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      if (!trimmedCategory) return [];
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

  return useQuery({
    queryKey: ['chatroom', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) {
        throw new Error('Backend connection not available');
      }
      const chatroom = await actor.getChatroom(chatroomId);
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['chatrooms'], exact: true, type: 'all' });
    },
    onError: (error: Error) => {
      console.error('[CreateChatroom] Error:', error);
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
      await actor.deleteChatroomWithPassword(chatroomId, password);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['chatrooms'], exact: true, type: 'all' });
    },
    onError: (error: Error) => {
      console.error('[DeleteChatroom] Error:', error);
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

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useGetMessages(chatroomId: bigint) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery({
    queryKey: ['messages', chatroomId.toString()],
    queryFn: async () => {
      if (!actor) {
        return [];
      }
      try {
        const messages = await actor.getMessageWithReactionsAndReplies(chatroomId);
        return messages.sort((a, b) => Number(a.timestamp - b.timestamp));
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
        params.mediaUrl ?? null,
        params.mediaType ?? null,
        avatarUrl,
        userId,
        params.replyToMessageId ?? null
      );

      return { userId, chatroomId: params.chatroomId };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatroom', variables.chatroomId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: false });
    },
    onError: (error: Error) => {
      console.error('[SendMessage] Error:', error);
    },
  });
}

export function useDeleteMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: bigint) => {
      if (!actor) throw new Error('Actor not available');
      await actor.deleteMessage(messageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flaggedMessages'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error: Error) => {
      console.error('[DeleteMessage] Error:', error);
    },
  });
}

// ─── Report Message ───────────────────────────────────────────────────────────

export function useReportMessage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, reason }: { messageId: bigint; reason: string }) => {
      if (!actor) throw new Error('Actor not available');
      return actor.reportMessage(messageId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flaggedMessages'] });
    },
  });
}

// ─── Flagged Messages ─────────────────────────────────────────────────────────

export function useGetFlaggedMessages() {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<Message[]>({
    queryKey: ['flaggedMessages'],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getFlaggedMessages();
    },
    enabled: !!actor && !actorFetching,
  });
}

// Legacy alias
export { useGetFlaggedMessages as useFlaggedMessages };

// ─── Pinned Video ─────────────────────────────────────────────────────────────

export function useGetPinnedVideo(chatroomId: bigint, userId: string) {
  const { actor, isFetching: actorFetching } = useActor();

  return useQuery<bigint | null>({
    queryKey: ['pinnedVideo', chatroomId.toString(), userId],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPinnedVideo(chatroomId, userId);
    },
    enabled: !!actor && !actorFetching && !!userId,
  });
}

export function usePinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chatroomId,
      userId,
      messageId,
    }: {
      chatroomId: bigint;
      userId: string;
      messageId: bigint;
    }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.pinVideo(chatroomId, userId, messageId);
      return { chatroomId, userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['pinnedVideo', data.chatroomId.toString(), data.userId],
      });
    },
    onError: (error: Error) => {
      console.error('[PinVideo] Error:', error);
    },
  });
}

export function useUnpinVideo() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatroomId, userId }: { chatroomId: bigint; userId: string }) => {
      if (!actor) throw new Error('Actor not available');
      await actor.unpinVideo(chatroomId, userId);
      return { chatroomId, userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['pinnedVideo', data.chatroomId.toString(), data.userId],
      });
    },
    onError: (error: Error) => {
      console.error('[UnpinVideo] Error:', error);
    },
  });
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export function useAddReaction() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
      chatroomId,
    }: {
      messageId: bigint;
      emoji: string;
      chatroomId: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.addReaction(messageId, emoji, userId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId] });
    },
    onError: (error: Error) => {
      console.error('[AddReaction] Error:', error);
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
      chatroomId,
    }: {
      messageId: bigint;
      emoji: string;
      chatroomId: string;
    }) => {
      if (!actor) throw new Error('Actor not available');
      const userId = getUserId();
      await actor.removeReaction(messageId, emoji, userId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.chatroomId] });
    },
    onError: (error: Error) => {
      console.error('[RemoveReaction] Error:', error);
    },
  });
}

// ─── Username / Avatar update ─────────────────────────────────────────────────

export function useUpdateUsername() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newUsername: string) => {
      if (!actor) throw new Error('Actor not available');

      const alphanumericRegex = /^[A-Za-z0-9]+$/;
      if (!alphanumericRegex.test(newUsername)) {
        throw new Error('Username must contain only letters and numbers');
      }
      if (newUsername.length > 15) {
        throw new Error('Username must be 15 characters or less');
      }
      if (newUsername.length === 0) {
        throw new Error('Username cannot be empty');
      }

      const userId = getUserId();
      localStorage.setItem('chatUsername', newUsername);
      await actor.updateUsernameRetroactively(userId, newUsername);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      return newUsername;
    },
    onError: (error: Error) => {
      console.error('[UpdateUsername] Error:', error);
    },
  });
}

export function useUpdateAvatar() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newAvatarUrl: string | null) => {
      if (!actor) throw new Error('Actor not available');

      if (newAvatarUrl) {
        localStorage.setItem('chatAvatarUrl', newAvatarUrl);
      } else {
        localStorage.removeItem('chatAvatarUrl');
      }

      const userId = getUserId();
      await actor.updateAvatarRetroactively(userId, newAvatarUrl);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      return newAvatarUrl;
    },
    onError: (error: Error) => {
      console.error('[UpdateAvatar] Error:', error);
    },
  });
}

// ─── User Profile ─────────────────────────────────────────────────────────────

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
    },
  });
}
