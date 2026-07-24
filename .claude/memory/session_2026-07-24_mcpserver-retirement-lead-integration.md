---
name: mcp-server retirement lead-verified + install.sh wiring completed (the blocker the beat's premise missed)
description: Lead independently verified mcp-retire's 4157-file deletion (dir gone, live Python classifier parity intact, residual = intended only) and RESOLVED the HIGH blocker Codex caught - the retire analysis's "install.sh never registers it" premise was FALSE (the 2026-07-15 wire-up's install half had landed). Replaced the install.sh build+register block with an active cleanup that removes the stale ~/.claude.json entry so already-registered machines self-heal. Fixed the stale bin comment. Ready to commit.
type: project
relates_to: [decision_sidecoach_mcpserver_fate.md, session_2026-07-24_mcpserver-retirement.md, session_2026-07-24_vocab-collapse-lead-verify.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - lead confirmed dir gone (4169 files/895599 deletions), python classifier-parity PASS (live classifier intact post-dedup), install.sh bash -n OK + cleanup pops ONLY sidecoach (lotus/other/keys preserved), no build/register residue
confidence: high
---

Collaborator: Jonah. 2026-07-24. The mcp-server retirement (Jonah's 2026-07-24 decision) is executed and lead-integrated.

## What mcp-retire did (lead-verified independently)
- **Dir GONE**: `ls sidecoach/mcp-server` -> No such file; `git diff --stat` = 4169 files changed, 46 insertions, **895,599 deletions** (4157 tracked files removed).
- **Tether severed first** (re-verified: it had DRIFTED L30 -> L40 in run-tests.ts), npm test proven green (76 -> **75**, the dropped suite is exactly the mcp-server parity) BEFORE any deletion.
- **LIVE classifier parity intact**: `python3 claude/hooks/test_classifier_parity.py` -> PASS (23-case corpus). The triplicated classifier collapsed to DUPLICATED (dead 3rd copy keyword-resolver.ts gone); both surviving copies (Python hook + engine TS) still agree. This is the audit's "irreducible floor" reached, and the dedup lost no guarantee - independently confirmed.
- 4 parity docstrings de-misled (3 copies -> 2).
- `modes.ts` correctly NOT deleted (CLI still resolves retired-mode words via getMode; its deletion is the separate follow-up needing mode->PHASE_ALIASES migration first).

## THE BLOCKER Codex caught (and I resolved) - the beat's premise had drifted
The retire analysis (stamped @0b65e983) asserted "install.sh never builds or registers it." **FALSE by execution time**: the reversed 2026-07-15 wire-up's INSTALL half had actually LANDED (install.sh had a `cd sidecoach/mcp-server && npm install && npm run build` + a `mcpServers.sidecoach` register into ~/.claude.json, comment "Jonah 2026-07-15: wire it up, do not retire"). So deleting the dir without touching install.sh would (a) warn every `install.sh --only sidecoach` run, and (b) leave post-2026-07-15-installed machines with a DEAD mcpServers.sidecoach entry that SPAWN-FAILS at Claude Code startup. This is exactly the class of thing a 4000-file deletion hides, and why the removal sequence had to be re-verified not trusted - mcp-retire correctly STOPPED and escalated rather than delete install.sh out of scope.

**Lead fix**: replaced the install.sh build+register block with an ACTIVE cleanup - it removes any stale `mcpServers.sidecoach` from ~/.claude.json (idempotent: rewrites only if present; touches ONLY the sidecoach key - verified a fixture with lotus/other/otherKey all preserved). So a machine that registered the server gets self-healed on its next install; the deregister/uninstall path (which already popped the entry) is unchanged. Also fixed the stale `bin/sidecoach.js:42` comment referencing the deleted mcp-server.

## Not a decision change
The install.sh wire-up having landed does NOT reopen the decision: registration != a consumer. The server was registered but still never CALLED by anything ("no consumer materialized" holds). The wire-up landing just meant MORE cleanup than the drifted beat anticipated.

## Verify (lead)
- `bash -n install.sh` OK; cleanup simulation pops only sidecoach, preserves lotus/other/otherKey.
- install.sh residual `mcp-server` refs = Lotus's + beats' OWN separate mcp-servers + the sidecoach deregister pop - NO sidecoach build/register remains.
- npm test 75 (mcp-retire), python parity PASS, npm run build clean (no drift).

## Residue for later (flagged, not blocking the commit)
- `docs/dependency-map/index.html` + `reference_component_dependency_map.md`: drop the "inert but not removable" mcp-server node (the beat's step 7, LEAD bookkeeping - do at a docs pass).
- `modes.ts` full deletion: separate follow-up (mode->PHASE_ALIASES migration).
- Harness FP flagged by mcp-retire: `codex-failure-watcher.sh` fired on a Bash call that merely `sed`-printed codex-review.py's source (matched the tool's own capacity-signature regex list in stdout); no codex ran - worth a carve-out.

## Files touched (this integration)
- install.sh (build+register block -> active ~/.claude.json cleanup), sidecoach/bin/sidecoach.js (stale comment). Plus mcp-retire's staged: sidecoach/mcp-server/ (deleted), sidecoach/.mcp.json (deleted), scripts/run-tests.ts (tether), sidecoach_lanes.py + lane-classifier.ts + classifier-corpus.json + classifier-parity.test.ts (docstrings).
- this beat + MEMORY.md index.
