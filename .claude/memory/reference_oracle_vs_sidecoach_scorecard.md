---
name: oracle vs sidecoach - scored capability comparison
description: 0-5 scorecard across 8 dimensions grounding the competitor (written codename "oracle" = the "comparison implementation" = the scoreboard opponent) against sidecoach's actual code/hook surface. Verdict - sidecoach matches and on enforcement/honesty surpasses; the competitor's durable lead is distribution reach and a self-updating taste corpus.
type: reference
relates_to: [session_2026-08-23_sidecoach-qa-gate-finish-boundary.md, feedback_localprojectx_detector_fail_open.md, session_2026-07-23_oracle-v4-gap-analysis.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: grounded in repo code + hooks read this session; competitor column mixes hard repo facts with research-sourced oracle beats (marked)
confidence: medium
---

Collaborator: Jonah Cohen. Scored comparison requested by the lead. NAME BLACKOUT honored:
the competitor is referred to ONLY by the canonical written codename "oracle" (per
oracle-naming-rule). No real brand name appears.

## Step 1 - Grounding the referent (IMPORTANT naming finding)

The lead's brief named the target with a codename that the repo's own content-guard
(`claude/hooks/content-guard.sh`, Jonah 2026-07-03) **RETIRES and blocks from all markdown** -
it is one of the base64-encoded banned "retired names" whose comment says they are "the old
skill name, its shorthand, and the pre-rename orchestrator name," i.e. names of SIDECOACH's OWN
lineage, to be replaced in writing by "sidecoach" / the canonical skill name. Writing that
codename into this beat was blocked outright.

That surfaces a genuine ambiguity worth flagging rather than assuming past:

- The blocked codename ALSO appears (in code/JSON, which the guard does not scope) as a
  third-party Claude Code PLUGIN reference in `claude/hooks/plugin-node-hook-heal.sh` (a plugin
  shipping a Stop / SessionStart / SessionEnd review gate, demanding node>=22) and as a captured
  user query in `beats/_eval/pool.json` ("Is it better than ...'s?"). So the same token is used
  two ways in the repo: (a) a retired sidecoach-lineage name banned in markdown, and (b) an
  informal handle for a competitor plugin.
- The lead grounded the target in `sidecoach-craft-floor.sh` + `sidecoach/src/craft-floor.ts`,
  which cite a **"comparison implementation" that (measured 2026-07-29) beat sidecoach on the
  unconditional-craft-floor axis** - its craft floor loads before every UI edit and cannot be
  missed by routing. That comparison implementation is the scoreboard opponent
  (`benchmark/run-scoreboard.sh`, on-disk codename **LOCALPROJECTX**), which is the same
  competitor the gap-analysis beats codename **oracle** - confirmed by identical detector-engine
  marker paths (`skill/scripts/detect.mjs` + `cli/engine/registry/antipatterns.mjs`).

**Resolution used here:** the target is the design-taste competitor. Its ONLY permitted written
codename is **"oracle"** (oracle-naming-rule: written references use "oracle" exclusively even
when another name is said aloud). This beat uses "oracle" throughout. The lead should confirm
the intended referent given the retired-name collision above.

**Honesty flag on the oracle column:** the deep oracle facts (detector internals, 23 commands,
distribution counts, taste corpus, v4 defect-mining loop) come from research-agent reads of the
competitor's public repo/site (oracle capability-map, gap-analysis, v4, taste-skill-inventory
beats), NOT from anything shipped in improv. Those beats warn their own marketing counts are
inconsistent (58/59/64/25 rules; 177/188 "worlds"; 28.5k vs 48k stars; MIT vs Apache). Exact
counts are soft; capability PRESENCE is scored. The two head-to-head, black-box measured facts
(oracle's craft floor beating ours; oracle's detector failing OPEN on degenerate input) are the
hardest data points and are weighted accordingly.

## Step 2 - Sidecoach's offerings (grounded in code read this session)

