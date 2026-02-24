// Utility to detect URLs in text and return segments for rendering

export interface TextSegment {
  type: 'text';
  content: string;
}

export interface LinkSegment {
  type: 'link';
  content: string;
  url: string;
}

export type ContentSegment = TextSegment | LinkSegment;

/**
 * Detects URLs in text and returns an array of text/link segments
 * Matches http://, https://, and www. patterns
 */
export function detectLinks(text: string): ContentSegment[] {
  // Regex to match URLs (http://, https://, www.)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const startIndex = match.index;

    // Add text before the URL
    if (startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, startIndex),
      });
    }

    // Add the URL as a link segment
    // Normalize URL: add https:// if it starts with www.
    const normalizedUrl = url.startsWith('www.') ? `https://${url}` : url;
    
    segments.push({
      type: 'link',
      content: url,
      url: normalizedUrl,
    });

    lastIndex = startIndex + url.length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  // If no URLs found, return the entire text as a single segment
  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: text,
    });
  }

  return segments;
}
