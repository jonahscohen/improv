---
name: Improv build and delivery pipeline investigation
description: Full trace of how edits to improv source reach the browser - identified 5 breakpoints in the pipeline
type: reference
relates_to: [feedback_improv_dist_is_source_of_truth.md, session_2026-05-04_improv-manipulate-reference-tool.md]
---

Collaborator: Jonah

## Investigation: Why improv edits don't reliably reach the browser

Full pipeline traced from TypeScript source to browser-loaded script.

### Pipeline steps identified

1. **Source** (repo `improv/core/*.ts`, ~471KB total) -> `build.js` (esbuild, IIFE, minified) -> repo `improv/dist/improv-core.js` (147KB)
2. **Installer** (`install.sh`) -> copies source + dist to `~/.claude/improv/`, runs `node build.js` fresh
3. **MCP server** (`~/.claude/improv/dist/server/index.js`) -> serves `~/.claude/improv/dist/improv-core.js` over HTTP on port 9223
4. **Per-project init** (`improv-init`) -> copies `~/.claude/improv/dist/improv-core.js` into project's public dir as a STATIC FILE
5. **Browser** loads the static file copy from the project's dev server, NOT from localhost:9223

### Breakpoints found

1. **CRITICAL: Source vs dist are diverged.** The repo source files (core/) were last modified May 4-5. The dist was rebuilt May 12. But the installed copy at `~/.claude/improv/core/` is MISSING files that exist in the repo source: apply-confirmation.ts, box-model.ts, handles.ts, icons.ts, state-toggle.ts. The installer ran `cp -r` but the installed core/ is stale from an earlier install that predates those files being added.

2. **CRITICAL: Per-project copies are stale.** Every project has its own copy of improv-core.js (static file), and ALL FOUR are different md5s from the current dist:
   - Repo dist: 40ef3413 (May 12)
   - Installed dist: 40ef3413 (May 12) - matches repo
   - dishplayscapes: 23f7a3b1 (May 11) - STALE
   - claude-dotfiles/public: 52678c8f (May 7) - STALE
   - glass-test/docroot: 38f44310 (May 7) - STALE
   - blueprint-tracker/public: a31331e4 (May 8) - STALE

3. **No auto-update mechanism.** When the dist is rebuilt, per-project copies are NOT updated. Each project loaded its copy via `improv-init` at init time and never again.

4. **Server serves file but browser doesn't use it.** The MCP server serves improv-core.js at `http://localhost:9223/improv-core.js` (via readFileSync, no caching), but projects reference the LOCAL static copy via `<script src="/public/improv-core.js">` or wp_enqueue_script, NOT the server URL. The server endpoint is unused by the browser.

5. **Build is forbidden.** Per `feedback_improv_dist_is_source_of_truth.md`, we must NEVER run build.js because the dist has hand-edited work not reflected in source files. This means the build pipeline is effectively broken - source can't be the input.

### How each project loads improv

- blueprint-tracker: `<script src="/public/improv-core.js?v=3">` in index.html (static copy, cache-busted manually)
- dishplayscapes: wp_enqueue_script loading `/improv-core.js` from WP root (static copy)
- glass-test: static copy in docroot/ (no reference found in templates - may be loaded manually)
- claude-dotfiles: static copy in public/ (generic init)

### What would need to happen to propagate a change

1. Edit dist/improv-core.js directly (since build is forbidden)
2. Copy to ~/.claude/improv/dist/improv-core.js (or re-run installer)
3. Run `improv-init` in EVERY project that uses improv, OR manually copy the file
4. Hard-refresh the browser (no cache-control headers, but browser may cache)

### Root cause summary

The pipeline has a "copy on init, never update" design. There is no symlink, no server-based loading, and no file watcher. Every layer is a snapshot that diverges immediately after creation.

## Files examined

- improv/build.js
- improv/install.sh
- improv/server/index.ts
- improv/server/ws-server.ts
- improv/cli/init.sh
- improv/cli/remove.sh
- improv/core/index.ts
- improv/core/transport.ts
- ~/.claude.json (MCP server registration)
