---
name: Phase 3 design - mined GUIDANCE rule to build-BLOCKING enforced detector (data-driven interpreter, precision-gated, second consent gate)
description: Blueprint for turning a learned taste rule into a build-blocking detector via a DATA-DRIVEN interpreter (NOT codegen), a held-out precision gate (P>=0.90 + min denominator), and a SECOND human-signed gate + separate HMAC ledger distinct from promote
type: decision
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: read-only design pass (phase3-design agent, file:line at HEAD a4ef8d06); build plan has per-step runnable verifies
relates_to: [session_2026-08-24_phase1-2-review-outcome.md, session_2026-08-23_gated-promote-path-built.md, session_2026-08-23_self-updating-taste-pipeline-design.md]
---

Choice made: Phase 3 turns a mined rule into a build-blocking detector via a DATA-DRIVEN INTERPRETER over a declarative pattern spec (static css/markup lane) + REUSE of the existing scanner + A5a path (rendered lane). NO codegen. Blocking is reached only via a held-out precision gate AND a second human-typed consent, distinct from the guidance-promote gate.

**Alternatives considered (the central fork):**
- (a) Codegen a checkProduct fn from the spec: REJECTED - executing model/expert-authored code the enforcer imports is the exact "untrusted data becomes live instructions" hazard the whole pipeline forbids, and it destroys structural inertness (generated code in src/ is reachable).
- (c) Hybrid codegen: rejected for the same execution hazard.

**Why the interpreter:** it executes NO authored code - it compiles regex DATA (new RegExp(source,flags)) and selects numeric predicates from a FIXED, code-reviewed allowlist keyed by predicateId; the candidate supplies DATA, never a predicate body; unknown engine/predicate => inconclusive (fail-closed, same contract as missingCheck at product-rule-registry.ts:858). Covers the population the miner actually produces net-new (static tells). Geometry/computed-style taste is NOT expressible statically and the miner must NOT propose net-new rendered detectors; that lane's backlog is the ~14 already-built audit-only rendered rules (RENDERED_RULE_MANIFEST, ruleId:null) whose only missing piece is the A5a precision gate - promoting one = adding it to RENDERED_BACKED_RULE_IDS (validator-generation.ts:35).

**Enforcement runtime (mapped):** CHECKS[canonicalRuleKey] ?? missingCheck (product-rule-registry.ts:858); missingCheck => inconclusive, never a false pass. BLOCKING = severity in ['blocker','major'] (validator-generation.ts:16) with toleratedFindingCounts=0. A mined rule blocks iff it has a runnable detector wired into CHECKS AND severity major/blocker.

**Schema extension:** two OPTIONAL fields on ProductRuleDefinition (optional => existing rules + validateRegistry unaffected): patternSpec {specVersion, engine:'static-css-regex', applicability{anyOf:regex[],scope}, defect{anyOf:{pattern,flags}[], numericGuard?{predicateId(allowlisted),threshold}}, message, remediation, evidenceScope} and exampleCorpus {positives[],negatives[]} where each ExampleRef mirrors eval/corpus-tool.mjs canonicalRecord (id,file,contentSha256,label:'fires'|'clean',labeledBy,split:'tune'|'heldout',provenance). Captured in the /sidecoach mine SKILL flow; labeler INDEPENDENT of author (Codex-only, author!=labeler - the A5a freeze rule). Miner preflight compiles every regex under a ReDoS budget, rejects any predicateId not in the allowlist, freezes the corpus; malformed => FILED with errors, never dropped.

**Held-out precision gate:** candidate's exampleCorpus SPLIT tune/heldout PLUS the shared eval negative pool (not synthetic-only - the taste-precision lesson: default-typeface scored an unfalsifiable P=1.000 on synthetic positives; nested-cards couldn't validate on a 4-fire held-out). Import the FROZEN spec, run interpreter over held-out + shared negatives ONCE, precision=TP/(TP+FP). Threshold P_heldout>=0.90 AND a minimum denominator floor (>=~8 positives / >=~8 held-out fires); under-floor => REFUSE (cannot validate), not pass. Build-stamped cache, exit non-zero on stale (taste-precision-sweep.mjs discipline).

