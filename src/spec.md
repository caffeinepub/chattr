# Specification

## Summary
**Goal:** Ensure lobby chatroom card thumbnails always display properly rounded corners by clipping the underlying media and overlays within a rounded, overflow-hidden wrapper.

**Planned changes:**
- Update the lobby chatroom card thumbnail markup to wrap the `<img>` and any overlay layers in a rounded container with `overflow-hidden`, so `object-fit: contain` media is clipped to the rounded shape.
- Apply the same clipping approach consistently across all thumbnail types (YouTube, Twitch, Twitter/X, and generic media) within the existing lobby card thumbnail component (e.g., `frontend/src/components/ChatroomCard.tsx`).
- Preserve existing hover behaviors (such as image scale on hover) while ensuring hover effects remain clipped within the rounded thumbnail bounds.

**User-visible outcome:** In the Lobby, all chatroom card thumbnails (YouTube/Twitch/Twitter/other) show clean rounded corners with no square/uncut edges, including on hover and when images are letterboxed due to `object-contain`.
