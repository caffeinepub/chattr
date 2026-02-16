# Specification

## Summary
**Goal:** Fix React Query stale-cache behavior so the unfiltered chatroom list (base `['chatrooms']` query) reliably loads and refreshes in the Lobby and Admin delete-chatrooms pages without requiring a category click.

**Planned changes:**
- Update Lobby page data-fetching behavior for the base `['chatrooms']` query to ensure it refetches on page entry and recovers automatically from a previously-cached empty array.
- Update `/admin/delete-chatrooms` to refetch and display the full chatroom list immediately after authentication, avoiding persistent empty UI caused by stale cached base results.
- Adjust create-chatroom invalidation/refetch logic so the base `['chatrooms']` query (and related filtered/search variants) updates promptly and stays consistent across Lobby and Admin lists.

**User-visible outcome:** Visiting the lobby or the admin delete-chatrooms page shows existing chatrooms immediately (no category click needed), and newly created chatrooms appear in unfiltered and filtered lists without manual reloads.
