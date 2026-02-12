# Specification

## Summary
**Goal:** Re-add Giphy GIF avatar selection in the existing avatar picker without any style/layout changes.

**Planned changes:**
- Add client-side Giphy search + results browsing UI/logic inside `frontend/src/components/AvatarPickerDialog.tsx`, keeping all existing elements and their current Tailwind `className` strings unchanged (only additive markup/logic for Giphy support).
- Implement debounced (or explicit-action) Giphy requests from the frontend using API key `rDA2nx5ya4RMgjd6KOJ0lrAtm9KLBWUv`, with no new backend endpoints and no changes to global styling/Tailwind configuration.
- On selecting a Giphy result, set the avatar via the existing `useUpdateAvatar` mutation (`avatarUrl` = chosen GIF URL, `isPreset=false`) and close the dialog (matching existing upload behavior).
- Add English empty/error states for “no results” and request failures while keeping existing avatar picker features (upload/remove) working.

**User-visible outcome:** Users can search Giphy in the avatar picker and set their avatar to a selected GIF URL, with the app’s existing styling/layout unchanged.
