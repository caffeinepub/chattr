# Specification

## Summary
**Goal:** Adjust the chatroom message input UI to use pill-shaped styling, move mic/media controls to the left of the text input, and match input height to the send button in the default state.

**Planned changes:**
- Update the chatroom message text input (Textarea) to use a 9999px (rounded-full) border radius for a pill shape.
- Reorder the message input row so the image/media and microphone buttons appear to the left of the text input, keeping the send button present and usable.
- Apply a 9999px (rounded-full) border radius to the microphone, image/media, and send buttons in the message input area.
- Ensure the single-line (non-expanded) text input height matches the send button height while preserving existing multi-line auto-grow behavior.
- Keep all changes confined strictly to the chatroom message input layout/styling without modifying other UI, behavior, logic, or backend code.

**User-visible outcome:** On the chatroom page, the message input row appears pill-shaped with rounded buttons, mic/media controls on the left of the text field, and the text input matching the send button height for single-line input.
