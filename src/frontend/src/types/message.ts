import type { MessageWithReactions } from '../backend';

// Frontend-friendly message type with converted reactions
export type MessageWithConvertedReactions = Omit<MessageWithReactions, 'reactions'> & {
  reactions: Array<{
    emoji: string;
    count: bigint;
    users: string[];
  }>;
};
