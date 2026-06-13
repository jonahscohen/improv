---
name: Codex GPT-5.4 cross-model review of lane spec v7
description: Seventh review, first from a different model family; 4 P0 / 5 P1 / 2 P2, all grounded in source; verdict NOT-READY; trajectory read = architecture stable since v3, findings now specification-level
type: decision
relates_to: [session_2026-06-13_lane-design-v7-first-class-validators.md]
---

Ran Codex (GPT-5.4) as a seventh, cross-model adversarial reviewer of spec v7
(read-only `task` via codex-companion, job task-mqbyt31x-kiwn6h, ~7.5 min).
Verdict: NOT-READY. It verified the six prior Claude diagnoses against source
(J/M/K/I/L ownership, prereq deps, false-convergence, global history default,
package.json single-test gate - all confirmed accurate), then found issues the
Claude rounds missed - several of them inconsistencies v7 ITSELF introduced.

**P0s (all assessed real; several provable from v7's own text):**
1. Release-floor rule ownership mutually inconsistent. Flow J's selection rule
   ("all statically-determinable polish rules") grabs transition:all,
   focus-visible, reduced-motion - the SAME checks v7 assigns to the
   anti-pattern and static-a11y slices. Single-owner check only catches
   identical string IDs; the same semantic rule appears under different IDs in
   polish-standard vs extended-domain, so aliases evade the check and
   double-count. Provable from v7 section 9 text alone. Fix: canonical rule/
   alias inventory + explicit ownership partition + Flow J selection EXCLUDES
   delegated rules + semantic-alias rejection in --check.
2. Clean-policy evaluator non-deterministic. ProductFinding referenced
   (spec:352) but never defined; ProductRuleResult has no severity/class;
   cleanPolicy needs blockingSeverities + toleratedFindingCountsByClass; the
   two severity domains (critical|high|medium|low vs P0|P1|P2) are never
   unified. Fix: define ProductFinding (validatorId, ruleId, class, severity,
   location, fingerprint) + the exact ordered rule-results -> coverage ->
   tolerance -> status algorithm + unify severities.
3. Binary source-support types can't represent the "partial" matrix. v7's
   supportedSourceKinds[]/unsupportedSourceKinds[] is binary; the matrix marks
   HTML/JSX/TSX "partial"; coverage minima are inconsistent (theming "all
   CSS/SCSS" but LESS is full; a11y "HTML/JSX" but TSX partial). Fix:
   per-source-kind, per-rule support declarations + mixed-file (CSS-in-JS in
   TSX) discovery rules.
4. NEW DEPTH FINDING (the class the Claude rounds never reached): the lock/CAS
   cannot guarantee once-only execution under async. Flow execution is async;
   MCP races handlers against a timeout with Promise.race and timed-out
   handlers keep running; no AbortSignal reaches handlers. Holding the lock
   across async validation lets a live lock look stale (age-based takeover);
   releasing before validation allows duplicate execution; a timed-out caller
   retries while the original advance continues. Fix: operation-ID/lease
   protocol (claim under CAS, persist in-flight ownership, idempotent execute,
   finalize under CAS) + AbortSignal propagation + heartbeat/liveness +
   timeout/retry/crash-mid-advance tests.

**P1s:** (5) loop transition table incomplete - StepReport lacks
stepId/iteration/reportId, convergence stalled|capped|error vs lane
completed|partial|failed unmapped. (6) scope can override explicit verbs -
decision-flow step 7 CONTEXT-CHECK fires before explicit verb at step 10,
contradicting the zero-verb-override target; need verb precedence + composite
diagnostic. (7) the "three gates" omit execution-time project-state failures
(flowA canExecute:true unconditionally then errors without PRODUCT.md - a 4th
gate); the promised per-lane no-PRODUCT/no-DESIGN matrix is described, not
supplied. (8) required-validator membership is both explicit (lane policy IDs)
and automatic (promotion widens gate) - contradiction; define the exact gate
formula. (9) validator target scope undefined - startLane takes free-form
target but Flow J scans whole project; a one-button lane could be blocked by
unrelated findings.

**P2s:** (10) project-identity canonicalization (realpath for history keys/
checkpoint roots/--project). (11) invalid-regex has two conflicting policies
(disable whole lane tier vs per-pattern isolation).

**Trajectory read (the meta-finding):** architecture has been STABLE since v3
(model-driven state machine); every review since has refined contracts. v7->
v8 findings are SPECIFICATION-level (undefined types, ownership overlap,
async-lease), not architecture-level. Critically, 3 of 4 P0s (#1, #2, #3) live
in the convergence-FLOOR, which the spec already stages LAST; only the
async-lease P0 (#4) touches the early classifier + sequence-lane work. So the
open P0s do NOT block starting implementation of the classifier and five
sequence lanes - and TDD against real code would pin ProductFinding's shape,
the rule-ownership partition, and the lease protocol far more precisely than
another paper round. The Codex review gate (enabled this session) now guards
implementation. Signal of diminishing returns on pure spec review: the spec is
generating new under-specs about as fast as it adds detail.

Decision surfaced to Jonah: fold v8, then either (a) 8th review round or
(b) move to implementation (recommended) - classifier + sequence lanes first,
resolving the async-lease contract via a concurrency test during the
state-machine build, floor-area P0s resolved when that stage is reached.

Job/runtime: codex-companion task, read-only, job task-mqbyt31x-kiwn6h,
rawOutput 11296 chars. Codex CLI 0.130.0, ChatGPT auth.
