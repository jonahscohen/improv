---
name: Hook calibration - prefer false positives over false negatives
description: Jonah's standing calibration for enforcement hooks - a hook that over-fires is fine, a hook that under-fires is not; wave off FPs plainly, never loosen a gate to silence them
type: feedback
---

Collaborator: Jonah. 2026-07-02.

Jonah, after the multiple-choice hook false-flagged a completion report: "I don't mind that the hooks create false positives, rather that than some false negatives."

**Why:** enforcement hooks exist to catch the expensive failure (a skipped gate, an unasked question, an unverified claim). A false positive costs one sentence of wave-off; a false negative costs a repeat of the failure the hook was built to prevent. The asymmetry favors over-firing.

**How to apply:**
- When tuning any enforcement hook (multiple-choice-enforce, sidecoach-keyword lexicon, bash-guard, content-guard, validation guards), bias thresholds toward sensitivity. Do not narrow a detector just to eliminate an over-fire that is cheap to dismiss.
- When a hook false-fires, state plainly why it is a false positive and proceed - do not apologize, do not silently rephrase work to dodge the detector, and do not treat the flag as evidence of an actual violation.
- A false-fire pattern is only worth fixing when it becomes noisy enough to erode trust in the hook's real alerts (the boy-who-cried-wolf threshold), and the fix must preserve recall on the true-positive cases. See T-0005 for the known multiple-choice over-fire backlog.

Same-day example: the sidecoach-intent hook fired on a thank-you message with no UI content. Correct response: note it, skip the flow, move on.
