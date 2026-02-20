# Specification

## Summary
**Goal:** Add Giphy GIF support to chat messages and streamline the media button by removing redundant video and X posts tabs.

**Planned changes:**
- Add a new Giphy tab to the media button with search functionality and preloaded popular GIFs
- Remove the video tab from the media button (videos can still be embedded via URL)
- Remove the X posts tab from the media button (X posts can still be embedded via URL)
- Implement Giphy integration using the same pattern as AvatarPickerDialog.tsx (search with debouncing, trending GIFs)
- Skip any caller checks or authentication validations for Giphy functionality

**User-visible outcome:** Users can search and send GIFs from Giphy directly in chat via the media button, while video and X post embedding continue to work through URL pasting.
