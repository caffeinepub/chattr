# Specification

## Summary
**Goal:** Make URLs in chat messages clickable with safety warnings and fix share link scroll/highlight functionality.

**Planned changes:**
- Detect URLs in chat messages and render them as clickable links
- Show "You are leaving this site" warning dialog when clicking external URLs
- Skip warning for trusted embeds (X/Twitter, YouTube, Twitch)
- Fix share link scroll-to-message functionality to properly scroll to the target message
- Fix share link highlight functionality to visually highlight the target message for 3 seconds

**User-visible outcome:** Users can click URLs in chat messages (with safety warnings for external sites), and share links will correctly scroll to and highlight the referenced message.
