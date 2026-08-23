---
name: Justify highlight is now CLICK-DRIVEN + cross-page navigate-then-highlight (built, unit+Codex verified, NOT deployed)
description: Removed auto-highlight-on-refresh; highlight only fires on a Review-panel task click; a different-page task navigates there first then highlights. pageUrl threaded browser->server->response->entry.
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests + codex
confidence: high
---

Jonah's request: Justify auto-highlighted changed elements (orange outline + selector tooltip) on EVERY page refresh, alongside the Review Changes button. Wanted: (1) STOP the auto-highlight on refresh; (2) highlight ONLY when the user clicks a task in the Review panel; (3) if the clicked task's change is on a DIFFERENT page, navigate there first, THEN highlight (a progress-showing affordance).

**ROOT of the refresh highlight:** on a completed response the core stashed the target selectors in sessionStorage `justify:locate` and re-applied them (`_locateAndSelect`) after the mandatory hot-refresh - so the orange selection reappeared on every reload. (core/index.ts justify_response handler + the on-load relay.)

**WHAT CHANGED (7 files, justify/):**
- Part A (stop auto-highlight): removed the completed-response auto-locate + the `justify:locate` auto-stash. Nothing stashes the relay automatically now, so the highlight never returns on a plain refresh. Removed two now-dead methods (`_highlightChangedElements`, `_changeSelectors`).
- Part B (click-driven + cross-page): highlight is driven only by the Review-panel row click (`onSelect`). Threaded a new `pageUrl` field the SAME route `selectors`/`targetSelectors` already travel: browser send (core/prompt/index.ts, both submit paths, `pageUrl: window.location.href`) -> prompts.json record (server/mcp-tools.ts + QueuePrompt types in mcp-tools.ts & dispatcher.ts) -> `emitResponse` joins `orig.pageUrl` onto the response (server/ws-server.ts, mirrors the targetSelectors join; explicit input wins; '' for old records) -> `ChangeEntry.pageUrl` (core/changes-panel.ts) -> row-click passes `entry.pageUrl` to the host.
- Decision engine `core/same-page.ts` (NEW, pure/testable): `decidePageNav(pageUrl, currentHref)` -> `highlight` (same origin+pathname; query = same page) | `{hash}` (same doc, different hash -> hash-router route: set `location.hash`, highlight after 400ms, no reload) | `{navigate, href, relay}` (different document; `relay` true ONLY same-origin). `isSamePageUrl` validates ARRIVAL for the on-load relay.
- Host wiring (core/index.ts `setOnSelect`): navigate branch stashes `{selectors, target}` in `justify:locate` ONLY when same-origin (sessionStorage is origin-scoped); cross-origin navigates without a relay (lands the user there). The on-load relay parses `{selectors, target}` and highlights ONLY if `isSamePageUrl(target, current)` confirms we arrived - so a stale/cross-origin/old-bare-array/hand-mutated key is dropped one-shot and can NEVER re-fire a highlight on an unrelated refresh.

**CODEX (3 rounds, real Codex 0.142.5, all folded):**
- R1: P1 cross-origin relay left a stale key that re-fired on refresh (reintroduced the bug); P2 hash-routed SPAs treated as same-page; P3 relay consumed any stale key. FOLDED via decidePageNav + same-origin-only relay + arrival validation + hash-route path.
- R2: two edge cases - malformed stored target still fired once (isSamePageUrl catch returned true); hash condition missed hashless-target-from-hashed-current. FOLDED: catch -> false; condition -> `target.hash !== here.hash`.
- R3: CONFIRMED both resolved, "No remaining correctness issue... Shippable."

**VERIFICATION:** core + server build clean; full suite 319 passed (was 306) - 13 new (`respond-parity` pageUrl join/precedence/back-compat; `cross-page-highlight` decidePageNav 4 outcomes incl hash + relay flag, and isSamePageUrl arrival guard). The pre-existing outbox "retries forever" test still logs expected stderr; unrelated.

**DEPLOY + LIVE-VERIFY (Jonah chose "publish now, confirm in browser"):**
- CORE deployed: `deploy.sh --core-only` synced dist/justify-core.js to ~/.claude/justify/dist (file sync only, NO daemon restart - verified deploy.sh does not touch the running daemon). Daemon confirmed serving the new bundle (decidePageNav present in the served /justify-core.js); drain untouched (pending stayed 15).
- PART A VISUALLY CONFIRMED LIVE: opened Ethos (localhost:3000, HTTP 200) in a fresh browser tab, hard-reloaded with the new core. The sidebar (WAYS OF WORKING, ClickUp/Agency/WMJ WoW, etc.) - exactly the elements Jonah's screenshot showed auto-highlighted on refresh - is now CLEAN, no orange outlines/selector tooltips. Two reloads, both clean. Tab closed (hygiene).
- PART B same-page click-highlight: deployed (core live) + unit-tested; NOT click-tested live because the shared daemon is mid-work - my tab's bottom-left showed the live "Working..." claudebar (the warden's active/stalled drain surfacing read-only), and driving its Review panel would tangle with that live session. It is an extension of the pre-existing onSelect->_locateAndSelect path, not a rewrite.
- SERVER half (pageUrl join for cross-page nav) NOT live: it needs a daemon restart, and the daemon is armed on /Users/spare3/Documents/Github/ethos/web STALLED with 15 pending + the Ethos warden actively working. Restarting mid-stall could interrupt it. DEFERRED until Ethos is clear. Until then, cross-page nav falls back to in-place highlight (existing changes have no pageUrl anyway). New changes made after the restart will carry their page and navigate.

**KNOWN LIMITATIONS (documented):** hash-route highlight waits a fixed 400ms for the SPA to settle (no route-settled signal); a path-routed page that happens to carry a hash (anchor) will get its hash cleared on a same-page click before highlighting; cross-origin changes navigate but cannot carry the highlight (origin-scoped storage).

Files: core/index.ts, core/prompt/index.ts, core/changes-panel.ts, core/same-page.ts (new), server/mcp-tools.ts, server/dispatcher.ts, server/ws-server.ts, __tests__/server/respond-parity.test.ts, __tests__/core/cross-page-highlight.test.ts (new). Built to dist/ locally; NOT synced to ~/.claude/justify/dist.
