import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import type { ChatroomWithLiveStatus } from '../backend';

/**
 * Force a one-time guaranteed fresh refetch of the chatroom list when the actor becomes ready,
 * with bounded empty-cache recovery to prevent the lobby from staying empty.
 * 
 * This ensures the lobby always loads on first page load by:
 * 1. Removing legacy/incorrect empty-filter cache entries
 * 2. Explicitly refetching the canonical ['chatrooms'] query even when inactive
 * 3. Detecting if the refetch still returns empty and performing one bounded recovery attempt
 * 4. Resetting on actor instance changes
 */
export function useForceFreshChatroomsOnActorReady() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const hasTriggeredRefetch = useRef(false);
  const actorInstanceRef = useRef(actor);

  useEffect(() => {
    // Reset flag if actor instance changes (e.g., reconnection)
    if (actorInstanceRef.current !== actor) {
      if (import.meta.env.DEV) {
        console.log('[useForceFreshChatroomsOnActorReady] Actor instance changed, resetting recovery state');
      }
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

    if (import.meta.env.DEV) {
      console.log('[useForceFreshChatroomsOnActorReady] Actor ready, starting recovery sequence...');
    }
    
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
    
    // Step 2: Explicitly refetch the canonical ['chatrooms'] query
    if (import.meta.env.DEV) {
      console.log('[useForceFreshChatroomsOnActorReady] Explicitly refetching canonical chatrooms query...');
    }
    
    queryClient.refetchQueries({ 
      queryKey: ['chatrooms'], 
      exact: true,
      type: 'all' // Refetch even when inactive
    }).then(() => {
      if (import.meta.env.DEV) {
        console.log('[useForceFreshChatroomsOnActorReady] Initial refetch complete, checking result...');
      }
      
      // Step 3: Bounded empty-cache recovery
      // After the refetch settles, check if we still have an empty array
      // If so, perform ONE more recovery attempt (invalidate + refetch)
      setTimeout(() => {
        const currentData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms']);
        
        if (currentData && currentData.length === 0) {
          if (import.meta.env.DEV) {
            console.log('[useForceFreshChatroomsOnActorReady] Detected empty cache after refetch, performing bounded recovery...');
          }
          
          // Stronger recovery: invalidate (mark stale) then refetch
          queryClient.invalidateQueries({ queryKey: ['chatrooms'], exact: true });
          
          queryClient.refetchQueries({ 
            queryKey: ['chatrooms'], 
            exact: true,
            type: 'all'
          }).then(() => {
            const recoveredData = queryClient.getQueryData<ChatroomWithLiveStatus[]>(['chatrooms']);
            if (import.meta.env.DEV) {
              console.log('[useForceFreshChatroomsOnActorReady] Recovery complete, final count:', recoveredData?.length ?? 0);
            }
          }).catch((error) => {
            if (import.meta.env.DEV) {
              console.error('[useForceFreshChatroomsOnActorReady] Recovery refetch failed:', error);
            }
          });
        } else {
          if (import.meta.env.DEV) {
            console.log('[useForceFreshChatroomsOnActorReady] Initial refetch successful, count:', currentData?.length ?? 0);
          }
        }
      }, 500); // Wait 500ms for the initial refetch to settle
      
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.error('[useForceFreshChatroomsOnActorReady] Initial refetch failed:', error);
      }
    });
    
    hasTriggeredRefetch.current = true;
  }, [actor, actorFetching, queryClient]);
}
