---
name: Sidecoach 3-axis stress test (INVOCATION / REPORTING / TASTE) - 1 real failure found+fixed, 2 axes proven clean
description: QA stress test of sidecoach across invocation, reporting, and taste validation with REAL inputs (live hook from /tmp, real rendered audits, real playwright taste renders). Found + fixed a genuine INVOCATION gap (pure-diagnosis prompts went silent); REPORTING and TASTE proven correct with evidence. Fix Codex-reviewed across 3 rounds to LGTM.
type: project
relates_to: [session_2026-06-26_sidecoach-NL-tier-fixes-verified.md, session_2026-06-26_sidecoach-invocation-gap.md, session_2026-06-27_audit-report-codex-folded.md]
---

Collaborator: Jonah. 2026-06-29. QA teammate stress test, manager-directed.

## VERDICT BY AXIS
- AXIS 1 INVOCATION: **1 real failure FOUND + FIXED + reviewed** (pure-diagnosis on-ramp was dead). Now proven.
- AXIS 2 REPORTING: **PASS, proven** (renders, honest verdict, fail-closed, width-safe, deduped, --json renderedPanel).
- AXIS 3 TASTE: **PASS, proven** (all 3 detectors fire on real defects, do not over-fire on clean copy; 2 operating-point characteristics documented, not bugs).

Codex available (codex-cli 0.130.0, model gpt-5.5) - used as the independent reviewer.

================================================================
## AXIS 1 - INVOCATION
### What I tested (REAL inputs)
- `test-sidecoach-keyword.sh`: 115/115 green at start (now 135/135 after +20 new cases).
- Battery of ~40 natural prompts run against the LIVE hook `~/.claude/hooks/sidecoach-keyword.sh`
  from `/tmp` (non-repo CWD = real-session conditions), fresh cooldown per prompt via
  `SIDECOACH_INTENT_COOLDOWN_FILE`. Build intent, diagnosis intent, borderline, trivial, backend.
- Live deploy confirmed: all 5 NL-tier siblings symlinked in `~/.claude/hooks/` (lane tier NOT dead).
- Lane classifier + parity: `test_sidecoach_lanes.py` 35/35, `test_classifier_parity.py` 23 cases.

### THE FAILURE (reproduced, root-caused)
Pure read-only DIAGNOSIS prompts went SILENT when they lacked a "feels/looks off" word or an
explicit verb, even though the nudge text + CLAUDE.md both cite them as canonical `/sidecoach audit`
cases. Confirmed silent: "what's wrong with the homepage / page / dashboard", "diagnose the homepage",
"take a look at the pricing page", "is the copy real or fluff" (a VERBATIM CLAUDE.md example).
- ROOT CAUSE: `_intent_eligible()` fires on `has_standalone OR (has_action AND has_target)`. The
  `actions` lexicon is 100% BUILD verbs (build/create/design/...). There was NO diagnosis-verb tier.
  So diagnosis fired only by accident: a "feels off" standalone, an explicit verb, a standalone
  design-noun, or a build-regex collision ("what's wrong with this layout" fired only because the
  build action `lay ?out` matches the NOUN "layout"). The previous arc (2026-06-26) broadened the
  nudge TEXT and added "feels/looks off" standalones but never broadened the TRIGGER to fire on
  diagnosis-without-a-feel-word. So the single most natural design-QA request stayed un-routed - the
  exact invocation gap that arc set out to close, still open for the no-feel-word class.

### THE FIX (3 files; live via symlink, verified)
1. `sidecoach-intent.json`: added a `diagnose` verb tier ("what's wrong/off with", diagnose, take a
   look at, look at, check, review, inspect, ... ) + "real or fluff" standalones; and a
   `diagnose_targets` positive allowlist.
2. `sidecoach-keyword.sh` `_intent_eligible()`: `fires = has_standalone or (has_action and has_target)
   or (has_diagnose and has_diag_target)`; exempt-suppression now also checks `not has_diagnose` so a
   genuine diagnosis is not silenced by an incidental tweak word.
3. `test-sidecoach-keyword.sh`: +20 cases (diagnosis fires; non-UI diagnosis stays silent; over-fire
   guards; design-canonical targets still fire).

### CODEX REVIEW (3 rounds, independent model gpt-5.5)
- R1: flagged over-fire (broad diagnose verbs x ambiguous targets). Its SPECIFIC examples were
  partly hallucinated (auth/app/profile/settings/flow are NOT substantive_targets), but the real
  subset was confirmed: header(HTTP)/table(DB)/view(SQL) ARE targets and over-fired on backend prose.
- Fold #1 (denylist): excluded header/table/view/grid from the diagnose path. R2 (after reading the
  actual code) correctly judged the DENYLIST the wrong shape - retained overloaded nouns still leak:
  `site`("call site"), `interface`("TS interface"), `component`("sw component").
- Fold #2 (allowlist): replaced the denylist with a positive `diagnose_targets` UI-allowlist
  (safe-by-default; a newly-added overloaded target cannot leak). Build-action path unchanged.
- R3: **"LGTM. Over-fire concern is resolved. No remaining real P0/P1."**

### VERIFIED (live hook, real prompts, post-fix)
FIRES (the gap, now closed): "what's wrong with the homepage/page/dashboard", "diagnose the pricing
page", "take a look at the landing page", "check the navbar", "is the copy real or fluff", "what's
wrong with the layout/login screen/signup form/pricing table".
SILENT (precision preserved): "inspect the packet header", "look at the users table", "review the
materialized view", "look at the call site", "review the TypeScript interface", "inspect the auth
component", "what's wrong with the database query", "diagnose the deployment failure", + all prior
trivial/backend regression cases. Suite 135/135, lanes 35, parity 23.

