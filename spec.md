# Specification

## Summary
**Goal:** Apply three small targeted fixes to the Chattr message bubble component: zero-pad share link message IDs, apply monospace font to inline message IDs, and increase X post iframe max-width.

**Planned changes:**
- Zero-pad the `messageId` query parameter in share link generation to a fixed 9-digit format (e.g., `?messageId=000000002`)
- Add the `font-mono` Tailwind class to the inline message ID element inside each message bubble
- Update the X (Twitter) post iframe embed max-width from 250px to 300px in the MessageBubble component

**User-visible outcome:** Share links correctly include zero-padded message IDs that resolve to the right message; message IDs in chat bubbles render in a monospace font; X post embeds display slightly wider at up to 300px.
