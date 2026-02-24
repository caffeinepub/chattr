/**
 * Twitter oEmbed preview reconstruction utility
 * Fetches Twitter oEmbed JSON and extracts safe preview fields
 * No html2canvas, no DOM snapshotting, no CORS issues
 */

import { getCachedPreview, setCachedPreview } from './twitterOEmbedPreviewCache';

export interface TwitterPreview {
  authorName: string;
  authorUrl: string;
  text: string;
  imageUrl?: string;
}

// In-flight request tracking to prevent duplicate fetches
const inFlightRequests = new Map<string, Promise<TwitterPreview | null>>();

/**
 * Fetch Twitter oEmbed preview data
 * Returns reconstructed preview or null on failure
 * Uses cache and deduplicates concurrent requests
 */
export async function fetchTwitterOEmbedPreview(
  tweetUrl: string
): Promise<TwitterPreview | null> {
  // Check cache first
  const cached = getCachedPreview(tweetUrl);
  if (cached) {
    return cached;
  }

  // Check if already fetching
  const inFlight = inFlightRequests.get(tweetUrl);
  if (inFlight) {
    return inFlight;
  }

  // Start fetch
  const promise = fetchPreviewInternal(tweetUrl);
  inFlightRequests.set(tweetUrl, promise);

  try {
    const result = await promise;
    if (result) {
      setCachedPreview(tweetUrl, result);
    }
    return result;
  } finally {
    inFlightRequests.delete(tweetUrl);
  }
}

/**
 * Internal preview fetch logic
 */
async function fetchPreviewInternal(
  tweetUrl: string
): Promise<TwitterPreview | null> {
  try {
    // Fetch oEmbed JSON with omit_script=true (no widgets.js needed)
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(
      tweetUrl
    )}&omit_script=true`;

    const response = await fetch(oembedUrl);
    if (!response.ok) {
      console.warn('[TwitterOEmbedPreview] oEmbed fetch failed:', response.status);
      return null;
    }

    const data = await response.json();

    // Extract safe fields
    const authorName = data.author_name || 'Unknown';
    const authorUrl = data.author_url || '';
    const html = data.html || '';

    // Parse text snippet from HTML (simple extraction)
    const text = extractTextFromHtml(html);

    // Try to extract image URL from HTML if present
    const imageUrl = extractImageUrl(html);

    return {
      authorName,
      authorUrl,
      text,
      imageUrl,
    };
  } catch (error) {
    console.warn('[TwitterOEmbedPreview] Error fetching preview:', error);
    return null;
  }
}

/**
 * Extract text content from oEmbed HTML
 * Simple extraction without full DOM parsing
 */
function extractTextFromHtml(html: string): string {
  try {
    // Remove script tags
    const noScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Extract text between <p> tags (tweet text is usually in <p>)
    const pMatch = noScripts.match(/<p[^>]*>(.*?)<\/p>/i);
    if (pMatch && pMatch[1]) {
      // Strip HTML tags and decode entities
      const text = pMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      
      // Truncate if too long
      return text.length > 200 ? text.slice(0, 200) + '...' : text;
    }

    return 'View post on X';
  } catch (error) {
    return 'View post on X';
  }
}

/**
 * Extract first image URL from oEmbed HTML if present
 * Looks for pbs.twimg.com images (safe, public CDN)
 */
function extractImageUrl(html: string): string | undefined {
  try {
    // Look for img tags with pbs.twimg.com URLs
    const imgMatch = html.match(/<img[^>]+src=["']([^"']*pbs\.twimg\.com[^"']*)["']/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }

    // Look for background-image style with pbs.twimg.com
    const bgMatch = html.match(/background-image:\s*url\(["']?([^"')]*pbs\.twimg\.com[^"')]*)["']?\)/i);
    if (bgMatch && bgMatch[1]) {
      return bgMatch[1];
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}
