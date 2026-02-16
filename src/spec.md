# Specification

## Summary
**Goal:** Fix the lobby’s initial rooms list so it displays rooms on first load even when a persisted React Query cache hydrates an empty array for the canonical `['chatrooms']` query.

**Planned changes:**
- Add frontend logic to detect and purge/ignore a hydrated persisted empty `[]` result for the canonical `['chatrooms']` query key (and any known legacy empty-filter variants) and force a fresh network refetch before showing an empty-state.
- Ensure the lobby shows a loading state while the refetch is in-flight, and only shows “No chats found yet” after a real empty result is confirmed from the network.
- Trigger a refetch for `['chatrooms']` on initial load/actor-ready even if the query is currently inactive.
- Provide the exact code change snippet(s) (diff-style or full file content) implementing the persisted-cache purge/ignore behavior for review.

**User-visible outcome:** On a fresh page load in production, the lobby shows available rooms immediately without requiring a search or category selection, and it no longer incorrectly shows an empty-state due solely to a persisted cached empty list.
