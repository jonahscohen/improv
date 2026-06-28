---
name: Sidecoach reframe - diagnosis of existing UI IS an audit (mental-model fix)
description: Jonah showed a fresh Claude reasoning ITS WAY OUT of sidecoach on a pure-diagnosis request ("diagnosis is a read, audit is a post-build gate, running it now dresses up an opinion"). The framing everywhere defined audit as post-build QA only, so Claude correctly concluded the gate did not apply. Fixed by reframing audit as the PRIMARY read path for diagnosing existing UI, in CLAUDE.md + SKILL.md + the nudge, rebutting each rationalization.
type: feedback
relates_to: [session_2026-06-26_sidecoach-NL-tier-fixes-verified.md, session_2026-06-26_sidecoach-NL-tier-dead-rootcause.md, session_2026-06-26_sidecoach-invocation-gap.md]
---

Collaborator: Jonah. 2026-06-26. Jonah: "It started down the same path again."

## THE DEEPER BUG (framing, not deploy)
After the deploy fix (NL tier was dead - separate beat), Jonah ran it again. A fresh Claude,
asked "are you planning to use sidecoach?" on a pure DIAGNOSIS request, gave a coherent
justification for NOT using it: "diagnosis is a read, not a build; sidecoach's QA gate is
for verifying a concrete UI change before reporting done; loading audit now would dress up
an opinion as a formal pass without anything built to gate; a diagnosis is upstream of that."
That reasoning is WRONG but it follows directly from the framing: CLAUDE.md:282, SKILL.md:184,
SKILL.md:147 ALL define /sidecoach audit as a post-build QA gate ("before reporting done on
any substantive UI CHANGE", "After implementing: run audit"). Nothing anywhere said audit is
the tool to DIAGNOSE an existing page on request. So with no build, Claude rationalized out -
and even my prior nudge copy-tweak just added a competing line that lost to the dominant model.

## WHY THE RATIONALIZATION IS WRONG
/sidecoach audit literally renders a URL + runs the detection engine + reports findings. That
IS a diagnosis, done rigorously. "What's wrong with this page" and "audit this page" are the
same request. The freeform eyeball read is the opinion; the audit is the measurement. The
Claude invented a gate-vs-read distinction that does not exist in what audit actually does -
it only exists in the docs' post-build framing.

## THE FIX (attack the mental model in all 3 surfaces)
- claude/CLAUDE.md: inserted a forceful rule BEFORE the QA-gate section: "Diagnosing or
  critiquing existing UI IS a sidecoach audit - run it, do not eyeball it." Run audit/critique
  as the FIRST step before forming an opinion; not only post-build; NOT "dressing up an opinion"
  (freeform read = opinion, audit = measurement); a diagnosis is sidecoach's primary read path,
  not "upstream of" it. Relabeled the existing gate "(the other use of the same tools)".
- claude/skills/sidecoach/SKILL.md: added Mandatory Gate 0 with the same rule.
- claude/hooks/sidecoach-intent.json: sharpened the nudge to rebut "dressing up an opinion"
  and drop the "gate" framing for the diagnosis case (now "primary read path... the audit is
  the measurement").

## VERIFIED (mechanical)
- sidecoach-intent.json valid JSON; nudge keeps DIAGNOSE + /sidecoach audit + the measurement
  rebuttal + the "reads as front-end" opener (test anchor).
- Zero banned chars (no emdash/endash/emoji) in all 3 edited files.
- test-sidecoach-keyword.sh: 114 passed, 0 failed.
- Live propagation confirmed: the new rule is present in the live ~/.claude/CLAUDE.md AND
  ~/.claude/skills/sidecoach/SKILL.md (both symlinks resolve to the edited repo files), so a
  fresh session loads it.
- BEHAVIORAL validation (does a fresh Claude now route instead of rationalize) is the real
  test. Tried to reproduce via a fresh named teammate (decision-only: "are you planning to
  use sidecoach?" on the diagnosis prompt) but the spawn was BLOCKED - the cmux session team
  file (session-bef88f21) was torn down when the earlier agents were sent home (known
  cmux team-init orphan issue; not chased - out of scope for this fix). Definitive behavioral
  proof = Jonah re-running his exact prompt in a fresh top-level session. Mechanical green is
  necessary, not sufficient.

## SELF-ANALYSIS
My prior pass treated this as a copy tweak (add a diagnosis line to the nudge). It was a
mental-model problem: the post-build framing was authoritative and ubiquitous, so a single
competing line could not overturn it. Lesson: when a Claude rationalizes AROUND a nudge with
a coherent story, the fix is to correct the MODEL the story rests on (in the authoritative
doc), not to add another advisory line that competes with it.

## Files touched
- claude/CLAUDE.md, claude/skills/sidecoach/SKILL.md, claude/hooks/sidecoach-intent.json
</content>
