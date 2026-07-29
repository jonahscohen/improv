---
name: Scoreboard handoff - state, outstanding work, and what to review
description: Tally as last derived, the two rows awaiting OUT OF SCOPE reclassification, the two rows the lead patched, and what is built vs still owed
type: project
relates_to: [session_2026-07-29_scoreboard-harness.md, session_2026-07-29_scoreboard-decay-and-gating.md, decision_scorekeeper_rejected_claims.md, session_2026-07-29_scorekeeper-instrument-failures.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: partial - see the explicit not-verified notes below
confidence: medium
---

Handoff written at team pause. Deliberately not re-verified, per the shutdown instruction. Read the not-verified flags before trusting any number here.

## (a) Tally

**WIN 12 / LOSS 12 / TIE 1 / UNMEASURED 5, 30 rows.** Live in `sidecoach/benchmark/SCOREBOARD.md`.

**IMPORTANT CAVEAT.** That tally is from the last run that COMPLETED. A later edit batch (anti-spoof gate on the fail-closed rows, per-tool timing exit codes, surface-wide sweeps, the mutation row moving to UNMEASURED, the drift reporter) went in afterwards and its regeneration **was KILLED at the team pause, confirmed, not merely unfinished** - the machine was at load 27 from concurrent agents. `benchmark/derivations.tsv` was never created, which is the fastest way to confirm this from disk: if that file is absent, no run has completed since the drift reporter landed.

**So the document does not currently reflect the harness.** First action for the next session: `bash benchmark/run-scoreboard.sh` and expect the tally to move. Do not quote the current numbers as derived from the current script. Run it on an unloaded machine; at load 27 the roughly 26 node invocations did not finish inside 10 minutes, and that is contention, not a hang (syntax checks clean and the reachability probe alone is 54ms).

## (b) NOT yet reclassified as OUT OF SCOPE

Jonah descoped cross-harness reach on 2026-07-29. The fourth verdict was **never implemented**. `row()` still recognises only WIN / LOSS / TIE / UNMEASURED, so these two are still scored LOSS and still drag the tally:

1. **Agent-harness install targets** - 14 against our 1.
2. **Distribution channels beyond the skill dir** - their plugin, CLI, browser extension and cloud functions against our 0.

No other row qualifies. I checked: "Loadable docs on the installed skill surface" and "Per-capability playbooks" are depth INSIDE Claude and stay LOSS - they are winnable and must not be filed out of scope.

Implementation notes for whoever builds it:
- Add `OUT_OF_SCOPE` as a fifth counter in `row()` and a separate line in the Tally table. Do not fold it into UNMEASURED; they mean different things.
- Keep the measurement command and the harness-detection code intact. The competitor's reach is a real fact and should stay measurable if the position ever reverses.
- Put this rule at the top of the document verbatim: **a row moves out of scope ONLY on an explicit recorded decision by Jonah, never because it is hard to win and never on a teammate's judgement.** The bucket is the obvious hiding place for a losing row, so the guard against that has to be visible in the artifact, not just in a beat.

On the lead's guess about the largest remaining gap: **probably right but NOT verified.** With the two distribution rows out, the biggest surviving LOSSes are loadable documents (11 against 39) and per-capability playbooks (9 installed against 32). Both are depth inside Claude. Re-derive before stating it, because the surface grew twice during the session and may have grown again.

## (c) Two rows the lead patched, already reviewed

The lead patched the image-generation and detector discoverability rows to enumerate the surface with `find -L` and hand the list to plain `grep -l`, and changed the detector row to count FILES rather than mentions.

**Both edits are correct. Do not revert.** I validated the helper against numbers I had measured independently:

    surface_files_naming sidecoach-detect  -> 3   (matches my independent 3)
    surface_files_naming sidecoach-image   -> 4   (matches my independent 4)
    surface_files_naming sidecoach-zzz     -> 0   (negative control clean)

The files-not-mentions change fixed a genuine unit mismatch I had introduced: our side was counting mentions against their side counting files. The `find -L` plus `grep -l` shape also correctly avoids the `-r` symlink defect (the installed skill files are symlinks into the repo and BSD `grep -r` does not follow a symlink given as an argument, only `-R` does).

Still outstanding from the same instruction: **"Shipped tools NAMED in the loadable surface" (reads 9 of 17) has the identical hardcoded-scope bug.** I changed it to sweep `SURFACE_DIR` but its number was never re-derived. Re-derive it with the same method rather than adjusting it by hand.

## (d) Derivation stamps and fail-loud - BUILT, contrary to the request's assumption

These were built, not skipped. Correcting the record so nobody rebuilds them:

- **Per-row derivation stamp.** `row()` appends a sixth column carrying the commit each row was DERIVED at, separate from the document-level generation commit.
- **Loud fail on disagreement.** The harness writes `benchmark/derivations.tsv`, compares every new verdict against the previous run's, prints `VERDICT DRIFT since the previous run` naming each changed row, and **exits 10** so a change cannot pass unnoticed in a script or CI step.

**Verification status: unit-verified in isolation, never observed on a full harness run.** I proved the mechanism with a three-run fixture: baseline WIN gives no drift and exit 0; identical rerun gives no drift and exit 0; verdict flipped to LOSS prints `Linked stylesheet: WIN -> LOSS` and exits 10. What has NOT happened is a real end-to-end run emitting a stamped document, because that run was still in flight at pause. Expect the first real run to report drift on many rows at once, since `derivations.tsv` does not exist yet and the first run establishes the baseline.

## Standing rules the next scorekeeper inherits

1. Default posture is LOSS. A row flips to WIN only when the command produces the number.
2. UNMEASURED never rounds up, and is tallied separately.
3. Absence on the competitor's side is UNMEASURED, never a win. `crow()` enforces this; with the competitor tree absent the whole board correctly yields WIN 0 / UNMEASURED 29.
4. Before believing any zero, plant a known positive and confirm the instrument fires. Nine instrument failures were caught this way; every one of them would have shipped a wrong number.
5. A claim is scored only when a command reproduces it against BOTH trees. Relayed figures may appear for context but never carry a verdict.
6. Do not project one tool's exit-code semantics onto another's. Theirs exits 2 when it HAS findings; ours exits 2 on usage/IO error.
7. The tally going DOWN is correct behaviour when evidence says so. It moved 13 to 12 because a WIN row was honestly flipped after its evidence stopped reproducing. A board that only goes up is not measuring anything.
