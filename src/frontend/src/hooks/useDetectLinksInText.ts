import { useState, useEffect } from 'react';
import { isYouTubeUrl, isTwitchUrl, isTwitterUrl } from '../lib/videoUtils';

export type DetectedLinkType = 'youtube' | 'twitch' | 'twitter';

export interface DetectedLink {
  url: string;
  type: DetectedLinkType;
}

/**
 * Custom hook that detects X post URLs and video URLs within a text string
 * Returns the first detected link and its type
 */
export function useDetectLinksInText(text: string): DetectedLink | null {
  const [detectedLink, setDetectedLink] = useState<DetectedLink | null>(null);

  useEffect(() => {
    if (!text.trim()) {
      setDetectedLink(null);
      return;
    }

    // Extract URLs from text using a simple regex
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);

    if (!matches || matches.length === 0) {
      setDetectedLink(null);
      return;
    }

    // Check each URL for supported types (first match wins)
    for (const url of matches) {
      // Clean URL (remove trailing punctuation that might be captured)
      const cleanUrl = url.replace(/[.,;!?]+$/, '');

      if (isTwitterUrl(cleanUrl)) {
        setDetectedLink({ url: cleanUrl, type: 'twitter' });
        return;
      }

      if (isYouTubeUrl(cleanUrl)) {
        setDetectedLink({ url: cleanUrl, type: 'youtube' });
        return;
      }

      if (isTwitchUrl(cleanUrl)) {
        setDetectedLink({ url: cleanUrl, type: 'twitch' });
        return;
      }
    }

    // No supported URLs found
    setDetectedLink(null);
  }, [text]);

  return detectedLink;
}
