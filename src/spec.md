# Specification

## Summary
**Goal:** Refactor the Lobby to rely on a single canonical chatrooms fetch and apply search/category filtering entirely client-side.

**Planned changes:**
- Update LobbyPage to fetch chatrooms only via the canonical React Query key `['chatrooms']` (useGetChatrooms) and remove usage of `useSearchChatrooms` and `useFilterChatroomsByCategory` in the lobby.
- Implement search and category filtering in-memory on the Lobby page using the debounced search term and selected category state, without creating new React Query cache keys.
- Preserve the existing recovery/loading behavior using `useForceFreshChatroomsOnActorReady` (`isRecovering`) and ensure the lobby renders and filters solely from the post-recovery `['chatrooms']` query result (including existing empty-state behavior).

**User-visible outcome:** On first load, the lobby shows chatrooms immediately without requiring a category click, and search/category filters update the visible list instantly without triggering extra network queries.
