# Specification

## Summary
**Goal:** Remove the `accessControlState` variable from `backend/main.mo` while keeping the canister compiling and preserving all existing public function names and signatures.

**Planned changes:**
- Delete the `accessControlState` definition in `backend/main.mo`.
- Update all `AccessControl.*(accessControlState, ...)` call sites to pass a valid `AccessControl.AccessControlState` value without reintroducing any new state variable named `accessControlState`.
- Ensure the existing in-file `module AccessControl { ... }` stub (or equivalent) continues to compile and that the canister builds successfully.

**User-visible outcome:** No user-facing changes; the backend builds successfully with the same public API as before.
