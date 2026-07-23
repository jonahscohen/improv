# GUI installer (browser-based, one-click) design

Authored against commit `84432079`. If HEAD has moved when you execute this, re-verify the current-state claims below (paths, function names, the `_AMPERSAND_*` env contract, `browser-tree.json` shape) before acting on them.

Collaborator: Jonah

## Problem

The default install surface is the gum-based bucket-browser TUI, reached via `curl ... | bash`. A team can be wary of two things about that: a full-screen terminal UI that takes over the shell, and piping an unseen remote script straight into bash. They want a more "visually secure" way to install that keeps the project's a-la-carte component ideology (pick the houses you want, everything else is a no-op) fully intact, and that fits a Claude Desktop / GUI world rather than a raw CLI.

The installer already ships non-TUI, auditable paths (`git clone` then `./install.sh --dry-run`, `--only KEYS`, `--preset NAME`). This spec covers the additional deliverable the user chose: a real browser-based GUI that renders the components visually, runs the install with one click through a local server, and shows a live log, so "one-click" still means "you see exactly what runs."

## Decisions locked during brainstorming

- Execute model: one-click run via a tiny local server (not emit-command-only). Security is preserved by construction (localhost-only, explicit launch, nonce, allowlisted picks, argv-not-shell, visible command + streamed log).
- Component list source: `install.sh` emits a JSON manifest; the server calls it at launch and serves it to the page. Single source of truth = `install.sh` + `browser-tree.json`, so the GUI cannot drift.
- Launch: a new `--gui` flag on `install.sh`; `ampersand --gui` works for free because `ampersand` forwards flags.

## Current-state grounding (verified at `84432079`)

- `claude/hooks/browser-tree.json` is the single source of truth for the bucket/group structure (buckets to members to hooks), with per-node `key`, `tag`, `desc`, `section`, `label`, and a `personal` flag.
- `claude/hooks/browser-lib.sh` holds pure accessor functions over that tree (`item_state`, counts, `_br_is_personal`), already used by the TUI and by the `--help` component generator.
- `install.sh` carries the component metadata as parallel bash arrays: `KEYS` (14 public keys: brain, config, memory, skills, statusline, cmux, nvm, ampersand, discord, voice-input, voice-output, reflect, sidecoach, task-list), `TITLES`, `DESCS`, `FILES`, `DIRS`, `PICKS`.
- The `--help` block already walks `browser-tree.json` with `python3` to emit the grouped component list. The manifest emitter mirrors that walk to emit JSON instead of text.
- Per-component removal exists: `deactivate_brain`, `deactivate_config`, `deactivate_memory`, `deactivate_skills`, `deactivate_voice`, `deactivate_discord`, `deactivate_voice_output`, plus `deactivate_cluster` / `deactivate_app_hooks` for hooks.
- `component_browser()` is the interactive apply engine. The headless install contract is `--only KEYS` plus the `_AMPERSAND_HOOK_ON` / `_AMPERSAND_HOOK_OFF` env vars (per-hook on/off), seeded from `_AMPERSAND_*`. The GUI server drives this same engine rather than reimplementing apply.
- An existing HTML prototype, `docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html`, is a complete client-side bucket browser (tree nav, drill-in, per-item toggle, staging, apply, install-all/uninstall-all, update banner). It is a mock: the tree `T`, `HOOK_DESC`, `CLUSTERS`, `HOOKS` are hardcoded in JS, install state is faked via `seed(...)`, and apply/quit only toast "prototype - nothing happens." The page is the reusable visual layer; the build wires it to real data and real actions.

## Architecture

Three layers. The GUI is a thin front-end over the installer core that already exists. What gets installed does not change, only the surface it is driven from. The TUI, the CLI flags, and the GUI become three doors to one apply engine.

```
Browser page  <-- GET /manifest, POST /dry-run, POST /apply (streamed), POST /shutdown -->  Local server  <-- --manifest, shared apply engine (_AMPERSAND_HOOK_ON/OFF, --only) -->  install.sh core --> browser-tree.json
```

1. Browser page (adapt the prototype).
2. Local server (new, python3 stdlib).
3. install.sh core (already exists, plus one `--manifest` emitter and the `--gui` launcher).

## Build units

### Unit 1: `install.sh --manifest`

- Emits JSON to stdout, no side effects, no TTY dependency (like `--dry-run`, it is safe to call from a subprocess).
- Content: the bucket tree from `browser-tree.json`, enriched with `TITLES`/`DESCS`/`FILES` per public component, plus a `state` map giving each leaf/component `active | partial | none` from the same detection the TUI uses (`browser-lib.sh` `item_state`/counts). Respects the `personal` gate exactly as the TUI does (personal buckets only appear when personal is requested).
- Manifest contract (shape, not final field names):
  - `buckets`: array mirroring `browser-tree.json` order, each with `key`, `label`, `tag`, `desc`, `section`, `members[]`.
  - `components`: map of public key to `{ title, desc, files[] }`.
  - `state`: map of path (e.g. `Beats/memory`) to `active | partial | none`.
  - `meta`: `{ personal: bool }` and, later, version/rev fields (deferred, see Scope).
- Degrades exactly as `--help` does: if `python3` is missing or the tree does not parse, print a clear error to stderr and exit non-zero so the server can surface it (the GUI cannot function without the manifest, unlike `--help` which falls back to a static hint).

