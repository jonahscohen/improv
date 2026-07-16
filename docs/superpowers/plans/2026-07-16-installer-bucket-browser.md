# Installer bucket browser - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Authored against commit `1ca3ef9f`. Collaborator: Jonah Cohen.
Spec: `docs/superpowers/specs/2026-07-16-installer-bucket-browser-design.md`.
Validated reference implementation (logic to port to bash):
`docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html`.

**Goal:** Replace the installer's flat component list + returning-flow with one siloed,
purpose-grouped bucket browser that drills to individual hooks, stages then applies changes,
and updates a setup drifted behind the repo.

**Architecture:** A `browser-tree.json` data file (buckets -> members -> hooks + descriptions)
is the single source of truth. `install.sh` loads it into bash arrays once, exposes small
pure accessor/status/staging functions (unit-tested), renders nested `gum` screens with a
plain-text fallback, and applies staged changes through the existing `--only` install +
`deactivate_*` paths - extended so individual app-component hooks can be toggled, not just
cluster hooks.

**Tech Stack:** bash, `gum` (optional, with text fallback), `python3` (JSON), git (update flow).

---

## Pre-flight

- [ ] **Confirm the stamp.** Run `git rev-parse --short HEAD`. If not `1ca3ef9f`, re-read the
  spec's "current-state" claims (function anchors below) against the live file before coding.
- [ ] **Baseline green.** Run `bash -n install.sh` (expect clean) and
  `bash claude/hooks/test-settings-deploy-parity.sh` (expect `ALL PARITY CHECKS PASSED`,
  exit 0). If either fails, STOP - fix the baseline first.

**Live function anchors (verify before editing):** `cluster_hooks()` ~600, `install_app_hooks()`
~694, `deactivate_app_hooks()` ~732, `run_tui_gum()` ~1025, `run_tui_fallback()` ~1094,
`detect_component()` ~1190, `check_updates()` ~1248, `apply_update()` ~1256, `returning_flow()`
~1791, entry dispatch ~2029.

## File structure

- **Create** `claude/hooks/browser-tree.json` - the validated tree: ordered buckets, each with
  a section (`core`/`more`), tag, description; ordered members, each with a kind
  (`leaf`/`group`/`hooks`), tag, description; hook lists + per-hook descriptions. One
  responsibility: the browsing model + `--help` source.
- **Create** `claude/hooks/test-component-browser.sh` - unit tests for the pure functions.
- **Modify** `install.sh` - add the browser (loader, accessors, status, staging, apply, update
  wrapper, render, nav loop, text fallback), extend `install_app_hooks`/`deactivate_app_hooks`
  for a per-hook off-list, replace the interactive entry dispatch, regenerate `--help` from the
  tree. Keep every non-interactive flag path untouched.

The pure functions (tree accessors, status, staging, update-classify) are the testable core and
carry the most risk; the gum render/nav loop is code-reviewed + hand-driven (needs a TTY).

---

## Task 1: The tree data file

**Files:**
- Create: `claude/hooks/browser-tree.json`
- Test: `claude/hooks/test-component-browser.sh`

- [ ] **Step 1: Write the failing test (tree is valid + complete).**

```bash
#!/usr/bin/env bash
# test-component-browser.sh - unit tests for the bucket browser pure functions.
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TREE="$REPO_DIR/claude/hooks/browser-tree.json"
pass=0; fail=0
ok(){ echo "PASS $1"; pass=$((pass+1)); }
bad(){ echo "FAIL $1"; fail=$((fail+1)); }

# 1. tree is valid JSON
python3 -c "import json;json.load(open('$TREE'))" 2>/dev/null && ok "tree valid json" || bad "tree valid json"

# 2. every install.sh KEY appears in exactly one bucket member set (completeness)
python3 - "$REPO_DIR" "$TREE" <<'PY' && ok "every component bucketed" || bad "every component bucketed"
import json,re,sys,os
repo,tree=sys.argv[1],sys.argv[2]
t=json.load(open(tree))
members=set()
for b in t["buckets"]:
    for m in b["members"]: members.add(m["key"])
src=open(os.path.join(repo,"install.sh")).read()
keys=set()
for line in re.findall(r'KEYS\+?=\(([^)]*)\)',src):
    keys.update(w for w in line.split() if w and not w.startswith('"'))
# personal keys live under the Personal bucket; app/cluster keys are members too
missing=[k for k in keys if k not in members and k not in ("skills",)]
print("missing:",missing,file=sys.stderr)
sys.exit(0 if not missing else 1)
PY

echo "== $pass passed, $fail failed =="
[ "$fail" = 0 ]
```

