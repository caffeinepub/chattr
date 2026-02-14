# Specification

## Summary
**Goal:** Add an admin-only (frontend password gated) “Reset/Wipe All Data” action that wipes all persisted backend application state.

**Planned changes:**
- Add a new public backend method in `backend/main.mo` that resets/clears all persisted in-canister state (chatrooms, messages, presence, reactions, user profiles, and ID counters) with no `caller`/`Principal`-based checks.
- Add a dedicated React Query mutation hook in `frontend/src/hooks/useQueries.ts` to call the backend reset method and invalidate relevant cached queries (chatrooms, messages, and per-chatroom queries) after success.
- Update `frontend/src/pages/AdminDeleteChatroomsPage.tsx` to expose a clearly labeled destructive “Reset/Wipe All Data” control behind the existing admin password/session gating, including an irreversible confirmation dialog, loading/disabled state during execution, and success/error toasts.

**User-visible outcome:** An authenticated admin can confirm and trigger a full app data wipe from the admin page; afterwards the lobby/admin views immediately reflect an empty, freshly-reset state without needing a manual refresh.
