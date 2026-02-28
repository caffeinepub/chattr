# Specification

## Summary
**Goal:** Polish the chat message input area layout and hide message IDs visually in message bubbles.

**Planned changes:**
- Vertically center all elements in the chat message input area (text field, send button, attachment buttons, character count indicator) so they align on the same vertical axis
- Reduce the vertical padding (top and bottom) of the chat input container to make it more compact while keeping all controls intact
- Hide message ID text inside message bubbles visually (via CSS) while keeping the elements in the DOM so share link functionality continues to work

**User-visible outcome:** The chat input area appears more compact and neatly aligned, and message bubbles no longer display visible message ID text, while all existing controls and share functionality remain fully operational.
