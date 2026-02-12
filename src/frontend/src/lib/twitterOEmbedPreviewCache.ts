/**
 * localStorage cache for Twitter oEmbed preview data
 * Stores reconstructed preview objects with validation and expiration
 */

import { getTwitterPostId } from './videoUtils';
import type { TwitterPreview } from './twitterOEmbedPreview';

interface CachedPreview {
  preview: TwitterPreview;
  timestamp: number;
  version: number;
}

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'twitter_preview_';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Build stable cache key from tweet URL
 * Prefers tweet ID (consistent with existing patterns)
 */
export function buildCacheKey(tweetUrl: string): string {
  const tweetId = getTwitterPostId(tweetUrl);
  return CACHE_PREFIX + (tweetId || btoa(tweetUrl).slice(0, 32));
}

/**
 * Get cached preview if valid
 */
export function getCachedPreview(tweetUrl: string): TwitterPreview | null {
  try {
    const key = buildCacheKey(tweetUrl);
    const cached = localStorage.getItem(key);
    
    if (!cached) {
      return null;
    }

    const data: CachedPreview = JSON.parse(cached);
    
    // Validate structure
    if (!data.preview || !data.timestamp || data.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }

    // Validate preview object
    if (!data.preview.authorName || !data.preview.text) {
      localStorage.removeItem(key);
      return null;
    }

    // Check age
    const age = Date.now() - data.timestamp;
    if (age > CACHE_MAX_AGE) {
      localStorage.removeItem(key);
      return null;
    }

    return data.preview;
  } catch (error) {
    console.warn('[TwitterOEmbedPreviewCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Store preview in cache
 */
export function setCachedPreview(tweetUrl: string, preview: TwitterPreview): void {
  try {
    const key = buildCacheKey(tweetUrl);
    const data: CachedPreview = {
      preview,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    // Quota exceeded or other error - fail silently
    console.warn('[TwitterOEmbedPreviewCache] Error writing cache:', error);
  }
}

/**
 * Clear all Twitter preview caches
 */
export function clearAllCaches(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('[TwitterOEmbedPreviewCache] Error clearing caches:', error);
  }
}
