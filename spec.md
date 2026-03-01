# Specification

## Summary
**Goal:** Fix several message bubble UI issues in the Chattr chat interface: avatar alignment, username font size, timestamp placement, and mobile long-press behavior.

**Planned changes:**
- Align the avatar to the top of the message bubble container (instead of the bottom) for both sent and received messages
- Slightly increase the font size of the username label near the avatar (e.g., `text-xs` → `text-sm`), without changing the timestamp font size
- Move the timestamp inside the message bubble (e.g., bottom-right/bottom-left of the bubble content area) instead of outside or below it
- Suppress native mobile long-press browser behavior on message bubbles by applying `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, and calling `event.preventDefault()` on the `onContextMenu` handler

**User-visible outcome:** Message bubbles display avatars at the top, usernames are slightly larger, timestamps appear inside the bubble, and long-pressing on mobile no longer triggers the native browser context menu or text selection — allowing the custom context menu to work without interference.
