# Specification

## Summary
**Goal:** Fix an intermittent bug where the Lobby and Admin chatroom lists sometimes become empty after creating chatrooms, without requiring users to click a tag/filter to recover.

**Planned changes:**
- Update the Lobby/Admin chatroom list fetching logic to avoid overwriting previously loaded chatrooms with an empty/undefined response during transient refetches shortly after chatroom creation.
- Adjust React Query chatroom queries to keep previously fetched data while refetching and to surface fetch failures as errors (instead of silently returning an empty list).
- Ensure successful chatroom creation reliably triggers refresh of all relevant chatroom list queries (base list, category-filtered lists, and search-based lists) matching the user’s current filter/search state.

**User-visible outcome:** After creating chatrooms repeatedly, the Lobby and Admin chatroom lists no longer randomly switch to showing zero rooms unless there truly are none; newly created rooms appear without needing to click a tag/filter, and failures can be reflected as an error state rather than an empty list.
