# Specification

## Summary
**Goal:** Implement a 154-room limit and bump-based sorting to keep active chatrooms at the top of the list.

**Planned changes:**
- Enforce a maximum of 154 chatrooms in the backend, preventing new room creation when limit is reached
- Add lastActivity timestamp tracking to chatrooms that updates when messages are posted
- Sort chatrooms by most recent activity (bump-based sorting) with active rooms appearing first
- Display room limit error in the create chatroom dialog when the 154-room maximum is exceeded
- Update frontend to display rooms in bump-order received from backend

**User-visible outcome:** Users will see the most active chatrooms at the top of the lobby list. When trying to create a room after 154 rooms exist, they'll receive a clear error message explaining the limit has been reached.
