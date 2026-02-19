# Specification

## Summary
**Goal:** Remove authorization checks from user-facing backend functions to allow anonymous users to interact with the application while keeping admin functions protected.

**Planned changes:**
- Remove AccessControl.isAuthorized() calls from all user-facing functions in backend/main.mo (createChatroom, sendMessage, addReaction, removeReaction, updateUsername, updateAvatar, addReply)
- Preserve password-protected admin functions (deleteChatroom and other admin-only operations)

**User-visible outcome:** Anonymous users can create chatrooms, send messages, add reactions, update usernames/avatars, and add replies without encountering authorization errors. Admin functions remain password-protected.
