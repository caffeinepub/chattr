# Specification

## Summary
**Goal:** Add a site-wide “Reset Data” action to the existing Admin Delete Chatrooms page to wipe all application data.

**Planned changes:**
- Update `frontend/src/pages/AdminDeleteChatroomsPage.tsx` to add a new tab/section that switches between the existing chatroom deletion UI and a new “Reset Data” UI.
- In the new “Reset Data” tab/section, add a “Reset Data” button with an explicit confirmation dialog, a loading/disabled state during execution, and a success message on completion.
- Wire the “Reset Data” button to a new backend method that performs a full canister data wipe and refreshes relevant cached queries (at minimum `['chatrooms']`) after success.
- Add a new backend method in `backend/main.mo` that clears all persisted state (chatrooms, messages, reactions, active user tracking, user profiles) and resets ID counters to initial values, with no caller principal checks or authorization checks.

**User-visible outcome:** Admins can open the Admin Delete Chatrooms page, switch to a “Reset Data” tab, confirm the action, and reset the entire site’s data; the UI then reflects the wiped state.
