# Specification

## Summary
**Goal:** Improve the collapsible chatroom header so text sizing stays consistent across expanded/collapsed states and message/user counts display as icon + compact number only.

**Planned changes:**
- Update `frontend/src/components/ChatArea.tsx` so collapsing/expanding the chatroom header does not change the font sizes for the chatroom topic and description, avoiding layout shift from font-size changes.
- In both expanded and collapsed header states, show message count and active user count as `MessageCircle`/`Users` icon + compact-formatted number (via `formatCompactNumber`) with no label text, sourced from `chatroom.messageCount` and `chatroom.activeUserCount`.

**User-visible outcome:** Toggling the chatroom header no longer changes the topic/description text size, and the header shows message/user counts as icon + compact number in both expanded and collapsed views.
