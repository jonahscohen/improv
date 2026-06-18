---
name: Justify fixes - never-forget queue, headless durability, click-to-locate
description: id-scoped clear (no dropped tasks), headless response persistence, and click-a-change scrolls+selects its target
type: project
relates_to: [decision_improv_http_polling_watch.md, session_2026-06-15_justify-real-diff-panel.md, session_2026-06-10_justify-watch-forever-loop.md]
---

Collaborator: Jonah

Three Justify defects Jonah hit (issues #1-#3; #4 = content-guard spinner, separate beat).

## #3 - Justify forgot fired tasks (the big one)
Root cause: `POST /prompts/clear` wiped the ENTIRE prompts.json, and `justify-done`
called it after every single task. Race: user fires tasks 2-5 while Claude is working
task 1; the first `justify-done` clear erases 2-5 from the queue -> never seen, forgotten.
Fix:
- ws-server `/prompts/clear` is now id-aware: body `{"ids":[...]}` or `{"id":"..."}` removes
  ONLY those handled prompts; empty body keeps clear-all for back-compat.
- `justify-done.sh` posts `{"ids":["<PID>"]}` - clears just the task it answered.
- SKILL.md loop: "handle EVERY prompt in the inbox, one justify-done per id; tasks that
  arrived while you worked stay queued and the next justify-watch picks them up; never drop one."

## #2 - watcher "complains about being headless"
There was no literal "headless" string; the failure was that `/respond` ONLY broadcast to
connected clients, so a result produced while no tab was connected vanished, and the SKILL
told Claude to hard-stop the watch when `connections==0`. Fixes:
- ws-server `/respond`: when `manager.size()===0`, append the response to responses.json
  (`appendResponseFile`) so it surfaces in the Changes panel the instant a tab (re)connects.
  When a client IS connected it owns the history write, so we skip to avoid double-append.
- SKILL.md "watch justify" precheck: `connections==0` is NOT a stop condition - run headless,
  keep all functions, don't refuse.

## #1 - clicking a change must scroll to + select its object (never review blind)
Root cause: clicking a Changes entry called `onSelect(entry.changes.map(selector))`, but
real-diff results carry `diffs` with NO per-change selectors, so selectors was empty and
nothing happened; and even when selectors existed, `onSelect` only drew a highlight box and
never scrolled. Fix threads the target selector end-to-end:
- prompt/index.ts `submitPrompt`/`submitFromQueue`: add structured `selectors` (the selected
  element selectors) to the push_prompt payload.
- mcp-tools.ts `push_prompt`: persist `selectors` on the stored prompt.
- ws-server `/respond`: join the original prompt by promptId and attach its selectors as
  `targetSelectors` on the broadcast/persisted response (explicit body `targetSelectors` wins).
- changes-panel.ts: `ChangeEntry.targetSelectors`; click handler unions per-change selectors
  with `targetSelectors`.
- index.ts `setOnSelect`: scrollIntoView({block:'center', smooth, reduced-motion aware}) the
  first resolvable target. DELETED target: walk the descendant selector path up to the nearest
  still-present ancestor, scroll there, and mark it with a DASHED box labelled "removed near <sel>".

## Verification (deterministic, isolated WsServer on a temp dir, 0 clients)
- #3: seed [p1,p2,p3]; clear {ids:[p2]} -> /prompts == [p1,p3]. PASS
- #2: respond with 0 clients -> responses.json has 1 entry, reviewed:false. PASS
- #1: respond to p1 with changes:[] (diff-only) -> entry.targetSelectors == ["\.hero \.cta"]
  (joined from the prompt). PASS
- Live daemon restarted; serves new bundle (targetSelectors present); id-clear endpoint
  accepts a body and left the empty queue untouched. PASS
- Server tsc clean; `node build.js` clean; deployed to ~/.claude/justify + public/justify-core.js.
- Client-side scroll/highlight (the actual in-browser click->scroll) is NOT visually e2e-verified:
  it needs a real submit->respond->click in a RELOADED tab, and the real-input-only validation
  rule forbids synthesizing those events. Open tabs must reload to load the new core.

## Self-analysis
The forget-bug had been latent because the single-task happy path never exposed it; only
async multi-fire does. Lesson re-confirmed: a "clear the queue" convenience that isn't scoped
to the unit of work is a data-loss bug waiting for concurrency.

## Harness bug to flag
install.sh writes the justify SKILL.md from a STALE inline heredoc (the old MCP-session model),
but the live ~/.claude/skills/justify/SKILL.md is the current HTTP-daemon model. Re-running
install.sh would clobber the good skill. The repo has no standalone justify SKILL.md source.

Files: justify/server/ws-server.ts, justify/server/mcp-tools.ts, justify/core/prompt/index.ts,
justify/core/changes-panel.ts, justify/core/index.ts, justify/cli/justify-done.sh,
~/.claude/skills/justify/SKILL.md; rebuilt dist + public/justify-core.js.
