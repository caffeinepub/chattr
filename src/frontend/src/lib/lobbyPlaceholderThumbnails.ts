/**
 * Maps mediaType to a stable placeholder thumbnail asset
 * Used by ChatroomCard when displaying lobby summaries without full media URLs
 */
export function getPlaceholderThumbnail(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case 'twitch':
      return '/assets/generated/twitch-placeholder.dim_200x150.png';
    case 'twitter':
      return '/assets/generated/twitter-placeholder.dim_200x150.png';
    case 'youtube':
    case 'image':
    case 'audio':
    default:
      return '/assets/generated/default-chatroom-thumbnail.dim_200x150.png';
  }
}
