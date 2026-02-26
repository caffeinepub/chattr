# Specification

## Summary
**Goal:** Hide the visible message ID text from chat bubbles in the UI while keeping the ID accessible in the DOM for anchor/share functionality.

**Planned changes:**
- In `MessageBubble.tsx`, remove the visible rendering of the message ID from the chat bubble UI
- Ensure each message's DOM element retains an `id` or `data` attribute containing the message ID so URL anchor scrolling and share links continue to work

**User-visible outcome:** Message IDs no longer appear as visible text in chat bubbles, while share links and scroll-to-message functionality remain fully intact.
