---
name: P4a-2 COMPLETE - partial-static validator floor built, reviewed, merged
description: P4a-2 (full floor rule set + four-status checkProduct/validateProduct adapting the existing validators, per-file coverage, faithful ports) built (11 commits), Codex-authored plan + impl + Codex code-review (4 fixes); merged to main
type: project
relates_to: [session_2026-06-13_p4a2-v2-approved.md, session_2026-06-13_p4a2-code-review.md, session_2026-06-13_p4a1-COMPLETE.md]
---

P4a-2 COMPLETE and merged to main. The partial-static validator floor. Plan was
Codex-authored (role inversion), I reviewed+approved; impl-p4a2 executed (8 tasks);
Codex code-reviewed (confirmed core + 4 fixes); I verified + merged.

**Deliverable:** product-rule-registry expanded to the 30-rule partial-static
floor (22 Polish rules w/ cross-registry aliases + theming + anti-pattern +
static-a11y); a four-status validator pipeline (src/validators/: check-context,
project-collector, run-validator, checks/{polish,a11y,theming,anti-pattern});
checkProduct on all 30 rules + validateProduct on all 4 gating validators;
FAITHFUL ports - static predicates extracted into shared exported helpers in the
existing validators (absolute-ban-detector/polish-standard-validator/taste-validator)
and the live callbacks rewired to call them (behavior preserved, carve-outs kept);
achievable fixtures. NO lane-execution wiring (P4b), NO loops (P4c), NO MCP (P4d),
copy/linguistic gating deferred (P4e).

**Verification (3 legs):** impl self-report + MY independent re-run (build exit 0,
27 suites, both --checks, P1 hooks 110/0+35/0, no scope leak, 41 in-scope files) +
Codex code review (confirmed all 30 rules four-status, browser-rules-inconclusive
incl ad-hoc-bypass guard, faithful ports/carve-outs, behavior-preserving callbacks,
fixtures, no leak; 2 P1 + 2 P2 fixed: kind-blind candidate false-clean,
unreadable-subtree gaps, optical-alignment absence-pass, anti-pattern finding info
loss - each with a failing-first test).

**Commit chain (11 on lane-p4a2):** 0e4f1c9 244026a 1201251 342efc9 a5ab9e4 8e6ec68
950e119 (7 tasks) + f15dfb7 7c5fb78 3a9c303 e6e4cb0 (4 code-review fixes).

**HONESTY BOUNDARY (document; resolved by P4b):** the partial-static floor CANNOT
confirm cross-file coverage. A project splitting CSS into .css and markup into
styleless .html/.tsx yields INCONCLUSIVE (not clean) for css-rule rules touching
markup-resident targets - because static evidence can't prove the cross-file link.
This is the truthful behavior (better than false clean); the fixtures are therefore
self-contained single files. P4b's browser/DOM collector resolves it (it supplies
the dom/computed/contrast evidence that makes those rules conclusive).

**NOT pushed** to origin (Jonah's call).

**Next:** P4b - async validator EXECUTION wiring into advanceLane (step/iteration
gates) + the browser-evidence collector + the folded P3 durability (lease/lock/
fencing/outbox/AbortSignal - finally meaningful because there is async work +
external side effects to protect). Then P4c (loops/convergence/lane_converge),
P4d (MCP), P4e (copy gating). Role inversion remains the pattern for the
spec-bound plans.

Collaborator: Jonah.
