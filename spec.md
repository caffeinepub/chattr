# Specification

## Summary
**Goal:** Fix the live user count display in the chatroom to always show at least 1 when the user is present, sync the count quickly on room join, and remove the "online" label.

**Planned changes:**
- In `ChatArea.tsx`, floor the displayed live user count at a minimum of 1 whenever the local user is in the room (show 1 instead of 0 if the backend returns 0)
- In `ChatroomPage.tsx` or `useHeartbeat.ts`, fire an immediate heartbeat on room entry so the real backend count syncs quickly without waiting for the 45-second interval
- In `ChatArea.tsx`, remove the "online" text/label from the live user count display

**User-visible outcome:** When a user joins a chatroom, the live user count immediately reflects a real value (never 0), syncs quickly with the backend, and displays without an "online" label.
