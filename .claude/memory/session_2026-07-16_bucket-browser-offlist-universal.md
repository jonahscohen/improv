---
name: Universal per-hook off-list + disable-all fix (Jonah - "fix the debt now")
description: apply_plan rule 3 rewritten to branch on target_on rather than staged-uninstall count (disable-all on a partial owner emitted INSTALL); cmux/fable/reflect/sidecoach hook deploy+wire converged onto install_app_hooks + app-wirings.json so the off-list contract is universal; browser-tree reconciled to the truth
type: project
relates_to: [session_2026-07-16_bucket-browser-task10-final.md, session_2026-07-16_bucket-browser-task5-app-offlist.md, session_2026-07-15_cmux-fable-alacarte-leak.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: controlled real-install off-list matrix (baseline + all-off, under explicit bash, throwaway HOME) + apply_plan regression with negative control + 7 suites + PARITY_FULL in a throwaway + codex-review.py on the full branch diff
confidence: high
---

Jonah ruled on the two HIGHs the Task-10 closing gate surfaced: **"Fix the debt now."** Full
per-hook control must be REAL everywhere the browser offers it.

## FIX 1 - apply_plan rule 3 (the coordinator's design bug, not the implementation)

The coordinator owned this one: rule 3 tested "hooks-only owner AND every owned hook is
staged-uninstall -> UNINSTALL_COMPONENT". That test is **unsatisfiable on a partially
installed owner**, because `stage_all uninstall` only stages the hooks currently ON - the
already-off ones are never staged, so the count can never reach `h_count`. The owner fell
through to the install branch, `target_on` computed empty, `off_list` became ALL hooks, and
it emitted `INSTALL <owner> <everything off-listed>`.

Reproduced before fixing (cmux, 1/6 hooks on):
```
'Disable all cmux hooks' -> staged uninstall: 1 (resume-guard only)
apply_plan -> INSTALL cmux agent-teams-guard node-shim-heal cmux-close-guard
              cmux-teammate-shim-heal team-reaper resume-guard
```

**Corrected rule:** compute the TARGET STATE first - for each owned hook, is it ON after the
pending sets - then for a hooks-only owner (`lp` empty) emit `UNINSTALL_COMPONENT` when
`on_count` is 0. The right question was never "what did the user stage" but "what is left
ON". One pass now drives both the uninstall decision and the off-list, because they are the
same question asked twice.

**`[ -z "$lp" ]` is load-bearing** and preserves the engine-leaf master-switch ruling: a
dual-nature owner (memory, reflect - has a component leaf) with zero hooks on must still
emit `INSTALL <O> <all hooks off-listed>` so the engine/skill survives with its hooks
unwired. Only step 1 (the leaf itself staged off) removes those.

## FIX 2 - the off-list contract made universal

Root cause (confirmed at the Task-10 gate): only `install_app_hooks` implements the off-list
contract (skip + wire-skip + reconcile-remove via `deactivate_app_hooks`). cmux's 4 extra
hooks, fable, reflect, and sidecoach deployed+wired through BESPOKE blocks with their own
`make_symlink`/`ln -sf` + their own python settings-merge, so `HOOK_OFF` never reached them.

Per Jonah's ruling: converge them on the ONE implementation rather than threading `HOOK_OFF`
into 4 bespoke blocks by hand. Only hook DEPLOY + WIRE moved; every component's non-hook
work (skill dirs, npm builds, MCP registration, shim dir, zshrc launcher, registries) stayed
exactly where it was.

**Safety check before touching anything** (the coordinator asked me to stop if a wiring shape
could not be expressed): app-wirings.json already proves every shape needed - multi-event
arrays (`memory-compact.sh`), null matchers, matcher groups, custom timeouts, and
`SESSION_CWD="$(pwd)"` command prefixes (`consolidate-nudge.sh`). Nothing had to be forced.

**What moved** (14 wirings added to app-wirings.json, transcribed from the bespoke blocks
and diffed field-by-field against them: 0 mismatches on event/matcher/command/timeout):
- cmux (6): `resume-guard` SessionEnd/5, `resume-toggle` UserPromptSubmit/5, `team-reaper`
  SessionStart+SessionEnd/5 (its mode is an ARG, so the two commands differ per event),
  `cmux-close-guard` PreToolUse/Bash/12, `cmux-teammate-shim-heal` SessionStart/5,
  `teammate-relay-stop` Stop/5. Joins `agent-teams-guard`/`node-shim-heal`, already routed.
- fable (1): `fable-orchestrator-guard` PreToolUse/`Write|Edit|MultiEdit|NotebookEdit|Bash`/10
- reflect (1): `reflect-nudge` SessionStart/5, `SESSION_CWD="$(pwd)"` prefix preserved
- sidecoach (6): sessionstart, preamble (SessionStart+PostCompact/5, SESSION_CWD), postuserp,
  keyword/5, taste-gate (PostToolUse `Write|Edit|MultiEdit`/30), postresponse

**What deliberately did NOT move:** the cmux shim dir + zshrc launcher + toggle-resume.sh
(a user-facing script, not a wired hook), fable's `detect-session-model.sh` (a shared
DEPENDENCY with no settings entry - off-listing the guard must not strip the guard's own
dependency), sidecoach's registries/skill/npm build/MCP registration, reflect's skill dir.

