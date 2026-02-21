# Specification

## Summary
**Goal:** Remove all authentication and authorization checks to enable full guest access throughout the application.

**Planned changes:**
- Remove all msg.caller verification logic from every backend function in backend/main.mo
- Remove initAccessControl function call and access control initialization logic from backend
- Remove authentication-related logic from frontend hooks (useActor.ts) that calls initAccessControl

**User-visible outcome:** All users can access and use all features of the application without any authentication or login requirements. Guest users have unrestricted access to create rooms, post messages, add reactions, upload media, and perform all other actions.
