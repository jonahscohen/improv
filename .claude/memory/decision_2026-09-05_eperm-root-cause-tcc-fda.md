---
name: EPERM root cause = TCC-protected ~/Documents; durable fix = grant host app Full Disk Access
description: The recurring getcwd/read/exec EPERM flap is NOT iCloud - the repo lives in TCC-protected ~/Documents and runs inside the Paseo app; fix is a stable Full Disk Access grant, relocate as fallback. Corrects the prior "transient/unfixable" conclusion.
type: decision
relates_to: [session_2026-09-02_env-cwd-eperm-transient-resume.md, session_2026-06-13_env-cwd-eperm-incident-and-resume.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: cause probed (iCloud ruled out); fix pending live confirmation after FDA + relaunch
confidence: medium
---

The recurring "Operation not permitted" / getcwd-EPERM / uv_cwd flap on /Users/spare3/Documents/Github/improv (and everything ~/.claude symlinks into it) has been hit "dozens of times" and repeatedly written off as "transient, self-heals, unfixable from inside" (session_2026-09-02, session_2026-06-13). That conclusion was WRONG - it is fixable; prior sessions misdiagnosed the cause.

**Probed root cause (2026-09-05):**
- NOT iCloud. iCloud Drive is not enabled: ~/Library/Mobile Documents/com~apple~CloudDocs ABSENT, `brctl status` silent, no .icloud placeholders. (An earlier hypothesis of "Documents sync/backup" was accepted from a teammate WITHOUT confirming - the probe corrected it. Self-analysis: I ran with an unverified hypothesis; verify the cause before prescribing the fix.)
- The repo lives in ~/Documents, a macOS TCC-PROTECTED folder (Documents/Desktop/Downloads require an explicit Files-and-Folders or Full-Disk-Access grant), and this session runs INSIDE the Paseo desktop app (PASEO_CLI/PASEO_AGENT_ID; see session_2026-09-05_paseo-split-spawn.md). "Operation not permitted" is the signature TCC/sandbox denial. Intermittency fits the host app's access to the protected folder lapsing / child processes not consistently inheriting the grant, and it self-heals on relaunch (fresh process re-establishes access).

**Decision (Jonah, 2026-09-05): grant the host app Full Disk Access.**

**Alternatives considered:**
- Relocate the repo out of ~/Documents to a non-protected path (~/Github/improv) + re-run the installer to re-point all ~/.claude symlinks: bulletproof regardless of cause, but disruptive (many symlinks) - kept as the FALLBACK if the FDA grant does not hold.
- Keep relaunching + a cwd-reset hook shim (eperm-fix's approach): band-aid; fixes only the hook-launch cascade, not the repo-file EPERM; does not stop recurrence. Rejected as the durable fix.
- In-harness cwd-reset from a healthy cwd: proven insufficient this session - operating from /tmp with absolute paths STILL EPERM'd on repo file reads and the node shim (which resolves into the tree), because the files themselves are access-denied, not just the cwd.

**Why this one:** if it is TCC, a stable Full Disk Access grant to Paseo (and Terminal) covers all child processes consistently and ends the lapses, with zero repo disruption - a 30-second toggle. It is the fastest test of the TCC theory.

**Steps (Jonah's action):** System Settings > Privacy & Security > Full Disk Access > enable Paseo (add /Applications/Paseo.app via + if absent), and Terminal/iTerm if the launch chain uses one. Then fully quit and relaunch Paseo (TCC grants apply to newly-launched processes). improv-pm verifies after relaunch (probe: git/node/read a repo file from inside the tree, no EPERM).

**Revisit when:** EPERM recurs AFTER the FDA grant + relaunch. That would mean it is not (only) TCC (e.g., a Paseo security-scoped-bookmark expiry or a backup daemon) - then execute the relocate fallback and/or confirm the exact sandbox mechanism.

FILES: .claude/memory/ this beat + MEMORY.md.
