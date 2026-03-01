# Specification

## Summary
**Goal:** Replace the always-visible message action buttons in MessageBubble.tsx with a context menu triggered by right-click on desktop and long-press on mobile.

**Planned changes:**
- Remove the always-visible Reply, React, and Share action buttons from message bubbles
- Add a context menu that opens on right-click (desktop) or long-press (~500ms, mobile)
- Context menu contains the same three actions — Reply, React, and Share — with identical functionality
- Context menu dismisses when clicking/tapping outside of it
- Only MessageBubble.tsx is modified; no other files, styles, or layouts are changed

**User-visible outcome:** Users no longer see action buttons on message bubbles by default. Instead, they right-click (desktop) or long-press (mobile) a message bubble to reveal a context menu with Reply, React, and Share options.
