# Specification

## Summary
**Goal:** Fix character count progress bars to update instantly on typing across all components.

**Planned changes:**
- Update CreateChatroomDialog to calculate character count percentage inline during render instead of using useEffect
- Update ProfileSetupModal to calculate character count percentage inline during render instead of using useEffect
- Update MessageInput to calculate character count percentage inline during render instead of using useEffect
- Update ChatroomCard to calculate character count percentage inline during render instead of using useEffect

**User-visible outcome:** Progress bars for topic input, username input, and message text input now fill immediately as the user types without any delay.
