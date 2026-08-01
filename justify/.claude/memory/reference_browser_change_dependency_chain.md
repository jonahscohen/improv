---
name: Every improv-owned dependency exercised when a change is sent from the browser
description: Full start-to-finish trace of the justify send path - the injected bundle, the transport, the daemon and its twelve server modules, the state files, both dispatch routes, the improv hooks that fire on the worker's edits, and the response path.
type: reference
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: traced from source and from the deployed tree, not from memory - deployed inventory listed, live settings and .claude.json read for wiring, worker script read for the dispatch call
confidence: high
---

# Browser change -> done: the improv-owned chain (2026-07-31)

Commit stamp at authoring: 6d0a9925.

## 1. In the page (the injected bundle)

    ~/.claude/justify/dist/justify-core.js      the served bundle (COPIED, can go stale)
    ~/.claude/justify/dist/justify-{react,vue,svelte}.js   framework adapters
    ~/.claude/justify/fonts/, assets/           JustifySans + spark SVGs

Built from `justify/core/`. The modules a send actually touches:

    index.ts              orchestrator, _changeHistory, hot refresh
    prompt/index.ts       prompt mode, selection-follow trackers
    prompt/inline-prompt  the input, clampPromptTop / clampPromptLeft
    selector/picker.ts    element picking
    multi-select          multi-element selection
    overlay.ts            shadow-root host
    transport.ts          WebSocket client
    outbox.ts             localStorage queue, survives a reload
    change-buffer.ts      batches edits
    preview-engine.ts     optimistic local preview
    changes-panel.ts      the review queue UI
    apply-confirmation.ts, toolbar.ts, icons.ts, freeze*.ts, timers-shim.ts

## 2. Transport

WebSocket to the daemon (`core/transport.ts`, default port 9223, resolved to the
port the daemon actually serves). `outbox.ts` persists the queue so a reload or a
disconnect cannot lose a prompt.

## 3. The daemon (long-lived, also the MCP server)

Registered in BOTH `~/.claude.json` and `~/.claude/settings.json` as MCP server
`justify`, entry `~/.claude/justify/dist/server/index.js`. Twelve modules:

    ws-server.js          HTTP + WS, /responses, /responses/clear, broadcasts
    connection-manager.js client registry (its size() gates headless persistence)
    dispatcher.js         claims a Send-All batch, spawns the worker
    watch-state.js        armed / disarmed, claim ledger
    mcp-tools.js          the 17 justify_* tools
    consent.js            permission gating
    source-resolver.js    selector -> source file
    component-scanner.js  component discovery
    styling-detector.js   which styling system is in play
    tailwind-registry.js  tailwind class mapping
    diff-formatter.js     the diffs shown in the panel
    types.js

## 4. State files (`~/.claude/justify/`)

    prompts.json            the queue
    prompt-seq.json         monotonic prompt ids
    responses.json          change history the panel restores from
    responses-cleared.json  clear tombstones (added 2026-07-31)
    served-clients.json     idempotency ledger
    watch-state.json        armed state + claims
    dist/claude-state.json, queue.json

## 5. Reaching Claude, two routes

**Live session:** the model calls the MCP tools - `justify_get_prompts`,
`justify_acknowledge`, `justify_working`, `justify_validating`, `justify_respond`,
`justify_apply_changes`, `justify_get_selection`, `justify_get_layout`,
`justify_get_components`, `justify_get_annotations`, `justify_get_pending_changes`,
`justify_status`, `justify_watch`, `justify_end_watch`, `justify_activate`,
`justify_clear`, `justify_queued`.

**Headless (watch armed):** `dispatcher.js` spawns `justify-worker.sh`, which runs

    claude -p "$PROMPT" --permission-mode bypassPermissions --add-dir "$ROOT"

detached via `perl setpgrp`. That is a FULL second Claude Code process, so it loads
the entire hook layer below.

## 6. improv hooks that fire

Justify's own, from live settings:

    SessionStart      justify-queue-mandate.sh, justify-watch-guard.sh
    UserPromptSubmit  justify-queue-mandate.sh turn, justify-watch-standing-by.sh
    PreToolUse        justify-source-guard.sh  (twice, matchers Bash and
                      Write|Edit|MultiEdit - distinct registrations, both wanted)
    Stop              justify-watch-standing-by.sh, justify-watch-guard.sh,
                      justify-queue-drain-stop.sh

And because the worker is a real Claude Code session, the general layer fires on
every edit it makes: `bash-guard.sh`, `content-guard.sh` / `content-guard-stop.sh`,
`verify-before-done.sh`, `grounding-gate.sh`, `concise-detect-stop.sh`,
`multiple-choice-detect-stop.sh`, and on any `.html`/`.css` write
`sidecoach-craft-floor.sh` plus `sidecoach-taste-gate.sh`.

## 7. Back to the browser

    worker/session -> justify_respond -> ws-server broadcast 'justify_response'
    client pushes onto _changeHistory, POSTs /responses with keepalive:true
    if NO client is connected, ws-server appends server-side instead
    completed -> _previewChanges, _locateAndSelect, then
                 window.location.reload() 1200ms later (_scheduleHotRefresh)
    on load -> GET /responses restores history, minus anything tombstoned

## 8. CLI scripts deployed alongside

    justify-watch.sh, justify-watch-arm.sh, justify-watch-disarm.sh,
    justify-worker.sh, justify-serve.sh, justify-done.sh, justify-working.sh,
    justify-validating.sh, init.sh

## The two copies that can go stale

`dist/` and `dist/server/` are COPIED, not symlinked - 73 real files. The browser
bundle refreshes on a tab reload; **the server half needs a Claude Code restart**,
because the MCP process is spawned once per session. `stale_deploys()` in
browser-lib.sh now surfaces the first case in the installer UI.
