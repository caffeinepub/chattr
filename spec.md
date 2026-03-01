# Specification

## Summary
**Goal:** Polish the message bubble action buttons and clean up the chat input area by unifying colors and removing redundant UI elements.

**Planned changes:**
- In `MessageBubble.tsx`, update the font and icon color of the Reply, React, Share, and Report action buttons to match the gray color used by the message timestamp.
- In `MessageInput.tsx`, remove the text-based line character counter displayed below the chat input field while keeping the circular character counter inside the input intact.

**User-visible outcome:** Action buttons in message bubbles will have a consistent gray color matching the timestamp, and the chat input area will no longer show a redundant character counter below the field.
