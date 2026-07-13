---
name: Marketing site moved out of the improv repo
description: marketing-site extracted to its own project at ~/Documents/Github/improv-site (fresh git init, no remote); git rm -r'd from improv; dependency map node reclassified EXTERNAL + finding 11 records the dead sidecoach/TASKS references
type: project
relates_to: [reference_component_dependency_map.md, session_2026-07-13_dependency-map-page.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: browser + curl + codex-review
confidence: high
---

Jonah: "move the marketing site into its own project folder in documents/github/improv-site/
and move the site fully out of the repo period." Done, in that literal order - it is now a
separate project, and nothing of it remains in improv.

## What happened

- Copied the entire `marketing-site/` tree to `/Users/spare3/Documents/Github/improv-site/`
  with `cp -a` (modes preserved). `diff -r` between old and new came back empty - byte-identical,
  37 files including the 2.4MB vendored `tilt-runtime.js`, `serve.py`, all 7 HTML pages,
  `styles.css`, PRODUCT.md, DESIGN.md, assets and the MADE Awelier fonts.
- `git init -b main` in the new project, single initial commit `d2e67fc`, no remote, no push,
  no GitHub repo created (Jonah is addressing the site separately). Commit body carries provenance:
  extracted from github.com/jonahscohen/improv at 6b217294 on 2026-07-13.
- `git rm -r marketing-site` in improv (36 tracked files deleted).
- Then `rm -rf marketing-site`, because git rm alone did NOT finish the job - see below.
- Restarted the :4830 dev server from the new path, detached.

## Why: git rm was not enough to make the site "fully out"

`git rm -r marketing-site` staged all 36 tracked deletions, but the directory was STILL on disk
afterward. `marketing-site/.DS_Store` is gitignored, so git had no opinion about it and left it -
and one surviving ignored file keeps the whole directory alive. Had I trusted the staged-deletion
count and stopped there, "moved fully out" would have been false in the most literal sense: the
folder would still have been sitting in the repo root. Checked with `find marketing-site -mindepth 1`,
confirmed the only leftover was the already-copied `.DS_Store`, then removed the shell.

Rule worth keeping: `git rm -r <dir>` proves nothing about the filesystem. Verify with `ls`, not
with the deletion count.

## How the dependency map was updated (not deleted)

The `marketing-site` node STAYS on `docs/dependency-map/index.html`. Deleting it would have thrown
away the very information that makes the move interesting - the site left the repo but did not stop
depending on it:

- It still fetches `justify-core.js` from the :9223 daemon at runtime. That dependency now crosses
  a repo boundary, so nothing in the improv tree can fix it when it breaks.
- It still ships `tilt-runtime.js` as a vendored byte-for-byte copy. A tilt-lab change now has to be
  re-copied into a *different project* to reach the site.

So the node was reclassified as EXTERNAL, reusing the existing `.flag.external` style that cmux
already uses (no new style invented). Its edges to justify and tilt-lab are preserved. Findings
count 10 -> 11; component count stays 16, because the node was reclassified, not removed, and
external nodes are already counted (cmux is one).

## Finding 11: what the move breaks, documented not fixed

Jonah said the site is addressed separately, so refactoring sidecoach/TASKS.md is out of scope.
Documenting the breakage honestly is the scope. Verified against the tree, not assumed:

- `sidecoach/src/dogfood-craft-step2.ts:10` and `sidecoach/src/dogfood-teach-step1.ts:8` both
  hard-code `/Users/spare3/Documents/Github/improv/marketing-site`, which no longer exists.
- `TASKS.md:14` still heads a `## marketing-site` area (incl. T-0043 about its DESIGN.md lint).
- Sharper than a dead path, and the reason this is a finding rather than a footnote:
  `dogfood-teach-step1.ts:14-15` calls `mkdirSync` when the path is missing. Running that script
  will not fail loudly - it will silently RECREATE an empty `marketing-site/` directory inside the
  improv repo. A dead reference that resurrects a ghost of the thing you just removed is worse than
  one that throws.

## Verification

- `diff -r` old vs new: empty (identical). Modes preserved (`cp -a`), spot-checked serve.py,
  tilt-runtime.js, MADE-Awelier-Bold.otf.
- Server on :4830: killed old pid 14722 (cwd was `improv/marketing-site`), started pid 64394 with
  PPID 1 (detached), cwd `improv-site`. HTTP 200 on index + justify/sidecoach/foundation/beats/
  reference/demo. `tilt-runtime.js` serves 2,463,252 bytes. Served index.html byte count (38,196)
  matches the new-path file exactly - proof it serves from the NEW location.
- Browser screenshots read for both the updated dependency map and the site on :4830.
- Codex review run on the improv diff.

## Files touched

- `/Users/spare3/Documents/Github/improv-site/` (new project, initial commit d2e67fc)
- `marketing-site/` (removed: git rm -r + rm -rf)
- `docs/dependency-map/index.html` (marketing-site node -> EXTERNAL + flag, finding 11, chip 10 -> 11)
- `.claude/memory/reference_component_dependency_map.md` (dated MOVED note)
- `.claude/memory/MEMORY.md` (index line)
