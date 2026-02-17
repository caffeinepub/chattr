# Specification

## Summary
**Goal:** Prevent the Lobby chat list from failing due to oversized `getChatrooms` query responses by returning and using lightweight chatroom summaries.

**Planned changes:**
- Update the backend `getChatrooms` query used by the Lobby list to return only lightweight chatroom summary fields and exclude any potentially large text/blob-like fields (e.g., full media URLs/data URLs, long descriptions).
- Update the frontend Lobby data fetching/rendering to consume the lightweight summary response while preserving existing UX (loading/recovery states, client-side search, category filtering, grid layout, and navigation).
- If Lobby thumbnails/media are not available from the summary response, render a deterministic placeholder thumbnail based on `mediaType` rather than requiring `mediaUrl` in the Lobby payload.
- Ensure full chatroom details (topic/media/description/messages) are fetched only on the chatroom detail page, keeping the Lobby list request lightweight.

**User-visible outcome:** The Lobby page loads reliably in production without “Failed to Load Chats” payload-too-large errors, while search/filtering and navigation into chatrooms continue to work as before.
