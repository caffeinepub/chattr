# Specification

## Summary
**Goal:** Add an admin “DELETE ALL ROOMS” action that deletes all chatrooms and their associated data via a new backend method.

**Planned changes:**
- Backend: Export a new publicly callable delete-all-chatrooms method that removes all chatrooms plus associated per-room data (messages, active user tracking, reactions) without any authorization or password checks.
- Frontend: Add a clearly labeled “DELETE ALL ROOMS” button to `frontend/src/pages/AdminDeleteChatroomsPage.tsx` with a confirmation dialog; on confirm, call the backend delete-all method and refresh the chatroom list.
- Frontend: Add a React Query mutation hook (alongside existing admin mutations, e.g. in `frontend/src/hooks/useQueries.ts`) for the delete-all operation that invalidates/refetches the `['chatrooms']` query key and is used by the admin page.

**User-visible outcome:** Admins can click “DELETE ALL ROOMS” on the existing admin page, confirm the action, and see all chatrooms removed with the list updating to empty, with success/error feedback shown.
