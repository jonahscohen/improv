# Borrow-list reconciliation (lists 1-N vs the 2026-07-23 upgrade plan)

**Authored against commit:** `1ea7ae73`
**Plan reconciled:** `docs/superpowers/plans/2026-07-23-sidecoach-upgrades.md` (stamped `a22d41fc`)
**Date:** 2026-07-23
**Collaborator:** Jonah

> Stamp note (Team Rule #10): the upgrade plan is stamped `a22d41fc`; HEAD is `1ea7ae73`,
> 3 commits ahead. The drift is benign for this reconciliation: `4d61ba1f` landed the
> live-verb removal the plan already assumed was in flight (so V3/Live Mode is DEAD, not
> pending), plus two hook false-positive fixes (`fb5b12f8`, `1ea7ae73`) that touch nothing
> this doc reasons about. The plan's current-state claims were separately corrected in
> `decision_sidecoach_upgrade_first_units.md` (font vocab is in `src/reference-data.ts`,
> not `src/fontshare-reference.ts`; `bin/` has 7 files, not 6). Both corrections are folded
> below where relevant.

Codename note: the competitive rival is referred to ONLY as "oracle". No real product
name, author handle, or domain appears here.

---

## 1. Why this doc exists

The upgrade plan names its own meta-finding ("this is the FIFTH borrow list; the prior four
never drained") and then mitigates it for ITSELF ONLY, via a runnable verify check per
stage so THIS list converts to code. It never accounts for the residue of the earlier
lists. This reconciliation buckets every gap from every prior list against the current
plan, so the un-covered backlog becomes visible. Section 5 is the payload: the
OPEN + UNSCHEDULED rows the plan is blind to.

---

## 2. How many borrow lists actually exist

**"Fifth" is a loose, self-incrementing label, not a rigorous count.** The beats' own
numbering is internally inconsistent: `session_2026-07-16_four-product-gap-analysis.md`
calls itself "the FOURTH borrow list" in one sentence and "capturing it a THIRD time" in
the next. That proves the ordinal was never counted; it was incremented by feel.

**Counting rule used here:** a "borrow list" is a beat whose PRIMARY product is a
ranked/itemized enumeration of capabilities Sidecoach LACKS versus one or more EXTERNAL
products, produced as candidate borrows. One beat = one list. Companion capability MAPS
(evidence bases) and absorption-DONE logs are NOT themselves borrow lists (an absorption
log may carry a residual "what's missing" sub-section, which I fold into the audit that
later checks its wiring).

Under that rule the population splits into two lineages plus non-lists:

**Lineage A - oracle-anchored DESIGN-COMPETITIVE gap lists (what the plan's stages address):**
1. `session_2026-05-21_oracle_gap_analysis.md` - oracle v2.1.9 command-coverage (3 missing flows)
2. `session_2026-05-25_capability_gap_analysis.md` - 34-item wired-vs-unwired forensic of absorbed content
3. `session_2026-05-25_tasteskill_competitive_investigation.md` - taste-skill, 6 items
4. `session_2026-06-23_sidecoach-oracle-gap-analysis.md` - 5-dimension rubric (+ `..-capability-map.md` = evidence, not a list)
5. `session_2026-07-16_four-product-gap-analysis.md` - taste-skill / visual-explainer / slop.md / hallmark
6. `session_2026-07-23_oracle-v4-gap-analysis.md` - the current one

**Lineage B - other external-skill recon/eval lists (feed a capability/workflow backlog, not the oracle-taste axis):**
- `session_2026-05-25_sidecoach_omc_gap_analysis.md` - vs oh-my-claudecode (model-routing / MCP / eval-harness)
- `session_2026-05-28_skill-recon-{team,synthesis}.md` - 4 external UI skills (forms/gesture/chart/mobile; "gaps are CAPABILITY not TASTE")
- `session_2026-05-28_omc-research-synthesis.md` - OMC absorb sweep
- `session_2026-06-12_external-skill-eval-six-skills.md` - 6 skills (a11y / motion-perf / animation principles)
- `session_2026-07-03_external-skills-recon-round2.md` - emil/shadcn/mattpocock; explicitly names the un-drained-backlog pattern

**Not borrow lists (excluded by the rule):**
- `session_2026-05-25_oracle_absorption.md`, `session_2026-05-25_external_taste_absorption.md` - absorption-DONE logs (residue folded into list 2's audit)
- `session_2026-06-23_..-capability-map.md` - evidence base for list 4
- `session_2026-05-23_sidecoach_audit.md` - internal readiness audit ("85% backend, 0% accessible"), not competitive

**Verified count:** by a strict one-beat-one-list rule, lineage A alone is **6** gap-list
beats (not "four prior + this fifth"). Counting BOTH lineages there are **11 distinct
borrow/recon beats** (6 + 5). "Fifth" is only defensible if you (a) collapse the entire
2026-05-25 same-day cluster into a single "capture event", (b) restrict to the oracle-taste
axis, and (c) drop the 05-28 skill-recon pair and the OMC list. Multiple such groupings can
be made to land on five, which is exactly why the number is unreliable.

**The load-bearing conclusion: "prior four never drained" UNDERCOUNTS the real borrow debt.**
The plan is blind to more residue than its own meta-finding admits. The plan's substantive
point (the same core gaps recur and get shelved) is correct and, if anything, understated.

### 2a. The `named-vibe-variants.md` citation-drift finding

The plan's grounding beat (`session_2026-07-23_oracle-v4-gap-analysis.md`, meta section)
says: "named-vibe-variants.md captured ~14 of these exact gaps on 2026-05-25, unwired." The
2026-07-16 beat says the same (line 104). This citation has drifted:

- There is **NO file named `named-vibe-variants.md` in `.claude/memory/`** (verified:
  `find . -iname "*vibe*"` returns zero hits under `.claude/memory/`). It is **not a beat
  and not a gap list.**
- The real file is `sidecoach/reference/_extracted/external/taste-skill/named-vibe-variants.md`
  - an EXTRACTED taste-skill REFERENCE file holding POSITIVE style archetypes (minimalist /
  soft / brutalist / gpt vibes). It is a pantry of vibes, not an enumeration of gaps.
- The gaps attributed to it on 2026-05-25 were actually captured in the two same-day beats
  `session_2026-05-25_capability_gap_analysis.md` (the 34-item wired/unwired tally) and
  `session_2026-05-25_external_taste_absorption.md` (the absorption record whose file list,
  line 26, is where the `named-vibe-variants.md` string enters the corpus).

**Resolution:** the beats point at an unwired positive-vocabulary REFERENCE FILE as if it
were the gap-capturing artifact. The spirit of the claim (gaps were captured 2026-05-25 and
shelved) is correct; the citation names the wrong object. When reading the plan's meta-finding,
substitute "the 2026-05-25 capability_gap_analysis + external_taste_absorption beats" for
"named-vibe-variants.md". The `_extracted` file's own residue (it is loaded only for its slop
word list, per `reference-loader.ts:115`) is real but is a wiring gap, not a gap list.

---

## 3. Upgrade-plan stage inventory (the buckets map against these exact ids)

- **Stage 1** (defect-mining): 1a provider sampling harness, 1b defect-distribution measurement, 1c build-time counter-rule compilation, 1d skill-prose ablation
- **Stage 2** (generative authoring): 2a palette-construction recipe, 2b pre-render authorship, 2c outside-ranking direction roll, 2d exclusion-safe deck presentation
- **Stage 3** (scanner productized): 3a detect CLI, 3b real hook path, 3c registry consolidation
- **Stage 4** (taste rule-count delta): 4a font-family read, 4b typographic-extreme classes, 4c structural taste classes, 4d motion/marker classes + honest exclusions
- **Section 6** (out of scope): interactive in-browser decision page (DEFERRED); Live Mode fold into Justify (DEAD); surface-purpose modes replacing the register (NOT SCHEDULED); adopting 59 rules as 59 hand rules / vendoring the world-deck (FORBIDDEN)

Note: Stage 3a and Stage 4a are in ACTIVE parallel build per
`decision_sidecoach_upgrade_first_units.md` (they own `sidecoach/bin/sidecoach-detect.js`,
`sidecoach/src/validators/subjective-rendered-scanner.ts`, `sidecoach/src/product-rule-registry.ts`,
`sidecoach/src/audit-rendered.ts`). Rows citing 3a/4a are SUBSUMED-in-progress.

---

## 4. Master reconciliation table

De-duplicated: a gap that recurs across lists is ONE row, first-captured = its EARLIEST
appearance; recurrence count noted in the reason (that recurrence IS the meta-finding made
concrete). Sources are cited by list date.

| # | Gap | First captured | Bucket | Covering stage or reason |
|---|-----|----------------|--------|--------------------------|
| 1 | Provider-specific defect-mining + skill-prose ablation | 2026-07-23 (v4) | SUBSUMED | Stage 1 (entire stage is this) |
| 2 | Integrated generative pipeline (core loop) | 2026-07-23 (v4) | SUBSUMED | Stage 2a-2d; browser-decision-page sub-part DEFERRED (Section 6) |
| 3 | Provider-specific tells (gpt/gemini) baked into skill | 2026-06-23 (rubric R1) | SUBSUMED | Stage 1c (provider counter-rules) |
| 4 | Palette construction / generative aesthetic layer | 2026-07-16 (F1) | SUBSUMED | Stage 2a (OKLCH ramp -> WCAG-checked tokens) |
| 5 | Pre-flight self-audit / render-before-build | 2026-05-25 (taste-skill T3) | SUBSUMED | Stage 2b (mock rendered + audited before full build) |
| 6 | Anti-sameness rotation / outside-ranking roll | 2026-05-25 (taste-skill T2) | SUBSUMED | Stage 2c (seeded roll excludes prior draws); re-captured 07-16 F3, 07-23 V2 (3x) |
| 7 | numbered-section-markers detection | 2026-05-25 (taste-skill T1) | SUBSUMED | Stage 4d (detectable class) |
| 8 | Unified runnable scanner / real `detect` CLI | 2026-06-23 (rubric R2/GAP2) | SUBSUMED | Stage 3a/3b/3c (3a in active build); re-captured 07-16 (README defect), 07-23 V4 (3x) |
| 9 | Taste rule-count / taste-frontier delta | 2026-05-25 (cap-gap list) | SUBSUMED | Stage 4 (~17 classes); re-captured 06-23 GAP1, 07-16 F4, 07-23 V5 (4x) |
| 10 | Font-family detector vs reflex-reject vocabulary | 2026-05-25 (cap-gap item 30) | SUBSUMED | Stage 4a (active build); dead-code form fixed 07-16, capability now scheduled (3x) |
| 11 | Linguistic/copy bans (slop words, "request a demo", title-case, Jane-Doe authenticity, aphoristic-cadence, theater-slop) | 2026-05-25 (cap-gap 7/8/10 + taste-skill) | OPEN + SCHEDULED | Stage 4d PARTIAL: marketing-buzzword class ships as the ceiling; broader copy-semantic detection explicitly deferred by 4d as a separate calibrated effort. Re-captured 07-16 (slop.md ~100 tells, we detect ~4) |
| 12 | Taste DEPTH & CURRENCY + no upstream-sync path + parity-pins-to-old | 2026-06-23 (rubric R1/GAP1) | OPEN + SCHEDULED | Stage 1 defect-mining is a currency MECHANISM + Stage 4 widens coverage; PARTIAL - no explicit upstream-sync path, and the "absorbed corpus is stale" expiry (taste-skill v2 tripled its corpus, 07-16) is unaddressed |
| 13 | Rendered-contrast on OKLCH/var/gradient coverage | 2026-06-23 (rubric R2 sub) | OPEN + SCHEDULED | Stage 2a routes required pairs through the rendered WCAG check; PARTIAL - full element-level parity with oracle's static contrast breadth not a named stage item |
| 14 | Modular-ratio + line-height-by-tier enforcement (all 7 ratios, UI tier) | 2026-05-25 (cap-gap 11/12) | OPEN + SCHEDULED | Stage 4b touches typographic extremes (oversized-h1, sub-11px, tracking, leading); PARTIAL - ratio-set and UI line-height tier not enumerated in 4b |
| 15 | Maintainability / complexity: 6+ routing impls, triplicated classifier, 138 files / ~40k SLOC | 2026-06-23 (rubric R3/GAP3) | OPEN + UNSCHEDULED | Nothing in Stages 1-4 simplifies routing; the plan ADDS CLIs/generators/a sampling harness. Direct tension with the mission's "more capable AND simpler" spine. MISSION-PRIMARY |
| 16 | Distributability: no plugin manifest, absolute paths, build-required, non-portable | 2026-06-23 (rubric R4/GAP4) | OPEN + UNSCHEDULED | No stage packages Sidecoach as a portable/versioned plugin. MISSION-PRIMARY |
| 17 | Workflow simplicity: 4 parallel user vocabularies (phases / verbs / lanes / NL) | 2026-06-23 (rubric R5/GAP5) | OPEN + UNSCHEDULED | Only partial reduction from the live-verb/lane_live removal (`4d61ba1f`); the 4-vocabulary sprawl is otherwise untouched. MISSION-PRIMARY (named the single biggest objective) |
| 18 | Visualizer AUTHORSHIP (build the chart/visual the surface-gate demands) | 2026-07-16 (F2) | OPEN + UNSCHEDULED | Stage 2d only PRESENTS a rolled direction deck as an artifact; the general "we own the guard+contract+blocking gate and zero authoring machinery" gap is uncovered. Sub-finding (surface rule wrongly conflates in-chat-unavailable with visuals-impossible) also unaddressed |
| 19 | Heading-size-by-role table (card vs modal vs display) | 2026-05-25 (cap-gap 13) | OPEN + UNSCHEDULED | No stage; 4b has oversized-h1 only |
| 20 | Font-pairing rules (one sans + one serif) | 2026-05-25 (cap-gap 14) | OPEN + UNSCHEDULED | 4a reads font-family for monoculture/mismatch, not pairing composition |
| 21 | Clamp-based fluid type-scale formulas | 2026-05-25 (cap-gap 15) | OPEN + UNSCHEDULED | No stage |
| 22 | Frequency-first motion matrix (100+/day = no animation) | 2026-05-25 (cap-gap 16) | OPEN + UNSCHEDULED | No stage; double-sourced 06-12 (Emil + design-lab "frequency principle") |
| 23 | Motion sophistication: Emil's 3 named easings, asymmetric enter/exit, Framer x/y gotcha | 2026-05-25 (cap-gap 17/18/19) | OPEN + UNSCHEDULED | 4d is marquee/blink/marker DETECTION only; these are guidance/enforcement gaps |
| 24 | iOS 100vh address-bar trap (svh/dvh/lvh) | 2026-05-25 (cap-gap 25) | OPEN + UNSCHEDULED | No stage; re-surfaced 05-28 (h-dvh) |
| 25 | Saturated-aesthetic lanes / 2nd-order category-reflex (editorial-typographic, brutalist-utility, acid-maximalism) | 2026-05-25 (cap-gap 29) | OPEN + UNSCHEDULED | No stage; 2c is the POSITIVE deck, not the negative lane-avoid check. Re-captured 06-23 R1 sub |
| 26 | Bencium 5-tier breakpoint table + prescribed pattern transitions | 2026-05-25 (cap-gap 22 / absorption) | OPEN + UNSCHEDULED | No stage |
| 27 | ALWAYS-ASK protocol (ask before deciding) | 2026-05-25 (cap-gap 34) | OPEN + UNSCHEDULED | No stage (shape's 2-3 questions is adjacent but not this protocol) |
| 28 | hero-eyebrow accent-bold refinement | 2026-06-23 (rubric R1 sub) | OPEN + UNSCHEDULED | 4c has structural classes but not this one |
| 29 | Strategic Omissions / "what AI forgets" (legal links, back nav, 404, form validation, skip-to-content, cookie consent) + "what never changes silently" (URLs/nav/form-field/analytics) | 2026-05-25 (taste-skill T4) | OPEN + UNSCHEDULED | No stage; re-captured 07-16 (slop.md redesign) |
| 30 | fact-check (doc-claims vs code), plan-review vs CODEBASE, output-skill banned-truncation patterns | 2026-07-16 (F5) | OPEN + UNSCHEDULED | No stage |
| 31 | Surface-purpose modes replacing the register (Persuade/Operate/Read/Experience) | 2026-07-23 (v4 minor #6) | OPEN + UNSCHEDULED | Explicitly "not scheduled here" (Section 6) |
| 32 | Domain-coverage gaps: data-viz categorical/sequential palettes, security-as-UI, notification hierarchy, empty-state taxonomy, PWA/offline, drag-drop + command-palette catalogs, print/email depth, multi-stakeholder/PR-handoff/visual-regression process | 2026-05-25 (oracle_absorption "what's missing") | OPEN + UNSCHEDULED | No stage; aspirational cluster, but never re-triaged after capture |
| 33 | Capability/coverage (lineage B): Forms validator (ZERO coverage), gesture/drag physics, chart-type selection matrix, CSS Scroll/View Timelines (ZERO coverage), content-resilience, URL-as-state, dark-mode device-UI, touch/mobile CSS, static remediation-mode, forced-divergence 5-axis variant taxonomy, interface-robustness stress test | 2026-05-28 (skill-recon) / 2026-06-12 (six-skills) | OPEN + UNSCHEDULED | Out of the plan's oracle-taste frame, but real and un-drained; detect CLI (3a) gives file:line findings but auto-remediation is explicitly out of scope (3b does not auto-fix) |
| 34 | oracle v2.1.9 command-parity (layout / overdrive / typeset dedicated flows) | 2026-05-21 (list 1) | DEAD | Obsoleted by the verb registry + convergence-to-one-engine; oracle is now v4 with a churned command set. v2.1.9 flow-count parity is moot |
| 35 | Live Mode / in-browser element-variant loop | 2026-07-23 (v4 #3) | DEAD | Jonah cut the direction entirely (`decision_live_mode_rejected.md`); live verb/lane/mode removed in `4d61ba1f`; Justify fold dropped |
| 36 | ban-identical-card-grids false-pass (certified clean forever) | 2026-07-16 (honesty defect 1) | DEAD | WE shipped the fix: BAN_SCANNERS registry, drift-guard proven to throw (`session_2026-07-16_honesty-defect-fixes.md`). The structural identical-card-grid detector itself was retired for ReDoS |
| 37 | README theater: nonexistent `npx sidecoach detect` / 28-rule bridge | 2026-07-16 (honesty defect 3) | DEAD | WE removed it (07-16); the real CLI is now Stage 3a |
| 38 | loadFontReflexReject dead code (16 fonts, zero consumers) | 2026-07-16 (honesty defect 2) | DEAD | WE deleted it, vocabulary preserved (07-16); the detector capability is now Stage 4a (row 10) |
| 39 | lotus anti-slop recommends Inter (contradicts our reject list) | 2026-07-16 (honesty defect 4) | DEAD | WE fixed it (07-16); Inter now appears only as banned |
| 40 | PRODUCT.md "register" as a category-to-aesthetic recipe | 2026-06-23 / 2026-07-23 | DEAD | Rival killed it FOR CAUSE (their bias mining showed category-to-aesthetic recipes CAUSED slop); if ever revisited, take the 4 per-surface modes (row 31), not the recipe register |
| 41 | OMC: custom MCP server | 2026-05-25 (omc gap) | DEAD | Closed - Sidecoach ships a 1284-SLOC MCP server (`session_2026-06-23_..-capability-map.md`) |
| 42 | OMC: empirical eval harness | 2026-05-25 (omc gap) | DEAD | Closed - `eval/` Contract-6 harness exists and is the substrate Stage 1 rides on |
| 43 | OMC infra: model-tier routing, stop-callbacks, persona injection | 2026-05-25 (omc gap) | UNKNOWN | Infra, out of the design-plan frame; not re-audited after the June engine convergence. Cannot classify from beats without reading current src (out of scope + parallel builds live there) |
| 44 | List-2 wiring-architecture items: SKILL_REF stringified not read, `_extracted/` unread by handlers, flowM absent from craft chain, responsive-foundation.md unloaded | 2026-05-25 (cap-gap 31/32/33) | UNKNOWN | Presuppose the OLD flow-handler/`_extracted` architecture; the engine was rebuilt registry=engine in the June convergence and these 4 items were never re-audited post-convergence. Likely DEAD-by-architecture-change but not verifiable from beats |

---

## 5. OPEN + UNSCHEDULED - what the plan is blind to (the payload)

Every row below is a real gap with nothing in the four upgrade stages covering it. Ordered
by severity, MISSION-PRIMARY first.

1. **Maintainability / complexity (row 15).** 6+ overlapping routing implementations, a
   classifier triplicated across TS/TS/Python, ~138 files / ~40k SLOC. Still real: the June
   convergence unified the detector ENGINE, not the routing/vocabulary surface. Unscheduled:
   no stage touches routing, and the plan ADDS machinery (detect CLI, two generators, a
   provider-sampling harness), which pushes AGAINST this gap and against the mission's "more
   capable AND simpler" spine. The mission beat names this the single biggest objective.

2. **Distributability (row 16).** No plugin manifest, hard-coded absolute paths in SKILL.md,
   a required TS build before anything runs, no versioned release/pin/update path. Still
   real: nothing has packaged Sidecoach as portable. Unscheduled: not a concern any of the
   four stages address.

3. **Workflow simplicity (row 17).** Four parallel user-facing vocabularies (phases, 22
   verbs, lanes, natural-language intent). Still real: only lane_live was removed; the rest
   of the sprawl stands. Unscheduled: no stage collapses the surface. Mission-primary.

4. **Visualizer authorship (row 18).** We own the visualizer guard, token contract, and a
   blocking surface-gate, and zero machinery to build the artifact the gate demands. Still
   real: Stage 2d only presents a rolled direction deck; general chart/visual authorship is
   uncovered, and the "in-chat-unavailable != visuals-impossible" surface-assumption bug is
   untouched.

5. **Heading-size-by-role table (row 19).** Card-title vs modal-title vs display sizing.
   Still real, unscheduled: 4b ships oversized-h1 only.

6. **Font-pairing rules (row 20).** Sans+serif pairing composition. Still real, unscheduled:
   4a reads font-family for monoculture/mismatch, not pairing.

7. **Clamp-based fluid type scale (row 21).** Unscheduled: no stage; documented-only since 05-25.

8. **Frequency-first motion matrix (row 22).** "Should this animate at all?" by usage
   frequency. Still real, unscheduled, and double-sourced (05-25 + 06-12) - a priority-raiser
   that was never actioned.

9. **Motion sophistication cluster (row 23).** Emil's three named easings, asymmetric
   enter/exit (exit faster), the Framer x/y hardware-accel gotcha. Unscheduled: 4d is marquee/
   blink/marker DETECTION, not motion-quality enforcement.

10. **iOS 100vh trap / svh-dvh-lvh (row 24).** Still real, unscheduled; re-surfaced 05-28.

11. **Saturated-aesthetic lanes / 2nd-order category-reflex (row 25).** The negative
    "avoid these families" check. Unscheduled: Stage 2c is the positive deck, not the
    avoid-list. Re-captured twice (05-25, 06-23).

12. **Bencium 5-tier breakpoint table + pattern transitions (row 26).** The canonical
    responsive mental model. Unscheduled since 05-25.

13. **ALWAYS-ASK protocol (row 27).** Ask-before-deciding design conversation mode.
    Unscheduled.

14. **hero-eyebrow accent-bold refinement (row 28).** A 3.5.0-era taste refinement we
    predate. Unscheduled.

15. **Strategic Omissions / "what AI forgets" + "what never changes silently" (row 29).**
    Legal links, back nav, 404, form validation, skip-to-content, cookie consent; plus the
    protected-invariants list (URLs/nav labels/form-field names/analytics events).
    Unscheduled; re-captured 07-16.

16. **fact-check + plan-review-vs-codebase + banned-truncation patterns (row 30).**
    Doc-claims-vs-code checking and codebase-aware plan review. Unscheduled.

17. **Surface-purpose modes replacing the register (row 31).** Explicitly "not scheduled" in
    Section 6. Listed here so the deferral is a visible backlog item, not a silent drop.

18. **Domain-coverage cluster (row 32).** data-viz palettes, security-as-UI, notification
    hierarchy, empty-state taxonomy, PWA/offline, drag-drop + command-palette catalogs,
    print/email depth, process protocols (multi-stakeholder, PR handoff, visual regression).
    Captured 2026-05-25 in the oracle absorption "what's missing" and never re-triaged.

19. **Lineage-B capability cluster (row 33).** Forms validator (ZERO coverage today),
    gesture/drag physics, chart-type selection matrix, CSS Scroll/View Timelines (ZERO
    coverage), content-resilience, URL-as-state, dark-mode device-UI mechanics, touch/mobile
    CSS, static remediation-mode, forced-divergence 5-axis variant taxonomy, interface-
    robustness stress test. Out of the plan's oracle-taste frame but real and un-drained
    across two separate lists (05-28, 06-12).

---

## 6. UNKNOWN (could not be classified from the beats)

1. **OMC infra gaps (row 43):** model-tier routing, stop-callbacks, persona injection.
   Infra, out of the design-plan frame, and not re-audited after the June engine
   convergence. Classifying them would require reading current src, which is out of scope
   for this reconciliation and off-limits while the Stage 3a/4a builds are live in
   `sidecoach/`.

2. **List-2 wiring-architecture items (row 44):** SKILL_REF stringified not read,
   `_extracted/` unread by handlers, flowM absent from the craft chain, responsive-foundation.md
   unloaded. These presuppose the pre-convergence flow-handler/`_extracted` architecture. The
   engine was rebuilt registry=engine in June; these four items were never re-audited against
   the new engine, so whether the underlying guidance is now enforced (via the registry) or
   still dark cannot be determined from the beats alone. Most likely DEAD-by-architecture-
   change, but I will not assert a bucket I cannot ground.

---

## 7. Bucket tally

| Bucket | Count |
|--------|-------|
| SUBSUMED | 10 (rows 1-10) |
| OPEN + SCHEDULED | 4 (rows 11-14) |
| OPEN + UNSCHEDULED | 19 (rows 15-33; several are clusters) |
| DEAD | 7 (rows 34-40) |
| DEAD (gap already closed) | 2 (rows 41-42) |
| UNKNOWN | 2 (rows 43-44) |

The headline: the plan cleanly SUBSUMES the fifth list's own gaps and the detector/taste/
generative axes (Stages 1-4 map tightly to rows 1-10). It is BLIND to the three
mission-primary simplicity/portability gaps (rows 15-17) that the /goal names as the single
biggest objectives, and to a long tail of taste/motion/responsive sophistication (rows 19-28)
that has been documented-only since 2026-05-25. Rows 15-17 are the most important finding:
the plan not only fails to schedule the "simpler" half of "more capable AND simpler", it
actively adds machinery against it.
