# Specification

## Summary
**Goal:** Prevent `getChatrooms()` from exceeding the Internet Computer query reply size limit while preserving the existing API contract, restore chatroom thumbnails, and continue removing runtime authorization gates for anonymous usage.

**Planned changes:**
- Update `backend/main.mo` `getChatrooms() : async [ChatroomWithLiveStatus]` to ensure the reply stays under the ~3MB limit by excluding/emptying large fields (e.g., keep `description` empty, keep `pinnedVideoId` as `null`) and removing any inline `data:` / base64 payloads, while keeping the exact return type and requiring no frontend changes.
- If needed to stay under the limit, cap the number of chatrooms returned by `getChatrooms()` (e.g., most recent N) entirely within the function without altering stored data.
- Fix the thumbnail regression by ensuring `getChatrooms()` preserves valid non-`data:` `mediaUrl` values (including long/blob-storage URLs) and only blanks inline `data:` URLs.
- Remove/neutralize the runtime authorization gate in `deleteChatroomWithPassword(...)` so it no longer traps as “Unauthorized” due to caller permission checks, while keeping the function signature and non-auth behavior intact.

**User-visible outcome:** The lobby loads without payload-size failures, chatroom thumbnails display again for rooms with normal `mediaUrl` links, and anonymous users can delete chatrooms via `deleteChatroomWithPassword(...)` without being blocked by authorization traps.
