# Specification

## Summary
**Goal:** Update lobby card timestamps to reflect the most recent activity from either new messages or new reactions.

**Planned changes:**
- Update backend Chatroom type to track and store the timestamp of the most recent activity (new message or new reaction)
- Update the backend to refresh this timestamp whenever a message is posted or a reaction is added
- Update lobby card UI to display this last modified timestamp instead of the current timestamp

**User-visible outcome:** Users will see lobby cards with timestamps that accurately reflect the most recent activity in each chatroom, whether from a new message or a new reaction.
