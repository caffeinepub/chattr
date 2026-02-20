# Specification

## Summary
**Goal:** Fix GIF display to show animated images instead of plain text in chat messages.

**Planned changes:**
- Store the complete GIF URL (not just the name) when users select a GIF from the Giphy picker
- Update MessageBubble component to detect and render GIF URLs as animated img elements
- Modify MessageInput component to pass the full GIF URL when a GIF is selected

**User-visible outcome:** When users select a GIF from the Giphy picker, the actual animated GIF displays in the chat message instead of showing only the GIF name as plain text.