- [ ] **Step 2: Run it, expect FAIL** (`browser-tree.json` does not exist yet).

Run: `bash claude/hooks/test-component-browser.sh`
Expected: FAIL on "tree valid json".

- [ ] **Step 3: Create `browser-tree.json`** by porting the prototype's `T` + `HOOK_DESC` +
  `CLUSTERS` + `HOOKS` into this shape (copy the exact member lists, hook lists, and
  descriptions from the prototype - they are the validated content):

```json
{
  "buckets": [
    {"key":"Foundation","section":"core","tag":"rules, settings, shell",
     "desc":"The base install - team rules, settings core, statusline, and shell shortcuts.",
     "members":[
       {"key":"brain","kind":"leaf","tag":"CLAUDE.md team rules"},
       {"key":"config","kind":"leaf","tag":"settings.json core (core-only)"},
       {"key":"statusline","kind":"leaf","tag":"custom status line"},
       {"key":"ampersand","kind":"leaf","tag":"re-run installer shortcut"},
       {"key":"nvm","kind":"leaf","tag":"node version auto-activate"}]},
    {"key":"Beats","section":"core","tag":"the beats memory system",
     "desc":"Beats is your cross-session memory - the engine, the reflection tool, and the hooks that keep it fresh.",
     "members":[
       {"key":"memory","kind":"leaf","tag":"the beats memory engine"},
       {"key":"reflect","kind":"leaf","tag":"reflection over your beats"},
       {"key":"Hooks","kind":"hooks","tag":"the hooks Beats depends on",
        "hooks":["memory-approve","memory-nudge","memory-compact","consolidate-nudge","beats-rebuild","beats-staleness-guard","reflect-nudge"]}]},
    {"key":"Sidecoach","section":"core","kind":"hooks","tag":"design orchestration",
     "hooks":["sidecoach-keyword","sidecoach-sessionstart"]},
    {"key":"Justify","section":"core","kind":"hooks","tag":"in-browser visual tweaks",
     "hooks":["justify-source-guard","justify-watch-guard","justify-watch-standing-by"]},
    {"key":"Tilt-lab","section":"core","kind":"leaf","tag":"visual-effects playground"},
    {"key":"Lotus","section":"core","kind":"leaf","tag":"Figma plugin + MCP bridge"},
    {"key":"Design Tools","section":"more","tag":"design skills + Figma","members":[ /* Skills(group of 11), figma(hooks) */ ]},
    {"key":"Guardrails","section":"more","tag":"safety hooks & QA","members":[ /* 8 clusters + fable, codex, chrome, visualizer */ ]},
    {"key":"Voice & chat","section":"more","tag":"talk & Discord","members":[ /* discord, voice-input leaves; voice-output hooks */ ]},
    {"key":"Dev surface","section":"more","tag":"cmux, tasks, ClickUp","members":[ /* cmux hooks; task-list leaf; clickup hooks */ ]},
    {"key":"Personal","section":"more","personal":true,"tag":"machine styling","members":[ /* ghostty, shaders leaves */ ]}
  ],
  "hook_desc": { "memory-approve":"Guards writes to your beats files.", "...": "port ALL from the prototype HOOK_DESC" }
}
```

Fill every `/* ... */` and the full `hook_desc` map verbatim from the prototype. Cluster hook
lists come from the prototype `CLUSTERS`; app-component hook lists from `HOOKS`.

