# Specification

## Summary
**Goal:** Add an admin-only UI control to reset all application data by calling a new unauthenticated backend `resetAll()` method.

**Planned changes:**
- Backend: Implement and expose a public `resetAll()` update method in `backend/main.mo` that clears all persisted application state and resets relevant ID counters, with no caller/principal authorization checks.
- Frontend: Add a destructive “Reset All Data” button to `frontend/src/pages/AdminDeleteChatroomsPage.tsx` with a clear confirmation dialog, loading/disabled state, and success/error feedback.
- Frontend: Add a React Query mutation hook in `frontend/src/hooks/useQueries.ts` (e.g., `useResetAllData`) that calls `actor.resetAll()` and invalidates relevant caches (at minimum `['chatrooms']`) so the UI updates without manual refresh.

**User-visible outcome:** From the existing admin page, an authenticated admin can click “Reset All Data”, confirm the irreversible action, and the app’s data is cleared with clear success/error messaging and the chatroom list updating to empty automatically.
