# Specification

## Summary
**Goal:** Prevent the lobby from starting with a persisted empty React Query cache (`[]`) for the canonical `['chatrooms']` query in production, so chatrooms load immediately on first view.

**Planned changes:**
- In the existing actor-ready recovery flow (used by `LobbyPage` via `useForceFreshChatroomsOnActorReady`), detect and purge/ignore a persisted cached value of `[]` for the canonical React Query key `['chatrooms']` on initial app load.
- Force a fresh network refetch for `['chatrooms']` after actor-ready so real rooms appear without requiring user interaction.
- Keep search/category filtering behavior unchanged and limit the fix strictly to the canonical `['chatrooms']` key behavior on initial load.

**User-visible outcome:** On production sessions where the browser previously persisted an empty `['chatrooms']` cache, the lobby shows available rooms immediately on initial load without needing to click search or categories.