**The one bespoke step kept, and why:** sidecoach's python block is now NORMALIZE-ONLY. It
strips every sidecoach entry, and it cannot be replaced by install_app_hooks, which adds by
EXACT command and would leave a stale absolute-path wiring from a pre-refactor install
sitting alongside the correct one. Component blocks run BEFORE the app-hook pass, so the
strip happens first and the pass re-adds exactly the hooks that survive HOOK_OFF - which
also means an off-listed hook is stripped here and simply never re-added. Codex confirmed
the ordering is sound.

## The tree was lying, and the completeness test allowed it

`browser-tree.json` claimed sidecoach owned 2 hooks while the installer deployed and wired
6, and omitted cmux's `resume-toggle` + `teammate-relay-stop`. The browser rendered
"2/2 active" for a component with 6 managed hooks and offered no toggle for the other 4.

Reconciled from the installer's own truth: sidecoach 2 -> 6, cmux 6 -> 8, with descriptions
written from each hook's actual header (not guessed). `beats-rebuild`/`beats-staleness-guard`
stay tree-only on purpose - they are PINNED and project-scoped by ruling
(decision_beats_hooks_stay_project_scoped.md), so the check exempts pinned hooks.

**Why the old test let it through:** it only checked the tree against ITSELF (every hook has
a desc, every hook has an owner). A tree that OMITS hooks passes all of that. The new check
is STRUCTURAL and derived from install.sh: every app hook deploys via a
`picked <owner> && install_app_hooks <hooks...>` line, so that line IS the installer's
declaration and the test reads it directly, BOTH directions:
- installer -> tree: a hook that installs but has no toggle (the sidecoach gap)
- tree -> installer: a toggle for a hook that never installs (a row that lies)
It fails loudly if it cannot find those lines at all, rather than passing vacuously.
Negative-controlled both ways: re-dropping the 4 sidecoach hooks fires the first direction;
a fabricated `ghost-hook` fires the second.

**Plus a count-in-prose guard** (Codex LOW, the second stale count this build): cmux's desc
still read "The 6 hooks cmux installs" after the node grew to 8, so the screen disagreed
with itself while the rendered count beside it was right. A test now checks the generated
"The N hooks X installs" shape against reality. Deliberately narrow - sidecoach's "26 flows"
is a product fact, not a hook count, and must not be caught.

## Codex - full branch diff, re-run (the wiring layer changed)

Verdict: **no HIGH, no MEDIUM. Both fixes confirmed correct.**
- Fix 1 correct: target-state-first, and `[ -z "$lp" ]` preserves dual-nature semantics.
- Fix 2 correct: the moved wirings "match the old bespoke event/matcher/command/timeout
  shapes"; sidecoach's normalize-then-readd ordering "is sound".
- One LOW (cmux's stale desc count) - folded, plus the guard above.
Also checked clean: bash 3.2 syntax, JSON validity, installer/tree consistency.

## Honor matrix - BEFORE vs AFTER

Controlled real-install matrix (each owner installed twice: baseline, then all-hooks-off; a
hook only counts if it LANDS at baseline), run under explicit `bash`, against a THROWAWAY
checkout so the worktree stayed clean.

| owner | before | after |
|---|---|---|
| cmux | IGNORES 4 of 6 (cmux-close-guard, cmux-teammate-shim-heal, resume-guard, team-reaper) | **HONORS 6/6** |
| fable | IGNORES (fable-orchestrator-guard) | **HONORS 1/1** |
| reflect | IGNORES (reflect-nudge) | **HONORS 1/1** |
| sidecoach | IGNORES (sidecoach-keyword, sidecoach-sessionstart) | **HONORS 2/2** |
| chrome, clickup, codex, figma, justify, memory, visualizer, voice-output | HONORS | **HONORS** (unchanged) |

All 12 owners honor the off-list. The browser's per-hook control is now real everywhere it
is offered.

## Gates

- `bash -n install.sh`, `bash -n browser-lib.sh`: clean. Tree + wirings: valid JSON.
- component-browser **104** (was 99: +4b/4c disable-all regressions, + both completeness
  directions, + the count guard), check-updates 39, apply-pending 33, app-hook-offlist 36,
  browser-render ALL 110, settings-deploy-parity ALL PARITY CHECKS PASSED, content-guard 35.
- **PARITY_FULL=1**: ALL PARITY CHECKS PASSED, in a throwaway checkout. This is THE gate for
  this change - it guards settings.json wiring, which is exactly what moved - and it covers
  `config,sidecoach` + `config,justify`, the combos the fast run skips. Worktree byte-
  identical before vs after; 0 node_modules churn.
- Flag matrix under explicit bash: `--only safety|justify|cmux` 1 pick, `--preset minimal` 6,
  `--preset all` 42, `--preset none` 0, `--dry-run`/`--help`/`--yes --dry-run` exit 0, unknown
  flag exit 2, NO banner leak on any of them, 0 writes under HOME/.claude.
- Re-captured `/tmp/browser-render-default-entry.txt` and a sidecoach drill: the browser now
  renders "6 of 6 hooks on" with all six hooks individually toggleable and described (it
  offered 2 before). The root row for Dev surface now reads `partial 9/10` rather than
  `active 8/8` - that is the honest state; the old tree hid cmux's 2 extra hooks.

## Files touched

- `claude/hooks/browser-lib.sh` - apply_plan rule 3 (target_on)
- `claude/hooks/app-wirings.json` - wirings for the converged hooks
- `install.sh` - cmux/fable/reflect/sidecoach hook deploy+wire -> install_app_hooks
- `claude/hooks/browser-tree.json` - tree reconciled to the installer's truth
- `claude/hooks/test-component-browser.sh` - apply_plan regression + installer<->tree
  completeness test
