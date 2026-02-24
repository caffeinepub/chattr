# Specification

## Summary
**Goal:** Add sequential message IDs to all messages across the entire application.

**Planned changes:**
- Add a global message ID counter in the backend that increments sequentially for every message created
- Add an id field to the Message type to store formatted message IDs
- Format message IDs as zero-padded 9-digit strings (e.g., '000000001'), automatically expanding to 10+ digits when exceeding 999999999
- Display the message ID in the MessageBubble component for all messages, styled to match 4chan's post numbering system appearance
- No authorization checks or caller verification for message ID assignment

**User-visible outcome:** Users will see a unique sequential ID displayed with each message (like 4chan post numbers), making it easy to reference specific messages across all chatrooms.
