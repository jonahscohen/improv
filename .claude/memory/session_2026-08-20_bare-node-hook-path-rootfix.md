---
name: bare-node hook-PATH root fix SHIPPED - plugin-node-hook-heal.sh (point-at-runtime + auto-heal)
description: Executed the handoff - measured the reduced hook PATH, built a SessionStart heal that rewrites bare-node plugin hooks to absolute node, Codex-reviewed (2 rounds), 18/18 green, probe cleaned up
type: project
relates_to: [session_2026-08-20_codex-plugin-bare-node-hook.md, session_2026-06-24_cmux-app-launch-bypasses-zsh-claude-wrapper.md]
supersedes: session_2026-08-20_HANDOFF_node-hook-path-rootfix.md
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + codex
confidence: high
---

Executed the HANDOFF ([[session_2026-08-20_HANDOFF_node-hook-path-rootfix.md]]). Jonah chose (via AskUserQuestion) "point checks at the runtime + auto-heal" over continuing to chase a path-level fix.

**GROUND TRUTH from the armed probe** (~/.claude/.hook-path-capture.txt, 2 SessionStart captures):
- A cmux app-launched session gives hooks a REDUCED PATH: `<cmux-cli-shims temp>:/Applications/cmux.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin` - **node=MISSING**, cmux resolves (to the .app bin). This is the session that prints "node: command not found".
- A terminal-launched session (the current one) gives hooks the FULL login PATH - node resolves. So the reduced vs full split is per-LAUNCH-CONTEXT (cmux.app GUI vs `cmux claude-teams` from a terminal), not per-event; SessionStart and Stop hooks in one session share the same process PATH.

**CORRECTED the prior diagnosis** ([[session_2026-08-20_codex-plugin-bare-node-hook.md]]): it claimed node-path-default.sh "no longer exists at claude/hooks/". FALSE - it exists and is live (SessionStart, base-wired). But it writes PATH to $CLAUDE_ENV_FILE, which reaches only the BASH TOOL, not hook shells (proven: it ran at SessionStart in the reduced session, yet the later probe hook still saw node MISSING). So it does NOT and cannot fix the hook PATH. Also NARROWED the blast radius: cmux resolves on the reduced PATH, so the CMUX hooks are fine - only bare **node** is missing. The class of failing hooks = plugin hooks.json that call bare `node`: openai-codex (Stop/SessionStart/SessionEnd review gate, the reported failure, ENABLED), plus two other cached plugins (vercel and one whose name collides with a retired skill token) that would break if enabled. Reproduced live: the codex Stop command under the reduced PATH prints "node: command not found" and silently exits 0 (degraded review-gate coverage, not just noise).

**WHY not the path-level fix Jonah originally leaned toward:** the reduced PATH holds no dotfiles-owned writable dir - only an ephemeral per-launch cmux temp dir and the SIGNED cmux.app bundle (unsafe to modify - can break the app's code signature). And $CLAUDE_ENV_FILE doesn't reach hooks. So there is no safe, durable place to put a node shim on the reduced PATH. Fix moved to the CALLERS (the nyx pattern: nyx's hooks call /opt/homebrew/bin/node absolute and never fail).

**THE FIX - claude/hooks/plugin-node-hook-heal.sh** (NEW, SessionStart cmux app hook):
1. Resolves an absolute working node >=16 (prefers /opt/homebrew/bin/node = v24, then ~/.claude/cmux/node, then newest nvm via a PORTABLE numeric field sort; last-resort `command -v node` only if absolute AND >=16).
2. Rewrites the bare `node` executable token to that absolute path in every plugin hooks.json under ~/.claude/plugins/cache, via a QUOTE-AWARE command-position scanner (rewrite()) - not a raw regex. Rewrites `node` only at a command-start position OUTSIDE quotes (start, or after unquoted `; | & { ( \n`), skipping `VAR=value` (incl. quoted values) and `env`/`command`/`exec`/`!` prefixes. Never touches a quoted/argument `node`, `node_modules`, `nodejs`, or an already-absolute `/.../node` (idempotent).
3. Re-runs every SessionStart, so a plugin UPDATE (which restores bare node in the cache) is re-healed next session. Fail-soft, silent, atomic write via tempfile.mkstemp (concurrent-session safe).

One-time on-disk rewrite run NOW, so the next launched session already reads absolute-node hooks. NOTE: the current session's registry was already cached with bare node, so codex still errors THIS session; the fix takes effect on the next launch (told Jonah: one restart to watch the error clear).

**REGISTERED durably** (mirrors node-shim-heal, a cmux app hook): app-wirings.json (SessionStart entry), browser-tree.json (cmux Hooks list + hook_desc + hook_owner=cmux), install.sh (install_app_hooks cmux list + deactivate_app_hooks list). **LIVE now**: created ~/.claude/hooks/plugin-node-hook-heal.sh symlink AND verified it RUNS clean from that path (exit 0) - not just that settings.json has the entry (the exact trap from [[session_2026-08-20_announce-hook-missing-symlink.md]]); added the SessionStart entry to live settings.json.

**CODEX REVIEW - 2 rounds** (codex-review.py deterministic wrapper, real Codex 0.142.5):
- Round 1: 2 HIGH (quote-blind regex could corrupt a quoted `node`; fixed temp path unsafe under concurrent SessionStart) + 2 MEDIUM. FOLDED: replaced the regex with the quote-aware scanner; tempfile.mkstemp; validated the PATH fallback (absolute + >=16).
- Round 2: confirmed both HIGH resolved. Folded 2 more: quoted-assignment prefixes (`NODE_OPTIONS="--x" node`) via a quote-aware value consumer; `sort -V` -> portable numeric field sort. Added `command`/`exec`/`!` prefix coverage. LEFT (documented, accepted): control-flow keyword positions (`if...then node`) - no plugin uses them; and the homebrew-before-nvm preference (Low - homebrew is typically newest; here it's 24; the >=22 self-gating plugin no-ops gracefully otherwise).

**VERIFICATION:** test-plugin-node-hook-heal.sh (NEW) 18/18 green - 14 tokenizer cases incl. the adversarial quoted `{ node: 1 }` preserved, argument/single-quoted/node_modules preserved, VAR=/env/command/exec/! prefixes rewritten; idempotency; fail-soft on junk json; resolver-absolute; reduced-PATH resolves (v24.2.0). Real codex cache: healed to absolute + idempotent on re-run + reduced-PATH command no longer prints "command not found". All edited JSON parse; install.sh + both scripts pass `bash -n`.

**PROBE CLEANED UP** (handoff step 5): removed the .hook-path-capture.sh SessionStart entry from live settings.json (valid after), rm'd ~/.claude/.hook-path-capture.sh + .txt.

**RESIDUAL to confirm on next reduced (cmux.app) launch:** that Stop hooks get the same reduced PATH as the captured SessionStart (high confidence - same process env) and that the codex Stop error is gone. Proven by mechanism + simulation this session; final live confirmation is one cmux.app launch away.

Files: claude/hooks/plugin-node-hook-heal.sh (new), claude/hooks/test-plugin-node-hook-heal.sh (new), claude/hooks/app-wirings.json, claude/hooks/browser-tree.json, install.sh. Machine-local (not in git): ~/.claude/hooks symlink, live settings.json entry, healed plugin-cache hooks.json files.