**Second human-signed gate (distinct from promote; do NOT overload the promotion ledger):** new CLI sidecoach-taste-enforce (byte-parallel to sidecoach-taste-promote.js) that (1) requires the rule already guidance-promoted; (2) re-measures held-out precision FRESH, refuses if under threshold/denominator (new exit code); (3) consumes a SECOND single-use token minted ONLY by a NEW arm hook on the user typing `enforce-confirm <ruleId> <precision-digest>` (digest binds sign-off to the measured precision report; agent cannot submit a user prompt); (4) appends to a SEPARATE data/enforcement-ledger.jsonl with its OWN HMAC hash-chain + signed head anchor; (5) only then flips the rule to blocking + runs npm run build (hard-fails). Two-key: promote token (content digest) + enforce token (precision digest) = distinct tokens/arm-hooks/ledgers.

**Safety:** runtime invariant test - every mined-taste rule with a blocking severity MUST have an enforcement-ledger entry + a passing precision record, else build/CI fails loud. Interpreter fail-closed (unknown engine/predicate => inconclusive). ReDoS: the interpreter runs in the taste-gate on EVERY .html/.css write, so a catastrophic-backtracking spec would hang the gate - miner preflight MUST reject unbounded patterns and the interpreter MUST bound execution (length cap + step/time budget, or re2). Blocking ships OFF-BY-DEFAULT behind a per-project opt-in even after enforce.

**Build plan (each step has a runnable verify; steps 1-4 = runnable detector, stays advisory; 5-7 = the second gate that crosses to blocking; 8 = Codex review):**
0. baseline `npm test` exit 0 (record suite count).
1. PatternSpec type + static-css-regex INTERPRETER as a CheckFn (fixed predicate allowlist, ReDoS-bounded) -> unit suite: fires on positive, clean on negative, inconclusive on unknown engine, catastrophic-backtrack rejected under timeout.
2. add OPTIONAL patternSpec + exampleCorpus to ProductRuleDefinition -> npm run build exit 0, every existing rule still validates.
3. wire interpreter into CHECKS lookup (a RULES entry with patternSpec + no hand CHECKS entry -> interpreterFor(def); neither -> missingCheck) -> seeded spec'd rule FIRES via run-validator; spec-less+check-less still inconclusive (no false pass).
4. miner emits patternSpec + captured labeled corpus per candidate; preflight compiles/allowlists/freezes -> quarantine JSON has valid spec+frozen corpus; bad-regex/bad-predicate FILED with errors.
5. precision harness eval/taste-enforce-precision.mjs (frozen interpreter over held-out + shared negatives, build-stamped, denominator-floor refusal) -> exit 0 on seeded corpus; non-zero on stale cache AND under-floor denominator.
6. sidecoach-taste-enforce CLI + enforce-confirm arm hook + enforcement-ledger.jsonl (own HMAC chain) -> refused w/o token (exit 5), refused on P<threshold, succeeds only with a valid precision-digest-bound token; ledger verify detects tamper/truncation/forged-head.
7. runtime invariant test - blocking mined-taste rule w/o ledger+precision => fail loud (RED on mutation, GREEN otherwise).
8. Codex cross-model review of the whole unit; fold every finding; re-verify.

**Biggest risk (called out):** the CORPUS honesty, not the interpreter. Synthetic-positive-only => unfalsifiable P=1.000; tiny held-out denominator validates nothing. The labeling harness + minimum-denominator REFUSAL is step 1's real content, ahead of detector wiring.

**Revisit when:** the miner needs net-new RENDERED (geometry/computed-style) detectors (interpreter can't express them - that needs scanner code + Codex labels, the A5a lane); or if a non-regex static engine is needed (add a new engine kind, keep fail-closed on unknown).
