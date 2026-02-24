# Specification

## Summary
**Goal:** Add automatic URL detection in chat messages with a Lucide ExternalLink icon and a disclaimer modal before navigating to external links.

**Planned changes:**
- Detect URLs in MessageBubble component and render them as clickable anchor elements
- Display a Lucide `ExternalLink` icon immediately before each detected link
- Intercept link clicks to show a disclaimer modal with the text: "You are about to leave Chattr. External links may be unsafe — proceed with caution."
- Modal includes a Confirm button (opens link in new tab) and a Cancel button (closes modal without navigating)
- No existing layout styles, spacing, colors, or other UI elements are changed

**User-visible outcome:** Users see clickable links with an ExternalLink icon in chat messages. Clicking a link shows a safety disclaimer modal where they can confirm to open the link in a new tab or cancel to stay in Chattr.
