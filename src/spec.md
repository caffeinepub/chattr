# Specification

## Summary
**Goal:** Redesign the chat input area with styled rounded buttons and an auto-expanding textarea.

**Planned changes:**
- Replace the MessageInput component styling with a new design featuring a border-top separator and card background
- Add left-aligned rounded image upload button with lucide-image icon
- Add left-aligned rounded microphone/voice recording button with lucide-mic icon
- Implement center auto-expanding rounded textarea (min 40px, max 120px height) with placeholder text
- Add right-aligned rounded send button with primary background and lucide-send icon
- Enable send button only when textarea contains text, disabled when empty
- Preserve all existing media attachment and recording functionality

**User-visible outcome:** Users will see a redesigned chat input area with clearly styled rounded buttons for image uploads and voice recording, an auto-expanding text input field, and a send button that activates when they type a message.
