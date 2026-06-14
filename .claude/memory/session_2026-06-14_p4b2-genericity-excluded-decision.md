---
name: P4b-2 scope decision (Jonah) - exclude genericity; browser-back only the 4 well-defined rules
description: Jonah chose to SKIP the genericity rule in P4b-2 (its dom-based meaning was never defined; Codex's DOM-repetition heuristic would be invented product semantics). P4b-2 browser-backs only the 4 well-defined parked rules (2 a11y blockers + 2 polish); genericity stays parked/inconclusive untouched
type: decision
relates_to: [session_2026-06-14_p4b2-kickoff.md, session_2026-06-14_p4b2-playwright-decision.md]
---

The P4a registry parked 5 rules as browser-evidence + inconclusive "until P4b".
P4b-2 builds the collector. 4 of the 5 are well-defined and genuinely fit the
render-URL model; the 5th (genericity) was never actually defined as a DOM check.

Choice made: EXCLUDE polish.anti-pattern-genericity from P4b-2. Browser-back ONLY
the 4 well-defined rules:
- a11y.min-hit-area (dom, BLOCKER) - tap-target size
- a11y.color-contrast (contrast, BLOCKER) - text/background readability
- polish.concentric-radius (computed-style, minor) - consistent corner radii
- polish.typography-rhythm (computed-style, minor) - consistent text spacing
genericity stays EXACTLY as it is in the registry (evidenceRequirements ['dom'],
applicability 'inconclusive', no checkProduct change) - parked/inconclusive,
untouched.

**Alternatives considered:**
- Accept Codex's invented "DOM repetition score" genericity signal (provisional):
  rejected - inventing product-quality semantics nobody defined; genericity is
  MINOR (never blocks) so low value vs the risk of a bad signal.
- Define a real DOM-genericity signal now: rejected by Jonah (defer; needs proper
  product thought, not a quick heuristic).

**Why this one:** delivers P4b-2's high-value checks immediately (the two a11y
BLOCKERS that actually gate clean evaluation, plus the 2 polish rules) without
inventing a quality signal. genericity can be designed properly later when its
meaning is decided. Honest: we do not silently change what a rule measures.

**Revisit when:** someone defines what DOM-based "genericity" should measure
(component variety / token reuse / repeated structures); then it becomes a small
follow-up to add it to the collector + promote it.

**Action:** Codex's P4b-2 plan (all-5, incl the genericity reinvention) is being
revised to the 4-rule scope; genericity tests assert it STAYS inconclusive even
with the collector present (collector does not produce its evidence). Then review,
execute, code-review, merge.

Collaborator: Jonah.
