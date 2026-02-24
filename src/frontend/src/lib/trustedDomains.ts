// Utility to check if a URL belongs to a trusted domain

const TRUSTED_DOMAINS = [
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  'twitch.com',
];

/**
 * Checks if a URL belongs to a trusted domain
 * Returns true for URLs from X/Twitter, YouTube, and Twitch
 */
export function isTrustedDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Check if hostname matches or ends with any trusted domain
    return TRUSTED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch (error) {
    // Invalid URL, not trusted
    return false;
  }
}
