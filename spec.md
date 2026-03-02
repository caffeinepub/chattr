# Specification

## Summary
**Goal:** Remove all backend caller/principal checks, re-enable admin message deletion, and make pinned videos per-user instead of global per-chatroom.

**Planned changes:**
- Remove every reference to `caller`, `Principal.isAnonymous`, and all access control/ownership guards from every function in `backend/main.mo`
- Add a backend function to delete a message by ID (no caller check), and wire a delete button per message in the admin UI so admins can remove individual messages
- Change pinned video storage from per-chatroom global to per `(chatroomId, userId)` so each user only sees their own pinned video; update frontend to pass the user identity when fetching and mutating pinned videos

**User-visible outcome:** All backend functions are open with no identity restrictions; admins can delete individual messages from the admin page; pinning or unpinning a video in a chatroom only affects the current user's view and does not impact other users in the same chatroom.
