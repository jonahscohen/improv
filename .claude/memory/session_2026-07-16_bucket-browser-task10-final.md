---
name: Bucket-browser Task 10 - Yes& banner on launch + final verification sweep; branch-level Codex gate finds 2 REAL HIGHs
description: Jonah ruled the banner shows once on launch (implemented as a real beat held during the update fetch, gated on a 64-col floor); full-branch Codex review confirmed 2 HIGH bugs in Task 4/5 territory - disable-all can INSTALL, and 4 owners silently ignore the per-hook off-list
type: project
relates_to: [session_2026-07-16_bucket-browser-task9-wirein.md, session_2026-07-16_bucket-browser-task5-app-offlist.md, session_2026-07-16_bucket-browser-task4-staging.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests (7 suites incl. content-guard) + PARITY_FULL in a throwaway checkout + pty banner-visibility proof + controlled real-install off-list matrix + codex-review.py on the full branch diff
confidence: high
---

Task 10, the build's closing gate. Two work items: the banner Jonah ruled on, and the final
verification sweep. The sweep did its job - it found two real HIGHs.

## 1. Yes& banner - Jonah ruled "show once on launch"

Escalated in Task 9 rather than deleted (`print_yes_and_banner` was orphaned when
run_tui_gum/fresh_flow/returning_flow died). Jonah ruled: show once on launch.

**The problem:** the browser's render loop opens with `clear`. A banner printed before the
loop is erased within milliseconds - present in a byte capture, never actually seen. "It
rendered" is not "it was visible", and a byte capture cannot tell the two apart.

**The mechanism:** the banner OWNS THE SCREEN for the update check, which is a real network
round-trip (`_browser_update_refresh` -> `check_updates` -> `git fetch`). This is exactly
what the retired `returning_flow` did - banner, "Checking for updates...", then the fetch -
so the brand moment is spent on work the installer must do anyway, not on an invented pause.
A fetch can finish in milliseconds (offline, warm local remote), which would put us back to
a flash, so the beat is padded to a minimum total dwell (`BR_LAUNCH_DWELL`, default 2s).
Slow networks pay nothing extra. Then the loop clears and the root screen renders exactly as
before - a launch beat, not a header, which is what keeps 80x24 usable (the banner never
competes for rows with the component list).

**PROOF OF VISIBILITY (not reasoning):** `prove-banner-visible.sh` sends NO keys and KILLS
the pty at time T, so whatever is in the capture is what a human would have been looking at.
  - t=1s: banner PRESENT, root screen ABSENT -> the banner owns the screen. This is the
    load-bearing assertion: it can only pass if the banner outlived the instant it was drawn.
  - t=8s: both present, banner first -> the beat ends and hands off (not a hang).

**REAL BUG THE WIDTH MATRIX CAUGHT:** the art is a fixed 64 columns and cannot reflow. At 60
columns it sheared mid-glyph - `w60: 15 line(s) exceed 60 columns`. A sheared logo reads as a
rendering fault, not as branding, so the beat is now gated on `_br_term_width >= 64`
(`BR_BANNER_COLS`). Verified at the boundary: 63 -> no banner, 64 -> banner. No banner also
means no dwell - there is nothing to hold the screen for.

**HARNESS SEAM:** `test-browser-render.sh` exports `BR_LAUNCH_DWELL=0`. This removes the
DWELL, not the banner - the banner still draws on every driven run, so the width assertions
still measure it (they are what caught the 64-col overflow). Only the padding is dropped,
because a pty reading bytes does not need to be shown anything, and worse: keys are sent on a
fixed schedule and gum LOSES anything typed before it enters raw mode, so a 2s pause ahead of
gum silently ate the first keystroke and every gum assertion failed (14 FAILED before the
seam). The dwell is proven separately, against the real default entry, by the kill-mid-beat
harness. That is a visibility claim and it cannot be made from a render suite.

**`print_title_animated` DELETED** as dead code. It shimmered a single component title for
the old flat gum list; nothing calls it now. Using it in the launch just to save it would
have been inventing a design decision Jonah did not make.

## 2. Full-branch Codex gate - 2 REAL HIGHs, both CONFIRMED, both ESCALATED

Reviewed the whole feature as one unit (merge-base `6004e1e0`..HEAD, ~20 commits), production
diff only (install.sh + browser-lib.sh + browser-tree.json, 138KB). Codex found no bash-4
syntax issues, no eval-injection in `browser_load` (hex-encoded names, single-quote-escaped
values), and no non-interactive path reaching the browser.

### HIGH 1 (CONFIRMED): "Disable all" can INSTALL

`stage_all <path> uninstall` stages only the hooks CURRENTLY ON. `apply_plan` step 3 emits
`UNINSTALL_COMPONENT` for a hooks-only owner only when EVERY hook is staged-uninstall. So a
PARTIALLY-installed owner falls through to step 4.

Reproduced with the suite's own probe contract (cmux, 1/6 hooks on):
```
'Disable all cmux hooks' -> staged uninstall: 1 (resume-guard only)
apply_plan -> INSTALL cmux agent-teams-guard node-shim-heal cmux-close-guard
              cmux-teammate-shim-heal team-reaper resume-guard
```
A disable-all produces an INSTALL. Combined with HIGH 2 below, the net effect on a
partially-installed cmux is that "Disable all cmux hooks" ends with FOUR MORE cmux hooks
installed than before. The action does the opposite of its label.

### HIGH 2 (CONFIRMED, and BROADER than Codex reported): 4 owners ignore the off-list

Partial hook-off plans depend on `_AMPERSAND_HOOK_OFF`, but only owners routed through
`install_app_hooks` honor it. Established by a CONTROLLED matrix against the REAL installer -
each owner installed twice, once clean (baseline) and once with all its hooks staged off; a
hook only proves anything if it LANDS at baseline:

| ignores the off-list | honors it |
|---|---|
| cmux (cmux-close-guard, cmux-teammate-shim-heal, resume-guard, team-reaper - 4 of 6) | chrome, clickup, codex, figma |
| fable (fable-orchestrator-guard) | justify, memory, visualizer, voice-output |
| reflect (reflect-nudge) | |
| sidecoach (sidecoach-keyword, sidecoach-sessionstart) | |

Root cause: `install_app_hooks` implements the whole off-list contract (skip + wire-skip +
reconcile-remove). reflect/sidecoach/fable and 4 of cmux's hooks have BESPOKE install blocks
with their own `link_or_copy` + their own python settings-wiring (reflect wires a custom
`SESSION_CWD=... reflect-nudge.sh` command, which is why it cannot trivially use the
app-wirings.json path). Task 5 shipped the off-list for the `install_app_hooks` path only.

User-visible symptom: the browser toasts "Applied - your setup now matches what you staged"
while the staged disable is silently dropped. A lie, which is the class of defect this build
cares most about.

### WHY THESE ARE ESCALATED, NOT FOLDED

Both are Task 4/5 product gaps surfaced by the closing gate (which is what a closing gate is
for), not defects in Task 9/10 work. Both fixes are DESIGN decisions with real alternatives:

- HIGH 1: make `stage_all uninstall` total (stage every non-pinned hook, not just the on
  ones), OR change apply_plan step 3 to compare against on-after-pending. Different
  semantics, different blast radius; Task 4's beat explicitly records a "stage_all is total"
  ruling that this interacts with.
- HIGH 2: thread the off-list through 4 bespoke install blocks (+ reconcile-remove per
  block, in the settings.json wiring layer the parity suite exists to protect), OR fail
  closed by removing un-honorable toggles from browser-tree.json (removes user-facing
  capability from the Task-1 source of truth).

Rewriting the wiring layer across 4 bespoke blocks at the closing gate, on my own authority,
is exactly the improvisation the executor contract forbids. Proven, scoped, and handed back.

### Folded: the MEDIUM that was MINE

Codex: help said "Every individual hook is --only-able too, e.g. --only bash-guard" - false.
Verified: `bash-guard` ACCEPTED; `justify-source-guard`, `reflect-nudge`, `sidecoach-keyword`,
`memory-approve`, `figma-fidelity-stop` all REJECTED (exit 2). The ORIGINAL help scoped this
to CLUSTER member hooks; my Task-9 regeneration generalized it into a lie. Now scoped to the
8 QA clusters, with the true statement that other components' hooks are browser-only.
Re-verified: 4 cluster hooks accepted.

### Reported, not fixed

- MEDIUM (Codex): the tree lists 2 sidecoach hooks while the installer deploys 6, and cmux's
  tree omits `resume-toggle`/`teammate-relay-stop`. Status rows can read "2/2" while the real
  component has more managed hooks. Same escalation class as HIGH 2 - browser-tree.json is
  the Task-1 spec'd source of truth and editing its membership is a product decision.
- LOW (Codex): `git fetch` has no timeout, so a hanging credential/network fetch holds the
  launch banner indefinitely. Pre-existing (returning_flow had the same exposure); the banner
  makes it more visible. A timeout is a behavior change worth ruling on, not sneaking in.

## Gates (all real output)

- `bash -n install.sh`, `bash -n browser-lib.sh`: clean.
- test-component-browser 99, test-check-updates 39, test-apply-pending 33,
  test-app-hook-offlist 36, test-browser-render ALL 110, test-settings-deploy-parity
  ALL PARITY CHECKS PASSED, test-content-guard 35 passed / 0 failed.
- `PARITY_FULL=1`: ALL PARITY CHECKS PASSED, run in a THROWAWAY checkout
  (`/tmp/parityfull.XXXX`, rsynced from the worktree so it tested the real working code,
  confirmed outside the worktree before running). It exercises two combos the fast run
  skips (`config,sidecoach`, `config,justify`). Worktree status byte-identical before vs
  after; no node_modules/dist churn leaked. Throwaway removed.
- Flag matrix + NO-BANNER-LEAK: `--only safety|justify` (1 pick), `--preset minimal` (6),
  `--preset all` (42), `--preset none` (0), `--dry-run`, `--yes --dry-run`, `--help`,
  `--personal --help` all exit 0 with NO banner; `--bogus-flag` exit 2; 0 writes under
  `HOME/.claude`.
- Captures re-taken through the real default entry with the REAL dwell:
  `/tmp/browser-render-default-entry.txt` (banner@10 -> root@28),
  `/tmp/browser-render-default-entry-gum.txt` (banner@10 -> root@26).

## Self-analysis: I repeated a failure I had already written down

My off-list scope probe reported VACUOUS for every MULTI-hook owner and I nearly concluded
the gap was smaller than it is. Cause: the Bash tool runs ZSH, which does not word-split
unquoted `$hooks`, so `for h in $hooks` tested one filename made of every hook name joined
together. Single-hook owners evaluated correctly, which is what made the output look
plausible rather than broken - the same shape as the `$spec` bug in Task 9, whose lesson I
had ALREADY written into that beat ("run installer flag matrices under an explicit bash,
never the ambient shell"). Writing the lesson down is not the same as applying it. What
caught it was a contradiction between two runs, not vigilance: an earlier single-hook probe
said sidecoach IGNORED the off-list while the loop said "honored". Standing rule, now with
teeth: ANY loop that word-splits goes inside `bash <<'SH'`, and any probe reporting "clean"
needs a baseline control proving it CAN report dirty. The first version of that matrix had no
baseline at all and would have called a failed install "honored".
