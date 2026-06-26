# Contract-6 Corpus Selection Method (PRE-REGISTERED, FROZEN before any capture)

Frozen: 2026-06-23, before the first candidate capture. "Rule-agnostic" only holds if
the method is fixed BEFORE seeing captures - this file IS that frozen method. The joint
independence review (lead + Jonah) audits RESULT-AGAINST-METHOD: every captured case must
trace to a slot defined here, selected by a rule that references NOTHING about what our (or
oracle's) detectors catch. Collaborator: Jonah Cohen.

## Integrity invariant
The architect (rule-author) does NOT choose URLs by design quality, by what our rules
detect, or by what would favor Sidecoach. Selection is by the mechanical rules below.
A human seed URL list (Jonah), if supplied, SUPERSEDES this method (maximal independence).

## Registers (5)
landing/marketing, dashboard/app-ui, product, forms, editorial.

## Targets (per Jonah + lead)
- Defect-bearing (heldout): >= 40 total, ~8 per register.
- Known-good: >= 40 total, ~8 per register (real shipped designer-clean, incl adversarial-borderline legit uses).
- Briefs (A5): power-locked N (>= 20 floor; target 20-30) spanning registers + the 3 calibration types (oracle-should-win / Sidecoach-should-win / genuine-tie).

## Known-good = PRIMARY-CONTENT-clean (Jonah ruling B, 2026-06-23) - refined inclusion criterion
Under crisp a11y rules, genuinely-clean (0 objective defects anywhere) real pages are RARE (~31% yield at
n=29, and that set skewed pristine: gold-standards/OSS-docs). Forcing 40 fully-clean pages would either
need ~120 captures or bias known-good into "only gold-standards" (which wrecks A2 precision). RULING B:
- KNOWN-GOOD = 0 objective defects in PRIMARY content. PRIMARY = main/article/role=main (nearest landmark);
  PERIPHERAL = nav/footer/aside/header/role=contentinfo|banner|navigation|complementary. Peripheral chrome
  defects (footer low-contrast, nav metadata, disabled states) do NOT disqualify a page as known-good.
- NO-PRIMARY EDGE CASE: if no deterministic primary region exists (no main/article/role=main), the page is
  EXCLUDE-WITH-FLAG (counts toward neither quota; never guess a main region). Recorded as bucket=excluded-no-primary.
- LOAD-BEARING: ground truth stays FULL-PAGE for BOTH A1 recall AND A2 precision. B refines only the
  known-good INCLUSION bucket, NOT the FP ground truth. A detector flagging a REAL peripheral defect on a
  known-good page is a TRUE positive (it is in full-page ground truth), NEVER an FP. FP = flags MINUS
  full-page ground truth, across the whole corpus. A1 recall = catch defects ANYWHERE (full-page).
- Implemented in objective-label-rendered.mjs (landmarkRegion + classifyKnownGood); calibrated (calibration
  section d); Codex item-8 on the addition. At n=36: 16 known-good / 11 defect-bearing / 9 excluded.
- OBSERVATION for the joint review: ~25% of captures lack main/article (older/archive pages) -> excluded;
  this introduces a mild MODERN/semantic skew in known-good. If it becomes binding, the deterministic
  alternative is "PRIMARY = content NOT inside a peripheral landmark" (complement rule, no <main> required).

## Defect-vs-good split is LABELER-DETERMINED, never architect-judged (lead clarification, integrity-critical)
The architect (rule-author) MUST NOT sort pages into defect-bearing vs known-good by eyeballing
quality - that reintroduces the exact selection bias the rule-agnostic method removes. The split is
set by the LABELER, not by opinion:
- OBJECTIVE: a case is defect-bearing iff the spec-math objective labeler (objective-label.mjs:
  static now + the rendered pass when built) finds >= 1 objective defect; known-good iff 0. The
  SUBJECTIVE dimension is layered in later by the held lead-run Codex pass (may move an
  objective-clean page to subjectively-defective; that is the Codex pass's call, not the architect's).
- SOURCING stays rule-agnostic (by category/era, NO detectability peek). Labels fall where they fall.
  To reach the ~8-defect quota, source MORE rule-agnostically until the labeler yields enough - NEVER
  pick a page because it "looks defective".
- If a register genuinely cannot yield ~8 defect-bearing (or ~8 known-good) from rule-agnostic
  sourcing, that is a FINDING to REPORT at the joint review, not a license to cherry-pick.
- diversity.quality is an AUDIT MARKER for the review, NOT a label and NOT the split key.

## CURRENCY FLOOR (mandatory - lead reinforcement 2)
Taste-currency is a differentiator we must be able to TEST, so the corpus must NOT skew old.
- >= 50% of each register's pages are CURRENT LIVE pages captured at HEAD (2025-2026).
- The remaining <= 50% are archive id_ snapshots for ERA diversity, evenly across the era buckets below.
- Per register (~16 pages = 8 defect + 8 good): >= 8 live-current, <= 8 archive.

## Mechanical selection rules (rule-agnostic)
- ARCHIVE era buckets (web.archive.org id_, original HTML): fixed dates 2012-06-01, 2016-06-01, 2020-06-01 (distributed across the archive allocation). id_ suffix = no wayback chrome.
- DOMAIN UNIVERSE (rule-agnostic breadth, NOT chosen by detectability): public domains spanning categories - government (.gov/.gov.uk), university (.edu/.ac.uk), large enterprise, small-business, personal/indie, news/editorial, OSS project, public product/demo/template-gallery. Spread quality (intentionally-strong -> intentionally-weak) by sourcing ACROSS these categories, never by previewing detector output.
- LIVE-CURRENT: HEAD captures of public 2025-2026 pages from the same category breadth.
- BRIEFS: real public design briefs / specs / RFPs / design-system docs; calibration briefs authored to a fixed neutral spec (3 types) and labeled by the independent pass.
- EXCLUSIONS (tool-enforced + procedural): oracle's own pages/demos/docs/outputs (host-refused); any page knowingly designed against oracle's/our rules; auth/paywall/access-controlled; PII/user-data; robots.txt/ToS disallowed.

## Per-case provenance (recorded by the tool)
source URL, capture-UTC, register, diversity.{quality,era}, license/ToS note, selection-slot
(which method slot this case fills). No detectability pre-filter (no detector is run to screen candidates).

## Archive-validity (lead reinforcement 3)
A capture becomes a case ONLY if it renders as the ORIGINAL intended page: substantive CSS
present (inlined/linked), not a broken-archive artifact (wayback error page / missing assets /
near-empty). Incomplete-archive captures are REJECTED so an archival break is never mislabeled
a design defect. Enforced in `corpus-candidate.mjs` capture (validateCapture).

## Audit
The review compares the realized manifest against these quotas + the per-case selection-slot +
the currency split. Deviations must be justified or the case pruned.
