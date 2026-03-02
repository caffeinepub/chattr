# Specification

## Summary
**Goal:** Fix the send button in the chat input area so it is fully visible and never clipped or cut off.

**Planned changes:**
- Update the `MessageInput` component layout to ensure the send button has sufficient padding, minimum width, and proper flex constraints
- Ensure the textarea and send button coexist in the same row without overlapping or overflow at all viewport sizes

**User-visible outcome:** The send button is always fully visible in the chat input area, with no clipping or truncation, while all existing functionality remains unchanged.
