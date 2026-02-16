# Specification

## Summary
**Goal:** Add an admin-only reset capability to wipe all published/live site data and return the site to an initial empty state.

**Planned changes:**
- Add a protected backend admin update method that clears all live data stores (chatrooms, messages, active users, reactions, user profiles) and resets ID counters to zero.
- Extend the admin page (/admin/delete-chatrooms) with a gated “Reset Published Site” destructive action that requires explicit confirmation and shows success/failure feedback.
- On successful reset, fully refresh the client state by invalidating and refetching chatroom-related React Query caches so admin/lobby views immediately reflect the empty state.

**User-visible outcome:** After passing the admin gate, an admin can confirm and run “Reset Published Site” to permanently clear all published data, and the UI updates immediately to show no rooms without a manual browser refresh.
