# Specification

## Summary
**Goal:** Fix the Lobby so the unfiltered chatroom list loads automatically on first page load once the backend actor is ready, and prevent React Query cache/key issues from blocking the list.

**Planned changes:**
- Ensure the Lobby triggers the canonical unfiltered React Query fetch (key `['chatrooms']`) automatically after actor initialization, without requiring category interaction.
- Normalize empty/whitespace search and category states to use the canonical `['chatrooms']` query key, and remove/ignore any legacy empty-filter cache entries that could return incorrect empty results.
- Improve Lobby loading/error UI so it cannot get stuck in an infinite loading state; add a clear error state with a Retry action that refetches the currently active query, and keep cached results visible if a background refresh fails.

**User-visible outcome:** On first load, the Lobby shows chatrooms automatically (when they exist). Clearing filters returns to the unfiltered list reliably, and failures show a clear error with a working Retry instead of an endless spinner.