- **Verb/flow surface:** 26 flows, 21 verb commands + natural-language intent (lead surface) +
  lanes preset; legacy phase words kept as back-compat aliases. Convergence loop with
  checkpointing; quiet invocation + surface-aware executive report. (`claude/skills/sidecoach/
  SKILL.md`, `sidecoach/src/lanes.generated.ts`, `intent-detector.ts`.)
- **Four enforcement boundaries (the physics):**
  1. `sidecoach-craft-floor.sh` - PreToolUse, **unconditional** craft floor on every UI write,
     regardless of verb (the exact axis oracle beat us on; now matched). Never blocks; injects
     ~11.7k chars of floor notes + refusals. Cooldown keyed on project+session.
  2. `sidecoach-taste-gate.sh` - PostToolUse, **fail-CLOSED**, runs the full `sidecoach-detect`
     battery on the written file under a DESIGN.md project: static-ban + static-check + rendered
     objective + rendered subjective lenses (marketing-buzzword held-out P1.000, tiny-text,
     nested-cards, low-contrast, skipped-heading, broken-image, justified-text, + 5 absolute
     bans). If the rendered lane can't run it says so loudly, never claims clean.
  3. `sidecoach-orchestrate-edit.sh` - PostToolUse, write-boundary QA-gate injection
     (audit -> critique -> polish) on any substantive design edit, no DESIGN.md required.
  4. `sidecoach-qa-gate-stop.sh` - **NEW** (2026-08-23), Stop / finish-boundary. Blocks "done"
     until proof the QA gate ran: **all three** of audit AND critique AND polish as un-forgeable
     Skill tool_uses since the arm (the text-signature path was dropped as self-gameable).
     Certified 65/65, fail-open on errors, fail-closed on tree uncertainty, 4-layer anti-loop,
     no permanent trap.
  Plus `verify-before-done-stop.sh` (screenshot gate) and `sidecoach-keyword.sh` (intent nudge).
- **Detection engine:** `bin/sidecoach-detect.js` - one fail-closed CLI, static + rendered
  lenses, held-out-validated detectors, honest verdicts (clean / inconclusive / findings; exit
  0/2/3).
- **Image + raster asset generation with byte-verification:** `sidecoach-image` - generates then
  reads back the pixels (geometry, format, actual-render, transparency, real WCAG contrast for
  overlaid text). Live providers.
- **Breadth CLIs:** palette (OKLCH ramp recipe), direction-deck (anti-sameness roll),
  pre-authorship board, drift detector, doctor, build-report, taste-check, monitor, artifacts.
- **Design-judgment rules:** 7 checkable taste rules with exception whitelists
  (`reference/design-judgment-rules.md`); teach/document project setup; tilt-lab dependency for
  shader/gradient backgrounds.

## Step 3 - Scorecard (0-5 per dimension; 5 = strongest)

| # | Dimension | oracle | sidecoach | Who leads |
|---|---|:--:|:--:|---|
| 1 | Write-boundary enforcement (physics) | 4 | 5 | sidecoach |
| 2 | Finish-boundary enforcement (physics) | 2 | 5 | sidecoach |
| 3 | Taste-defect detection coverage | 5 | 4 | oracle (breadth); sidecoach edge on measurement |
| 4 | Fail-direction integrity (honesty contract) | 1 | 5 | sidecoach (outright) |
| 5 | Workflow ergonomics | 4 | 4 | tie |
| 6 | Breadth of offerings | 5 | 5 | tie |
| 7 | Portability / installability / distribution | 5 | 2 | oracle (the moat) |
| 8 | Taste depth & currency (self-update / mining) | 5 | 3 | oracle |
| | **Total (max 40)** | **31** | **33** | |

### Dimension notes

1. **Write-boundary.** oracle's unconditional craft floor is real physics and was its proven
   win. sidecoach now MATCHES it (same PreToolUse-on-write layer) AND adds a fail-closed rendered
   detect battery on the same write. sidecoach edges ahead.
2. **Finish-boundary.** oracle ships a Stop review gate (grounded via plugin-node-hook-heal.sh),
   but there is no evidence it blocks "done until the design QA sequence provably ran."
   sidecoach's new qa-gate-stop enforces all-three-stages via un-forgeable tool_use evidence,
   certified. Clear sidecoach lead - and the single newest capability delta.
