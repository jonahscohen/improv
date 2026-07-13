---
name: Improv component dependency map
description: Evidence-verified classification of all 16 components into 5 classes plus islands, the key runtime edges, and the 11 open debt findings
type: reference
relates_to: [decision_hook_system_architecture.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: browser + codex-review
confidence: high
---

The durable classification of the improv tree as of 2026-07-13. Rendered as a page
at `docs/dependency-map/index.html` (served on :4832). The data below is the record;
the page is one view of it.

## MOVED 2026-07-13 - marketing-site left the repo

The `marketing-site` component is no longer in this repo. It was extracted to its own
top-level project at `~/Documents/Github/improv-site` (fresh `git init`, no remote) and
removed here with `git rm -r marketing-site`, per Jonah's instruction to move the site
fully out. It still serves on :4830, now from the new path.

The node stays on the map, reclassified as an EXTERNAL consumer (the same treatment cmux
gets), because both of its edges are still true and are precisely why the separation
matters:

- It still fetches `justify-core.js` from the :9223 daemon at runtime, so the site still
  degrades when justify is down - and that dependency now crosses a repo boundary.
- It still ships `tilt-runtime.js` as a vendored byte-for-byte copy, so a tilt-lab change
  now has to be re-copied into a *different project* to reach the site.

What the move breaks, documented rather than refactored (Jonah is addressing the site
separately, so fixing these is explicitly out of scope):

- `sidecoach/src/dogfood-craft-step2.ts:10` and `sidecoach/src/dogfood-teach-step1.ts:8`
  both hard-code `/Users/spare3/Documents/Github/improv/marketing-site`, which no longer
  exists. Sharper than a dead path: `dogfood-teach-step1.ts:14-15` calls `mkdirSync` when
  the path is missing, so running it silently RECREATES an empty `marketing-site/` inside
  this repo instead of failing loudly.
- `TASKS.md:14` still heads a `## marketing-site` area (incl. T-0043 re: its DESIGN.md).

These are recorded as finding 11 on the page. Findings count 10 -> 11; component count
stays 16 (the node was reclassified, not deleted - external nodes are still counted, as
cmux already is).

## The five classes

**Foundation** - everything stands on these. `claude-harness` (CLAUDE.md, 60+ hooks,
18 skills, settings.json), `install.sh` (+bootstrap.sh, sole deploy path, 137KB),
`beats` (memory/retrieval engine), `cmux` (EXTERNAL BINARY), `.claude/memory`
(the data substrate, ~880 beats).

**Tool with dependents** - consumed by something else in the tree. `sidecoach` (the
most-wired application: 4 hooks + parity contract + design gate), `justify` (MCP
daemon :9223/:9224, consumed by 7 marketing-site pages + 3 hooks), `tilt-lab` (Vite
workbench :5180, runtime vendored byte-for-byte into marketing-site).

**Leaf consumer** - nothing depends on these. `marketing-site` (:4830, consumes
justify + vendored tilt-runtime), `reference` (:4831, docs manual, consumes nothing
at runtime).

**Standalone** - own column, no edges. `lotus` (Figma plugin + :9527 bridge; launcher
skill only, nothing consumes its output), `ghostty`+`shaders`, `docs/superpowers`
(87 files, zero live references), `assets`.

**Supportive** - attach to a parent. `beats/bench` -> beats; `beats/mcp-server` ->
beats (INERT, deliberate); `sidecoach/mcp-server` -> sidecoach (INERT BUT
PARITY-BOUND); `bin` -> tilt-lab/cmux; `public` -> justify (LEGACY build artifact);
skills launchers -> tilt-lab/lotus/sidecoach.

**Islands** (red-flagged, not a class - a state): `test-site-1` (dead since
2026-05-25, zero edges in or out beyond name-mentions) and `cmux/settings.json`
(legacy since 2026-04-11, 100% commented-out, yet install.sh still symlinks it).

## Key runtime edges (evidence)

- settings.json -> beats hooks -> beats/beats.py [`beats-rebuild.sh:43`]
- claude/settings.json -> sidecoach-sessionstart.sh -> sidecoach daemon [`:8,21`]
- settings.json mcpServers -> justify server [`settings.json:601-603`]
- marketing-site 7 pages -> justify :9223 [`index.html:28`]
- marketing-site -> vendored tilt-runtime.js [`index.html:623`, byte-identical 2,463,252B]
- install.sh -> every component [`install.sh:2790,2800,2811,2886,2181`]
- hooks x10 -> cmux binary
- beats/bench -> beats.py [`score.py:50`]
- sidecoach tests -> reference/DESIGN.md; sidecoach dogfood -> marketing-site (absolute paths)
- ghostty -> shaders [`config.ghostty:25`]

## The 11 open findings

1. `install.sh:364` points at `ghostty/shaders`, which does not exist (real path:
   top-level `shaders/`); the TUI "open directory" for shaders silently fails.
2. `.justify` marker still references the pre-rename `/public/improv-core.js`.
3. `public/justify-core.js` is tracked in git despite `.gitignore:5` - the ignore
   never took effect because the file was committed before the rule was written.
4. `~/.claude/skills/improv/SKILL.md` is deployed with no source - an orphan from the
   rename that install.sh will never clean.
5. `sidecoach/mcp-server` is built but wired to nothing; the only thing keeping it
   alive is the parity contract in `sidecoach_lanes.py` bound to its keyword-resolver.ts.
6. `beats/mcp-server` is deliberately inert (install hint only). Not a bug.
7. The marketing site is NOT static: 7 of its pages hard-code
   `http://localhost:9223/justify-core.js`, so they degrade whenever justify is down.
8. `sidecoach-sessionstart.sh:4` hard-codes an absolute `/Users/spare3` path - the one
   hook that breaks on any other machine (the beats hooks derive their root correctly).
9. `reference/serve.py` is a copy of marketing-site's with the same default port 4830 -
   only convention keeps the two sites from colliding.
10. cmux is the highest-risk dependency: an external, unpinned binary with 10 in-repo
    consumers. If its CLI changes, ten hooks break at once and the repo cannot fix itself.
11. (2026-07-13) The sidecoach dogfood scripts and the TASKS.md marketing-site area now
    point at a path that left the repo: `dogfood-craft-step2.ts:10` and
    `dogfood-teach-step1.ts:8` hard-code `/Users/spare3/Documents/Github/improv/marketing-site`,
    and `TASKS.md:14` still heads a `## marketing-site` area. Documented dead references,
    deliberately left pending the separate site workstream. Worse than a clean break:
    `dogfood-teach-step1.ts:14-15` calls `mkdirSync` on the missing path, so running it
    silently RECREATES an empty `marketing-site/` in this repo instead of failing loudly.

## Spot-checks performed

Findings 1, 7 and 8 were re-verified against the tree before shipping (the rest came
from the lead's evidence sweep). `ghostty/` contains only `config.ghostty`;
`index.html:28` does hard-code the localhost justify URL; `sidecoach-sessionstart.sh:4`
does hard-code `/Users/spare3` while `beats-rebuild.sh:43` derives `$REPO_ROOT` - the
portable pattern is known in-repo and simply was not applied to that one hook.