### Unit 2: `install.sh --gui`

- Starts the local server (Unit 3), prints the URL, opens the default browser with `open <url>` on macOS.
- `ampersand --gui` works without extra wiring because `ampersand` forwards every non-consumed flag to `install.sh`.
- Foreground process. Ctrl-C stops it; an in-page Quit hits `POST /shutdown`.
- Parsed in the same arg loop as the other flags; documented in `--help`.

### Unit 3: the local server (new)

- Implementation: `python3` standard library only (`http.server` + a small handler), no pip installs. Matches the repo's existing `serve.py` no-cache pattern and the "no new dependencies" ideology. Lives at a fixed path, e.g. `claude/installer-gui/server.py`, with the page beside it.
- Bind: `127.0.0.1` only, ephemeral port (bind port `0`, read back the assigned port), never `0.0.0.0`.
- Auth: a one-time nonce minted at launch, embedded in the opened URL (`?token=...`), required on every request that mutates or reveals state. `Origin` and `Host` headers checked against the local bind. This blocks other localhost processes and CSRF.
- Endpoints:
  - `GET /` serves the page.
  - `GET /manifest` shells out to `install.sh --manifest` and returns its JSON.
  - `POST /dry-run` body `{ on: [keys], off: [keys] }`, runs `install.sh --dry-run` with the corresponding `--only` / `_AMPERSAND_HOOK_OFF`, returns the resolved-picks text.
  - `POST /apply` same body, runs the shared apply engine, streams stdout+stderr back to the page (chunked response or SSE) so the log is live.
  - `POST /shutdown` stops the server.
- Command safety: every key in `on`/`off` must match `^[a-z0-9-]+$` and be a member of the manifest allowlist before it is placed into the argv. Subprocess is invoked with an argv list, never `shell=True`, so shell injection is not expressible. The exact argv is echoed into the streamed log.
- Lifecycle: single install session. The server exits on `/shutdown`, on Ctrl-C, and MAY self-exit after a completed apply once the client acknowledges (keep it simple: explicit shutdown is enough for v1).

### Unit 4: the page (adapt the prototype)

Copy `2026-07-16-installer-bucket-browser-prototype.html` to the server's static dir and change exactly three things:

1. Data: replace the hardcoded `T` / `HOOK_DESC` / `CLUSTERS` / `HOOKS` with a `fetch('/manifest')` at load, building the same in-memory tree the render code already consumes.
2. State: replace the `seed(...)` fake install state with the manifest `state` map, so glyphs (active/partial/none) reflect reality.
3. Apply: replace the no-op `applyPending()` with a `POST /apply` (nonce attached) that opens a live-log panel and appends the streamed output; on completion, re-fetch `/manifest` to refresh state. Wire Quit to `POST /shutdown`.

Everything else (keyboard nav, drill-in, staging, install-all/uninstall-all, the detail line) already works and is kept. Aesthetic: keep the terminal-window prototype look for continuity with the TUI it replaces.

## Security posture (the "visually secure" contract)

- Localhost-only bind, ephemeral port, explicit user launch (no daemon).
- One-time nonce on every request; Origin/Host verified.
- Picks allowlisted and regex-guarded server-side; argv-list subprocess, never a shell string.
- The exact command is shown in the page and echoed in the streamed log: one-click still means you see precisely what ran.
- Only ever calls `install.sh`, whose sections are idempotent and marker-undoable.

## Scope

In v1:
- `--manifest`, `--gui`, the local server, the adapted page.
- Install and toggle-off for the public components, driven through the shared apply engine (`--only` for on; `_AMPERSAND_HOOK_OFF` and the `deactivate_*` functions for off). If the off-set for whole components is not reachable through the existing headless contract, add one small headless apply/off entry to `install.sh` that reuses the existing `deactivate_*` functions (no reimplementation of removal).

Deferred (explicitly out of v1):
- The "update available / re-sync to latest rev" banner (the prototype fakes it; real git-rev comparison is a follow-up).
- The `--personal` bucket surfacing in the GUI (gate identically to the TUI when added).
- Bootstrap-level `curl ... | bash -s -- --gui` for brand-new machines (an add-on to `--gui`, not a replacement).
- A cleaner "web app" restyle away from the terminal-window aesthetic.

## Testing / verification

- Manifest parity: for a fixed set of picks, the manifest keys and `state` agree with `--help` and `--dry-run`.
- Injection guard: a `POST /apply` carrying a non-allowlisted key or a shell-metacharacter key is rejected before argv construction (unit test on the validator).
- Dry-run parity: a dry-run through the GUI yields the identical resolved-picks set as the same picks on the CLI.
- End-to-end: one real install of a small component (e.g. `task-list`) driven from the browser, then verified in-browser per the verification protocol (open the page, drive the real toggle and apply with real input, read the streamed log and a screenshot, confirm the component landed on disk). Then toggle it back off and confirm removal.
- Nonce: a request without the nonce (or with a stale one) is refused.

## Open questions for the plan stage

- Exact manifest field names and whether `state` is keyed by path or by component key.
- Whether `--only` alone can express a whole-component off-set or a new headless off entry is required (determines whether Unit 1/3 needs a matching `install.sh` change).
- Streaming transport: chunked `Transfer-Encoding` vs SSE for the live log.
