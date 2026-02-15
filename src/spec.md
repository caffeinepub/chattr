# Specification

## Summary
**Goal:** Use the first attached photo from an X/Twitter status as the background thumbnail for chatroom cards that link to that post.

**Planned changes:**
- For chatroom cards where `mediaType='twitter'` and `mediaUrl` is an X/Twitter status URL, extract the tweet/status ID, fetch the public `tweet-result` JSON from `https://cdn.syndication.twimg.com/tweet-result?id=TWEET_ID&token=123`, and parse the first attached photo URL (if present).
- Render the extracted photo as the chatroom card thumbnail background image using an object-cover style.
- Add safe handling and lightweight caching keyed by tweet URL/ID to avoid repeated refetching; if no photo is found or fetch fails, fall back to the existing Twitter thumbnail behavior without affecting other embeds or media thumbnails.

**User-visible outcome:** Chatroom cards for X/Twitter posts with attached photos show the post’s first photo as the thumbnail background; posts without photos (or failed fetches) look the same as before.
