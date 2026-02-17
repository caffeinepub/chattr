# Specification

## Summary
**Goal:** Allow `data:` media URLs to flow through `getChatrooms()` so lobby thumbnails render, while bypassing backend authorization checks for non-admin actions and keeping admin delete password protection intact.

**Planned changes:**
- Update `backend/main.mo` `public query func getChatrooms()` to return each chatroom’s stored `mediaUrl` unchanged (do not null out `data:` URLs).
- Update `backend/main.mo` to bypass/always-allow AccessControl-based authorization checks for non-admin backend operations so they no longer trap with “Unauthorized”.
- Update `backend/main.mo` `deleteChatroomWithPassword(chatroomId, password)` to enforce the fixed admin password (`lunasimbaliamsammy1987!`) and remove/bypass any AccessControl-based admin checks in that method.
- Ensure the frontend continues to gate `/admin/delete-chatrooms` behind the existing password-prompt flow and does not add new auth prompts for regular app actions.

**User-visible outcome:** Users can create and interact normally without role/permission errors, lobby thumbnails display for chatrooms using `data:` media URLs, and deleting chatrooms via the admin page still requires the correct password.
