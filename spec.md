# Specification

## Summary
**Goal:** Reorder the header elements of current user messages so they mirror the left-to-right layout used for other users' messages.

**Planned changes:**
- For current user message headers, reorder the four elements left-to-right as: Message ID → Timestamp → Username → Avatar
- No styles, colors, spacing, font sizes, CSS classes, or any other visual properties are changed — only the DOM order of these four elements

**User-visible outcome:** Current user message headers will display the message ID on the far left, followed by the timestamp, then the username, and the avatar on the far right — matching the structural order of other users' messages.
