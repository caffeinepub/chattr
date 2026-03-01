import { useEffect, useRef } from 'react';
import { useActor } from './useActor';

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem('chatroomSessionId');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('chatroomSessionId', sessionId);
  }
  return sessionId;
}

const HEARTBEAT_INTERVAL_MS = 45_000;

export function useHeartbeat(roomId: bigint | null) {
  const { actor } = useActor();
  const actorRef = useRef(actor);

  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);

  useEffect(() => {
    if (!roomId) return;

    const roomIdStr = roomId.toString();
    const sessionId = getOrCreateSessionId();

    // Send an immediate heartbeat on mount
    const sendHeartbeat = () => {
      if (actorRef.current) {
        actorRef.current.heartbeat(roomIdStr, sessionId).catch(() => {
          // Silently ignore heartbeat errors
        });
      }
    };

    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [roomId]);
}
