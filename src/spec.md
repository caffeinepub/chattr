# Specification

## Summary
**Goal:** Add client-side image compression to all File-based image uploads to reduce serialized payload size while keeping uploads working end-to-end.

**Planned changes:**
- Implement a shared client-side image compression step that preserves orientation, downscales large images to a reasonable max dimension, and applies lossy compression before converting/storing as data URLs.
- Integrate compression into the canonical `uploadImage` pipeline in `frontend/src/hooks/useQueries.ts`, keeping the existing optional `onProgress` behavior intact.
- Update all File-based upload entry points to use the shared pipeline:
  - Avatar upload in `AvatarPickerDialog.tsx`
  - Chatroom media image upload in `CreateChatroomDialog.tsx`
  - Message image upload in `MessageInput.tsx` (remove/replace the local `uploadImage` implementation)
- Ensure graceful fallback: if compression fails, attempt the original (uncompressed) upload path and only surface an error if that also fails.
- Ensure no compression is applied to non-file media inputs (YouTube/Twitch/Twitter URLs) or Giphy avatar selection (remote URL).

**User-visible outcome:** Users can upload avatar images, chatroom images, and in-chat message images as before, but typical large photos serialize/upload as smaller payloads while still rendering correctly; uploads continue to work even if compression fails for a given file.
