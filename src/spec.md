# Specification

## Summary
**Goal:** Implement a 4chan-style room bumping and archiving system with a 77-room active limit.

**Planned changes:**
- Add activity-based sorting algorithm that ranks chatrooms by creation date, message count, reaction count, and last message timestamp
- Add 'archived' field to Chatroom type to track room status
- Implement automatic archiving: when active rooms exceed 77, archive the least active rooms
- Make archived rooms read-only (no messages, reactions, or write operations allowed)
- Create /archive page to browse archived chatrooms
- Add visual indicators for archived rooms throughout the UI
- Disable all input controls when viewing archived rooms
- Add navigation link to access the archive page

**User-visible outcome:** Users will see a lobby with up to 77 active chatrooms sorted by activity. Older, inactive rooms automatically move to a separate archive page where they can be viewed but not modified. The most active rooms stay visible in the main lobby.
