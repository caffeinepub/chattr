# Specification

## Summary
**Goal:** Polish the Chattr chat UI by moving quoted reply previews inside message bubbles, making action buttons always visible with icons only, and removing the redundant character counter below the chat input.

**Planned changes:**
- Move quoted reply previews to render inside the chat bubble container, above the message text, rather than outside the bubble
- Make message action buttons (reply, react, pin, etc.) always visible on all message bubbles instead of only on hover
- Remove all text labels from action buttons, leaving only the icons
- Remove the character counter displayed below the chat input field, while keeping the circular counter inside the input intact

**User-visible outcome:** Quoted replies appear as part of the message bubble, action buttons are always shown with icons only, and the chat input no longer shows a duplicate counter below it.
