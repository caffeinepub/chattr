import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { ChatroomWithLiveStatus } from '../backend';

/**
 * Force a one-time guaranteed fresh refetch of the chatroom list when the actor becomes ready,
 * with explicit cache purging to prevent persisted empty arrays from blocking lobby display.
 * 
 * This ensures the lobby always loads on first page load by:
 * 1. Removing legacy/incorrect empty-filter cache entries
 * 2. Detecting and purging persisted empty-array cache for ['chatrooms']
 * 3. Explicitly refetching the canonical ['chatrooms'] query even when inactive
 * 4. Exposing a recovery-in-progress signal so the lobby can show loading state
 * 5. Resetting on actor instance changes
 */
export function useForceFreshChatroomsOnActorReady() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const hasTriggeredRefetch = useRef(false);
  const actorInstanceRef = useRef(actor);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    // Reset flag if actor instance changes (e.g., reconnection)
    if (actorInstanceRef.current !== actor) {
      if (import.meta.env.DEV) {
        console.log('[useForceFreshChatroomsOnActorReady] Actor instance changed, resetting recovery state');
      }
      hasTriggeredRefetch.current = false;
      actorInstanceRef.current = actor;
      setIsRecovering(false);
    }

    // Only run once per actor-ready lifecycle
    if (hasTriggeredRefetch.current) {
      return;
    }

    // Wait for actor to be ready
    if (!actor || actorFetching) {
      return;
    }

    if (import.meta.env.DEV) {
      console.log('[useForceFreshChatroomsOnActorReady] Actor ready, starting cache purge and recovery sequence...');
    }
    
    setIsRecovering(true);
    
    // Step 1: Remove legacy/incorrect empty-filter cache entries
    const queryCache = queryClient.getQueryCache();
    const allQueries = queryCache.getAll();
    
    let removedCount = 0;
    allQueries.forEach((query) => {
      const key = query.queryKey;
      
      // Check if this is a chatroom query with empty/whitespace filter
      if (
        Array.isArray(key) &&
        key.length === 3 &&
        key[0] === 'chatrooms' &&
        (key[1] === 'search' || key[1] === 'category') &&
        typeof key[2] === 'string' &&
        key[2].trim() === ''
      ) {
        if (import.meta.env.DEV) {
          console.log('[useForceFreshChatroomsOnActorReady] Removing legacy empty-filter cache entry:', key);
        }
        queryClient.removeQueries({ queryKey: key, exact: true });
        removedCount++;
      }
    });
    
    if (import.meta.env.DEV && removedCount > 0) {
      console.log('[useForceFreshChatroomsOnActorReady] Removed', removedCount, 'legacy cache entries');
    }
    
    // Step 2: Check if the canonical ['chatrooms'] cache contains an empty array
    // If so, purge it completely to force a fresh fetch
    const currentCachedData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms']);
    
    if (currentCachedData && Array.isArray(currentCachedData) && currentCachedData.length === 0) {
      if (import.meta.env.DEV) {
        console.log('[useForceFreshChatroomsOnActorReady] Detected persisted empty array in cache, purging...');
      }
      
      // Set cache to undefined (not empty array) to signal "no data yet"
      queryClient.setQueryData(['chatrooms'], undefined);
      
      if (import.meta.env.DEV) {
        console.log('[useForceFreshChatroomsOnActorReady] Cache cleared (set to undefined)');
      }
    } else if (import.meta.env.DEV) {
      console.log('[useForceFreshChatroomsOnActorReady] Current cached data:', currentCachedData?.length ?? 'undefined', 'items');
    }
    
    // Step 3: Explicitly refetch the canonical ['chatrooms'] query
    if (import.meta.env.DEV) {
      console.log('[useForceFreshChatroomsOnActorReady] Explicitly refetching canonical chatrooms query...');
    }
    
    queryClient.refetchQueries({ 
      queryKey: ['chatrooms'], 
      exact: true,
      type: 'all' // Refetch even when inactive
    }).then(() => {
      if (import.meta.env.DEV) {
        const finalData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms']);
        console.log('[useForceFreshChatroomsOnActorReady] Refetch complete, final count:', finalData?.length ?? 0);
      }
      setIsRecovering(false);
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.error('[useForceFreshChatroomsOnActorReady] Refetch failed:', error);
      }
      setIsRecovering(false);
    });
    
    hasTriggeredRefetch.current = true;
  }, [actor, actorFetching, queryClient]);

  return { isRecovering };
}
