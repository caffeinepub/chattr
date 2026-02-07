# Specification

## Summary
**Goal:** Move chatroom category tags into the lobby thumbnail as a bottom-right overlay for clearer, more compact chatroom cards.

**Planned changes:**
- Update lobby chatroom cards to render the category tag as an overlay inside the thumbnail, positioned bottom-right when the chatroom has a non-empty category.
- Remove the category tag from its current placement next to/under the chatroom title.
- Ensure overlay legibility across bright/dark thumbnails (e.g., with a subtle background scrim/opacity and appropriate text styling).
- Maintain existing LIVE badge placement (top-left) and ensure the category overlay does not overlap it.
- Keep cards without a category visually stable (no overlay and no unexpected layout shift).

**User-visible outcome:** In the lobby grid, chatrooms with categories show a readable category label inside the thumbnail at the bottom-right, while chatrooms without categories show no label and the card layout remains consistent.
