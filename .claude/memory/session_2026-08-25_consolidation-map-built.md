---
name: Consolidation + contradiction MAP built (inert engine)
description: sidecoach-consolidate.js + taste-map-types.ts built to the accepted blueprint - inert human-reviewed map that clusters distilled rules by concept, shows overlap vs live rules, and flags every contradiction typed direction-pair/hard-vs-hard/standard-calibration/cross-type. Provenance-gated direction exemption. 192/192 tests green.
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (192/192 npm suites green; 100% typing precision on the labeled fixture)
confidence: high
relates_to: [session_2026-08-25_consolidation-contradiction-model.md, session_2026-08-23_taste-miner-built.md]
---

Built the TASTE CONSOLIDATION + CONTRADICTION MAP for sidecoach, to the accepted blueprint in
session_2026-08-25_consolidation-contradiction-model.md. Inert, human-reviewed report subsystem - a NEW
sibling bin to the miner, NOT an extension of it. Reported to the lead for integration + Codex review.

WHAT IT IS. An upfront survey across the whole ingested taste corpus (outside pioneers + our live rules).
It clusters distilled rules by concept, shows overlap vs our live rules (covered / additive / single-source),
and flags EVERY contradiction CLASSIFIED by type so a human is never handed a flat pile. It writes ONLY a
report zone (sidecoach/data/taste-map/) + a taste_map beat; it never touches the registry, quarantine,
promote/enforce, hooks, or config. Nothing in src/ imports data/taste-map/, so the map is inert by construction.

Files created:
- sidecoach/src/taste-map-types.ts - typed schema (DistilledRule, ContradictionRecord, OverlapView,
  TasteMap) + the PURE classifyContradiction(recA,recB) over typed records + seedConceptFromKey +
  normalizeConcept. A leaf module (imports nothing), so the bin can require the compiled dist copy.
- sidecoach/src/__tests__/taste-map-types.test.ts - 28 assertions: classifyContradiction returns exactly
  direction-pair/hard-vs-hard/standard-calibration/cross-type on hand-built pairs, null on unrelated
  concepts, direction-pair.isConflict===false; the load-bearing invariant (direction gate beats polarity).
- sidecoach/bin/sidecoach-consolidate.js - the engine. `distill-corpus` (thin wrapper over the miner's
  assembleCorpus, filtered to expert-external + rule-store) and `map` (ingest+normalize distilled.json with
  totality, cluster, overlap via buildDedupIndex, deterministic contradiction detector, markdown renderer,
  --check drift gate, headless rule-store baseline fallback). Reuses the miner's assembleCorpus,
  buildDedupIndex, loadRegistry, loadGuidanceStores, assertSafeWrite - zero corpus-loading duplication.
- sidecoach/bin/__tests__/sidecoach-consolidate.test.js - 53 assertions incl. the labeled ~16-pair
  typing-precision gate (100% measured).
- sidecoach/bin/__tests__/fixtures/distilled-conflicts.json (acceptance: 1 direction-pair + 1
  standard-calibration + 1 hard-vs-hard + covered/additive/single-source counts) and
  distilled-precision.json (the risk gate).
- sidecoach/data/taste-map/taste-map.{json,md} - the delivered headless baseline artifact.

Files edited: scripts/run-tests.ts (+2 suites), scripts/generate-tool-index.ts (+DESCRIPTIONS entry ->
regenerated claude/skills/sidecoach/reference/tools.md), claude/skills/sidecoach/SKILL.md (+consolidate flow).

THE LOAD-BEARING RULE (got it exactly right).
Why: a direction-typed rule (bolder vs quieter) must never be mistyped as a hard-vs-hard conflict; that
would turn the intended MENU into a false alarm.
How: directionLabel + type='design-direction' are PROVENANCE-GATED - set ONLY when the source matches a
fixed allowlist keyed on source slug + filename (leon minimalist/brutalist/soft, oracle bolder/quieter,
taste-skill named-vibe). normalizeDistilled reads the label from provenance and DEMOTES a design-direction
claim from a non-direction source to principle-guidance. classifyContradiction checks the direction gate
FIRST, so two directions on the same axis always pair as direction-pair (isConflict=false), never
hard-vs-hard. The detector RE-TYPES every pair from the STRUCTURED fields (axisSubject join, polarity,
measured values), never prose - so classification is reproducible. Verified against the real corpus: 6
provenance-gated direction files matched exactly (leon x3, oracle x2, taste-skill x1).

