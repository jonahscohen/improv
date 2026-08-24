---
name: FULLY-GATED PROMOTE PATH built (Phase 1 E) - REPL-confirm arm hook + consent token + tamper-evident ledger + guard fences
description: The safety core of the self-updating taste loop - a promote CLI that moves a mined candidate from the inert quarantine into the GUIDANCE tier only after consuming a single-use consent token the user mints by typing "promote-confirm <id> <store>" in their own REPL (a UserPromptSubmit arm hook, frontier-confirm model); agents are hook-fenced from the token, the ledger secret, AND direct execution of the arm hook; every promotion is recorded in an HMAC hash-chained, head-anchored, content+store-binding promotion ledger. 90/90 test suite green; SIX rounds of Codex cross-model review, 21 findings folded.
type: project
relates_to: [session_2026-08-23_self-updating-taste-pipeline-design.md, session_2026-08-23_learning-researcher-framework-plan.md, session_2026-07-18_fidelity-gate-level2-ledger-built.md, session_2026-08-23_taste-miner-built.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: test-taste-promote.sh 90/90 PASS; integrated `npm run build` (sidecoach) GREEN incl generate-tool-index; skill-surface-parity OK; content-guard 47/0, bash-guard-commit pass, hook-registry 94/0, settings-wire-parity pass, frontier-token-block 7/0, frontier-confirm 17/0; live agent Bash+Write to token AND ledger-secret AND direct arm-hook exec all BLOCKED; Codex 7 rounds (8+4+3+2+2+2 folded, round 7 = only determined-forger arm-exec residuals, lead-ruled stopping point; core clean 5 rounds)
confidence: high
---

Collaborator: Jonah. Built as teammate `gated-promote` (opus-executor); miner owned in parallel by `miner-design`. HEAD cdb530f2.

## What was built (files)
- `sidecoach/bin/sidecoach-taste-promote.js` - the promote CLI. Subcommands: `list`, `show <id> [--store]`,
  `approve <id> [--store]` (non-minting review helper that PRINTS the REPL confirm phrase), `promote <id> --store <s>`
  (consume a token + move + ledger), `check <id> [--store]` (read-only token validity), `verify-ledger`, `audit`.
  Node stdlib only (crypto). It has NO mint path and exports NOTHING.
- `claude/hooks/taste-promote-arm.sh` - NEW UserPromptSubmit hook (the mint boundary, frontier-confirm model).
  Mints the signed consent token ONLY when the user's WHOLE prompt is `promote-confirm <candidateId> <store>`
  (safe id, allowlisted store). An agent cannot submit a user prompt, so cannot trigger it.
- `claude/hooks/cluster-wirings.json` - +1 entry declaring taste-promote-arm.sh as a UserPromptSubmit hook
  (repo source of truth; installer deploys it into settings.json). NOT yet deployed to the live settings.json.
- `claude/hooks/bash-guard.sh` - +2 fences (mirror frontier-confirm): DENY any Bash naming
  `.taste-rule-promote-consent` (token) or `.taste-promotion-ledger-secret` (ledger HMAC key).
- `claude/hooks/content-guard.sh` - +2 fences: DENY any Write/Edit/MultiEdit whose file_path resolves to (or is
  basenamed) the consent token OR the ledger secret.
- `claude/hooks/test-taste-promote.sh` - 50-case suite; repo test-*.sh format; green.
- `sidecoach/data/proposed-rules/` (inert quarantine, README owned by miner) + `sidecoach/data/guidance/{design-laws,craft-corpus,design-judgment-rules}/` (guidance tier, README + dirs).

## Codex round-1 findings (8) - ALL FOLDED
Real Codex, 230s, exit 0. The gate earned its keep - it found holes my same-model build rationalized past.
1. CRITICAL env-override mix (an agent could point guidance at the real store while faking token/secret) ->
   collapsed 6 per-path env overrides into ONE `SIDECOACH_PROMOTE_TEST_ROOT` (all-or-nothing relocation).
2. CRITICAL ledger secret writable via Write/Edit -> added the content-guard secret fence (bash already had it).
3. HIGH pseudo-TTY mint: `[ -t 0 ]` is defeated by `script`, so the CLI-TTY mint WAS agent-reachable, violating
   "no mint path an agent tool call can reach". DESIGN STRENGTHENED to the frontier-confirm model: mint moved to
   the taste-promote-arm.sh UserPromptSubmit hook (user REPL input; agents can't submit prompts). CLI mint removed.
4. HIGH ambiguous MAC (pipe-join, no escaping) -> sign a JSON-array of fixed-order fields.
5. HIGH empty-ledger head under-checked -> verifyLedger now validates the head signature even when empty; a full
   wipe is caught by `audit` (remaining guidance files have no ledger entry - the external-anchor backstop).
6. MEDIUM id under-validated -> isSafeId (no separators/`..`) + require sanitizeId(internalId)===filename id.
7. MEDIUM single-use TOCTOU -> read-only checkToken first (benign mismatch does not consume) + atomic rename
   claim at the commit point + re-validate claimed bytes.
8. MEDIUM ledger-first orphan -> guidance write is temp+atomic-rename; accurate failure message; audit reports
   orphans. The orphan (ledger entry, no guidance file) stays a documented SAFE failure (never an un-blessed rule).
Also flagged (NOT fixed, out of scope): the shipped `.fidelity-secret` has the same content-guard gap #2 has now closed for the promotion secret.

## Codex round-2 findings (4) - ALL FOLDED
Round 2 (real Codex, 232s) found the folds were incomplete. All fixed:
1. CRITICAL: `SIDECOACH_PROMOTE_TEST_ROOT=<repo>/sidecoach/data` made the CLI write the REAL store while
   token/secret sat at UNGUARDED names (`consent-token`/`ledger-secret`). FIX: the token/secret ALWAYS use the
   GUARDED basenames even under a test root, so no directory yields a tool-writable token/secret; pointing the root
   at the real store collapses to the accepted direct-arm residual (no new power).
2. HIGH: the arm hook was declared in cluster-wirings.json but NOT in install.sh's deploy lists or browser-tree.json,
   so it would never deploy. FIX: added to both sidecoach `install_app_hooks` lines + browser-tree.json
   (hook_owner=sidecoach, hook_desc). hook-registry audit now clean.
3. MEDIUM: id binding ignored nested `rule.ruleId`. FIX: validateCandidate binds candidateId, top-level ruleId, AND
   rule.ruleId - all must sanitize to the filename stem.
4. MEDIUM: re-armed same-id replay race (two concurrent promotes could both append). FIX: a mkdir ledger LOCK
   (stale-steal 30s) around {re-check replay, atomic token claim, re-validate, append}, acquired BEFORE the claim so
   contention never consumes a token.

## Codex round-3 findings (3) - ALL FOLDED
Round 3 (real Codex, 207s) found a DEEP critical the first two rounds missed. All fixed:
1. CRITICAL: the ledger signed the candidate ID but NOT the rule CONTENT or STORE, so an agent could edit an
   already-approved guidance/<store>/<id>.json to hold a different rule (keeping ruleId) and both verify-ledger and
   audit passed - a post-promotion content swap. FIX: the ledger entry now signs `store` + `content_digest` (sha256 of
   a recursively key-sorted canonicalization of the candidate, excluding _promotion). `audit` derives the id from the
   FILENAME stem (never an internal id), requires the signed store to equal the directory, requires every id field to
   sanitize to the stem, and recomputes + compares the content digest. Content swap, store move, and id masquerade are
   all now detected (exit 9).
2. HIGH: the arm hook was wired in cluster-wirings.json, but install_app_hooks (the sidecoach install path) reads
   app-wirings.json - so it would never register. FIX: RENAMED the hook to sidecoach-taste-promote-arm.sh (so
   sidecoach-heal.sh self-heals it) and wired it in app-wirings.json + both install.sh sidecoach lists +
   browser-tree.json; removed from cluster-wirings.json.
3. MEDIUM: doPromote checked replay before verifying the ledger, so a forged unsigned row made a legit promote exit
   "replay (11)" not "tampered (8)". FIX: verifyLedger() now runs first.

## Codex round-4 findings (2) - ALL FOLDED
Round 4 (real Codex, 202s) - the last two real gaps, both fixed to go STRONGER than the frontier baseline:
1. CRITICAL: an agent could RUN the arm hook directly (`bash sidecoach-taste-promote-arm.sh` with crafted stdin) -
   the command names neither guarded basename, so bash-guard did not block it. FIX: bash-guard now fences EXECUTION
   of the arm hook (interpreter target OR command position, matched on CMD_CODE so data/mentions pass; read/edit like
   cat/vim/git are allowed). Tested against env-var/`bash -c`/eval/`$()`/relative/sh/source variants - all blocked;
   this makes the mint UNREACHABLE by an agent tool call (stronger than the frontier-confirm residual).
2. HIGH: pre-promotion content TOCTOU - the human confirmed id+store but the candidate content could be swapped
   before promote. FIX: the confirm phrase is now `promote-confirm <id> <store> <digest>` (4 tokens); the CLI
   approve/show prints the content digest for copy-paste; the arm hook binds it (64-hex) into the token; doPromote
   recomputes the candidate digest at promote time and REFUSES if it differs from the approved digest. A content swap
   between approval and promote is caught (exit 5). The digest is computed + re-checked by the ONE CLI impl (the arm
   hook only carries the string), so there is no cross-language canonicalization to keep in sync.

## Codex rounds 5-6 findings - ALL FOLDED (arm-exec fence hardened to fail-closed)
The round-4 arm-exec fence was a regex; rounds 5-6 proved a regex is an endless arms race.
- Round 5 (Critical): bypassable via `/bin/bash`, `$PWD/`, `~/`, `command`, `env -S`, `PATH=x name` - all
  natural (lazy) invocations. Round 6 (Critical): also `{ bash <arm>; }`, `if bash <arm>`, `eval bash`,
  `builtin . <arm>`, `source <(cat <arm>)`, `find -exec bash`, `xargs`-via-stdin.
- FIX (both rounds' verdict converged on this): replaced the regex with a fail-closed ALLOWLIST tokenizer in
  bash-guard. For any CMD_CODE segment naming the hook, it strips grouping/negation + env-assignment + runner
  prefixes (command/exec/nohup/time/timeout/sudo/xargs/env/watch/... incl. their option+duration args) and
  ALLOWS only when the resulting command basename is a known read/inspect/edit/VCS verb (cat/less/vim/git/chmod/
  cp/rm/grep/sha256sum/...); everything else BLOCKS. It does NOT split bare parens (so process-sub and grouping
  cannot separate the executor from the hook). Tested against ~30 exec forms (all block) + the safe verbs (all
  allow). This makes the mint unreachable by any NATURAL agent tool call - far stronger than the frontier-confirm
  baseline (which has NO arm-exec fence). Residual: a determined obfuscating forger (out of the stated threat
  model) + a Low over-block of `bash -n <arm>` / `find -name <arm>` (use the Read/Glob tools instead).
- Also fixed the Low doc-drift: arm hook header, CLI header, browser-tree hook_desc, generate-tool-index all now
  state the 4-token `promote-confirm <id> <store> <digest>` phrase.

## Codex round 7 - STOPPING POINT (lead-ruled): only determined-forger arm-exec residuals remain
Round 7 (real Codex, 278s) found NO new core critical - the ledger/token/binding/inertness/guard-fence core has
been clean for 5 straight rounds. It found only more arm-exec forms, and ALL are determined-obfuscating-forger
techniques (out of the stated threat model), not lazy self-opt-outs:
- copy/link the hook to a new basename then run the copy (`cp arm.sh /tmp/x; bash /tmp/x`) - a FUNDAMENTAL limit
  of ANY name-based fence (cat>, python, etc. can also duplicate the bytes); uncloseable without a non-spoofable
  harness signal, which does not exist (Codex confirmed). Frontier-confirm does not defend this either.
- `env -S 'bash arm.sh'` and `python3 -c '...subprocess.run([...])'` - exploit CMD_CODE quote-stripping / a fresh
  interpreter; the same residual any same-uid code-exec forger has.
- `git -c alias.X='!bash arm.sh' X`, `vim -c '!...'` - VCS/editor command-exec options; deliberate injection.
Fixed the 2 remaining Low doc-drift items (CLI no-token message + a test label). Did NOT chase the exec forms past
the fail-closed allowlist (lead ruling: diminishing returns below the already-cleared bar; frontier-confirm has NO
arm-exec fence and its direct-invocation residual was called acceptable, so this unit is far stronger than baseline).
ACCEPTED RESIDUAL (documented, in threat model): a determined forger with same-uid code execution can duplicate the
arm hook bytes or spawn an interpreter that reads the machine-local secret and mints a token. This is the same
fundamental limit frontier-confirm has, explicitly out of scope ("a lazy self-opt-out, not a determined forger").
The core promise holds for the stated threat model; the GUIDANCE tier is advisory (not build-blocking), and every
promotion is recorded in the tamper-evident ledger regardless.

## Integration (lead's two hard gates, both green)
- generate-tool-index DESCRIPTIONS: added a `sidecoach-taste-promote` row in scripts/generate-tool-index.ts (kept OUT
  of STANDALONE_BINS / the "seven CLIs"). The integrated `npm run build` in sidecoach/ is GREEN (generate-tool-index +
  --check pass); skill-surface-parity OK (still 7 bins). The arm hook lives in claude/hooks (not sidecoach/bin) so it
  needs no DESCRIPTIONS row.
- Hook registry: sidecoach-taste-promote-arm.sh registered in browser-tree.json + app-wirings.json + install.sh;
  test-hook-registry 94/0.
- Component browser (both-directions install<->tree agreement): the arm hook also had to go in sidecoach's `hooks`
  TOGGLE node (browser-tree.json buckets[2]/members[1], key "Hooks"), not just hook_owner/hook_desc - otherwise
  install deploys a hook the settings browser gives no per-hook toggle. Added it there + updated the one test that
  hardcodes the expected sidecoach hook-children list. test-component-browser.sh 147/0 (was 146/1).

## The three fail-closed layers (the whole point)
1. STRUCTURAL - nothing under `sidecoach/src` imports `data/proposed-rules`, `data/guidance`, or the ledger; an
   un-promoted proposal is physically unreachable by the enforcer. Asserted by the suite (grep = empty).
2. HARNESS - promotion consumes a single-use consent token minted ONLY by the user typing
   `promote-confirm <candidateId> <store> <digest>` in their OWN REPL (the sidecoach-taste-promote-arm.sh
   UserPromptSubmit hook). An agent cannot submit a user prompt, so cannot trigger the arm; the CLI has NO mint path
   and exports NOTHING; bash-guard + content-guard fence the token AND ledger-secret paths from every agent Write/Edit/
   Bash; AND bash-guard fences direct EXECUTION of the arm hook, so `bash arm.sh` cannot mint either - the mint is
   unreachable by ANY agent tool call (stronger than the frontier-confirm baseline). The `<digest>` binds the approval
   to the reviewed CONTENT: doPromote refuses if the candidate changed since the human confirmed. Proven live: my
   (agent) Bash+Write to the token, to the ledger secret, AND a direct `bash arm.sh` exec were ALL BLOCKED.
3. BUILD - a candidate is validated before it lands (required id, resolvable target store, rule body, provenance.source);
   the miner's `preflight.ok === false` makes a candidate INELIGIBLE (exit 4). A malformed candidate never moves.

## Tamper-evident promotion ledger (mirrors the Figma fidelity ledger, 2026-07-18)
`sidecoach/data/promotion-ledger.jsonl` (append-only) + `promotion-ledger.head` (signed anchor). Per entry:
`candidateId|source|commit|retrieved_utc|approvedBy|approved_utc|token_mac|prev_mac` -> mac = HMAC(secret, that string),
prev_mac chains (GENESIS first). Head = `count|tip|HMAC(secret,"count|tip")` - commits to count so TAIL truncation is
caught (the per-line HMAC alone cannot see a deleted last line - the exact fidelity-build lesson). A consistency guard
refuses to append onto a base that does not match its own head (no head-laundering). `verify-ledger` and `audit`
recompute the chain + head; `audit` also flags any promoted guidance rule with no ledger entry (un-blessed rule).
Ledger signable string is a fixed pipe-joined field order (no JSON key-order ambiguity). `token_mac` is recorded so a
promotion is bound to its authorizing token; a replayed token or an already-promoted candidate is refused (exit 11).

## Exit-code contract (fail-loud, distinct per class)
0 ok, 2 usage, 3 no candidate, 4 bad candidate/pre-flight-fail, 5 no valid token, 6 no TTY, 7 bad typed confirm,
8 ledger tampered, 9 audit discrepancy, 10 IO, 11 replay.

## Contract reconciliation with the miner (load-bearing)
The miner (`sidecoach-mine.js`) emits `<sanitizeId(ruleId)>.json` = `{candidateVersion, ruleId, title, disposition, rank,
rule:{ProductRuleDefinition}, provenance:{source,commit,retrieved_utc,minedBy,...}, preflight:{ok,errors}}`. NO
`targetStore`. Decision: routing a candidate into WHICH guidance store is a HUMAN REVIEW judgment, not a mining output,
so the store comes from a `--store` flag at approve time (an optional top-level `targetStore` hint is honored as the
default). Reader accepts id from `ruleId` OR `candidateId`, rule body from `obj.rule` OR flat top-level fields, and
honors `preflight.ok`. Confirmed with miner-design; no change required on their side.
Why: the miner cannot know a taste call's home store; the reviewer decides. How: `resolveStore(obj, --store)`.

## Verification (real output)
- `test-taste-promote.sh`: 90 passed, 0 failed (covers: agent token+secret writes BLOCKED (incl. test-root guarded
  basenames); direct arm-hook EXECUTION blocked in ~30 forms (bash, /bin/bash, sh, env -S, command, timeout, watch,
  sudo, nohup, xargs, $PWD/, ~/, PATH=name, ./, source, . , builtin ., brace-group, if, subshell, eval, process-sub
  source <(cat), find -exec), while cat/vim/git/chmod/cp/rm/grep/sha256sum/sudo-cat/( cat ) are allowed; arm mints
  ONLY on the exact 4-token confirm with a 64-hex digest (not 3-token/non-hex/substring/bad-store/unsafe-id); approve
  does not mint; content-swap-after-approve REFUSED (5); promote w/o token (5); wrong-store token refused (5) + not
  consumed; promote w/ sanctioned token -> move + ledger + chain verify + single-use consume + replay (11);
  field-tamper + tail-truncation + forged-head + separator-redistribution detected (8); content swap / store move /
  masquerade detected by audit (9); un-blessed rule (9); pre-flight-fail (4); id-mismatch top-level AND nested
  rule.ruleId (4); traversal id (2); module exports nothing; structural no-import; frontier fence regression).
- Regressions green: content-guard 47/0, bash-guard-commit 156/0, hook-registry 94/0, settings-wire-parity pass,
  frontier-token-block 7/0, frontier-confirm 17/0. install.sh + cluster-wirings.json + browser-tree.json all valid.
- LIVE agent-block proofs (real harness): my Bash `echo > ~/.claude/.taste-rule-promote-consent` was BLOCKED; my Write
  to that token path was BLOCKED; my Write to `~/.claude/.taste-promotion-ledger-secret` was BLOCKED.
- Manual end-to-end: approve helper prints the phrase -> arm hook mints on `promote-confirm mined.demo craft-corpus`
  -> promote consumes -> guidance file lands + ledger verifies + audit clean + token gone.
- Cross-model review: real Codex via `codex-review.py` (deterministic wrapper; the codex-rescue agent is hook-blocked
  for REVIEW intent - it can silently downgrade). Round 1: 8 findings, all folded (above). Round 2: [UPDATE ON DONE].

## Known limitation (documented, not a gap)
The ledger secret is machine-local (`~/.claude/.taste-promotion-ledger-secret`, 0600, O_EXCL), same model as the
fidelity ledger. A ledger committed and pulled to a different machine cannot be cryptographically verified there
(different secret) - verify/audit fail CLOSED (report "can't verify"), which is correct for a safety gate. Cross-machine
verifiable promotion would need a shared/committed key scheme - out of Phase 1 scope.

## Deployment note (for the lead / installer)
The arm hook is fully wired in the repo source (app-wirings.json + both sidecoach install_app_hooks lines +
browser-tree.json), so `bash install.sh --only sidecoach` (or a full install) deploys it into the live
~/.claude/settings.json UserPromptSubmit and sidecoach-heal.sh keeps it wired each session. I did NOT run the
installer against the live machine (I don't mutate live machine config unilaterally). Until an install runs, the arm
cannot fire, so the path is SAFE by default (nothing can mint -> nothing promotes), just not yet usable for real
approvals on this machine. Run the sidecoach install to make the human approval path live.

## Files touched
- NEW sidecoach/bin/sidecoach-taste-promote.js
- NEW claude/hooks/sidecoach-taste-promote-arm.sh (UserPromptSubmit mint hook; sidecoach-* so it self-heals)
- NEW claude/hooks/test-taste-promote.sh (59 cases)
- NEW sidecoach/data/guidance/README.md + guidance/{design-laws,craft-corpus,design-judgment-rules}/ (dirs)
- EDIT claude/hooks/bash-guard.sh (+2 fence blocks: token + ledger secret)
- EDIT claude/hooks/content-guard.sh (+2 fence blocks: token + ledger secret)
- EDIT claude/hooks/app-wirings.json (+1 UserPromptSubmit wiring for the arm hook - the table install_app_hooks reads)
- EDIT claude/hooks/browser-tree.json (hook_owner + hook_desc for the arm hook)
- EDIT install.sh (arm hook added to both sidecoach install_app_hooks lists)
- EDIT sidecoach/scripts/generate-tool-index.ts (+1 DESCRIPTIONS row for sidecoach-taste-promote)
