# Specification

## Summary
**Goal:** Disable the browser's native mobile long-press behavior when triggering the custom context menu in MessageBubble.tsx.

**Planned changes:**
- Call `preventDefault()` on `touchstart` and `contextmenu` events in MessageBubble.tsx to suppress native mobile long-press popups
- Add `onContextMenu={(e) => e.preventDefault()}` alongside existing touch event handlers
- Apply `-webkit-touch-callout: none` and `touch-action: none` CSS properties to the message bubble element

**User-visible outcome:** On mobile (iOS and Android), long-pressing a message bubble no longer triggers native browser context menus, text selection popups, or image/link save dialogs — only the custom context menu appears.
