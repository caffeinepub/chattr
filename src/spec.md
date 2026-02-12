# Specification

## Summary
**Goal:** Replace the current X/Twitter lobby thumbnail generation (offscreen embed + html2canvas) with a lightweight, reliable reconstructed preview based on Twitter’s public oEmbed JSON.

**Planned changes:**
- Add a frontend utility to fetch `https://publish.twitter.com/oembed?url=...&omit_script=true`, parse safe preview fields (author name/URL, text snippet, optional first image URL when safely extractable), and return a typed result with handled error states.
- Update `frontend/src/components/ChatroomCard.tsx` to render the reconstructed X/Twitter preview in the thumbnail area (image+label when available, otherwise a clean text-only author+snippet preview), including a non-blocking loading state.
- Implement localStorage caching for reconstructed X/Twitter preview data with a stable key (prefer tweet/status ID when available, otherwise full URL) and expiration, with graceful invalidation/re-fetch on expiry or invalid entries.
- Remove/disable the lobby thumbnail generation path that snapshots Twitter embeds (stop using `twitterThumbnail.ts`, `twitterEmbedRenderer.ts`, and `html2canvasLoader.ts` for lobby cards; eliminate related imports/state/warnings).

**User-visible outcome:** In the lobby grid, X/Twitter chatroom cards show consistent previews (author/snippet and sometimes an image) that load smoothly and no longer fail due to cross-origin canvas screenshotting; non-Twitter cards remain unchanged.
