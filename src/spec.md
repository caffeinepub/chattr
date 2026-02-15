# Specification

## Summary
**Goal:** Automatically expire and delete chatrooms older than 5 minutes (including rooms that already exist at rollout), and ensure the UI handles disappearing rooms cleanly.

**Planned changes:**
- Add backend cleanup logic to identify chatrooms where `now - createdAt > 5 minutes` and delete them along with all associated state (messages, active users, reactions).
- Enforce expiration in backend read APIs by filtering out expired rooms (lobby lists and single-room fetch) even if a cleanup pass hasn’t run yet, and trigger cleanup during normal canister activity.
- Update frontend behavior so that if a room expires while being viewed, the existing “Chat Not Found” state is shown and the Lobby list naturally reflects expired rooms on the next refresh.

**User-visible outcome:** Chatrooms automatically disappear after 5 minutes; expired rooms no longer show up in the Lobby, and users viewing an expired room are redirected to the existing not-found/removed experience without crashes.