### SELF-ANALYSIS (why the gap survived the prior arc)
The 2026-06-26 fix treated "make the nudge TEXT mention diagnosis" as equivalent to "make the trigger
FIRE on diagnosis." It verified the text and the specific original prompt ("...feels off...") - which
fires via the "feels off" standalone - and stopped, without testing the no-feel-word diagnosis class
("what's wrong with the homepage"). Same failure mode the invocation-gap beat itself warned about:
certifying a behavior from the matcher it happens to touch, not from the full class it claims to cover.
Caught here by running the WHOLE diagnosis class, not one representative prompt.

================================================================
## AXIS 2 - REPORTING (PASS, proven)
Tested via `node sidecoach/bin/sidecoach-monitor.js "/sidecoach audit <target>"` against the live
marketing dev server (localhost:4830, http 200) and a dead port (59997). dist was rebuilt first
(`npm run build` green: generate-lanes + generate-validators --check + tsc, 0 errors) because several
src files post-dated dist; tested the CURRENT engine.
- RENDERS: 4830 audit -> verdict ✗ blocked, grade F, 20 findings. accessibility 20 (low-contrast x18
  "contrast under 4.5:1", gray-on-color x2), taste 0 clean. Priority fixes DEDUPED by selector,
  severity-first, worst-first (dd.stat__caption 3.02:1 leads), 5 distinct selectors, full selector +
  metric, never truncated mid-fact.
- HONEST verdict / FAIL-CLOSED: dead port -> success:false, verdict `inconclusive`, rendered:false,
  NO buildReport, message "INCONCLUSIVE, not clean", panel "? inconclusive / the page did not render ·
  connection refused / this is not a clean result". A false clean is structurally impossible.
- WIDTH-SAFE under NO_COLOR: max visible line = 62 chars = the rule width, for blocked, inconclusive,
  AND an 80+ char URL (URL truncates with …; longest line is the rule itself). No overflow.
- --json: carries success, audit.verdict, audit.rendered, audit.unavailableReasons, byRule, topFixes,
  AND `renderedPanel` (1590 chars present on the blocked case).
- PARTIAL COVERAGE: unit-covered (audit-rendered.test.ts "partial-lens"); the panel shows a
  "partial scan · coverage incomplete" caveat when one lens fails (Codex-folded 2026-06-27).
- `cd sidecoach && npm test`: **65 suites passed, 0 failed** (incl. audit-rendered: url detect,
  normalize, clean/blocked/warnings, FAIL-CLOSED inconclusive, partial-lens).

================================================================
## AXIS 3 - TASTE VALIDATION (PASS, proven)
Tested `subjective-rendered-scanner.ts` via REAL playwright renders (analyzeHtmlOnBrowserSubjective on
the freshly-built dist), crafting positive (real defect) + negative (clean/specific) pages for each
detector. 10/10 probe pages classified correctly.
- marketing-buzzword: FIRES on fluff-leaning copy (density 146.6/100); SILENT on concrete copy, on a
  single concrete "powerful" in realistic-length copy, and on buzzwords confined to a <blockquote
  class="testimonial"> (the quote-exclusion works).
- tiny-text: FIRES when most content text is 11px (100% <=13px); SILENT on 16px body + one 12px
  caption (proportion floor) and on uniform readable 14px (SMALL_PX=13 boundary).
- nested-cards: FIRES on a bordered+rounded card inside a bordered+rounded card; SILENT on sibling
  cards and on a card with plain (non-card) children (strong-treatment requirement).

### Two operating-point CHARACTERISTICS (documented, NOT bugs)
1. buzzword is DENSITY-based: one STRONG-tier word ("powerful") yields density 1.6 @100w, 0.8 @200w,
   SILENT @300w+. So a single concrete marketing word trips the 0.75 threshold only on short (<~270w)
   pages; realistic marketing copy (300w+) dilutes it. This is the frozen v3 operating point
   (dev P=0.839 by design), not a regression.
2. `BUZZ_MIN_WORDS=40` floor: a page under 40 content words is never judged "leaning on buzzwords"
   (a 33-word 2-PEAK page is correctly SILENT). Intended precision guard.

================================================================
## CONFIDENCE
HIGH. Every claim is backed by a real input (live hook from a non-repo CWD, real rendered audits, real
playwright taste renders) - no synthetic shortcuts. The one genuine failure (INVOCATION) is fixed,
regression-tested (+20 cases), and Codex-approved to LGTM after 2 folds. REPORTING and TASTE are proven
correct with reproducible evidence. Full green: keyword 135/135, lanes 35, parity 23, sidecoach npm 65
suites, taste probe 10/10.

## HONEST LIMITS
- End-to-end "fresh top-level Claude session routes into the engine" is still best run by Jonah in a
  clean session; I proved the hook FIRES the audit-directed nudge on the diagnosis class (the on-ramp),
  not that a downstream model then runs `/sidecoach audit` (that is the model's choice, advisory).
- The nudge is ADVISORY by design; the buzzword density operating point trades some precision for
  recall on very short pages (characterized above).
- Concurrent teammate edits to lotus/* + MEMORY were in the shared working tree during this session
  (the known Agent-isolation caveat); my changes are scoped to the 3 claude/hooks/ files only.

## Files touched
- claude/hooks/sidecoach-intent.json (diagnose tier + diagnose_targets allowlist + fluff standalones + _meta)
- claude/hooks/sidecoach-keyword.sh (_intent_eligible: diagnose path + allowlist gate + exempt override)
- claude/hooks/test-sidecoach-keyword.sh (+20 regression cases)
