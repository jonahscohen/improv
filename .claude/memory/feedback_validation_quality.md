---
name: Validation must be critical, not mechanical
description: When verifying UI work, actually examine screenshots for problems - overlapping elements, clipping, misalignment - not just element existence
type: feedback
relates_to: [session_2026-05-12_global-verification-hook.md]
---

Taking a screenshot is not validation. Validation means examining what you see and asking: "Does this match what the user asked for? Does anything look wrong?" Multiple times in this session, screenshots showed clear problems (overlapping icons, clipped borders, flat circles) that were reported as passing.

**Why:** The verification hook fires and says "take a screenshot." But taking a screenshot and glancing at it is not the same as critically examining it. The collapsed toolbar showed two overlapping icons and was reported as "perfect circle, verified."

**How to apply:**
- After every screenshot, describe what you ACTUALLY see in specific visual terms
- Compare against what was requested: does it match?
- Look for: overlapping elements, clipped edges, wrong colors, missing content, z-index issues
- If something looks even slightly off, investigate before reporting success
- "The element exists" is not validation. "The element looks correct" is validation.
