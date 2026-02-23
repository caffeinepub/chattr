# Specification

## Summary
**Goal:** Remove all caller and Principal-based authentication checks from the backend to make all canister methods publicly accessible.

**Planned changes:**
- Remove all msg.caller and Principal-based authorization checks from backend/main.mo
- Make methods like createChatroom, deleteMessage, pinMessage, and updateUserProfile callable by any principal without authentication verification
- Ensure no assertion failures or authorization errors occur when methods are called without authentication

**User-visible outcome:** All backend functionality becomes publicly accessible without requiring authentication or authorization checks.
