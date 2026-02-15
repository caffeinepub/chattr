import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { ChatroomWithLiveStatus } from '../backend';

/**
 * Force a one-time guaranteed fresh refetch of the chatroom list when the actor becomes ready.
 * 
 * This bypasses any stale cached data (including empty arrays) by performing a single
 * forced fetch after actor initialization, ensuring old chatrooms always load correctly.
 */
export function useForceFreshChatroomsOnActorReady() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const hasTriggeredRefetch = useRef(false);
  const actorInstanceRef = useRef(actor);

  useEffect(() => {
    // Reset flag if actor instance changes (e.g., reconnection)
    if (actorInstanceRef.current !== actor) {
      hasTriggeredRefetch.current = false;
      actorInstanceRef.current = actor;
    }

    // Only run once per actor-ready lifecycle
    if (hasTriggeredRefetch.current) {
      return;
    }

    // Wait for actor to be ready
    if (!actor || actorFetching) {
      return;
    }

    console.log('[useForceFreshChatroomsOnActorReady] Actor ready, performing one-time guaranteed fresh fetch...');
    
    // Perform a single guaranteed fresh fetch by fetching directly and updating the cache
    // This bypasses any stale cached data (including empty arrays)
    actor.getChatrooms()
      .then((chatrooms) => {
        console.log('[useForceFreshChatroomsOnActorReady] Fresh fetch complete, received', chatrooms.length, 'chatrooms');
        
        // Sort by creation date (newest first)
        const sortedChatrooms = chatrooms.sort((a, b) => Number(b.createdAt - a.createdAt));
        
        // Update the cache with fresh data
        queryClient.setQueryData<ChatroomWithLiveStatus[]>(['chatrooms'], sortedChatrooms);
        
        hasTriggeredRefetch.current = true;
      })
      .catch((error) => {
        console.error('[useForceFreshChatroomsOnActorReady] Fresh fetch failed:', error);
        // Don't mark as triggered so we can retry on next render
      });
  }, [actor, actorFetching, queryClient]);
}
