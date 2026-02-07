/**
 * Utility functions for extracting video IDs and generating thumbnail URLs
 */

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
export function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^&\s?]+)/,
    /youtube\.com\/v\/([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      // Remove any query parameters or fragments
      return match[1].split('?')[0].split('#')[0];
    }
  }
  return null;
}

/**
 * Generate YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Extract Twitch clip slug from various Twitch URL formats
 */
export function getTwitchClipSlug(url: string): string | null {
  const patterns = [
    /clips\.twitch\.tv\/([^/?]+)/,
    /twitch\.tv\/\w+\/clip\/([^/?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract Twitch video ID from URL
 */
export function getTwitchVideoId(url: string): string | null {
  const patterns = [
    /twitch\.tv\/videos\/(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract Twitch channel name from URL
 */
export function getTwitchChannelName(url: string): string | null {
  // Match channel URLs like twitch.tv/channelname (but not videos or clips)
  const match = url.match(/twitch\.tv\/([^/?]+)(?:\/|$)/);
  if (match && match[1] && match[1] !== 'videos' && match[1] !== 'clip') {
    return match[1];
  }
  return null;
}

/**
 * Generate Twitch thumbnail URL based on URL type
 * Returns the appropriate thumbnail URL for live streams, clips, or VODs
 */
export function getTwitchThumbnailUrl(url: string): string | null {
  const clipSlug = getTwitchClipSlug(url);
  const videoId = getTwitchVideoId(url);
  const channelName = getTwitchChannelName(url);
  
  // For clips, use clip thumbnail
  if (clipSlug) {
    return `https://clips-media-assets2.twitch.tv/${clipSlug}-preview-480x272.jpg`;
  }
  
  // For VODs, use VOD thumbnail
  if (videoId) {
    return `https://static-cdn.jtvnw.net/cf_vods/${videoId}/thumb/thumb0-640x360.jpg`;
  }
  
  // For live streams, use live preview thumbnail
  if (channelName) {
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelName}-640x360.jpg`;
  }
  
  return null;
}

/**
 * Extract Twitter/X post ID from URL
 */
export function getTwitterPostId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

/**
 * Check if URL is a Twitch URL
 */
export function isTwitchUrl(url: string): boolean {
  return url.includes('twitch.tv') || url.includes('clips.twitch.tv');
}

/**
 * Check if URL is a Twitter/X URL
 */
export function isTwitterUrl(url: string): boolean {
  return url.includes('twitter.com') || url.includes('x.com');
}

/**
 * Get Twitch embed URL with proper parent parameter
 */
export function getTwitchEmbedUrl(url: string): string | null {
  const clipSlug = getTwitchClipSlug(url);
  const videoId = getTwitchVideoId(url);
  const channelName = getTwitchChannelName(url);
  
  const parent = window.location.hostname || 'localhost';
  
  if (clipSlug) {
    return `https://clips.twitch.tv/embed?clip=${clipSlug}&parent=${parent}`;
  }
  
  if (videoId) {
    return `https://player.twitch.tv/?video=${videoId}&parent=${parent}&autoplay=false`;
  }
  
  if (channelName) {
    return `https://player.twitch.tv/?channel=${channelName}&parent=${parent}&autoplay=false`;
  }
  
  return null;
}
