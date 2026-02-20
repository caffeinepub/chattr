# Specification

## Summary
**Goal:** Restore image and GIF display functionality in chat message bubbles.

**Planned changes:**
- Update MessageBubble.tsx to restore image rendering using the approach from draft version 261, supporting both imageId (via useGetImage hook) and imageUrl (via direct blob URLs)
- Ensure animated GIFs display and animate correctly in message bubbles
- Update frontend query hooks in useQueries.ts (specifically useGetImage if it exists) to properly support image fetching
- Handle image loading states and errors gracefully

**User-visible outcome:** Users can see images and animated GIFs displayed correctly within chat message bubbles.
