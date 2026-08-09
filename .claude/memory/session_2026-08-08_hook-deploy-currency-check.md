---
name: Hook deploy-currency check (wired-but-not-deployed guard)
description: New SessionStart hook hook-deploy-currency.sh warns when a hook is wired in the repo config (cluster-wirings.json / app-wirings.json) and its file is on disk in ~/.claude/hooks, but its command was never written into the live ~/.claude/settings.json. Built to prevent the ELIAS-style silent deploy-lag. Honest scope: catches the deploy-lag half only, not the frozen launch-snapshot half (harness behavior a hook cannot fix).
type: project
relates_to: [session_2026-08-08_elias-silent-activation-failure.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests (15/15 new suite green) + shellcheck clean + parity (test-component-browser 147/0) + registry audit clean + live symlink integration + codex cross-model review (2 findings folded)
confidence: high
---

Collaborator: Jonah. Built the deploy-currency guard requested off the ELIAS post-mortem.

## Origin (why this exists)
ELIAS (stakeholder mode) was built + wired in the repo config on Aug 5 (hooks symlinked into ~/.claude/hooks 10:57) but its entries did not land in the live ~/.claude/settings.json until Aug 7. For every session launched in that window the ELIAS hooks were present on disk yet ABSENT from settings.json, so the mode was silently off with no signal - a PM shipped client-facing technical content believing it was protected. See [[session_2026-08-08_elias-silent-activation-failure.md]]. The generalizable defect: a hook can be committed/wired in the repo yet not present in the deployed settings.json, and nothing tells anyone.

## What the check does
`claude/hooks/hook-deploy-currency.sh` (SessionStart, planning-git cluster, default-on):
- Resolves its OWN checkout via the ~/.claude/hooks symlink walk (same pattern as hook-registry-guard.sh) so it reads THIS repo's wiring tables regardless of CLAUDE_PROJECT_DIR.
- Builds the DECLARED set: every hook name that is a key in cluster-wirings.json OR app-wirings.json, with its exact command string(s). The installer writes these verbatim into settings.json, so exact-string comparison is correct.
- Builds the LIVE set: every command string across all events/groups in ~/.claude/settings.json.
- For each declared hook whose FILE exists at ~/.claude/hooks/<name> (= its component is installed here), asserts every declared command is in the live set. Any missing -> collect.
- If any missing: emit a ONE-LINE SessionStart warning naming the hook(s) + remedy ("wired but not deployed; run install.sh to deploy..."). Else emit `{}` (silent). Never blocks, never mutates.

**How "installed" is determined:** file presence at ~/.claude/hooks/<name>. Why: the install pass deploys a wired hook's FILE and writes its settings entry together, and a deselected hook is reconcile-removed from disk. So a present file with a missing settings entry is a real deploy lag, and a hook whose component was never installed (or was deselected) has no file on disk and is never checked. This is why the check never warns about a hook that is not installed here (test case 6/7).

Silent when: HOOK_DEPLOY_CURRENCY_DISABLE=1, python3 missing, repo/wiring not locatable, settings.json unreadable/absent, or everything current.

## Honest scope (deploy-lag YES, frozen-snapshot NO)
The ELIAS failure had two halves. This check owns ONLY the deploy-lag half (config-wired + on-disk, but absent from settings.json). The OTHER half - a hook correctly IN settings.json that an already-running session never picked up because a running Claude session uses its LAUNCH-TIME settings snapshot until a fresh SessionStart (compaction / new window) - is harness behavior a hook cannot fix or reliably detect from inside. Deliberately NOT solved here; documented in the hook header. The mtime-based "restart long-running sessions" hint was considered and rejected as noisy/unreliable (at SessionStart the settings mtime is almost always older than now, so it would essentially never fire while adding a moving part). The remedy for the frozen-snapshot half stays: restart or let long sessions compact. Did NOT touch any mode's default polarity - making ELIAS default-on was a misdiagnosis (polarity is irrelevant when the code is absent from the snapshot).

## Why planning-git cluster
It is a session-start hygiene SURFACING, the same shape as its clustermate push-ahead-check.sh (surfaces committed-but-unpushed work). Cluster membership means it deploys to the GLOBAL ~/.claude/settings.json and runs at every SessionStart on the machine (not project-scoped), which is required - the deploy-lag can bite any project's session. Default-on (planning-git PICKS=1).

## Wiring (managed, parity-clean)
- install.sh: added to `cluster_hooks() planning-git` membership; planning-git FILES count 2->3; cluster DESC updated.
- cluster-wirings.json: new `hook-deploy-currency.sh` key -> one SessionStart entry (matcher null, timeout 5, no SESSION_CWD prefix - it reads $HOME + its own repo, not the project dir).
- browser-tree.json: added to planning-git `hooks` list; tag 2->3; group desc updated; `hook_desc` + `hook_owner` ("planning-git") entries added.
- Proven managed: `hook-registry-guard.sh --check hook-deploy-currency` = exit 0 (managed); `--audit` = exit 0 (no unmanaged hooks).

## Verification
- New suite `claude/hooks/test-hook-deploy-currency.sh`: 15/15 green under fake $HOME (sandboxes settings.json + hooks dir; reads real repo wiring). Covers: (a) deployed+missing -> WARN naming it; (a') names only the missing hook among deployed; (a'') per-command granularity (one of two entries missing -> warn); (b) all current -> silent {}; (c) not-installed -> never warned (empty hooks dir + non-wired deployed file both silent); absent settings.json -> silent; disable switch -> silent; malformed settings (hooks is a list) -> silent no traceback; malformed group/hook entries -> no crash; python3 unavailable -> silent; repo not locatable -> silent; mutant (gate swings both ways).
- Hook + test both shellcheck clean (/opt/homebrew/bin/shellcheck exit 0; test carries a documented file-level SC2015 disable for the repo-standard `cond && ok || bad` idiom).
- Real-machine smoke: silent {} (all 65 deployed wired hooks currently live in settings.json).
- Live symlink integration: invoked through a ~/.claude/hooks-style symlink with an ELIAS deploy-lag simulated in a sandbox home -> warns naming elias-mandate.sh with the exact remedy; wire it correctly -> silent. The exact ELIAS failure reproduced and caught.
- Parity/registry: `test-component-browser.sh` 147/0; registry audit clean.
- Cross-model review: codex exec (codex-cli 0.142.5) run directly (the codex-review.py wrapper is broken on this machine per the lead). Two findings, both folded: (Medium) a readable-but-malformed settings.json where `hooks` is a list crashed with a Python traceback (exit 1) instead of staying silent - fixed with isinstance guards on hooks/group/hook plus a None-vs-malformed split (hooks absent -> judge as empty; hooks present but non-dict -> silent) and a top-level try/except net that emits {} on any unexpected shape. (Low) the suite did not cover the python3-missing and repo-not-locatable silent branches - added test cases 9a-9d. Re-verified whole unit after folding: 15/15 suite, shellcheck clean, parity 147/0, audit clean, real smoke silent.

## Pre-existing finding (NOT mine, flagged)
`test-hook-registry.sh` reports "93 passed, 1 failed"; the single failure is "1 hook(s) do not parse" = `claude/hooks/elias-detect-stop.sh` (bash -n: line 139 unexpected EOF looking for matching backtick). That file is committed in bd8f2a76 (Aug 5), unmodified by this work, and runs correctly in production (it is the live ELIAS Stop hook and blocks as designed - the beat above verified it). Looks like a `bash -n` static-parse quirk over a backtick inside a quoted/heredoc region rather than a runtime break. My two new .sh files both parse clean, so this work did not add to the count. Left for a separate unit (a half-written Stop hook is high-risk to touch casually).

## Files
- claude/hooks/hook-deploy-currency.sh (new)
- claude/hooks/test-hook-deploy-currency.sh (new)
- claude/hooks/cluster-wirings.json (new hook-deploy-currency.sh SessionStart entry)
- claude/hooks/browser-tree.json (planning-git hooks list + tag + desc; hook_desc + hook_owner)
- install.sh (cluster_hooks planning-git membership; FILES count; cluster DESC)
