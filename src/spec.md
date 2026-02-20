# Specification

## Summary
**Goal:** Fix GIF rendering in chat messages so that GIFs from Giphy display as animated images instead of plain text names.

**Planned changes:**
- Update MessageBubble.tsx to detect and render GIF data from Giphy as animated image elements
- Ensure GIF data structure from Giphy picker includes the necessary URL information for rendering
- Verify GIF URLs are properly stored, transmitted, and received through the message pipeline

**User-visible outcome:** When users select a GIF from the Giphy picker, it will display as an animated image in the chat instead of showing just the GIF name as text.
