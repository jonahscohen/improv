---
name: P4a-2 code review (Codex) - core confirmed, 4 coverage/finding fixes to impl-p4a2
description: independent verify green (27 suites); Codex code review confirmed all core validator correctness; 2 P1 (false-clean from kind-blind candidate selection; unreadable-subtree gaps) + 2 P2 (optical-alignment absence-pass; anti-pattern finding loses file/rewrite info) routed before merge
type: project
relates_to: [session_2026-06-13_p4a2-v2-approved.md, feedback_autonomous_phases_codex_partner.md]
---

P4a-2 built by impl-p4a2 (7 commits). MY independent verify: build exit 0, npm
test 27 suites, both --checks OK, P1 hooks 110/0+35/0, no scope leak, 41 files
all in scope (incl the intended faithful-port edits to absolute-ban-detector/
polish-standard-validator/taste-validator).

Codex code review (task-mqd5b9br; session 019ec3e3): CONFIRMED - all 30 rules
four-status; missing-evidence/throws -> inconclusive+category; browser rules
inconclusive (ad-hoc fields don't bypass); existing live validators call the
extracted shared helpers (behavior-preserving for current callers); carve-outs
(identical-card-grid repeat, Tailwind/shadcn) preserved; only 3 markup bans
project-scoped; fixtures produce declared statuses; no scope leak; tsc + both
--checks pass.

**4 defects -> impl-p4a2 (NEEDS-FIXES):**
- P1 false-clean (run-validator.ts:69,188): candidate selection uses non-empty
  cssText/markup, IGNORING compatible source kinds. An HTML/TSX file with an
  uncovered <button> but no extracted <style> is dropped from execution AND
  discoveredApplicableFiles, yet the kind is reported supported + scope measured ->
  false clean. Repro: styles.css(focus-visible) + page.html(uncovered button) ->
  static-a11y clean; clean tokens + card.tsx(conflicting rounded utils) -> theming
  clean. FIX: derive candidates from the coverage record's compatible source kinds;
  a compatible inspected file lacking sufficient extracted evidence/applicability
  is an UNKNOWN gap -> affected required rule inconclusive. Add both repro tests.
- P1 unreadable subtree (project-collector.ts:27, run-validator.ts:75): an
  unreadable directory is recorded sourceKind 'directory'; run-validator only
  treats unreadable as a gap when the kind matches rule alternatives -> an
  unreadable subtree with applicable files still -> clean. FIX: treat unreadable
  discovery subtrees as unknown gaps for every required static rule (or escalate to
  validator-level unreadable_input). Test.
- P2 optical-alignment absence-pass (check-context.ts:93, polish-checks.ts:97): any
  padding: counts as target AND as the feature predicate -> ordinary padding ->
  pass. FIX: applicability requires an icon-text control/badge/explicit
  optical-alignment target; only then evaluate padding. Test ordinary padding ->
  not_applicable.
- P2 anti-pattern finding info loss (anti-pattern-checks.ts:15,27): keeps only the
  first rewrite option; scanners get placeholder filenames -> findings show
  <collected-file>/<assembled-markup>, drop remaining rewrites. FIX: pass the real
  one-file path; source-map assembled project markup back to original files;
  preserve all rewrite options in remediation. Test.

Each fix needs a failing-first test. After fixes: re-verify (27+ suites, --checks,
P1 hooks), merge to main, then P4b.

Collaborator: Jonah.
