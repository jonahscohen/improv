---
name: Bucket browser gap - hooks-only components offer no install/uninstall affordance
description: BUG (confirmed by driving the real installer 2026-07-17). Top-level kind=hooks buckets (sidecoach, justify, + 8 more) render ONLY hook toggles and "Enable/Disable all X hooks". The component itself has no visible install/uninstall row, and the "hooks" label understates what Disable-all actually does (full UNINSTALL_COMPONENT). Fix not yet chosen - awaiting Jonah's ruling.
type: project
relates_to: [decision_bucket_browser_engine_leaf_master.md, decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: drove the real ./install.sh --browser under a pty in text-fallback mode and read the captured Sidecoach screen
confidence: high
---

Jonah 2026-07-17: "improv installer TUI doesn't indicate where or how i can install or uninstall the biggest packages with dep hooks. example...go to sidecoach or justify, open the bucket, and see nothing about installing or uninstalling either one."

**Confirmed, and it is broader than sidecoach/justify.** Drove `./install.sh --browser` under `/usr/bin/script` with gum off PATH (text fallback) and captured the real Sidecoach screen:

```
ampersand > Sidecoach
Sidecoach is the design orchestration system - 26 flows ... These are the hooks it installs.
6 of 6 hooks on

   1) < Back to all groups
   2) + Enable all Sidecoach hooks...
   3) - Disable all Sidecoach hooks...
   4)   * sidecoach-sessionstart active
   ... 5 more hook rows
```

The word "install" appears nowhere on the screen except inside the prose blurb. Every row is about HOOKS.

**Root cause (two layers, both real):**

1. **No component leaf.** `browser-tree.json` gives sidecoach and justify `kind: "hooks"` at the TOP level, so the bucket IS a hook folder and has no component leaf to toggle. `install.sh:2419-2427` branches on `node_kind == hooks` and emits "Enable/Disable all <label> hooks..." instead of "Install all of <label>... / Remove all of <label>...". That copy was specced (design spec lines 111-113) for hook folders sitting INSIDE a component bucket (Beats/Hooks), where the component leaf lives elsewhere on the parent screen. It leaked to the top level, where there is no leaf anywhere.

2. **The label lies about scope.** Per [[decision_bucket_browser_engine_leaf_master.md]] rule 3, a hooks-only owner (no leaf) with target_on empty emits `UNINSTALL_COMPONENT <owner>` (browser-lib.sh apply_plan, `[ -z "$lp" ] && [ "$on_count" -eq 0 ]`). So "Disable all Sidecoach hooks" does NOT unwire six hooks - it removes the entire Sidecoach component. Conversely "Enable all Sidecoach hooks" is the only path that installs it. The mechanism is correct and tested; the UI never says so.

**Scope - every top-level or nested `kind: hooks` node that is a real component, not just a hook cluster:** sidecoach, justify, figma, fable, codex, chrome, visualizer, voice-output, cmux, clickup. The 8 Guardrails clusters (safety, verification, question-discipline, grounding, api-drift, planning-git, surface, model-routing) are genuinely just hook groups, so "Enable/Disable all X hooks" is honest there and should stay.

Also note the root screen renders these as `v * Sidecoach ... active 6/6` (`install.sh:2258`, `hooks) caret="v"`), where the 6/6 is a HOOK count reading as a component count, and selecting the row drills in rather than staging.

**Why the 300+ passing assertions missed it:** every browser test asserts the rendered rows match the tree, and the tree says sidecoach is a hook folder. The tests and the tree agree with each other. Nothing asserts "a user can find how to install this component," which is not a structural property.

## RULED + IN PROGRESS (Jonah, 2026-07-17)

**Shape:** open a bucket and see (1) the main component, (2) associated tools if applicable, (3) dependent hooks as a bucket you drill into to toggle individual hooks. That IS the validated Beats model generalized.

**Scope ruled:** "The 4 with real payloads and beats" - sidecoach, justify, voice-output, cmux (the four whose `detect_component` checks a real non-hook artifact: a skill file, an installed dir, a settings symlink), plus Beats in the consistency pass. The other six (codex, chrome, figma, visualizer, clickup, fable) detect purely via `is_our_hook` - they ARE just a bundle of hooks, so their hook-only screen is already honest and is deliberately left alone. That line (real payload vs pure hook bundle) is the durable rule for any component added later.

**Tools tier ruled:** omit where nothing is separable. Sidecoach and Justify install as one atomic unit; inventing installer granularity for their sub-parts was explicitly rejected as out of scope. The tier stays available in the schema for later.

**Key finding that made this cheap:** NO installer change was needed. `_real_probe` (browser-lib.sh:306-315) already routes a leaf node to `detect_component "$key"`, and sidecoach/justify/voice-output/cmux are all already keys there. `_owner_leaf_path` already emits for every leaf node. So giving each a leaf converts it from a rule-3 hooks-only owner into a rule-1/4 dual-nature owner using machinery that already shipped and was already tested. This was a tree-DATA change plus tests, not engine surgery.

**Semantics verified after the restructure** (fake-probe harness over the real apply_plan, all four now `kind: group` with children `[<key>, Hooks]`):

| Action | Plan emitted | Reading |
|---|---|---|
| Drill into Hooks, "Disable all hooks" | `INSTALL sidecoach <all 6 off-listed>` | skill stays, hooks unwired - label is now TRUE |
| Bucket screen, "Remove all of Sidecoach" | `UNINSTALL_COMPONENT sidecoach` | honest full removal |
| Toggle the Sidecoach leaf off | `UNINSTALL_COMPONENT sidecoach` | leaf is the master switch |
| Toggle one hook off | `INSTALL sidecoach sidecoach-keyword` | one hook unwired |
| Clean machine, "Install all of Justify" | `INSTALL justify` | install path is now reachable and named |

The landmine from the diagnosis above is defused by construction: "Disable all hooks" can no longer emit `UNINSTALL_COMPONENT`, because `[ -z "$lp" ]` in apply_plan rule 3 is now false for all four.

Owner leaf paths resolve as `sidecoach/sidecoach`, `justify/justify`, `Voice & chat/voice-output/voice-output`, `Dev surface/cmux/cmux`. The doubled path segment is required, not cosmetic: `_real_probe` calls `detect_component "${path##*/}"` and `_owner_leaf_path` is keyed by leaf key, so the leaf key MUST equal the installer's `--only` key.

## BUILT + VERIFIED LIVE (2026-07-17)

**No renderer change was needed either.** install.sh:2419 already branches on `node_kind == hooks` to pick "Enable/Disable all X hooks..." vs "Install all of X... / Remove all of X...". Once the bucket became a group and the hooks moved into a Hooks child, the correct copy fell out on both screens automatically. The whole fix is tree data + tests. The renderer was right all along; it was being fed a shape that made it say the wrong thing.

Driven live against the real `./install.sh --browser` under a pty (text fallback, 100x50). Actual captured output:

```
ampersand > Sidecoach
Sidecoach is the design orchestration system - 26 flows covering every design and QA task.
7 of 7 installed
   1) < Back to all groups
   2) + Install all of Sidecoach...
   3) - Remove all of Sidecoach...
   4)   * Sidecoach  the design orchestration skill    active
   5) v * Hooks      the hooks Sidecoach depends on    active   6/6

ampersand > Sidecoach > Hooks
6 of 6 hooks on
   1) < Back to Sidecoach
   2) + Enable all hooks...        <- now TRUE: unwires hooks, keeps the skill
   3) - Disable all hooks...
   4)   * sidecoach-sessionstart active   ... (6 per-hook toggles)
```

Justify renders identically (4 of 4 installed; leaf "the Justify server + skill" + Hooks 3/3). Root screen carets flipped from `v` (hook folder) to `>` (group) and counts went 6/6 -> 7/7 and 3/3 -> 4/4, correctly now counting the component itself.

**Gates, all green on the change:** component-browser 122 (was 104 - added the leaf/shape assertions, the affordance regression tests, and the meta-guard), check-updates 41, apply-pending 36, app-hook-offlist 38, browser-render 146 ALL PASSED, `bash -n` clean on install.sh + browser-lib.sh + the suite, `--help` renders unchanged in content.

## THE SUITE WAS LYING TO ME - meta-guard added

**Self-analysis (why this nearly shipped green).** After moving the hooks to `justify/Hooks/<hook>`, FOUR tests kept staging the OLD `justify/<hook>` path AND KEPT PASSING. Every consumer of a bogus path degrades silently instead of erroring: `stage_toggle` cheerfully stages a path nothing looks up; `pending_under` counts via `leaf_paths`, which never yields the bogus path, so "stage_all clears opposite pending" read 0 and passed while proving nothing; `_owner_of` on `justify/justify-source-guard` returns the HOOK NAME as the owner (its parent is a group, not a hooks node), so apply_plan emits nothing at all.

I only caught it because I grepped for stale path literals out of habit after the suite was already green. Had I trusted "121 passed, 0 failed" I would have shipped a suite whose staging tests asserted against paths that do not exist. This is the SAME failure family as the tree that lied about sidecoach's hook count (2026-07-16): a check that only ever compares the suite to its own assumptions cannot see the data move underneath it.

**Durable fix:** test-component-browser.sh check 3b - every path literal cited by `stage_toggle`/`stage_all`/`item_state`/`pending_under`/`counts`/`leaf_paths`/`node_*` and every entry of a literal `INSTALLED="|...|"` fixture must resolve to a real node or leaf path in the tree. Proven in BOTH directions, not just green: it passes clean (122), and reintroducing the stale path makes it FAIL. It caught its own comment's `INSTALLED="|a|b|"` example on first run, so the scanner strips comment lines first.

**Rule-3 coverage was also about to be lost silently.** Tests 4b/4c (the partial-owner disable-all regression) were written against cmux. cmux now has a leaf, so it can no longer exercise rule 3 AT ALL - the tests would have kept passing while testing a different code path. Retargeted onto `safety`, a genuine hooks-only owner (a cluster: 5 unpinned hooks, no non-hook payload). Rule 3 still governs the 6 pure-hook components and the 8 clusters and must keep multi-hook coverage.

## CROSS-MODEL REVIEW (real Codex, 228s, exit 0) - NO HIGH, 1 MEDIUM, 3 LOW, all folded

Routed via `git diff | ~/.claude/hooks/codex-review.py` after the `codex-rescue` agent was correctly BLOCKED by a hook: that agent silently downgrades to a same-model self-review when codex is slow (precedent 2026-06-30). The wrapper always runs real Codex or fails loudly.

Codex confirmed the load-bearing claim independently: `browser_load` keys node data by full path, so the `sidecoach` group and the `sidecoach/sidecoach` leaf do not collide; OWNERLEAF now resolves all four owners; HOOKPATH resolves to the new Hooks child paths. It found no path where the new shape produces a destructive plan, and verified hook counts/order against the installer's own `install_app_hooks` calls (sidecoach 6, justify 3, voice-output 3, cmux 8).

- **MEDIUM (real hole in MY meta-guard, fixed):** the bare-key exemption was too broad. I merged path-taking and key-taking accessors into one cited set, then exempted any literal without a "/" that matched a known leaf key - so `stage_toggle 'justify-source-guard'` (a bogus PATH whose final segment is a real leaf KEY) would have been accepted. The exemption had a hole shaped like the exact bug the guard exists to catch. Fixed by splitting PATH_FNS (must resolve to a full node/leaf path) from KEY_FNS (must resolve to an owner key, where valid keys = leaf keys + every `hook_owner` value). Proven with a negative control: the bare-key bypass now FAILS the guard, and the original stale full path still FAILS it.
- **LOW (valid, fixed):** rule 3's pure-hook APP class had lost coverage. 4b/4c were retargeted onto `safety`, but `safety` is a CLUSTER - `deactivate_component` routes clusters to `deactivate_cluster` (install.sh:1763) and pure-hook apps to their own arms (`deactivate_codex`, ...). Pure-hook apps are exactly the class the 4 payload components just LEFT. Added test 4d: codex all-off -> `UNINSTALL_COMPONENT codex` plus the negative half, and an assertion that codex is genuinely leafless so the test cannot silently stop exercising rule 3 the way the cmux one did.
- **LOW (valid, fixed):** `browser-lib.sh` comments at `_owner_leaf_path` and `apply_plan` still named justify/sidecoach as hooks-only owners - now false, and a trap on the exact rule that caused this bug. Rewritten to name the real leafless set (8 clusters + 6 pure-hook components) with an explicit "do NOT extend rule 3 to a component that has a leaf".
- **LOW (valid, fixed):** the sidecoach leaf desc claimed a "compiled engine", but `install.sh:4434` runs the npm build with `|| warn` (non-fatal) while `detect_component sidecoach` only probes the skill file - so the component reads active with no build. Desc tightened to what is actually guaranteed.

**Gates after folding (all re-run, not just the patched lines):** component-browser 125, check-updates 41, apply-pending 36, app-hook-offlist 38, browser-render ALL 146 PASSED (rc=0, 0 harness errors), content-guard 35/0, `bash -n` clean on install.sh + browser-lib.sh + the suite, `--help` renders unchanged in content.

NOT committed and NOT pushed - left in the working tree for Jonah.

**Harness gotcha worth knowing (cost me six orphaned shells).** test-browser-render.sh takes ~4 minutes (it drives real ptys). The obvious way to wait for it - `until ! pgrep -f 'test-browser-render'; do sleep 5; done` - DEADLOCKS: the waiter's own command line contains the string `test-browser-render`, so `pgrep -f` matches the other waiters (and, with more than one armed, they keep each other alive forever). Nothing was actually running; six shells spun on each other until killed by PID. Use a non-self-matching pattern (e.g. `pgrep -f '[t]est-browser-render'`) or just run the suite with `run_in_background: true` and wait for the completion notification, which is what actually worked.

Files: claude/hooks/browser-tree.json (4 nodes restructured), claude/hooks/test-component-browser.sh (shape + affordance + meta-guard + rule-3 app coverage; 104 -> 125), claude/hooks/browser-lib.sh (COMMENTS ONLY - no logic changed). install.sh UNCHANGED.
