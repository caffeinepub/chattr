# Specification

## Summary
**Goal:** Ensure the Lobby and admin delete-chatrooms pages show the full, unfiltered chatrooms list immediately on load by refetching the canonical `['chatrooms']` query even when it is inactive/unobserved.

**Planned changes:**
- Update frontend React Query `refetchQueries` calls targeting `['chatrooms']` to refetch inactive queries as well (change `type: 'active'` to `type: 'all'` or equivalent).
- Apply the same refetch behavior in the admin `/admin/delete-chatrooms` flow so the list populates immediately after authentication and on mount.
- Update the one-time actor-ready refetch logic to guarantee a refresh of the canonical `['chatrooms']` query even when it is not currently observed, without breaking filtered/search/category queries.

**User-visible outcome:** Navigating to the Lobby or admin delete-chatrooms page shows the full rooms list immediately, and the list updates promptly after creating or deleting rooms without requiring any category filter clicks.
