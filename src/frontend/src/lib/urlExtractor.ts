import { isYouTubeUrl, isTwitchUrl, isTwitterUrl } from './videoUtils';

export type ExtractedUrlType = 'youtube' | 'twitch' | 'twitter';

export interface ExtractedUrl {
  url: string;
  type: ExtractedUrlType;
}

/**
 * Extracts the first X post URL or video URL from a text string
 * Returns an object with the URL and its type, or null if no supported URL is found
 */
export function extractUrl(text: string): ExtractedUrl | null {
  if (!text.trim()) {
    return null;
  }

  // Extract URLs from text using a simple regex
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex);

  if (!matches || matches.length === 0) {
    return null;
  }

  // Check each URL for supported types (first match wins)
  for (const url of matches) {
    // Clean URL (remove trailing punctuation that might be captured)
    const cleanUrl = url.replace(/[.,;!?]+$/, '');

    if (isTwitterUrl(cleanUrl)) {
      return { url: cleanUrl, type: 'twitter' };
    }

    if (isYouTubeUrl(cleanUrl)) {
      return { url: cleanUrl, type: 'youtube' };
    }

    if (isTwitchUrl(cleanUrl)) {
      return { url: cleanUrl, type: 'twitch' };
    }
  }

  return null;
}
