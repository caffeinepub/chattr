# Specification

## Summary
**Goal:** Tighten spacing in the chatroom header stats row and reposition the LIVE badge next to the category badge.

**Planned changes:**
- Update the stats row layout in `frontend/src/components/ChatArea.tsx` so the horizontal gap between message/reply count, view count, and category badge is 0.5rem (instead of 1rem).
- Adjust the LIVE indicator placement in `frontend/src/components/ChatArea.tsx` to render to the right of the category badge within the same stats row, with a 0.5rem gap (and keep consistent 0.5rem spacing when the category badge is absent).

**User-visible outcome:** The chatroom header stats appear more compact, and the LIVE badge displays immediately to the right of the category tag (or at the end of the stats row when no category is present) with consistent 0.5rem spacing.