Verification (each blueprint step with its runnable check):
- baseline: SIDECOACH_AUDIT_HISTORY=/tmp/none npm test -> 190 suites, exit 0 (pre-change).
- step 1: npm run build clean; taste-map-types.test 28 assertions green, wired into run-tests.
- step 2: distill-corpus total 292 == miner corpus expert-external(82) + rule-store(210).
- step 3: map --distilled fixture --dry-run --json -> exactly 1 direction-pair (isConflict=false) + 1
  standard-calibration + 1 hard-vs-hard; covered 1 / additive 2 / single-source 1.
- step 4: render contains all three section headers; --check exit 0 fresh, 1 after a manual edit.
- step 5: --out-dir ../src refused (exit 4, nothing leaked); no src/ file imports data/taste-map; headless
  map (no --distilled) emits a rule-store baseline map exit 0; labeled fixture typing precision 16/16 (100%).
- FINAL: SIDECOACH_AUDIT_HISTORY=/tmp/none npm test -> 192 suites passed, exit 0.

Did NOT commit (lead integrates + runs Codex). Did NOT touch the concurrent miner's files
(data/taste-candidates.json, data/proposed-rules/, sidecoach/.claude/memory/) - the consolidate fence is
data/taste-map/ + the project-root .claude/memory only.

CODEX RE-REVIEW FOLD (3 findings, all reachable, all in the "never hide a real conflict" path).
Why they mattered: all three could silently DROP a real conflict. Each folded with a regression test that
fails before and passes after (demonstrated the pre-fix defect empirically for all three).
- F1 (High): contradiction detection joined on `concept` only. Two records sharing an axisSubject but in
  different normalized-concept clusters ("typeface inter" vs "inter font", both axisSubject "inter-font")
  were never compared, so a real hard-vs-hard was missed. Fix: buildMap now groups the contradiction pass
  by NORMALIZED axisSubject (the blueprint join key) and compares every pair within each axisSubject group,
  independent of the concept clustering that still drives the overlap/display view. Per-cluster display
  shows intra-cluster contradictions; contradictionsByType carries the complete axisSubject-joined set.
  Regression: 2 records, different concepts, same axisSubject -> exactly 1 hard-vs-hard (was 0).
- F2 (High): the provenance direction-gate over-matched. Old token-substring regexes (/(^|[/_-])oracle.../)
  let `not-oracle` and `oracle-fake` PASS the oracle gate, masking a real hard rule as a harmless
  direction-pair. Fix: EXACT source-slug allowlist (['leon-lin-taste-skill','oracle','taste-skill']) +
  EXACT path-segment match (dir segment or basename-sans-ext). TIGHTENED (not weakened) per the lead: a
  design-direction claim from a non-direction source is now DEMOTED to the rule kind its own fields imply -
  hard-prohibitive if it carries a polarity, standard-measurement if measured, else principle-guidance - so
  a masquerading hard rule is SURFACED as hard-vs-hard, never hidden. All 6 real direction files still match.
  Regression: not-oracle/oracle-fake -> null gate + the masquerade pair classifies hard-vs-hard.
- F3 (Medium): a value-taking flag with no value (`map --distilled` at end of argv) left opts.distilled
  undefined and silently produced a zero-cluster headless map that could OVERWRITE the report. Fix:
  parseArgs `need()` requires a value that is not itself a flag, else exits usage (2) before any write.
  Regression: `map --distilled` and `map --distilled --dry-run` both exit non-zero, write nothing.
Kept intact (Codex confirmed good): no eval/require/exec of untrusted distilled content; the write fence
realpaths ancestors so in-repo ../src and symlink escapes are refused.
Result: consolidate suite 53 -> 66 assertions; typing precision still 16/16 (100%).

CODEX RE-REVIEW ROUND 2 (2 findings; the axisSubject join + arg guard were CONFIRMED solid).
- F1r2 (High): a hard rule could still hide inside the direction menu. normalizeDistilled kept
  type='design-direction' as soon as an allowlisted provDir existed, BEFORE inspecting the record's own
  structured hard fields - so two allowlisted directions with OPPOSING polarity (oracle bolder ban vs
  quieter mandate, same axisSubject) classified as a harmless direction-pair and the ban-vs-mandate
  conflict vanished. Fix (the blueprint's "re-type from STRUCTURED fields" applied to the type assertion
  itself): a record is a genuine design-direction ONLY if it carries NO hard structured field. Re-type
  order in the gate is now polarity -> hard-prohibitive, else measured -> standard-measurement, else
  provDir -> design-direction+label, else -> principle-guidance. A structured hard field OVERRIDES the
  direction label even from an allowlisted source (surfacing over hiding); a genuine direction (label, no
  polarity, no measured) still pairs as direction-pair, so bold-vs-restrained stays the menu. Tests
  F1r2a/b/c: opposing-polarity directions -> hard-vs-hard; differing-measured directions ->
  standard-calibration; two genuine directions (minimalist vs brutalist) STILL direction-pair
  (isConflict=false, menu preserved).