- [ ] **Step 4: Run the test, expect PASS.**

Run: `bash claude/hooks/test-component-browser.sh`
Expected: PASS "tree valid json" and "every component bucketed".

- [ ] **Step 5: Commit.**

```bash
git add claude/hooks/browser-tree.json claude/hooks/test-component-browser.sh
git commit -m "browser: add validated bucket-tree data + test scaffold"
```

## Task 2: Tree loader + accessors (pure bash over the tree)

**Files:**
- Modify: `install.sh` (new section, after the cluster machinery ~line 640)
- Test: `claude/hooks/test-component-browser.sh`

The browser queries the tree constantly, so load it ONCE into bash state at browser start
(shelling to python per query would be too slow for redraws). A python one-liner emits `declare`
lines the browser `eval`s: ordered bucket keys, per-bucket member keys, node kinds, node tags,
node hook-lists, and the hook-desc map, keyed by node PATH (`Beats/Hooks/memory-approve`).

- [ ] **Step 1: Write failing tests** for the accessors. Add to `test-component-browser.sh`:

```bash
# source only the browser functions (extract them into a lib the test can source)
source "$REPO_DIR/claude/hooks/browser-lib.sh"
browser_load "$TREE"
[ "$(browser_buckets)" = "Foundation Beats Sidecoach Justify Tilt-lab Lotus Design Tools Guardrails Voice & chat Dev surface Personal" ] \
  && ok "bucket order" || bad "bucket order"
[ "$(node_kind 'Beats')" = "group" ] && ok "Beats is group" || bad "Beats is group"
[ "$(node_kind 'Sidecoach')" = "hooks" ] && ok "Sidecoach is hooks" || bad "Sidecoach is hooks"
[ "$(node_kind 'Tilt-lab')" = "leaf" ] && ok "Tilt-lab is leaf" || bad "Tilt-lab is leaf"
[ "$(node_children 'Beats')" = "memory reflect Hooks" ] && ok "Beats children" || bad "Beats children"
[ "$(node_hooks 'Sidecoach')" = "sidecoach-keyword sidecoach-sessionstart" ] && ok "Sidecoach hooks" || bad "Sidecoach hooks"
[ -n "$(hook_desc 'beats-rebuild')" ] && ok "hook desc present" || bad "hook desc present"
```

- [ ] **Step 2: Run, expect FAIL** (`browser-lib.sh` missing).

Run: `bash claude/hooks/test-component-browser.sh`
Expected: FAIL sourcing `browser-lib.sh`.

- [ ] **Step 3: Create `claude/hooks/browser-lib.sh`** with `browser_load` (reads the tree via
  one python call into bash assoc arrays `BR_KIND`, `BR_CHILDREN`, `BR_HOOKS`, `BR_TAG`,
  `BR_DESC`, `BR_HOOKDESC`, and ordered `BR_BUCKETS`) and the accessors `browser_buckets`,
  `node_kind <path>`, `node_children <path>`, `node_hooks <path>`, `node_tag <path>`,
  `node_desc <path>`, `hook_desc <hook>`. Node kind rules: has `members` -> `group`; has
  `hooks` -> `hooks`; else `leaf`. Source `browser-lib.sh` from `install.sh` (so the installer
  and the test share one implementation).

- [ ] **Step 4: Run tests, expect PASS.**

Run: `bash claude/hooks/test-component-browser.sh`
Expected: all accessor assertions PASS.

- [ ] **Step 5: Commit.**

```bash
git add claude/hooks/browser-lib.sh install.sh claude/hooks/test-component-browser.sh
git commit -m "browser: tree loader + pure accessors over browser-tree.json"
```

## Task 3: Status + rollup

**Files:** Modify `claude/hooks/browser-lib.sh`; Test `test-component-browser.sh`.

