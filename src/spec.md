# Specification

## Summary
**Goal:** Fix React Query caching for chatroom lists so empty/whitespace search terms or categories don’t create alternate cache keys that can leave the Lobby showing stale empty results, and ensure all chatroom list variants refresh on invalidation.

**Planned changes:**
- Normalize chatroom list query keys so empty/whitespace search and empty/whitespace category both use the base query key `['chatrooms']` (instead of empty-filter variants like `['chatrooms','search','']` / `['chatrooms','category','']`).
- Update the transient empty-result guard (post-create window) so `previousData` is read from the same query key currently used by the hook (including `['chatrooms']` in the empty-filter case).
- Update all chatroom list cache invalidations to invalidate the full `['chatrooms']` namespace so base, search, and category queries refresh together after create/delete and after sending messages.

**User-visible outcome:** Clearing search or category filters reliably returns the Lobby to the same up-to-date chatroom list (no stale empty list), and chatroom lists refresh consistently after chatroom or message activity.
