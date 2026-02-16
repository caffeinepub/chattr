# Specification

## Summary
**Goal:** Fix the Lobby initial-load issue so chatrooms display immediately without requiring a category selection.

**Planned changes:**
- Update the Lobby’s category-filter React Query to use a distinct query key (and/or conditional enabling) so it never shares the base `['chatrooms']` cache key when no category is selected.
- Prevent any category-filter backend request from being made when the selected category is empty, ensuring the base chatroom list cache is not overwritten.

**User-visible outcome:** On first load of the Lobby (no category selected, empty search), rooms appear immediately; selecting/clearing a category continues to filter/restore the list as before, and search works the same as before.
