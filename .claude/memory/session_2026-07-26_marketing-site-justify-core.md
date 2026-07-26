---
name: Marketing site justify-core.js graceful-degrade
description: 6 improv-site marketing pages hard-loaded a localhost:9223 daemon script that broke the console when the Justify daemon was down; replaced with an opt-in self-hosted loader so the static site never contacts the daemon on a normal load
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: browser + codex-review
confidence: high
---

# Marketing site: Justify daemon dependency made graceful

The marketing site MOVED out of the main improv repo to `/Users/spare3/Documents/Github/improv-site` (its own git repo, branch main). Fix landed there; this beat lives in the main improv repo per the beats-here convention.

## Problem

`grep -rl 'localhost:9223/justify-core.js'` matched 7 files: 6 HTML pages plus the `.justify` JSON config. Every one of the 6 HTML pages carried an identical hard `<script>` in `<head>`:

```
<script src="http://localhost:9223/justify-core.js?v=5"></script>
```

That script is the Justify in-browser design toolbar (served by the `justify-serve` daemon on port 9223). It is a development-time enhancement, NOT a runtime dependency of a marketing page. When the daemon is down (the normal state for a static site) the browser logs a failed request to the console, and an `onerror` handler cannot suppress that browser-level network error. A marketing site must render standalone.

The 7 matched files:
- Pages fixed (had the hard `<script src>`): `index.html`, `beats.html`, `foundation.html`, `justify.html`, `sidecoach.html`, `reference.html`
- `.justify` - JSON daemon config (`{"stack":"generic","source":"server","url":"http://localhost:9223/justify-core.js",...}`). NOT a browser page and never fetched by the browser, so it causes no console error. Left untouched (it is the justify CLI's own wiring record). Noted as a residue of the pre-move state.

Confirmed no page had a code-level dependency on any justify global (grep for `window.justify` / `justifyCore` / `__justify` etc. = none). Pure optional overlay.

Two other HTML files (`demo.html`, `sidecoach-demo.html`) never referenced the daemon (0 occurrences) - they were already clean and were left alone.

## Fix approach: graceful-degrade via an opt-in self-hosted loader

Why: **Graceful-degrade over self-host.** The toolbar's whole job is to talk to the local daemon, so bundling the ~2MB core as a static asset would still not work without the daemon - worse than gating. The pages function fully without it, so the graceful path is correct.

Why gate (opt-in) instead of `onerror`: a plain `<script src="http://localhost:9223/...">` with `onerror` STILL emits a browser-level `net::ERR_CONNECTION_REFUSED` to the console when the daemon is down - `onerror` only gives JS a callback, it does not suppress the browser's own logging. The only way to guarantee ZERO console errors on a normal static load is to make no request at all unless explicitly opted in.

How: new self-hosted `justify-loader.js` (same-origin, so it can never 9223-error). It injects the daemon `<script>` ONLY when opted in:
- `?justify=1` (or `?justify` bare) enables and persists to `localStorage["justify:enabled"]`.
- `?justify=0` / `false` / `off` disables and clears the flag.
- No query param -> read the persisted flag; default is OFF.
- Opted-in-but-daemon-down degrades silently via `onerror` (a single `console.info`, no throw).
- All `localStorage`/`URLSearchParams` access wrapped in try/catch so `file://` contexts fall back to OFF safely.

Each of the 6 pages had its hard daemon line replaced with:
```
<script src="justify-loader.js" defer></script>
```

The two prose/code mentions of port 9223 (`justify.html:203`, `reference.html:136`) are marketing copy describing how Justify works - correctly left in place (not script loads).

## Verification (browser, daemon was actually UP)

The task assumed the daemon was down; it was actually up (HTTP 200, PID 5029, shared process running since Monday - deliberately NOT killed). This did not weaken the proof: the fix decouples the default load entirely, which is stronger than graceful down-handling - a normal visit never contacts the daemon, so its up/down state is irrelevant.

Served via `serve.py` on port 4831, driven with a real browser (screenshots read):
- **index.html (default)**: renders (hero "Build the scene with Improv"), console zero errors, network log shows ZERO requests to `:9223`.
- **justify.html (default)**: renders (hero "Tweak the page. Claude writes the code."), console zero errors, zero `:9223` requests. Notable: this page contains "port 9223" in prose and that text correctly triggers no request.
- **index.html?justify=1 (opt-in)**: gate opens - real `GET http://localhost:9223/justify-core.js?v=5 -> 200 OK` plus the toolbar's own resource calls, and the Justify "&" spark toolbar appears bottom-right. Proves the fix is a gate, not a removal.
- **index.html?justify=0 (opt-out)**: toolbar removed, flag cleared, console clean.

Cross-model review: Codex (codex-cli 0.142.5) reviewed the full diff. No concrete bugs in the loader or the 6 pages; loader syntax clean; normal path returns before creating any daemon request. One LOW finding (demo.html / sidecoach-demo.html do not load the opt-in loader) is OUT OF SCOPE - those two never referenced the daemon, never had the bug, and do not break when it is down. Adding opt-in toolbar capability to them would be gold-plating. Optional follow-up only.

## Committed

Committed in the improv-site repo (not the main improv repo). No lead integration needed for the fix itself.

## Files touched (all in /Users/spare3/Documents/Github/improv-site)
- `justify-loader.js` (NEW) - opt-in self-hosted loader
- `index.html`, `beats.html`, `foundation.html`, `justify.html`, `sidecoach.html`, `reference.html` - daemon `<script src>` replaced with the loader
- `.justify` - inspected, left untouched (daemon config, not a page)
