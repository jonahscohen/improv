---
name: sidecoach mode words feel unnatural
description: Jonah hates the 6 mode words (forge, kiln, bloom, canvas, trim, ralph) - unnatural conversationally; vocabulary needs replacement
type: feedback
relates_to: [mapping_23_commands_to_flows.md]
---

Jonah's verdict on the sidecoach mode vocabulary (2026-06-12): "I hate all of those mode words. They're unnatural conversationally."

**Why:** The mode words were optimized for hook detectability (distinctive single tokens that never false-fire in normal prompts), which pushed them toward pottery-metaphor nouns. "Kiln this release" and "bloom the dashboard" are not sentences a person actually types. `ralph` was inherited from oh-my-claudecode for familiarity, not chosen on merit. Distinctiveness beat naturalness in every pick, and the result is a vocabulary Jonah has to memorize instead of one he already speaks.

**How to apply:** Do not add new magic keywords that fail the say-it-out-loud test. Any replacement scheme must read as natural English in a real prompt. Jonah's chosen direction (2026-06-12): intent detection, IF it can be made to really work. Second piece of standing guidance from the same exchange: "interviewing the user isn't a failure mode, it's a pathway to specificity that works" - a one-question confirm to disambiguate intent is welcome, not a violation of the no-lazy-questions rule. Touchpoints when implementing: sidecoach/src/modes.ts, claude/hooks/sidecoach-modes.json, sidecoach-intent.json, sidecoach-keyword.sh, sidecoach skill SKILL.md + CHEATSHEET.md.