3. **Detection coverage.** oracle's mature 4-engine detector (~35 antipatterns, real WCAG OKLCH
   contrast, Puppeteer + visual lenses) is broader by registry size. sidecoach's are fewer but
   held-out-validated (P/R measured). Score oracle on raw breadth; sidecoach's measurement
   discipline is the higher-quality half.
4. **Fail-direction.** Measured head-to-head (feedback_localprojectx_detector_fail_open): oracle's
   detector exits 0 (reads "clean") on a missing file, garbage input, no args, and a page whose
   defects live only in a linked stylesheet. sidecoach fails CLOSED on all four (exit 2/3, "a
   scan that did not happen is not a passing scan"). This is the strongest differentiator
   sidecoach has and it is invisible on a feature-list comparison. Protect it.
5. **Ergonomics.** Roughly even: oracle has self-update + live/variant HMR mode; sidecoach has
   NL-intent-led routing + convergence loop + surface-aware executive report.
6. **Breadth.** Both very broad. oracle: 23 verbs, live mode, defect-mining loop, imagegen
   skills, curated "worlds" deck. sidecoach: 26 flows, byte-verified imagegen, palette/deck/
   pre-author/drift/doctor/build-report. Call it a tie.
7. **Distribution (oracle's moat).** oracle installs across ~7-14 harnesses (Claude Code plugin,
   Cursor, Codex, Gemini CLI, Copilot hooks), npm CLI, Chrome extension, self-update, permissive
   license, tens of thousands of GH stars. sidecoach ships a plugin.json manifest but is
   effectively single-harness (Claude Code). Jonah explicitly DESCOPED cross-harness reach
   (2026-07-29), so this LOSS is a deliberate scope choice, not a defect - but it remains the
   biggest raw gap.
8. **Taste depth & currency.** oracle's corpus is current-2026, self-updating, and fed by a
   continuous defect-mining loop (its strongest durable capability per the v4 analysis).
   sidecoach improved (stage-4 subjective classes, prose-ablation-validated guidance) but has no
   self-update or mining loop; historically pinned to an older extraction. oracle leads.

## Overall verdict

**Sidecoach now MATCHES oracle overall (33 vs 31 on this scale) and SURPASSES it on the axes
that live inside the tool: both enforcement-physics boundaries (write AND finish) and the
fail-closed honesty contract.** The unconditional-craft-floor axis oracle beat us on is closed;
the finish-boundary QA gate is a capability oracle is not grounded as having; and sidecoach's
fail-closed detector contract wins that family outright, head-to-head.

**Two remaining gaps where oracle leads durably:**
1. **Distribution / reach** (dim 7) - multi-harness install, CLI, browser extension, self-update,
   large install base. Their moat; descoped by Jonah, so a strategy gap, not a quality gap.
2. **Self-updating taste + defect-mining loop** (dim 8) - oracle's taste corpus refreshes itself
   and mines new tells continuously; sidecoach's does not. The one capability gap worth
   revisiting if scope reopens.

Everything else is parity or a sidecoach win.

## Files read to ground this (no code changed)

- claude/hooks/sidecoach-craft-floor.sh, sidecoach-taste-gate.sh, sidecoach-orchestrate-edit.sh,
  sidecoach-qa-gate-stop.sh, plugin-node-hook-heal.sh, content-guard.sh
- sidecoach/src/craft-floor.ts; claude/skills/sidecoach/SKILL.md; bin/ listing
- beats/_eval/pool.json
- beats: session_2026-08-23_sidecoach-qa-gate-finish-boundary.md, _qa-gate-stop-verification.md,
  feedback_localprojectx_detector_fail_open.md, session_2026-07-23_oracle-v4-gap-analysis.md,
  session_2026-06-23_sidecoach-oracle-capability-map.md, _sidecoach-oracle-gap-analysis.md,
  session_2026-07-25_taste-skill-repo-inventory.md, session_2026-07-29_craft-corpus-across-verbs.md,
  _scoreboard-harness.md, _scoreboard-handoff.md, oracle-naming-rule.md
