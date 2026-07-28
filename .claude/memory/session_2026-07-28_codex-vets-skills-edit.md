---
name: Codex vets the skills/docs auto-trigger edit
description: Independent Codex review of the 15-file SKILL.md framing edit - claim 5 narrowly holds, claims 2/3/4 disputed, scope incomplete in 6 unedited files including the edited sidecoach's own frontmatter
type: project
relates_to: [session_2026-07-28_skills-never-fire.md]
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: codex-review
confidence: high
---

Jonah did not trust the Claude-side self-assessment of the skills work and asked for an
independent model's verdict on what is LEFT TO DO. Ran two `codex-review.py` passes
(gpt-5.5, effort high). Both returned exit 0 with real verdicts (113.7s, 119.3s).

**Why two passes:** pass 1 reviewed the diff plus the out-of-diff CLAUDE.md lines. A local
grep then found auto-trigger language surviving in files the diff never touched, which
Codex could not see. Pass 2 fed those excerpts so the scope-completeness judgement came
from Codex, not from me.

**How the wrapper was driven:** prompt POSITIONAL, diff on STDIN, `-C <repo>`. Both calls
backgrounded and polled because `timeout` does not exist on this machine; the poll loop
used `perl -e 'select(undef,undef,undef,10)'` rather than a foreground sleep.

Codex verdicts on the five claims:
- Claim 1 (417 transcripts, 11 of 12 idle for lack of demand): CANNOT VERIFY FROM DIFF. "Genuinely eligible" is rubric-dependent and the rubric is not in the artifact.
- Claim 2 (third-party skills firing refutes a harness cause): DISPUTED. Third-party skills firing does not rule out repo-specific causes - stale installs, weaker descriptions, missing orchestration.
- Claim 3 (cause is NOT register): DISPUTED. One non-invocation does not eliminate register.
- Claim 4 (auto-trigger language is fiction): DISPUTED. The premise "a hook must call the Skill tool for auto-triggering to exist" is a strawman - a shell hook cannot call a tool at all. The real mechanism is model selection from the injected description, which is what a normal reader means by auto-trigger.
- Claim 5 (framing-only, zero trigger widening): DISPUTED as stated, VERIFIED narrowly. Trigger tokens are byte-identical across the 14 description edits, corroborated by my own independent normalize-and-compare over all 15 files. It fails as a whole-claim because it excludes the sidecoach behaviour change, and because the proof measured repo files while the harness reads installed copies.

Highest-value findings, all independently verified after Codex reported them:
1. `claude/skills/sidecoach/SKILL.md:3` still reads "Also triggers on:" - the session edited this very file and missed its own frontmatter. Found by Codex, not by the Claude side.
2. `claude/hooks/browser-tree.json:156` still advertises "design skills that auto-trigger during UI work". Nobody had found this.
3. `claude/CLAUDE.md:32/46/57` unchanged, line 46 still carries the wait-and-see branch the edit deleted elsewhere. CLAUDE.md loads every session; a SKILL.md body only loads after invocation, so the unedited file is the one driving behaviour.
4. `claude/skills/design-build/SKILL.md:14` recorded the same "skills never auto-triggered" finding on 2026-05-20. Codex's read: this session re-derived a conclusion the repo already held for two months.
5. Install layer: skills are COPIED, not symlinked. Measured 13 of 15 installed files stale. sidecoach is the exception (real symlink) so its edit is live. Four installed copies match neither HEAD nor the working tree - pre-existing drift.

**Why the second pass mattered:** the single most damaging finding (the edited file's own
frontmatter still saying "Also triggers on") was invisible to a diff-only review, because
line 3 of sidecoach/SKILL.md is context, not a changed line. A review scoped to the diff
cannot catch what the diff failed to change.

Reported as findings only. Nothing fixed - Jonah's instruction was that Codex's judgement
is the deliverable.

Files touched: none in the repo. Artifacts at /tmp/codex_out.txt, /tmp/codex_out2.txt.
