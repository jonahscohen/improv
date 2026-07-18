---
name: Installer GUI front-end page wired to the manifest
description: Task 5 - claude/installer-gui/index.html adapts the bucket-browser prototype to the live manifest + streamed apply
type: project
relates_to: [session_2026-07-17_gui-installer-design.md, session_2026-07-17_installer-gui-server.md, session_2026-07-17_installer-manifest-emitter.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: node-harness
confidence: high
---

Task 5 of the GUI-installer plan (branch gui-installer, on top of d89927b1). Built the front-end page claude/installer-gui/index.html.

What was done:
- Copied the reusable prototype (docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html) into claude/installer-gui/index.html and stripped ALL mock data: HOOK_DESC, CLUSTERS, HOOKS, the hleaf/hookFolder/clusterNode/compHooks/skillLeaves helpers, the hardcoded const T tree, and the entire seed()/seedList() block. applyPending() removed (nothing needed it after rewiring).
- Added TOKEN + api(path,opts): api() appends the token query param (URL-encoded) to every request. The ONLY network fetch in the file lives inside api(), so every call carries the page nonce.
- Wrote buildTreeFromManifest(m) + walkMembers(): builds module-scope T in the exact node shape the prototype's nodeAt/leafPaths/render consume. leaf -> {tag,desc}; kind:hooks -> {folder:1,hooks:1,tag,desc,children:{hook leaves}}; nested -> {tag,desc,children} recurse. Install state set directly from m.state (clear installed, then installed[path] = st==='active').
- KEY correctness point: a bucket with no members (tilt-lab, lotus) is built as a LEAF (no children key), so its single-segment state key stays reachable via leafPaths. Giving it an empty children object would orphan it.
- Added a hidden log pane (pre#log, monospace, max-height 180px, overflow auto) under the .screen div + a specific #log CSS rule (no broad selectors).
- runApply()/stagedPlan(): POST /apply, stream the reader into the log pane, then re-fetch /manifest and rebuild to show REAL post-apply state, clear pending, re-render. Wired both apply entry points (apply row action + a/A keydown) to runApply().
- doQuit(): POST /shutdown (fire-and-forget) then toast "Installer stopped. You can close this tab." Wired to BOTH the quit row action AND the q/Q keydown. Spec only named the quit row branch; rewiring q/Q too was a judgment call because leaving the prototype's stale "Quit (prototype)." toast (no shutdown) would be a defect.
- Replaced the trailing render() with boot(); boot() fetches /manifest, builds, renders, and on failure writes an error into the lead line.
- All prototype nav/staging behavior preserved intact (drill-in, back, install-all/uninstall-all, per-leaf toggle, update/uptodate banner, crumb, detail, footer). All text set via textContent - no HTML-string sinks anywhere.

Verification (node harness, no browser):
- verify-from-file.js EXTRACTS walkMembers/buildTreeFromManifest/nodeAt/isLeaf/leafPaths out of the shipped index.html (brace-matched), requires them, runs against a live `bash install.sh --manifest`. Asserts: (1) T has exactly the 10 manifest bucket keys; (2) leafPaths([]) set == Object.keys(state) set - 90 == 90, no symmetric difference, no orphan; (3) installed = 90 booleans (85 active / 5 inactive). RESULT: PASS.
- node --check on the full script body: parses clean (runApply/doQuit/rewired branches syntactically valid).
- grep: no residual mock symbols, no HTML-string injection sinks, sole network fetch is inside api().

Codex cross-model review (codex-review.py, real gpt-5.5, exit 0, 140s) - 4 findings, adjudicated:
- FOLDED #2 apply/state race: added a re-entrancy guard (let applying) so /apply cannot fire twice concurrently; snapshot the plan before posting and clear ONLY the applied plan's keys (not all pending) so mid-apply toggles are not silently dropped; wrapped in try/finally.
- FOLDED #4 TextDecoder: decode(value,{stream:true}) in the loop + a trailing decode() flush, so a multibyte char split across chunks no longer corrupts the streamed log.
- NOT folded #1 partial-state: installed[path]=(st==='active') is the spec's exact mandated line; the live manifest never emits 'partial' on a leaf path (verified - all 90 are active/none; partial is a folder rollup computed by stateOf, never stored). A third leaf-state would ripple through counts/stateOf/toggleLeaf/stageAll - a redesign the spec deliberately avoided.
- NOT folded #3 fake update banner: the spec scopes Task 5 to the wiring changes and says keep everything else intact; the update/uptodate banner is deferred-by-design per the GUI-installer design beat. Left untouched.
Post-fold re-verify: full script node --check clean; data harness still PASS (10 buckets, 90==90, no orphan, 90 booleans); single fetch inside api(); no HTML-string sinks.

Owed: browser visual verification is owed to the controller (server binds 127.0.0.1-only; screenshots must be examined by the controller).

Files touched:
- claude/installer-gui/index.html (new)
