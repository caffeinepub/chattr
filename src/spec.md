# Specification

## Summary
**Goal:** Center the collapsed chatroom header’s inner content on desktop layouts to match the expanded state alignment, without changing mobile behavior.

**Planned changes:**
- Update `frontend/src/components/ChatArea.tsx` collapsed header layout at the `md` breakpoint and up to center the inner content horizontally.
- Preserve the existing collapsed header layout and spacing on small screens (below `md`).
- Leave the expanded header layout unchanged.

**User-visible outcome:** On desktop-sized viewports, the collapsed chatroom header content is visually centered within the header bar; mobile and expanded header layouts look the same as before.