`leaf_paths <path>` returns every leaf under a node (leaf component or hook). `item_state
<path>` = `active|partial|none` (leaf: from `detect_component`/on-disk hook check; group/hooks:
rollup). `counts <path>` = `on/total` over leaves. These read real install state via the
existing `detect_component` and an on-disk hook check (`is_our_hook`), so tests seed a fake
state map via an injectable `BR_STATE_PROBE` hook (default = real detect).

- [ ] **Step 1: Write failing tests** with a seeded probe:

```bash
# inject a fake installed-set so the test is deterministic
BR_STATE_PROBE='fake_probe'
fake_probe(){ case " $INSTALLED " in *" $1 "*) return 0;; *) return 1;; esac; }
INSTALLED="Beats/memory Beats/Hooks/memory-approve Beats/Hooks/memory-nudge"
[ "$(item_state 'Beats/Hooks/memory-approve')" = "active" ] && ok "leaf active" || bad "leaf active"
[ "$(item_state 'Beats/Hooks/reflect-nudge')" = "none" ] && ok "leaf none" || bad "leaf none"
[ "$(item_state 'Beats/Hooks')" = "partial" ] && ok "folder partial" || bad "folder partial"
[ "$(counts 'Beats/Hooks')" = "2/7" ] && ok "folder counts" || bad "folder counts"
```

- [ ] **Step 2: Run, expect FAIL.** Expected: FAIL "leaf active" (functions undefined).
- [ ] **Step 3: Implement** `leaf_paths`, `item_state`, `counts` in `browser-lib.sh`, reading
  state through `${BR_STATE_PROBE:-_real_probe}` where `_real_probe <path>` maps a node path to
  the real on-disk check (component via `detect_component`; hook via `is_our_hook <hook>.sh`).
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit** (`browser: status + rollup with injectable state probe`).

## Task 4: Staging (pending sets + apply computation)

**Files:** Modify `browser-lib.sh`; Test `test-component-browser.sh`.

Pending is two space-delimited sets, `PENDING_INSTALL` / `PENDING_UNINSTALL`, keyed by leaf
path. `stage_toggle <leaf>` flips vs current state or clears if it returns to current.
`stage_all <path> <install|uninstall>`. `apply_plan` computes, WITHOUT running anything, the
`--only` component list + the per-component hook off-list + the uninstall list, so it is
unit-testable in isolation (the actual run is Task 6).

- [ ] **Step 1: Write failing tests**: toggle-then-toggle clears; staging one hook of Justify
  yields `apply_plan` = install `justify` with off-list `justify-watch-guard justify-watch-standing-by`
  (i.e. install only the staged hook). Assert the computed plan strings.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `stage_toggle`, `stage_all`, `pending_under <path>`,
  `apply_plan` (groups staged leaves by owning component; a partially-staged component becomes
  `--only <comp>` + an off-list of its NON-staged hooks; a fully-staged component is a plain
  `--only <comp>`; uninstalls list components/hooks to remove).
- [ ] **Step 4: Run tests, expect PASS.**
- [ ] **Step 5: Commit** (`browser: staging + apply-plan computation`).

## Task 5: Per-hook selective install for APP components (the big extension)

**Files:** Modify `install.sh` (`install_app_hooks` ~694, `deactivate_app_hooks` ~732); Test
`test-settings-deploy-parity.sh` + a new sandbox test.

Today `install_app_hooks <hooks...>` wires EVERY app-wirings entry for the named hooks. Extend
it to honor an inherited off-list so `--only justify` with `_AMPERSAND_HOOK_OFF="justify-watch-guard.sh"`
installs+wires justify's other hooks but NOT that one - mirroring the cluster mechanism.

- [ ] **Step 1: Write the failing test** (sandbox, like the cluster HOOK_OFF test): install
  justify with `_AMPERSAND_HOOK_OFF="justify-watch-guard.sh"` into a throwaway HOME; assert
  `justify-source-guard.sh` deployed+wired, `justify-watch-guard.sh` NOT deployed and NOT wired,
  exit 0.

