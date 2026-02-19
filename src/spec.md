# Specification

## Summary
**Goal:** Add automatic link detection and embedding for social media platforms (YouTube, Twitch, X/Twitter, Instagram, TikTok, Rumble) and image URLs in chat messages, and add GIF support via Giphy to the Add Media button.

**Planned changes:**
- Implement automatic link detection in chat messages that renders rich previews/embeds inline for YouTube, Twitch, X (Twitter), Instagram, TikTok, Rumble, and direct image URLs
- Support multiple links per message with automatic embedding
- Modify Add Media button to exclusively support image uploads and GIF selection via Giphy integration
- Remove video URL input options from Add Media dialog (videos will be posted as links directly in chat)

**User-visible outcome:** Users can paste social media and image links directly into chat and see automatic rich previews/embeds. The Add Media button now allows users to upload images or search and select GIFs from Giphy.
