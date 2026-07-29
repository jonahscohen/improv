---
name: marketing-buzzword - the rule is real, the enforcement claim never was
description: Claim-versus-reality answer. The rule exists, is calibrated, and fires; the docs asserting a taste validator and a write-time hook enforce it are false, and the ban count in those docs is stale by one and names a deleted scanner.
type: feedback
relates_to: [session_2026-07-29_detector_finding-locations.md]
author_human: Jonah
author_model: claude-opus-4.6
source: session
verified: benchmark/probe-buzzword.js raw scores + end-to-end CLI render lane; anchored on a planted positive before any not-caught conclusion
confidence: high
---

**Does the rule fire? YES - proven, not assumed. Was the enforcement claim ever true? NO.**

Anchor first, because a "does not fire" result is worthless without one. `benchmark/probe-buzzword.js`
runs the SHIPPING `inPageBuzzword` + `buzzwordFindingFromScore` (no reimplementation) and prints the
raw score:

    node benchmark/probe-buzzword.js \
      benchmark/fixtures/mutation/buzzword-positive.html \
      benchmark/fixtures/mutation/buzzword-clean.html \
      benchmark/fixtures/canary/canary.html

    buzzword-positive : words=92  density=73.37 distinctPeak=13 -> FIRES
    buzzword-clean    : words=112 density=0.00  distinctPeak=0  -> does not fire
    canary            : words=22  density=0.00  distinctPeak=6  -> does not fire

The instrument fires on a planted positive and stays clean on a known negative, so the canary result
is believable. End-to-end through the CLI as well: `node bin/sidecoach-detect.js
benchmark/fixtures/mutation/buzzword-positive.html` emits
`[warning] subjective/marketing-buzzword @ h1 - buzzword density 73.4/100 words`.

**The rule is real and calibrated.** `polish.marketing-buzzword` is in the registry
(product-rule-registry.ts), bound to the subjective rendered scanner, with a held-out operating
point recorded in subjective-rendered-scanner.ts: gate 2 / threshold 0.75, held-out P 1.000, R 0.421.

**Why it misses the canary - two independent structural reasons, neither a bug:**

1. `evidenceRequirements: ['rendered-scan']`. It lives ONLY in the rendered subjective lane. The
   scoreboard row measures with `--no-render`, so the lane is not even attempted.
2. Even WITH render it cannot fire: the canary carries 22 content words against a hard
   `BUZZ_MIN_WORDS = 40` floor, which zeroes the density BEFORE the threshold is consulted. Every
   other gate is already satisfied - distinctPeak 6 against a required 2, weighted 40.

**I did not move the floor, and that was the call.** Lowering `BUZZ_MIN_WORDS` to make our own
benchmark canary fire is fitting to the test. This rule has already collapsed once on held-out data
(frozen-90: dev p1.0 -> frozen p0.25, see session_2026-06-25_frozen90-milestone-result) and the v3/v4
retune bought precision 1.000 back by moving the QUALIFY GATE rather than the thresholds. Trading that
for one scoreboard cell would be the worst trade available.

**THE CLAIMS. Two are false and one is stale:**

- "sidecoach's taste validator already catches marketing-buzzword" - **FALSE, and never was true.**
  `src/taste-validator.ts` has exactly 7 rules: fabricated-svg, translatey-in-hover,
  large-inline-style, hero-radial-blob, hex-in-interactive-state, observer-race,
  border-radius-inconsistency. No buzzword rule has ever been in that file.
- "one of the six anti-pattern bans a live PostToolUse hook sweeps on every HTML and CSS write" -
  **FALSE.** The hook (`~/.claude/hooks/sidecoach-taste-gate.sh`) shells out to `scanForAbsoluteBans`,
  whose `BAN_SCANNERS` table has exactly FIVE entries: side-stripe-borders, gradient-text,
  glassmorphism-default, hero-metric-template, modal-as-first-thought. marketing-buzzword has never
  been one of them, and could not be - the ban scanners read raw CSS/markup text and buzzword needs a
  render.
- **"six" is itself stale.** The hook's own header comment still lists `identical card grids`, whose
  scanner was DELETED 2026-06-24 for a ReDoS-class regex. So the count in the docs is one higher than
  reality and names a scanner that does not exist. Fixed the hook comment; the CLAUDE.md count is the
  lead's/user's to change since global standing docs are not mine to edit unilaterally.

**What IS true:** CLAUDE.md's description of `/sidecoach audit` ("the audit renders the page and runs
the detection engine ... taste defects (marketing-buzzword, ...)") is ACCURATE. The audit does render,
and marketing-buzzword does run in it. The false part is specifically the write-time static path.

The damage from the false version is exactly what the lead named: a rule documented as enforced on
every write, which no write-time path can reach, buys confidence that nothing is checking.

Files touched: benchmark/probe-buzzword.js (new), benchmark/fixtures/mutation/buzzword-positive.html,
benchmark/fixtures/mutation/buzzword-clean.html, claude/hooks/sidecoach-taste-gate.sh (dotfiles repo)
