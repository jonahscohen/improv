---
name: cmux hardening proposal (finding 10 + cmux/settings.json disposition)
description: Coupling map of the 8 cmux-touching hooks with file:line evidence, three hardening options, and the cmux/settings.json keep-vs-retire ruling; recommends per-hook fail-soft + a WARN-only version-drift check, rejects vendoring, keeps settings.json.
type: decision
relates_to: [session_2026-07-14_parallel-dispatch-plan.md, reference_cmux_team_init_orphan_bug.md, reference_claude_code_surface_detection.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: none
confidence: high
---

Unit 8 (research) of the parallel-dispatch plan. cmux is the highest structural risk (dependency-audit finding 10): an unpinned external GUI binary that lives outside the repo, with eight hooks that exist only to talk to it or heal it. This beat maps every coupling with file:line evidence, weighs three hardening options, and folds in the `cmux/settings.json` keep-vs-retire question U1 surfaced. Read-only investigation; no code changed.

Investigated at HEAD `0b65e983` (the plan was stamped at `7eb21eca`; HEAD moved because Waves 0-2 landed). All line numbers below were re-verified live at `0b65e983`, not trusted from the drifted plan. The plan's old `install.sh:2181` symlink claim is stale; the live symlink is at `install.sh:2304`.

## Coupling map (evidence + classification)

Taxonomy per the dispatch: **runs-the-cmux-CLI** (execs the `cmux` binary), **couples-to-a-cmux-internal-file** (reads/writes a file cmux or its nyx backend owns/generates), **reads-CMUX-env** (gates on a `CMUX_*` / cmux-injected env var). Several hooks carry more than one. A fourth, sharper flavor shows up on the close-guard: **couples-to-a-cmux-output-schema** (parses the exact shape of `cmux` stdout) - the single most drift-fragile coupling in the set.

### 1. cmux-close-guard.sh - PreToolUse, matcher `Bash` (settings.json:54,63; 12s timeout)
Registered on the `Bash` matcher, so it runs on **every Bash tool call** - the widest blast radius of the eight.
- **runs-the-cmux-CLI** (primary): `find_cmux()` resolves the binary at `cmux-close-guard.sh:466-473` via `CMUX_CLOSE_GUARD_CMUX` env, then `shutil.which("cmux")`, then hard-coded `~/.claude/cmux/cmux` (:469) and `/Applications/cmux.app/Contents/Resources/bin/cmux` (:470). `cmux_run()` (:483-488) execs it. Subcommands: `list-panels --id-format both` (:491), `top --all --processes --format tsv` (:492), `tree --all` (:668).
- **couples-to-a-cmux-output-schema** (deepest fragility): parses the `list-panels` surface/uuid regex (:500), the strict 7-column `top ... --format tsv` layout (:517-563, refuses on any unrecognized row shape at :560-563), and the `tree --all` window/workspace/surface indentation (:665-700). Any of these three formats drifting flips the guard to fail-closed BLOCK.
- **couples-to-a-cmux-internal-file** (minor): the two hard-coded binary locations above.
- **reads-CMUX-env**: `CMUX_CLOSE_GUARD_CMUX` (:467, test/override only); `CMUX_CLOSE_CONFIRM` (:646) is the guard's *own* ownership convention, not a cmux var.
- Failure mode: **fail-closed by design** (deny is the default; a fail-open close-guard is worthless). Two consequences: (a) on a machine where cmux output drifts, every close BLOCKs with "output not in the shape this guard understands"; (b) on a machine with **no cmux at all**, any Bash command that merely contains a close-subcommand substring (e.g. `close-window` in prose) BLOCKs with "cmux CLI is not resolvable" (:477-480). (b) is a latent cross-machine papercut - the guard cannot tell "cmux absent, no panes to protect" from "cmux present but unhelpful."

### 2. cmux-teammate-shim-heal.sh - SessionStart (settings.json:208)
- **couples-to-a-cmux-internal-file** (primary): overwrites cmux's per-launch-regenerated stock tmux shim at `~/.cmuxterm/claude-teams-bin/tmux` (:25) with the repo's canonical `~/.claude/cmux/teammate-tmux-shim` (:29-30); greps the shim for the `cmux-teammate-launch` marker (:34) and backs up the stock copy to `tmux.orig` (:39).
- **reads-CMUX-env**: `CMUX_SOCKET_PATH` gate (:23) - only acts inside a cmux-teams session.
- Couples to a cmux *implementation detail* (the `__tmux-compat` execvp-on-whitespace behavior and the exact shim path/layout). Already **fail-soft**: `[ -e "$SHIM" ] || exit 0` (:26), missing canonical -> exit 0 (:31).

### 3. node-shim-heal.sh - SessionStart + Stop (settings.json:203,474)
- **reads-CMUX-env** (primary): reads `NODE_OPTIONS` that cmux injected (:36) and extracts the `restore-node-options.cjs` preload path.
- **couples-to-a-cmux-internal-file**: re-plants that cmux-injected preload at the macOS-temp `cmux-claude-node-options/restore-node-options.cjs` path (:4, :36-59) from the repo canonical copy, atomically (temp-then-rename, :49-57).
- Already **fail-soft**: empty/other `NODE_OPTIONS` -> no paths -> no-op; missing canonical -> exit 0 (:32). Heals a real recurring macOS-temp-purge breakage.

### 4. team-reaper.sh - SessionStart `session-start` + SessionEnd `session-end` (settings.json:197,561)
- **couples-to-a-cmux-internal-file** (primary): operates on the agent-teams state dirs `~/.claude/teams/<name>` and `~/.claude/tasks/<name>` (:74-75), hard-railed to those two roots (:100-102).
- **couples-to-a-cmux-spawn-convention**: scans `ps -Axww -o args=` (:144-146) for cmux's spawn markers `--team-name <name>`, `--agent-id <agent>@<name>`, `/teams/<name>` (:167-170) to detect live members before reaping.
- Not CLI, not CMUX-env (session_id comes from the hook payload). Heavily **fail-safe**: biases to NOT reap on any uncertainty (:160-170), `TEAM_REAP_DISABLE=1` kill switch (:51), `TEAM_REAP_PS_OVERRIDE` for tests. NOTE: also owned/edited by Wave-2 U7 (team-dir orphan lazy-init), so it is already post-stamp.

### 5. resume-guard.sh - SessionEnd (settings.json:556)
- **couples-to-a-cmux-internal-file** (primary), specifically the **nyx backend**, not cmux proper: deletes `~/.nyx/agent-sessions/*.json` (:7,:10) to block cmux/nyx auto-resume.
- Not CLI, not CMUX-env. Gated behind opt-in flag `~/.claude/.no-auto-resume` (:6,:9) - inert unless the user opted in. Weakest/narrowest coupling of the six: a flag-guarded `rm -f` on a glob. Already **fail-soft** (acts only if both flag and dir exist).

### 6. agent-teams-guard.sh - PreToolUse, matcher `Agent|Workflow` (settings.json:123)
- **reads-CMUX-env** (primary/only): detection = `CMUX_SOCKET_PATH` set AND `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (:38). Outside that exact combo it is a hard no-op (`echo '{}'`, :38-41).
- Not CLI, not internal-file (it *names* the shim path in advisory prose at :95 but performs no file op). Purely an env-gated policy guard on the Agent tool. Already **fail-soft** by construction.

### 7. claude-surface.sh - SessionStart + UserPromptSubmit `turn` (settings.json:185,312) [soft]
- **reads-CMUX-env** (soft/only): `CMUX_BUNDLE_ID` (:33) to split cmux from a bare terminal; the primary key is `CLAUDE_CODE_ENTRYPOINT` (:24), a Claude Code var, not a cmux one. Absent `CMUX_BUNDLE_ID` -> falls back to "terminal" gracefully.
- No CLI, no internal file. Purely presentational (text-vs-visual guidance). Misdetection cost = wrong presentation hint. Zero functional risk.

### 8. surface-visual-gate.sh - Stop (settings.json:469) [soft]
- **reads-CMUX-env: effectively none.** Keys only off `CLAUDE_CODE_ENTRYPOINT` (:28); cmux falls into the default `*) exit 0` exempt bucket (:32) without reading any `CMUX_*` var. Its "cmux coupling" is purely conceptual (cmux is one of the text-only surfaces it exempts).
- No CLI, no internal file, no CMUX env. Softest of all. Misdetection cost = one spurious Stop nudge to re-present a table as a visual. Zero functional risk to cmux.

**Summary:** only **one** hook (cmux-close-guard) runs the cmux CLI, and it is the one with the widest blast radius (every Bash call) AND the deepest fragility (three output-schema parsers). The other five cmux-only hooks are file/env heal-or-gate hooks that **already fail-soft** when cmux is absent. The two "surface" hooks are barely cmux-coupled at all - one reads a single `CMUX_BUNDLE_ID`, the other reads no cmux var. The real structural risk concentrates in cmux-close-guard's coupling to cmux's *output format*, which no version pin can fully guarantee and no fail-soft can make safe-and-useful at once.

## Decision

**Recommend Option (a) per-hook fail-soft as the primary, augmented with a minimal WARN-only slice of (b) (a single SessionStart cmux-version drift notice). Reject (c) vendoring.**

**Alternatives considered:**

- **(a) Per-hook fail-soft guards (RECOMMENDED).** For each hook, guarantee that cmux-absent OR cmux-format-drifted degrades to a safe no-op or a loud-but-non-blocking warning - never bricks unrelated functionality, never silently passes something dangerous. Most of this is *already true*: hooks 2-8 no-op cleanly without cmux. The concrete gaps are two: (i) **cmux-close-guard's absent-vs-drifted split** - when `find_cmux()` returns None and there is no evidence cmux is installed at all, treat as no-op/allow (there are provably no cmux panes to protect), and keep fail-CLOSED only when cmux IS present but unhelpful; (ii) make the already-soft absent-cmux paths **explicit and test-covered** so a future edit cannot regress them. Rejected-as-sole-fix only in that it does nothing to warn about output-schema drift *before* it silently breaks the close-guard - which is why a thin (b) is layered on.
  - Tradeoff: cheap, incremental, per-hook, no new moving parts, no version bookkeeping; buys portability (non-cmux clones stop hitting papercuts). But treats the symptom (ungraceful failure) more than the cause (unpinned external), and fail-soft on the close-guard's parsers means "block loudly on drift," i.e. the guard is useless-until-patched whenever cmux ships a format change.
- **(b) Pin cmux version + drift detection.** Record a known-good `cmux --version` (optionally a hash of the `list-panels`/`top`/`tree` output schemas) and compare at SessionStart, warning on drift. Directly targets finding 10's root ("unpinned external") and gives early warning *before* a format change silently breaks the close-guard or the teammate shim.
  - Tradeoff: cmux is a GUI app the user auto-updates out-of-band, so a pin can only DETECT drift, never PREVENT it, and it generates churn (every auto-update fires the warning until someone re-pins). A version match also does not guarantee a format match. The high-fidelity variant (schema-hashing) is more work and noisier. Rejected as a *standalone* answer, but a **minimal WARN-only version check** is worth adding on top of (a): one `cmux --version` vs a pinned string in a small data file, emitted as non-blocking `additionalContext` (same posture as the beats provenance lint - a warning never blocks). That is the smallest change that converts "silent schema drift breaks the close-guard weeks later" into "you are told at the next session start."
- **(c) Vendor the cmux binary (REJECTED).** Commit a pinned cmux build into the repo.
  - Tradeoff: maximum control on paper, but **largely non-functional here**: cmux is a macOS `.app` the user runs as their live terminal/browser surface, and the hooks must introspect *the running app instance the user is in* (via its socket), not a repo-local copy. You cannot vendor "the running GUI." It is also heavy (large per-arch binary in git, licensing, breaks on cmux server-protocol changes regardless). The repo **already vendors the thin shims** (`claude/cmux/{cmux,node,teammate-tmux-shim}`, symlinked by install.sh:1877) - which is the correct and sufficient thing to vendor. Vendoring the app itself is disproportionate.

**Why this one:** (a) is the floor and mostly already met; the only real gaps are the close-guard's absent-vs-drifted split and locking in the soft behavior with tests - near-zero cost, immediate portability win. The thin (b) WARN supplies the early-warning that pure (a) lacks, without the futility of trying to *block* an auto-updating GUI or the noise of schema-hashing. (c) is rejected because the hooks fundamentally talk to the user's live app, not a bundled binary. Net: make the whole cmux coupling surface **explicit, fail-soft, and self-announcing on drift**, rather than silently assumed.

**Revisit when:** cmux ships a stable, versioned CLI/IPC contract (then pin hard against that contract, not the app version); OR cmux changes its `list-panels`/`top`/`tree` output format (the WARN fires - re-verify the close-guard parsers at :500 and :517-563 and the tree parser at :665-700); OR the harness moves off cmux entirely (then delete the six cmux-only hooks and the two soft surface hooks lose their cmux branch).

## cmux/settings.json disposition (folded in, resolves U1's correction)

**The plan's original premise - "retire the legacy commented-out symlink" - was FALSE, and the correct disposition is KEEP + reclassify, not retire.**

What the file actually is (verified by reading `cmux/settings.json`, 6120 bytes, live on disk): a JSONC template whose **only live JSON is the envelope** - `$schema` (:2) and `schemaVersion` (:3). Every actual setting (:11-181) is `//`-commented. Its own header (:5-9) states cmux uses JSONC, that uncommenting a key makes it file-managed, and crucially (:8) that **"cmux creates this template on launch when both settings file locations are missing,"** and (:9) that `~/.config/cmux/settings.json` **takes precedence** over the Application Support fallback.

