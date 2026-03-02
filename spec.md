# Specification

## Summary
**Goal:** Reorganize the chat input controls in Chattr by moving the image/GIF button inside the input field with a floating popover, and swapping the send/voice buttons based on input state.

**Planned changes:**
- Move the image/GIF button to the left side inside the chat input container
- Clicking the image/GIF button opens a floating popover/modal panel anchored above the chat input (not a dropdown), containing the existing image upload and GIF picker options
- Clicking outside the popover or pressing Escape closes it
- Show the voice message button by default on the right side of the chat input
- When the chat input is focused or has text, hide the voice button and show the send button in its place
- When the input loses focus and is empty, swap back to the voice button

**User-visible outcome:** Users see the image/GIF button inside the chat input on the left; clicking it reveals a floating panel above the input with image/GIF options. The send button only appears when the input is active or has text, replacing the voice button, which returns when the input is empty and unfocused.
