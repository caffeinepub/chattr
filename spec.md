# Specification

## Summary
**Goal:** Add a custom context menu with a "Copy Text" option to chat messages, reduce message spacing, and suppress native mobile long-press behavior.

**Planned changes:**
- Add a custom context menu to `MessageBubble.tsx` triggered by right-click on desktop and a ~500ms long press on mobile
- Include a "Copy Text" option in the context menu that copies the message text to the clipboard
- Dismiss the context menu when clicking or tapping outside of it
- Reduce vertical spacing/gap between message bubbles in `ChatArea.tsx` for a more compact look
- Suppress the browser's native long-press behavior on message bubbles via CSS (`user-select: none`, `-webkit-touch-callout: none`) and JavaScript (`preventDefault` on relevant touch/context events)
- Preserve all existing layout, username rendering, and avatar rendering exactly as-is

**User-visible outcome:** Users can right-click (desktop) or long-press (mobile) a message to open a custom context menu and copy the message text. Messages appear more compact, and no native browser popup interferes on mobile.
