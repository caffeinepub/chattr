# Specification

## Summary
**Goal:** Enable inline link embedding in chat by detecting X post and YouTube/Twitch video URLs directly in the chat input field.

**Planned changes:**
- Remove the separate X post and video input fields from MessageInput
- Detect X post URLs (x.com/twitter.com) and YouTube/Twitch video URLs in the main chat input field
- Display inline preview of embedded content below the chat input before sending
- Extract and store detected URLs in appropriate mediaType and mediaUrl fields when sending messages
- Render embedded content inline in sent messages using existing MessageBubble embed logic

**User-visible outcome:** Users can paste X post or YouTube/Twitch video links directly into the chat input, see a preview before sending, and view embedded content inline in the chat feed without using separate input fields.
