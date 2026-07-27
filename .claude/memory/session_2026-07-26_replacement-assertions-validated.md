---
name: Replacement suppression assertions pre-validated before handing them to the implementer
description: Before dispatching the fix, proved all three replacement prompts fire with suppression removed - so the corrected tests are real, not a second round of the same vacuous mistake. Included removing the XML-scrub line from a temp hook copy to exercise that branch.
type: project
relates_to: [session_2026-07-26_vacuous-suppression-tests.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: each replacement probed twice - against the real lexicon/hook (SILENT) and against a suppression-disabled lexicon or an XML-scrub-stripped hook copy (FIRES)
confidence: high
---

# Replacement assertions validated

Collaborator: Jonah. After finding three vacuous suppression tests, the obvious
risk was writing three more. So the replacements were validated BEFORE the fix
was dispatched, using the same disable-and-observe method that exposed the
originals.

| replacement prompt | with suppression | without suppression |
|---|---|---|
| `find all the callers` (20 chars) | SILENT | **FIRES** |
| `what is the best way to find all the callers of detect-session-model in this repo` | SILENT | **FIRES** |
| `<quote>find all the callers of detect-session-model</quote> was the wording in the old ticket we archived` | SILENT | **FIRES** |

All three are real: each matches a tier pattern and is silenced by exactly the
rule it claims to test.

Method note for the third case: the XML scrub cannot be disabled through the
lexicon, since it is code rather than config. A temp COPY of `route-intent.sh`
was made with the single XML-scrub line stripped (87 bytes) and the prompt
probed against that copy. The real hook was never modified. That is the general
technique when the behavior under test lives in code rather than data.

Why the second prompt is worded the way it is: it is deliberately over 40
characters so the LENGTH gate cannot be what silences it. Without that, it
would pass for the wrong reason and be vacuous in a new way. Each suppression
assertion must isolate ONE rule.

## Hook false positive worth noting

The `CODE DEPLOYED/BUILT` PostToolUse hook fired on this shell-only work and
demanded a screenshot. There is no UI in this project - it is hooks, JSON, and
bash. Verification here is behavioral (mutation tests, observed hook output),
not visual. Flagging that the hook's trigger is too broad for CLI/hook repos
rather than silently ignoring it.

## Files touched
- `.claude/memory/session_2026-07-26_replacement-assertions-validated.md` (this beat)
- No repo files changed; both probe artifacts were temp files and were deleted
