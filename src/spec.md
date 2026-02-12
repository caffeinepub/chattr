# Specification

## Summary
**Goal:** Fix the non-functional Giphy GIF search in `AvatarPickerDialog` so typing in the search bar actually fetches and displays results reliably.

**Planned changes:**
- Replace the incorrect `useState(() => { ... })` side-effect usage with a `useEffect` that runs when `debouncedSearchTerm` changes to trigger the Giphy search request.
- Ensure clearing the search input clears `giphyResults` and `giphyError` and does not issue a Giphy request.
- Guard against stale/out-of-order responses (and dialog close/unmount) so only the latest debounced search updates `giphyResults`/`giphyError` and no state updates occur after unmount.

**User-visible outcome:** Typing into the Giphy search input triggers a debounced search that updates GIF results; clearing the input clears results/errors; rapid typing or closing the dialog won’t cause incorrect results or React unmounted-update warnings.
