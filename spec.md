# Specification

## Summary
**Goal:** Replace the inline message action buttons in MessageBubble with a context menu, without changing any other styles or components.

**Planned changes:**
- Remove the inline Reply, React, and Share action buttons from the message bubble UI
- Add a context menu that opens on right-click (desktop) and long-press (mobile) on a message bubble
- The context menu contains the same Reply, React, and Share actions with identical behavior
- The context menu dismisses when clicking/tapping outside it and stays within the viewport

**User-visible outcome:** Users no longer see inline action buttons on message bubbles; instead, they right-click (desktop) or long-press (mobile) a message to reveal a context menu with the same actions.
