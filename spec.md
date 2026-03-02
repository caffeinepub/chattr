# Specification

## Summary
**Goal:** Overlay both the unpin (X) button and a pin indicator icon directly on the pinned video thumbnail, removing the separate header row.

**Planned changes:**
- Remove the existing separate header row/section that housed the unpin button in the PinnedVideo component
- Overlay the X (unpin) button absolutely at the top-right corner of the video container, styled as a small circular semi-transparent button with hover effect
- Overlay a non-clickable Lucide Pin icon absolutely at the top-left corner of the video container, styled identically to the X button

**User-visible outcome:** The pinned video thumbnail displays both a pin icon (top-left) and an X button (top-right) overlaid directly on the video, with no separate header row, giving a cleaner look and more vertical space for the video.
