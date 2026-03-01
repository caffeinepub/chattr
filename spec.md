# Specification

## Summary
**Goal:** Add text labels to message action buttons and remove the numeric character count text from the message input area.

**Planned changes:**
- Add visible text labels ("Reply", "React", "Share", "Flag") alongside the existing icons on the four message action buttons in MessageBubble.tsx
- Remove the numeric character count text from the character counter in MessageInput.tsx (non-text indicator such as a progress ring may remain)

**User-visible outcome:** Message action buttons now display their names next to their icons, and the message input no longer shows a numeric character count.