```bash
SB="$(mktemp -d)"
_AMPERSAND_HOOK_OFF="justify-watch-guard.sh" _AMPERSAND_NO_SUMMARY=1 HOME="$SB" bash install.sh --only justify --yes >/dev/null 2>&1
# assert justify-source-guard present + wired, justify-watch-guard absent + unwired
```

- [ ] **Step 2: Run, expect FAIL** (currently all justify hooks install regardless of the off-list).
- [ ] **Step 3: Implement** in `install_app_hooks`: skip any `$h` present in `" $HOOK_OFF "`
  (the seeded-from-`_AMPERSAND_HOOK_OFF` var), both for the `link_or_copy` deploy loop and the
  python wiring filter (add the off-set to the `okh` exclusion). In `deactivate_app_hooks`, allow
  a single-hook call (it already loops `"$@"`) - confirm `deactivate_app_hooks justify-watch-guard.sh`
  removes just that hook's file + its app-wirings entries, leaving the others.
- [ ] **Step 4: Run the sandbox test + `test-settings-deploy-parity.sh`, expect PASS.** Parity
  must still be `ALL PARITY CHECKS PASSED` (no dangles introduced).
- [ ] **Step 5: Commit** (`install.sh: per-hook off-list for app components (matches clusters)`).

## Task 6: apply_pending - run the computed plan

**Files:** Modify `browser-lib.sh` / `install.sh`; Test: sandbox integration.

`apply_pending` executes `apply_plan`: one `install.sh --only <comma-list> --yes` per staged
install group (passing `_AMPERSAND_HOOK_OFF` for partial components), then `deactivate_component`
/ `deactivate_app_hooks` for uninstalls, then clears pending + refreshes state.

- [ ] **Step 1: Write the failing sandbox test**: seed a sandbox HOME with justify+codex
  installed; stage (uninstall one codex hook) + (install chrome); call `apply_pending`; assert
  the codex hook is gone, chrome's 3 hooks present, others intact, pending empty.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `apply_pending` invoking the recursive installer (reuse the
  `_AMPERSAND_NO_SUMMARY=1 bash "$0" --only ... --yes` pattern from the current returning flow)
  and the deactivators.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** (`browser: apply_pending runs installs + uninstalls in one pass`).

## Task 7: Update flow (pull + re-run, two-state)

**Files:** Modify `install.sh` (new `update_status` / `update_apply` near `check_updates` ~1248);
Test: `test-component-browser.sh` with a git stub.

- [ ] **Step 1: Write failing tests** with stubbed `check_updates`: when it prints commits ->
  `update_status` = `available` (and lists them); when empty -> `up-to-date`; simulate a
  non-ff pull -> `update_apply` returns the `resolve-first` code.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `update_status` (wraps `check_updates`), and `update_apply`:
  `apply_update` (git pull --ff-only); on success, re-run install for the currently-active
  components only (`--only <active-list> --yes`); on non-ff failure, surface the resolve-first
  message. No remote / offline -> `unknown` (hide/grey the row).
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** (`browser: two-state update flow - pull + targeted re-run`).

## Task 8: Rendering + navigation (gum) + text fallback

**Files:** Modify `install.sh` - add `component_browser` (the nav loop) + `render_screen`
(gum) + `render_screen_text` (fallback). NOT unit-tested (needs a TTY); implemented against the
prototype as the visual spec, then code-reviewed + hand-driven.

- [ ] **Step 1: Implement `render_screen`** porting the prototype's `render`/`buildRows`/`itemRow`:
  breadcrumb, lead + `N of M installed`, section labels (`CORE COMPONENTS`/`MORE COMPONENTS`),
  the two-state update row at root, item rows (caret `>`/`v`, glyph, name, tag, status, count,
  pending marker), the detail line, contextual actions, footer. One `gum choose` per screen; the
  returned row drives `activate`.
