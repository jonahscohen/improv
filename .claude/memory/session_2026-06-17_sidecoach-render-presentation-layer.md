---
name: Sidecoach engine gains a designed --render presentation layer
description: Added bin/sidecoach-present.js + a --render flag on sidecoach-monitor.js so a routed session emits a designed, low-noise, branded terminal view (route/phases/gates/progress) instead of bare JSON - so Sidecoach reads as a product, not vanilla Claude
type: project
relates_to: [session_2026-06-17_sidecoach-real-behavior-audit.md, session_2026-06-17_demo-full-loop-rebuild.md, feedback_simulations_match_real_tui.md]
---

Jonah: "fix the engine to produce vanity outputs that clearly demonstrate Sidecoach as a product, because otherwise everything looks like vanilla claude... we need to know what gets called in by sidecoach and where flows/phases begin, indicate progress, etc. and it should look designed, reduce noise/verbosity."

Built it engine-side (not just a demo skin):
- NEW bin/sidecoach-present.js - pure data-in/string-out renderer. ANSI truecolor (orange #D9794E brand mark/accents, green pass, off-white, dim/faint), honors NO_COLOR. Renders: branded header (◆ sidecoach · <verb> + the utterance between rules), route (flowName · flowId · confidence), flow chain (phase › phase), per-phase ◇ markers with [done]/[skipped] status + a condensed dimension scan-line, a checklist progress bar (▰/▱ distinct glyphs so it reads w/o color) with N/M handed-to-claude, gates (✓/✗ per validator + letter grade), verdict + next step. Defensive: omits any absent section.
- bin/sidecoach-monitor.js: added a `--render` flag in executeFlow. Default stays JSON so the skill's programmatic parse is untouched.

Verified (multiple real runs):
- presenter loads; `--render` prints the designed view; routing adapts (audit->flowK Multi-Lens Audit, polish->flowJ 16-Point Tactical Polish, conf ~0.85); color escape codes emit (11 in a colored run); NO_COLOR structure legible.
- Two bugs found-and-fixed during verify: (1) progress bar used one glyph for filled+empty so it looked 100% full under NO_COLOR -> now ▰ filled / ▱ empty; (2) phase sub-line grabbed wrong guidance lines (garbage "register: · design...") -> restricted to /^Dimension N:/ only.

Honest engine facts observed while testing (NOT renderer bugs - real behavior):
- The main flow often returns [skipped] "prerequisites not met" unless run from a dir with PRODUCT.md + DESIGN.md (project context). From sidecoach/ cwd the audit flow skips; from marketing-site/ it runs.
- Even with context, sub-flows skip (e.g. design critique [skipped]).
- The checklist is always 0/N - the engine hands it to Claude and never executes it itself (consistent with the earlier finding that the engine routes + scaffolds; Claude does the work).
- Output is nondeterministic across runs (flow composition, confidence, presence of buildReport/verdict vary on near-identical input).

Next (not yet done): replay this designed render in the marketing demo (marketing-site/demo.html) with animated progress so the web demo shows the real Sidecoach surface, not vanilla Claude.

Files: sidecoach/bin/sidecoach-present.js (new), sidecoach/bin/sidecoach-monitor.js (--render wired).

Collaborator: Jonah.