Why it is NOT dead (the edges U1 found, re-verified at `0b65e983`):
- `install.sh:2304` live-symlinks `$REPO_DIR/cmux/settings.json` -> `~/.config/cmux/settings.json`.
- `install.sh:899` keys the cmux component's **active-detection** off it: `[ -L "$HOME/.config/cmux/settings.json" ] && echo active || echo not-installed`.
- `install.sh:1231` keys **deactivation** off it: `[ -L ... ] && rm -f ...`.
- `install.sh:321` lists it in the component's touched-paths manifest.

The symlink's *existence, as a symlink*, IS the cmux component's "installed" bit. The `-L` test specifically distinguishes "ampersand installed this" from "cmux self-created its own regular-file template" (:8) - which is exactly why it cannot be casually dropped.

Retireability analysis:
- The **content** is not load-bearing: cmux self-provisions an identical all-commented template on launch (:8), so removing the repo copy and letting cmux self-create loses zero config.
- The **symlink** IS load-bearing, on two counts: (1) it is the install/detect/deactivate state marker (three install.sh sites); (2) it is a real, precedence-winning cmux config path (:9) - the seam through which ampersand *could* push file-managed cmux settings later. It is an inert template today, not a dead one.

**Ruling: KEEP it; reclassify from "dead commented-out island" to "live install-state marker + inert (precedence-winning) cmux config template."** The original "retire" call was a content-only read (all settings commented -> looks dead) that missed the install edges. Retiring buys zero functional gain and costs a marker-replacement across three install sites.