- [ ] **Step 2: Implement `component_browser`** - the nav-stack loop (root -> bucket -> member ->
  hooks), `activate` (drill vs toggle vs action), `a`=apply, `q`=quit-with-unapplied-warn, and
  the update row. Mirror the prototype's `activate`/`move` semantics.
- [ ] **Step 3: Implement `render_screen_text`** - numbered plain-text menus covering every
  screen (no gum), matching current fallback style.
- [ ] **Step 4: `bash -n install.sh`** clean.
- [ ] **Step 5: Hand-drive verify** (TTY): from a scratch checkout, run `./install.sh`; walk
  root -> Beats -> Hooks, toggle a hook, apply; drill Justify, toggle one hook, apply; open
  Guardrails -> a cluster; trigger the update row. Screenshot each (cmux `--out` then Read, or
  chrome MCP) and confirm against the prototype. Repeat with `gum` uninstalled for the text path.
- [ ] **Step 6: Commit** (`install.sh: component_browser render + nav + text fallback`).

## Task 9: Wire in - replace the interactive entry flows + regenerate --help

**Files:** Modify `install.sh` (entry dispatch ~2029; `run_tui_gum`/`run_tui_fallback` ~1025/1094;
`returning_flow` ~1791; `--help` block ~818-833).

- [ ] **Step 1:** Route the interactive entry (fresh AND returning) to `component_browser`.
  Keep the update check, but surface it via the browser's update row rather than the
  returning-flow prologue. Retire `run_tui_gum`/`run_tui_fallback`/`returning_flow` (delete or
  leave thin shims that call the browser). Non-interactive flags unchanged.
- [ ] **Step 2:** Regenerate the `--help` "Components" block from `browser-tree.json` (a small
  python pass) so help and browser can never drift.
- [ ] **Step 3:** `bash -n install.sh`; `--help` renders; `--dry-run`, `--only`, `--preset`
  unaffected (spot-check `--only safety`, `--only justify`).
- [ ] **Step 4: Hand-drive** the full first-run and returning experiences once more.
- [ ] **Step 5: Commit** (`install.sh: browser replaces fresh + returning TUI; --help from tree`).

## Task 10: Full verification + cross-model review

- [ ] **Step 1:** `bash -n install.sh` clean.
- [ ] **Step 2:** `bash claude/hooks/test-component-browser.sh` all pass.
- [ ] **Step 3:** `bash claude/hooks/test-settings-deploy-parity.sh` -> `ALL PARITY CHECKS
  PASSED`; `PARITY_FULL=1` too (in a throwaway checkout - it npm-builds sidecoach in-tree).
- [ ] **Step 4:** `bash claude/hooks/test-content-guard.sh` -> 0 failed.
- [ ] **Step 5: Cross-model review** of the whole diff via `~/.claude/hooks/codex-review.py`
  (now node>=16-safe) or an independent-Claude reviewer if Codex is down; fold every finding,
  re-verify.
- [ ] **Step 6: Commit** any review fixes; write the completion session beat (collaborator
  Jonah Cohen) with what shipped + what was verified.

---

## Self-review (against the spec)

- **Bucket taxonomy** (spec) -> Task 1 (browser-tree.json) + Task 9 (--help regen). Covered.
- **Nested nav + wayfinding** -> Task 8. Covered.
- **Status/rollup** -> Task 3. Covered.
- **Staged-apply** -> Tasks 4 + 6. Covered.
- **Per-hook control for app components (DECIDED)** -> Task 5. Covered - the highest-risk task.
- **Update flow (two-state, pull + re-run, edges)** -> Task 7. Covered.
- **Replaces run_tui_gum/returning_flow; preserves non-interactive** -> Task 9. Covered.
- **Testing (test-component-browser + parity regression)** -> Tasks 1-7, 10. Covered.
- **Open questions**: update re-run scope resolved in Task 7 (targeted, active-only); update-row
  default is live from `check_updates` (Task 7). Both closed.
- No placeholders except the deliberate `/* port from prototype */` markers in the Task-1 JSON,
  which name the exact prototype source to copy - not vague TODOs.
