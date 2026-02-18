# Specification

## Summary
**Goal:** Restore character count progress bar and remove extra border in chatroom chat input.

**Planned changes:**
- Add character count progress bar below the textarea in MessageInput component matching the CharacterLimitProgress component style from CreateChatroomDialog
- Remove the extra top border from the chat input area in the chatroom page

**User-visible outcome:** Users will see a visual character count progress bar while typing messages in chatrooms (with color transitions based on usage), and the chat input area will have cleaner styling without the duplicate top border.
