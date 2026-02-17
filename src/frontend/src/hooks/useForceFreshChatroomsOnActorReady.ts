import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';

/**
 * One-time cleanup and refetch hook for chatrooms queries
 * Purges any persisted empty arrays and forces a fresh refetch when actor becomes ready
 */
export function useForceFreshChatroomsOnActorReady() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const [hasRecovered, setHasRecovered] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    if (!actor || actorFetching || hasRecovered) {
      return;
    }

    const performRecovery = async () => {
      console.log('[useForceFreshChatroomsOnActorReady] Starting recovery...');
      setIsRecovering(true);

      try {
        // Check if lobby cards query has empty data
        const lobbyCardsCache = queryClient.getQueryData(['lobbyChatroomCards']);
        const shouldPurgeLobbyCards = Array.isArray(lobbyCardsCache) && lobbyCardsCache.length === 0;

        // Check if full chatrooms query has empty data
        const chatroomsCache = queryClient.getQueryData(['chatrooms']);
        const shouldPurgeChatrooms = Array.isArray(chatroomsCache) && chatroomsCache.length === 0;

        if (shouldPurgeLobbyCards) {
          console.log('[useForceFreshChatroomsOnActorReady] Purging empty lobby cards cache');
          queryClient.removeQueries({ queryKey: ['lobbyChatroomCards'], exact: true });
        }

        if (shouldPurgeChatrooms) {
          console.log('[useForceFreshChatroomsOnActorReady] Purging empty chatrooms cache');
          queryClient.removeQueries({ queryKey: ['chatrooms'], exact: true });
        }

        // Force fresh refetch for both queries
        console.log('[useForceFreshChatroomsOnActorReady] Forcing fresh refetch...');
        await Promise.all([
          queryClient.refetchQueries({
            queryKey: ['lobbyChatroomCards'],
            exact: true,
            type: 'all',
          }),
          queryClient.refetchQueries({
            queryKey: ['chatrooms'],
            exact: true,
            type: 'all',
          }),
        ]);

        console.log('[useForceFreshChatroomsOnActorReady] Recovery complete');
      } catch (error) {
        console.error('[useForceFreshChatroomsOnActorReady] Recovery error:', error);
      } finally {
        setIsRecovering(false);
        setHasRecovered(true);
      }
    };

    performRecovery();
  }, [actor, actorFetching, hasRecovered, queryClient]);

  return { isRecovering };
}