- F2r2 (Low): the round-1 value guard rejected a legitimate value beginning with a dash (a filename like
  -fixture.json). Fix: parseArgs now also accepts the unambiguous `--flag=value` form (value may begin
  with a dash), while KEEPING the space-separated guard (bare flag / flag-followed-by-flag still exit 2),
  so the headless-overwrite hole stays closed. A boolean flag with an =value is rejected. Tests F2r2:
  --distilled=<file> reads it; --distilled=-lead.json (dash-leading, from a temp cwd) accepted; --distilled=
  empty still exits 2; --json=x rejected; bare --distilled and --distilled --dry-run still exit 2.
Result: consolidate suite 66 -> 81 assertions; typing precision still 16/16 (100%).

ROUND-2 HARDENING - END-TO-END PIPELINE TESTS (lead's directive). The lead's round-2 probe reported 0/0
from `map --distilled` (messages had crossed - the lead ran a copy predating my round-2 fold). Reproduced
the four scenarios against current code via the REAL pipeline (C.runMap -> normalizeDistilled -> buildMap):
masquerade hh=1, measured sc=1, genuine dp=1, fabricated hh=1 - all correct. Lead's point stands regardless:
the round-2 regressions used the DIRECT classifier, which cannot catch a demotion/grouping bug that drops
records before the classifier. Added 4 committed fixtures (bin/__tests__/fixtures/r2-*.json) and an
END-TO-END pipeline test block asserting the four contradictionsByType counts through C.runMap plus one CLI
shell-out. Harness note: spawnSync PIPE capture truncates large stdout at ~8192 bytes (why run-tests.ts
captures child output to a file); the tool's JSON is correct at 46KB - the one large-JSON CLI assertion now
captures stdout to a file. Result: consolidate suite 81 -> 92 assertions; typing precision still 16/16 (100%).

CODEX FINAL PASS (3 findings; 2 High + 1 Med) - type-gated override reopened the hide-a-conflict hole.
Root cause (all 3): normalizeDistilled's re-typing + provenance promotion ran INSIDE `if (type ===
'design-direction')`, so they fired only when the UNTRUSTED input already asserted design-direction. A
record with a missing/unknown/WRONG type but hard structured fields was left principle-guidance ->
classifyContradiction hit the final null -> the conflict was DROPPED. Fix: drive the type from the RAW
structured fields FIRST, independent of the asserted type. Order now: (1) polarity field PRESENT (non-empty
after trim) -> hard-prohibitive (keep the trimmed ban|mandate); (2) else VALID measured -> standard-measurement;
(3) else exact provenance allowlist AND no polarity/measured field present -> design-direction+label; (4) else
the asserted non-direction type if valid, else principle-guidance. A genuine direction requires NO polarity
field AND NO measured field on the RAW record. F3 also TRIMs polarity before the ban|mandate check and keys
step 1 on field PRESENCE, so a record carrying any polarity is hard-prohibitive, never a menu.
- F1 (High): r3-untyped-polarity.json (unknown type + opposing polarity -> realConflicts=1) +
  r3-untyped-measured.json (unknown type + differing measured -> calibration=1). Before: 0 (dropped).
- F2 (Med): r3-notype-genuine-direction.json (allowlisted oracle directions, NO type field -> directionMenu=1).
  Before: 0 (menu lost).
- F3 (High): r3-trailing-space-polarity.json (design-direction + polarity "ban "/"mandate " -> realConflicts=1).
  Before: untrimmed polarity dropped -> stayed design-direction -> direction-pair (hidden).
All new regressions assert on `.counts` through the REAL pipeline (C.runMap), not the direct classifier.
Updated the one existing TOTALITY assertion (a polarity:'sideways' record is now correctly hard-prohibitive;
the fallback test uses a no-hard-field malformed entry). Prior acceptance stays green; precision 16/16.
Result: consolidate suite 92 -> 99 assertions.
