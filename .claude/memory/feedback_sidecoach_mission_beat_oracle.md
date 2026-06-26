---
name: Sidecoach mission - oracle as baseline, make it better AND simpler in every way (the /goal)
description: Jonah's standing baseline (2026-06-23). Sidecoach is NOT meant to be original out of the gate - it is meant to take the best of everyone's thinking (oracle's taste as the baseline) + add our expertise + scale into something greater. The /goal - Sidecoach must beat oracle in EVERY rubric dimension it currently lags AND be simpler, creating efficiencies oracle cannot.
type: feedback
relates_to: [session_2026-06-23_codex-review-mandated-protocol.md, reference_sidecoach_reference_routing_map.md, feedback_multiagent_verified_implementation_mandate.md]
---

Collaborator: Jonah Cohen

## The directive (verbatim intent, 2026-06-23)
"We want to use Oracle's taste as a baseline and then add to its richness with our own expertise. We want to take what Oracle's good at and make it better. That was one of the original promises of Sidecoach. ... everything you mentioned about its focus, design taste depth and currency, automation/detector engine superiority, its maintainability, I want it applied to Sidecoach. ... Sidecoach isn't supposed to come out of the gate being original and novel. Sidecoach is supposed to take the very best of what everyone has thought of and allow the space for it to scale into something greater. ... Sidecoach must be better than Oracle in every single possible way and create efficiencies in ways it cannot. That is our /goal."

## The reframe (corrects my rubric)
My honest rubric graded Sidecoach DOWN on "originality/provenance" for extracting oracle's taste (sidecoach/reference/_extracted/legacy-design-skill/). Jonah: that derivation is the DESIGN, not the flaw. Synthesis IS the strategy. The bar is not originality - it is SUPERIORITY THROUGH SYNTHESIS: take the best (oracle + everyone), add our expertise, end up better AND simpler than what we derived from. Drop "originality" as a metric; replace it with "is it measurably better than oracle in every dimension, while being simpler."

## The rubric gaps to close (where Sidecoach currently trails oracle)
- Design-taste DEPTH & CURRENCY: Sidecoach's taste is downstream/extracted, not ahead. Must enrich it past oracle's current edge (e.g. oracle's second-order category-reflex check, the 2026 cream/sand call-out, color-commitment axis, absolute bans) AND keep it current.
- DETECTOR ENGINE: oracle ships a real multi-engine local scanner (regex/browser/visual/static-html, ~16 mjs). Sidecoach has TS detector modules of unverified runtime maturity. Must match + exceed.
- MAINTAINABILITY / complexity: Sidecoach = 130 TS files, 6 lanes, 31 handlers, lane spec churned v1-v10 with repeated regressions, harness-coupled. Must net-SIMPLIFY.
- DISTRIBUTABILITY: oracle is a clean Apache-2.0 versioned plugin (homepage, pin/unpin, update-check). Sidecoach is bespoke. Must become cleanly usable/distributable.
- FOCUS / WORKFLOW SIMPLICITY: oracle = 23 clear commands + a context-aware menu. Sidecoach sprawls (lanes + verbs + phases + intent detection). The single biggest objective: SIMPLIFY + evolve the user workflow to be cleaner than oracle's while delivering more.

## The hard constraint (the spine)
MORE CAPABLE AND SIMPLER, simultaneously. A plan that adds machinery fails. Net-reduce complexity while increasing capability.

## The process Jonah set
1. Deploy an agent to identify the gaps + propose a plan to close them and exceed oracle + create efficiencies it can't.
2. Codex ADVERSARIAL review of the plan that pushes on (a) simplifying/evolving the user workflow and (b) being better in every rubric dimension Sidecoach isn't.
3. /loop (iterate) Claude + Codex in tandem until the PLAN converges.
4. Then /loop until Sidecoach is CHANGED to meet the criteria. Each change produce-and-verify + Codex (Verification Protocol item 8).
5. "No more games, no more fluff, no more lies." Claude + Codex mastermind together.

## How I am realizing it
Phase 1 (plan, no code changes): deployed teammate `sidecoach-architect` (visible pane) grounds in oracle 3.5.0 + Sidecoach in full, produces a rubric-mapped gap analysis + a net-simplifying plan, runs the Codex adversarial loop until convergence, and reports for lead + Jonah approval. Lead independently Codex-reviews at the gate. Phase 2 (implementation loop) only after the plan is approved.

## Operating model (added 2026-06-23)
"Work autonomously, if you need help, shout. Hand work off to Codex if you meet multiple points of failure and need an extra hand from a friend. Then you become the reviewer and verify the work Codex has done. You and Codex should be interchangeable partners, working together at every level."
- AUTONOMOUS: drive both loops without asking permission for routine steps; escalate to Jonah only when genuinely blocked.
- CLAUDE <-> CODEX INTERCHANGEABLE: either partner does work, the other verifies. When Claude hits multiple failure points, hand the task to Codex, then Claude becomes the reviewer of Codex's output. Symmetric at every level (planning AND implementation).
- Codex engaged at two levels: inside the worker's iteration loop AND at the lead's convergence/verification gate.

## SUCCESS BAR - operationalized (Jonah ruling, 2026-06-23)
"Better than oracle in every single way" collided with reality at the head-to-head eval: some axes are correctness FLOORS (WCAG contrast) where the best possible is to MATCH "correct" - you cannot beat correct. Jonah's ruling (chosen over "strictly-better on every axis"): operationalize as PARITY (never regress) on correctness/floor axes + STRICTLY OUTPERFORM on the differentiators (taste quality, workflow simplicity, maintainability, distributability, memory/refs/convergence). Net = "never worse anywhere, decisively better where it counts." Detector parity is "non-regression + extension capacity," NOT a "beat." This is the durable definition of the /goal's success bar; the eval thresholds (>= on floors, strict-> with statistical significance on differentiators) enforce it.

## FOUNDATION RULING - REIMPLEMENT-AND-OWN, not vendor (Jonah, 2026-06-23)
v13 converged on a VENDOR-oracle's-Apache-2.0-code-and-extend foundation (both gates + the success bar passed). At the vendoring-blessing gate Jonah HELD and chose REIMPLEMENT-AND-OWN over vendoring. The durable ruling:
- "oracle as baseline" = STUDIED REFERENCE / quality-bar / ORACLE, NOT vendored code. Sidecoach OWNS 100% of its implementation.
- Build the correctness floor (WCAG contrast / OKLCH / var-resolution) from PUBLIC standards (W3C WCAG, CSS Color 4 - public specs, not oracle's IP); unify our existing detectors into one owned scanner. Copy NO oracle code and NO verbatim taste prose; implement detection of the same issue-CLASSES (design facts, not copyrightable expression) ourselves. Credit oracle as studied inspiration; redistribute nothing (so no Apache-redistribution machinery).
- The head-to-head eval (already hardened over 4 gate rounds) now validates OUR implementation against oracle-AS-ORACLE on the externally-sourced corpus - a STRONGER proof than vendoring (proves our own code matches/exceeds, not that a copy matches itself). Trade: drop the "don't reinvent the detector" efficiency for full ownership + independence (no perpetual sync-to-a-competitor dependency).
- Everything vendoring-INDEPENDENT in v13 stands verbatim (collapse thesis, protected-leads, eval methodology, deletion discipline, distributability, the success bar). Only CONTRACT 4 + the vendoring/taste-currency sections are rewritten -> v14.
This supersedes the vendoring bet; v14 swaps the foundation, then both gates re-run.

## EVAL LABELER RULING - independent model labels subjective classes (Jonah, 2026-06-23)
The head-to-head detector eval needs ground-truth labels by a non-rule-author. Split: OBJECTIVE classes (contrast/tiny-text/line-length/... - 15) the architect computes by WCAG/CSS spec-math (math, not opinion; independence-safe). SUBJECTIVE classes (cream-palette/eyebrow-chip/numbered-markers/gradient-text-as-taste/... - 15) - Jonah ruled an INDEPENDENT MODEL (Codex, different family from the rule-authoring Claude) labels them, lead + Jonah spot-check. Pipeline keeps author != labeler airtight: architect sources/captures/objective-labels/flags-subjective/manifest -> LEAD runs the Codex subjective-labeling (the architect never sets/influences those labels) -> lead+Jonah independence-review the selection + spot-check the labels -> freeze -> architect writes subjective rules against frozen labels it never set. Sourcing: public pages only, internal eval use (not redistributed), provenance per case, no detectability pre-filter. Corpus capture format: Playwright self-contained snapshot (inline CSS, strip scripts - static/deterministic/safe).

## Files
- .claude/memory/feedback_sidecoach_mission_beat_oracle.md (this)
