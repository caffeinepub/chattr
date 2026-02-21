# Specification

## Summary
**Goal:** Update username display format to 8-character alphanumeric format with mixed case.

**Planned changes:**
- Modify backend username generation to produce 8-character alphanumeric usernames using uppercase letters, lowercase letters, and numbers (e.g., 'A3x7K9m2', 'B5n2M8k1')
- Update all frontend components to display the new 8-character username format
- Maintain all existing username generation logic and behavior - only change the output format

**User-visible outcome:** Users will see 8-character alphanumeric usernames (mixing uppercase, lowercase, and numbers) throughout the application instead of the current format.
