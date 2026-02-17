# Specification

## Summary
**Goal:** Fix the lobby so the chatroom list (or empty state) renders correctly on first load without requiring a filter click, by removing stale-data fallback behavior when queries return empty arrays.

**Planned changes:**
- Remove the LobbyPage “empty array guard” that substitutes a previously cached non-empty chatroom list in place of the current React Query results (all/search/category views).
- Update `useGetChatrooms` (and related list queries for search/category) to treat empty arrays as valid successful responses rather than throwing/rejecting to preserve prior data.
- Keep the existing recovery/loading flow (including `isRecovering` gating), but ensure that once recovery completes the lobby renders from the post-refetch query results without stale-data substitution.

**User-visible outcome:** On first load of the lobby (/), users immediately see the current chatroom list if available, or the existing “No chats found yet” empty state if none are returned—without needing to click a category badge or type in search.
