# Specification

## Summary
**Goal:** Allow creating a chatroom without attaching any media, while keeping media tabs visible and preserving the “only one media type when used” behavior.

**Planned changes:**
- Frontend: Update CreateChatroomDialog so Image/Video/Twitter tabs remain visible, and room creation can submit successfully with topic/description/category filled and no media provided.
- Frontend: Adjust validation so empty media inputs do not produce errors; validations run only when a media value is provided, and still enforce a single chosen media type.
- Backend: Update createChatroom(...) to accept empty mediaUrl/mediaType without trapping, skipping media validation when mediaUrl is empty and preserving existing public function signatures.
- Backend: When no media is provided, ensure the room’s initial message does not include mediaUrl/mediaType (null/absent), while storing empty media fields in the chatroom using the existing representation.

**User-visible outcome:** Users can create a chatroom without selecting/uploading/entering any media, while still seeing the Image/Video/Twitter tabs and getting the same validations when they do add exactly one media type.
