# Specification

## Summary
**Goal:** Update the LIVE badge to remove the numeric live user count and adjust its padding in the lobby.

**Planned changes:**
- In lobby chatroom cards, render the LIVE badge text as only "LIVE" (no numeric count) while keeping the pulsing dot indicator.
- In the lobby only, update the LIVE badge top/bottom padding to 0.125rem (py-0.5) without changing left/right padding.
- In the chatroom page header, render the LIVE badge text as only "LIVE" (no numeric count) while keeping the pulsing dot indicator and leaving the separate connected indicator/count unchanged.

**User-visible outcome:** LIVE badges in both the lobby and chatroom header display only “LIVE” with the pulsing dot, and the lobby LIVE badge appears slightly tighter vertically without affecting other room metadata.
