# Specification

## Summary
**Goal:** Force production clients/CDNs to fetch the latest lobby frontend bundle so users reliably receive the corrected first-load behavior (rooms visible with no category selected).

**Planned changes:**
- Update `frontend/index.html` to use a deterministic cache-busting version on the module script URL (e.g., a query string on `/src/main.tsx`) with a single, obvious value to increment later.
- Add no-cache meta directives in `frontend/index.html` (Cache-Control/Pragma/Expires equivalents) to discourage browser caching while keeping valid HTML.

**User-visible outcome:** After deployment and a hard refresh, the lobby shows rooms on first load without requiring a category selection, because the newest frontend bundle is served instead of a stale cached copy.
