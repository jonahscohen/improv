---
name: bash-guard verify-gate false-blocked non-UI commits - fixed
description: The bash-guard commit verification gate required browser verification for ALL .ts/.js source, so it false-blocked every backend/CLI/hook/engine commit (no UI to verify). Narrowed it to genuinely front-end files (UI extensions, or plain JS/TS under a front-end path). Jonah hit it committing the sidecoach engine + hooks.
type: reference
relates_to: [session_2026-06-26_codex-gate-claude-fallback.md]
---

Collaborator: Jonah. 2026-06-27. "Fix that guard so it doesn't fire mistakenly again."

## THE FALSE BLOCK
`git commit` of the sidecoach engine/CLI/hook work was BLOCKED: "code was deployed but not
verified in the browser." Root cause: claude/hooks/bash-guard.sh verification gate (gated on
~/.claude/.needs-verification) classified ANY .ts/.tsx/.js/.jsx/.css/.scss + dist/*.js as
"source code -> require browser verification." Backend/CLI/hooks/engine code (plain .ts/.js,
.sh) is NOT browser-renderable, so the gate fired on commits with nothing to look at. The
block also caught my own grep that merely CONTAINED the string "git commit".

## THE FIX (claude/hooks/bash-guard.sh, lines ~52-60)
Narrowed the "require verification" set to genuinely FRONT-END files:
- UI extensions: tsx, jsx, css, scss, sass, less, vue, svelte, astro, html. -> NEEDS-VERIFY.
- Plain ts/js/mjs ONLY under a front-end path (marketing-site|reference-site|components|pages|
  views|ui|widgets). -> NEEDS-VERIFY.
- Everything else (plain .ts/.js in src/ or bin/, .sh hooks, .py, scripts, tests, dist output)
  -> EXEMPT. The gate keeps protecting real UI commits; it no longer false-fires on non-UI.
Live: ~/.claude/hooks/bash-guard.sh is symlinked to the repo, so the fix took effect immediately.

## VERIFIED
- bash -n clean; live symlink confirmed.
- Classified the staged sidecoach files (audit-rendered.ts, sidecoach-present.js, daemon.sh,
  dist/*.js, claude-surface.sh, run-tests.ts) -> ALL exempt.
- Control: marketing-site/styles.css, components/Card.tsx, app/ui/widget.js -> still NEEDS-VERIFY.

## Files touched
- claude/hooks/bash-guard.sh (verification-gate file classification narrowed to front-end)
</content>
