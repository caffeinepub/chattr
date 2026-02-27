# Specification

## Summary
**Goal:** Polish the chat input area layout and clean up message bubble visuals in the Chattr app.

**Planned changes:**
- Vertically center-align all elements in the chat input bar (text input and action buttons) so they share the same horizontal axis
- Reduce vertical padding in the chat input area to give more vertical space to the messages list above it
- Visually hide message ID labels in chat message bubbles while keeping their anchor elements in the DOM so share links and URL-based anchoring remain functional

**User-visible outcome:** The chat input bar looks cleaner and more compact, message IDs are no longer visible in the chat, and share links still scroll to and highlight the correct message.