If Jonah nonetheless wants it retired, the **exact detection change** required (so nothing silently mis-detects): (1) stop the symlink at `install.sh:2304`; (2) replace all `[ -L "$HOME/.config/cmux/settings.json" ]` tests - `:899` (detect) and `:1231` (deactivate) - plus the `:321` manifest string, with a dedicated ampersand-owned sentinel the installer writes/removes, e.g. `~/.config/cmux/.ampersand-cmux-installed` (a real file, NOT cmux's config path, so cmux self-provisioning its own `settings.json` cannot flip detection); (3) on deactivate remove only that sentinel, never cmux's self-created `settings.json`. This decouples ampersand's state bit from cmux's real config file. Recommend against on cost/benefit - it is the settings.json analog of the hooks' problem: the coupling was *mis-read as dead precisely because it was implicit*, and the right fix is to make it explicit and documented (keep + reclassify), not to sever it.

## Files examined (no edits)
- claude/hooks/cmux-close-guard.sh, cmux-teammate-shim-heal.sh, node-shim-heal.sh, team-reaper.sh, resume-guard.sh, agent-teams-guard.sh, claude-surface.sh, surface-visual-gate.sh
- claude/settings.json (hook registrations, events, matchers)
- install.sh (cmux component: :299, :321, :899, :1231, :2301-2304, :1877, :3059)
- cmux/settings.json (the 6120-byte JSONC template)
- docs/plans/2026-07-14-parallel-dispatch-plan.md (Unit 8 spec)

## Files touched
- .claude/memory/decision_cmux_hardening_proposal.md (this beat; the only write)
