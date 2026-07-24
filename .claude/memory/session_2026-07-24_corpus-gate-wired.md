---
name: corpus freeze gate - audited re-lock, fail-closed verify, wired into npm test
description: Re-froze the 90-page corpus with a recorded reason, closed the vacuous-green and brief-metadata holes, and put verify-candidates + corpus-tool.test.mjs behind npm test (73 -> 75 suites)
type: project
relates_to: [session_2026-07-24_corpus-freeze-drift.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + codex-review
confidence: high
---

# Corpus freeze gate: re-locked, hardened, and actually enforced

Follow-on to [[session_2026-07-24_corpus-freeze-drift]] (root cause: a post-freeze motion re-label
that was never re-frozen). Three parts.

## 1. Audited re-freeze (the drift was legitimate, so it was re-locked - with its reason)

`freeze-candidates --reason "<why>"` re-locked all 90 pages + 23 briefs. `candidates.json` came out
BYTE-IDENTICAL; only `lock-candidates.json` moved. The lock now carries `reason` (the full motion-GT
story incl. the recovered pre-freeze blob id) and `supersedes: {frozenAt: 2026-06-24T01:50:02.844Z,
changes: 90}`. Both are lock-level metadata, deliberately NOT in any record hash.

**Why:** a freeze that can be silently re-run over drifted data is a rubber stamp, and that is exactly
how the June re-label erased its own evidence for a month. So re-locking a DRIFTED corpus now REQUIRES
`--reason`, and creating a lock for a non-empty corpus with no prior lock requires `--reason` or an
explicit `--initial` - otherwise `rm lock-candidates.json` laundered any drift into an unaudited
"first freeze".

## 2. verify-candidates fails closed

It used to return `ok:true` on an ABSENT or EMPTY corpus: every read falls back to an empty value, so
the loops ran zero times and collected zero errors - a gate that passes loudest when there is nothing
left to check. Now errors on: absent/empty candidates.json, absent/empty lock, page/brief COUNT drift
vs the lock, and pages/briefs present-but-not-in-lock (forward bijection).

**Still true and worth knowing:** the sibling `corpus-tool.mjs verify` (manifest corpus) reports
`VERIFY OK` on counts all-zero. That corpus is intentionally empty (tooling-only path), which is why
`verify` is deliberately NOT wired into npm test - it would bank a permanent pass that asserts nothing.

## 3. Wired into npm test (73 -> 75 suites)

`scripts/run-tests.ts` now runs `eval/corpus-tool.test.mjs` (logic, temp dirs) then
`eval/corpus-tool.mjs verify-candidates` (the real committed artifact). Logic first, so a broken gate
reports as a broken gate rather than as a corrupt corpus. Both cheap (~1s, no browser) and reproducible:
all 90 corpus HTML files and 25 briefs are git-tracked.
The suite entry PINS `SIDECOACH_CORPUS_DIR` via a new `Suite.env` field - see finding 1 below.

## Codex review (codex-cli 0.142.5, via the deterministic wrapper) - 4 findings, all folded

1. **High, env leak.** `SIDECOACH_CORPUS_DIR=/tmp/decoy npm test` would have pointed the gate at a
   decoy and passed green over a corrupt real corpus. Fixed by pinning the var on that suite.
   Proven: with the decoy var set AND the real corpus tampered, the runner still read 90 pages and failed.
2. **High, briefs half-verified.** `freezeCandidates` locked a `recordHash` over brief
   kind/authoredBy/file/provenance, but `verifyCandidates` re-checked only `contentSha256`. Flipping
   `codexAuthored -> architectAuthored`, or re-pointing a brief at a byte-identical decoy file, verified
   clean. Fixed by factoring `canonicalBriefRecord()` used by BOTH sides (field order is load-bearing -
   the existing lock still verifies).
3. **High, duplicate ids.** Duplicate page/brief ids collapse in the id-keyed lock map, leaving an entry
   present but unlocked AND invisible to forward bijection (its id exists). Now rejected at freeze and verify.
4. **Medium, bootstrap bypass.** Covered by the `--initial` gate above.

Codex explicitly cleared: `--reason` arg-parsing edge cases, test tautology, and the judgment to
re-freeze rather than treat the drift as tampering.

## Verification (real output, not "should work")

- `corpus-tool.test.mjs`: 28/28 ALL PASS (was 11; the candidates path had ZERO coverage before).
- `npm test`: **75 suite(s) passed**.
- Negative proof the gate BLOCKS: flipping ONE `present` boolean on one page -> `run-tests: 1 suite(s)
  failed`, naming `ed_govuk_live`. Restored, green again.
- Negative proof of the env pin: clean decoy corpus + tampered real corpus -> runner still failed.

## Self-analysis: why the first fix attempt was incomplete

The forensic search started from a wrong hypothesis (that the motion labels were ADDED after the freeze,
inferred from `labeledUtc` alone) and a 1296-variant structural brute force found nothing, because the
real change was a REPLACEMENT of existing labels. The signal that broke it open was not more theorizing
about the current file - it was recovering the actual prior state from unreferenced git blobs. Lesson
matching the Debugging Protocol: when a hash disagrees, stop reconstructing what the old input might
have been and go find it. `git cat-file --batch-all-objects` survives a squash.

Second miss, caught only by Codex: hardening `verifyCandidates` for pages while leaving the brief branch
checking one field. The mental model was "the drift was in pages," so the brief path never got the same
scrutiny. Applying a fix only where the observed failure landed leaves the same class of hole one branch over.

## Files touched
- eval/corpus-tool.mjs (audited re-freeze + `--initial`, fail-closed verify, canonicalBriefRecord, dup-id rejection, lockDrift counts)
- eval/corpus-tool.test.mjs (cases 12-28: candidates path, vacuous-green, audit gate, brief records, dup ids, env assumption)
- scripts/run-tests.ts (`Suite.env`, env plumbed into both exec paths, two new suites)
- eval/corpus/lock-candidates.json (re-frozen; candidates.json unchanged)
