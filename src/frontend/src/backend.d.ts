import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserProfile {
    name: string;
    presetAvatar?: string;
    anonId: string;
    avatarUrl?: string;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface http_header {
    value: string;
    name: string;
}
export interface ReplyPreview {
    messageId: bigint;
    sender: string;
    mediaThumbnail?: string;
    contentSnippet: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface MessageWithReactions {
    id: bigint;
    content: string;
    chatroomId: bigint;
    sender: string;
    mediaUrl?: string;
    avatarUrl?: string;
    replyToMessageId?: bigint;
    timestamp: bigint;
    mediaType?: string;
    reactions: List_1;
    senderId: string;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export type List_1 = [Reaction, List_1] | null;
export interface Message {
    id: bigint;
    content: string;
    chatroomId: bigint;
    sender: string;
    mediaUrl?: string;
    avatarUrl?: string;
    replyToMessageId?: bigint;
    timestamp: bigint;
    mediaType?: string;
    senderId: string;
}
export type List = [string, List] | null;
export interface ChatroomWithLiveStatus {
    id: bigint;
    topic: string;
    activeUserCount: bigint;
    createdAt: bigint;
    description: string;
    isLive: boolean;
    mediaUrl: string;
    viewCount: bigint;
    messageCount: bigint;
    mediaType: string;
    category: string;
    pinnedVideoId?: bigint;
}
export interface Reaction {
    count: bigint;
    emoji: string;
    users: List;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addReaction(messageId: bigint, emoji: string, userId: string): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    cleanupInactiveUsers(): Promise<void>;
    createChatroom(topic: string, description: string, mediaUrl: string, mediaType: string, category: string): Promise<bigint>;
    fetchTwitchThumbnail(channelName: string): Promise<string>;
    fetchTwitterOEmbed(tweetUrl: string): Promise<string>;
    fetchYouTubeThumbnail(videoId: string): Promise<string>;
    filterChatroomsByCategory(category: string): Promise<Array<ChatroomWithLiveStatus>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getChatroom(id: bigint): Promise<ChatroomWithLiveStatus | null>;
    getChatrooms(): Promise<Array<ChatroomWithLiveStatus>>;
    getMessageWithReactionsAndReplies(chatroomId: bigint): Promise<Array<MessageWithReactions>>;
    getMessages(chatroomId: bigint): Promise<Array<Message>>;
    getPinnedVideo(chatroomId: bigint): Promise<bigint | null>;
    getReactions(messageId: bigint): Promise<Array<Reaction>>;
    getReplies(chatroomId: bigint, parentMessageId: bigint): Promise<Array<Message>>;
    getReplyPreview(chatroomId: bigint, messageId: bigint): Promise<ReplyPreview | null>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    incrementViewCount(chatroomId: bigint, userId: string): Promise<void>;
    initializeAccessControl(): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    pinVideo(chatroomId: bigint, messageId: bigint): Promise<void>;
    removeReaction(messageId: bigint, emoji: string, userId: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    searchChatrooms(searchTerm: string): Promise<Array<ChatroomWithLiveStatus>>;
    sendMessage(content: string, sender: string, chatroomId: bigint, mediaUrl: string | null, mediaType: string | null, avatarUrl: string | null, senderId: string, replyToMessageId: bigint | null): Promise<void>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    unpinVideo(chatroomId: bigint): Promise<void>;
    updateAvatarRetroactively(senderId: string, newAvatarUrl: string | null): Promise<void>;
    updateUsernameRetroactively(senderId: string, newUsername: string): Promise<void>;
}
