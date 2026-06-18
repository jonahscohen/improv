# Independent Review: Sidecoach Lane Intent Detection v5

Date: 2026-06-12  
Reviewed design: `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
Review basis: v5 design plus current tactical-polish handler, Polish Standard
validator, Extended Domain validator, audit/critique handlers, convergence
loop, and validator tests.

## Executive verdict

V5 resolves the principal v4 design blockers. The lane state machine,
capability registry, explicit product/advisory distinction, persisted
convergence state, failure semantics, preflight policy, checkpoint CAS, and
measured/unverified summary contract are all sensible foundations.

The selected release posture is still not implementation-ready:
`flowJ_tactical_polish` is designated as the sole product-validation gate, but
its current project-evidence collection and rule-result model cannot yet
support the claimed measured scope truthfully. The issue is not that Option A
is architecturally wrong. The issue is that the sole validator admitted by
Option A currently treats incomplete evidence inconsistently and can count
unmeasured or not-applicable checks as passes.

Recommendation: **retain Option A's capability architecture, but require a
bounded Option B release floor before enabling `lane_converge`.** Harden Flow J
into a coverage-aware product validator and add the tractable static portions
of Audit as independent product validators. Keep browser-dependent checks and
judgment-heavy Critique advisory until each has reliable target-derived
evidence.

This is not a recommendation to build full automated design judgment before
shipping. It is a recommendation to ensure the initial convergence gate is
meaningfully deep and mechanically truthful.

## Recommended decision

Adopt the following staged contract:

1. **Keep v5's capability registry and convergence semantics.** They are the
   correct long-term architecture.
2. **Do not enable `lane_converge` with current Flow J as its sole gate.**
3. **Harden Flow J before release** so every rule returns
   `pass | fail | not_applicable | inconclusive`, and only genuinely executed
   checks contribute to measured scope or clean status.
4. **Ship a bounded first slice of Option B** consisting of static
   theming/token-consistency, CSS anti-pattern, and reliable static
   accessibility validators.
5. **Keep rendered responsive behavior, Core Web Vitals, screen-reader
   behavior, Nielsen heuristics, and cognitive-load critique advisory** until
   their required harnesses and confidence policies exist.

Under this recommendation, `lane_converge` can ship when all enabled product
validators are clean and the coverage ledger proves their required evidence
was actually collected. New validators continue to widen the gate through
v5's registry without redesigning lane membership.

## Why full Option B is not recommended

Full Option B would require building several materially different validation
systems as a dependency of this already broad release:

- a browser launcher and route/state discovery contract;
- stable viewport and rendered-layout assertions;
- performance baselines and Core Web Vitals collection;
- authentication and application-start handling;
- deterministic or calibrated policies for Nielsen and cognitive-load
  judgments.

Static theming, anti-pattern, and selected accessibility checks are tractable.
Rendered behavior and performance require a browser harness. Automated design
judgment is a separate research and product-calibration problem. Treating all
of these as one release gate would either delay the lane substantially or
create pressure to admit weak proxies as product evidence.

The bounded approach gains meaningful validation depth without weakening v5's
truthfulness standard.

## Prioritized findings

### P0. Flow J cannot yet prove the measured scope assigned to it

V5 assigns Flow J the following measured scope:

- tactical polish matrix;
- extended design-domain matrix;
- linguistic-ban scan;
- absolute-ban scan.

It also requires missing or skipped inputs to produce `inconclusive`. That is
the right rule, but it is not satisfied by the current validator behavior.

The current project collector:

- walks only the project root and one directory level;
- primarily collects CSS-family files;
- scans only root and one-level HTML/Markdown for copy;
- does not populate raw HTML, rendered DOM, typography, color, spacing,
  motion, performance, visualization, or internationalization evidence during
  normal project execution.

Relevant implementation:

- `sidecoach/src/flow-handler-tactical-polish.ts:24-125`
- `sidecoach/src/flow-handler-tactical-polish.ts:192-212`

Despite those absent inputs, the validators can still produce pass results:

- missing `computedStyle` passes the concentric-radius check because
  `undefined !== '0px'`;
- missing `genericityScore` defaults to zero and passes;
- many Extended Domain checks encode not-applicable as `passed: true`;
- once any CSS input exists, the Extended Domain validator runs the entire
  matrix rather than identifying which domain checks had sufficient evidence.

Relevant implementation:

- `sidecoach/src/polish-standard-validator.ts:76-85`
- `sidecoach/src/polish-standard-validator.ts:103-120`
- `sidecoach/src/polish-standard-validator.ts:420-427`
- `sidecoach/src/extended-domain-validator.ts:2937-2983`
- `sidecoach/src/domains/tier2-content-perf.ts:8-16`
- `sidecoach/src/domains/tier2-visual-copy.ts:6-15`

This means a clean Flow J result can currently mix:

- checks that inspected target evidence;
- checks inferred from partial static proxies;
- checks that were not applicable;
- checks that silently defaulted missing evidence to a pass.

That mixture cannot truthfully support the static `measuredScope` claimed by
v5.

**Required resolution**

Introduce a product-validation rule result with explicit evidence semantics:

```text
ProductRuleResult = {
  ruleId,
  status: 'pass' | 'fail' | 'not_applicable' | 'inconclusive',
  evidenceKind,
  evidenceLocations[],
  message,
  remediation?
}
```

`clean` must require every required applicable rule to be `pass`, with no
required rule `inconclusive`. `not_applicable` must be reported separately and
must never inflate a pass count. `measuredScope` must be derived from the
checks that actually ran with sufficient evidence.

### P0. The sole-gate release posture is too weak until coverage is enforced

V5 correctly prevents audit warnings and critique framework initialization
from becoming false product evidence. However, it then permits convergence
based solely on Flow J.

That is defensible only if Flow J's evidence coverage is strong enough to make
the resulting convergence useful. Today it is not. A TSX-heavy application
with deeply nested sources, CSS-in-JS, runtime-only states, or missing
metadata can fall outside significant portions of the collector while the
lane still evaluates a nominally comprehensive matrix.

The mandatory closing summary prevents the result from claiming manual
accessibility, responsive, performance, or critique verification. It does not
currently disclose:

- files and source types not inspected;
- rules that lacked required evidence;
- rules treated as not applicable;
- domains measured only through weak static proxies;
- actual measured-rule coverage.

**Required resolution**

Before `lane_converge` is enabled:

1. Flow J must provide a coverage ledger and truthful per-rule statuses.
2. Project discovery must recursively inspect supported source types while
   respecting explicit exclusions and size limits.
3. Unsupported source systems and unreadable/skipped files must make the
   affected scope `inconclusive`, not clean.
4. At least the tractable static Audit validators should independently join
   the initial product gate.

### P1. `cleanPolicy` needs a concrete, testable schema

V5 requires each product validator to declare `cleanPolicy`, but does not
define its shape. The current Flow J behavior contains several different
threshold concepts:

- any Polish Standard violation;
- critical versus non-critical violations;
- zero P0 linguistic findings but a tolerated number of P1 findings;
- zero P0 absolute-ban findings with P1 framed as review;
- optional checklist items.

Without an exact schema, implementations can disagree about whether warnings,
P1 findings, not-applicable rules, or partial coverage prevent clean.

**Required resolution**

Define `cleanPolicy` as structured data rather than prose:

```text
cleanPolicy = {
  requiredRuleIds[],
  blockingSeverities[],
  toleratedFindingCountsByClass,
  minimumCoverageByScope,
  inconclusiveBehavior: 'block',
  notApplicableBehavior: 'exclude_and_report'
}
```

The policy must be included in the persisted validation run and closing
summary. Tests must prove that changing policy inputs changes the result
deterministically.

### P1. Measured and unverified scope must be dynamic, not registry-only

The mandatory summary is an important truthfulness control. Its current scope
lists are primarily declared by the capability registry. Registry declarations
are necessary, but they cannot represent run-specific evidence gaps.

For example, a validator may support HTML and CSS generally but encounter a
project implemented primarily through TSX and CSS-in-JS. A static registry
still says the domain is measured, while the actual run did not collect the
needed evidence.

**Required resolution**

Persist a run-derived coverage record:

```text
coverage: {
  inspectedFiles[],
  skippedFiles[],
  supportedSourceKinds[],
  unsupportedSourceKinds[],
  rules: { pass, fail, notApplicable, inconclusive },
  measuredScope[],
  unverifiedScope[]
}
```

The final summary must be generated from this run record. Registry scope is
the validator's maximum capability; run scope is what it actually proved.

### P1. The initial product gate should include bounded static Audit validators

Audit currently remains advisory because the handler serves a framework and a
permanent manual-testing warning rather than target-derived findings. That
classification is correct.

However, several Audit dimensions have useful deterministic slices that can
be built without a browser or automated design judgment:

- token consistency and hardcoded-color detection;
- prohibited CSS transition and global-style patterns;
- semantic markup, label/ARIA presence, and selected focus/reduced-motion
  checks where source evidence is available.

These checks should be independent product validators rather than inferred
from Audit handler output. Promoting them provides a meaningful initial
release gate while preserving manual warnings for the portions they cannot
prove.

**Required resolution**

Add an explicit v5 release-floor table:

| Validator slice | Initial capability | Release requirement |
|---|---|---|
| Flow J coverage-aware static polish/copy/bans | `product_validator` | required |
| Static theming/token consistency | `product_validator` | required |
| Static CSS anti-pattern checks | `product_validator` | required |
| Reliable static accessibility checks | `product_validator` | required |
| Rendered responsive/device validation | `advisory` | follow-up |
| Browser performance/Core Web Vitals | `advisory` | follow-up |
| Nielsen/cognitive-load/design critique | `advisory` | follow-up |

### P2. Advisory failure semantics should affect the user-facing terminal label

V5 allows the product gate to converge when Audit or Critique errors, provided
the errors appear in `advisoryRuns` and the summary. That is mechanically
consistent, but a bare terminal status of `converged` may still overstate the
result when the requested coaching loop did not fully execute.

**Recommendation**

Keep advisory failures non-blocking, but expose a user-facing qualification:

```text
machine_checks_clean_with_advisory_warnings
```

The persisted convergence status can remain `converged`; the display status
and summary should make partial advisory execution prominent.

## Required acceptance additions

Add the following tests before release:

- A nested TSX/CSS-in-JS fixture cannot report unsupported checks as pass.
- Removing required evidence changes affected rules from pass/fail to
  `inconclusive`.
- Not-applicable rules are excluded from pass rate and listed separately.
- Missing metadata cannot silently pass genericity, contrast, performance, or
  accessibility checks.
- Unreadable and size-skipped files appear in coverage and make affected
  scopes inconclusive.
- A project containing only a shallow clean CSS fixture cannot claim the full
  Extended Domain matrix as measured.
- Static theming, anti-pattern, and accessibility mutations each produce
  stable target-derived findings and block convergence.
- The final summary is generated from run coverage and changes when inspected
  evidence changes.
- Advisory flow failure produces a visibly qualified converged result.

## Suggested v5 disposition

| V5 area | Assessment |
|---|---|
| Lane classifier and scope architecture | Approve |
| Model-driven lane state machine | Approve |
| Checkpoint, CAS, resume, retention, and containment contracts | Approve |
| Product-validator capability architecture | Approve |
| Advisory/product evidence boundary | Approve |
| Flow J as sole initial convergence gate | Reject pending hardening |
| Full Option B before release | Reject as excessive |
| Bounded static Option B release floor | Require |
| Browser and judgment-heavy validators | Defer, remain advisory |

## Final recommendation

Revise v5 from **"Option A selected for this release"** to:

> **Capability architecture selected, with a bounded product-validation
> release floor.** Product validators gate and advisory flows coach.
> `lane_converge` is enabled only after Flow J is coverage-aware and the
> initial static theming, anti-pattern, and accessibility validator slices
> produce target-derived findings. Browser-dependent and judgment-heavy
> validation remains advisory until separately proven.

This preserves the strongest part of Option A: a truthful, self-widening
convergence contract. It also captures the practical benefit of Option B:
the initial gate has enough independent validation depth to make
`lane_converge` a meaningful product feature rather than a polished static
lint loop.
