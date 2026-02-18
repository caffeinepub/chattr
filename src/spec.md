# Specification

## Summary
**Goal:** Conditionally display the Creator message on room cards only when the room was created with media attachments.

**Planned changes:**
- Update room card display logic to check if a room has media (image, video, or X post)
- Hide the Creator message for rooms created without any media
- Keep the Creator message visible for rooms with media attachments

**User-visible outcome:** Room cards will show the Creator message only for rooms that include media content, creating a cleaner interface for text-only rooms.
