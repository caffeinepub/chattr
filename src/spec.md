# Specification

## Summary
**Goal:** Remove caller-principal and authorization/role checks that currently block profile avatar upload/update, while keeping the app usable anonymously.

**Planned changes:**
- Update `backend/main.mo` to remove any `caller` principal comparisons and any `AccessControl.*` / role-check gating from avatar upload and avatar URL update methods.
- Keep non-avatar authorization behavior unchanged (e.g., admin-only operations unrelated to avatars).
- Verify the existing frontend avatar flow in `frontend/src/components/AvatarPickerDialog.tsx` (including `uploadImage(...)` and `useUpdateAvatar()`) still works end-to-end without adding any login/auth UI, and that user-facing error messages remain in English.

**User-visible outcome:** Users can upload a custom avatar, set an avatar via a Giphy GIF, or remove their avatar successfully without authorization-related failures, even when using the app anonymously.
