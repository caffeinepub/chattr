# Specification

## Summary
**Goal:** Restore the action button styling in MessageBubble.tsx to how it appeared in Version 335, fixing the invisible buttons caused by layout reorder changes in Version 369.

**Planned changes:**
- Revert action button styles (colors, visibility, opacity, backgrounds, borders, hover states) in `MessageBubble.tsx` to match Version 335
- Preserve the message header layout reorder (Message ID → Timestamp → Username → Avatar) from Version 369

**User-visible outcome:** Action buttons in message bubbles are fully visible and styled as they were before Version 369, while the updated message header layout remains intact.
