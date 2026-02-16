import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';

/**
 * Force a one-time guaranteed fresh refetch of the chatroom list when the actor becomes ready.
 * 
 * This ensures the lobby always loads on first page load by:
 * 1. Removing legacy/incorrect empty-filter cache entries
 * 2. Explicitly refetching (not just invalidating) the canonical ['chatrooms'] query even when inactive
 * 3. Resetting on actor instance changes
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

    console.log('[useForceFreshChatroomsOnActorReady] Actor ready, cleaning legacy cache entries and forcing fresh fetch...');
    
    // Step 1: Remove legacy/incorrect empty-filter cache entries
    // These are keys like ['chatrooms','search',''] or ['chatrooms','category',''] with empty/whitespace values
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
        console.log('[useForceFreshChatroomsOnActorReady] Removing legacy empty-filter cache entry:', key);
        queryClient.removeQueries({ queryKey: key, exact: true });
        removedCount++;
      }
    });
    
    if (removedCount > 0) {
      console.log('[useForceFreshChatroomsOnActorReady] Removed', removedCount, 'legacy cache entries');
    }
    
    // Step 2: Explicitly refetch (not just invalidate) the canonical ['chatrooms'] query
    // Changed from type: 'active' to type: 'all' to refetch even when the query is inactive/unobserved
    console.log('[useForceFreshChatroomsOnActorReady] Explicitly refetching canonical chatrooms query...');
    queryClient.refetchQueries({ 
      queryKey: ['chatrooms'], 
      exact: true,
      type: 'all' // Changed from 'active' to 'all' to refetch even when inactive
    }).then(() => {
      console.log('[useForceFreshChatroomsOnActorReady] Refetch complete');
    }).catch((error) => {
      console.error('[useForceFreshChatroomsOnActorReady] Refetch failed:', error);
    });
    
    hasTriggeredRefetch.current = true;
  }, [actor, actorFetching, queryClient]);
}
