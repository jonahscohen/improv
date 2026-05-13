# Improv-Claude Loop: Postmortem

**Date:** 2026-05-13
**Duration:** ~2 days (May 12-13), 13 ralph loop iterations, 20+ commits
**Collaborator:** Jonah

---

## Executive Summary

The improv-claude loop was designed as a fully cyclical browser-to-Claude-to-browser experience where users stay in the browser, select elements, describe changes, and see Claude's work reflected back in real time. The spec was ambitious and well-structured. The implementation delivered something that compiles, deploys, and superficially appears functional, but multiple core features were broken at ship time and only caught during manual user testing after the ralph loop was cancelled. The ralph loop ran 13 iterations without catching that Send All, Done, and Revert - three of the four primary user actions - did not work.

---

## 1. Spec vs Reality Gaps

### 1.1 Delivered as Specified
- **improv_respond MCP tool**: Matches the spec's schema exactly (promptId, summary, filesChanged, changes[], status, question). Works correctly.
- **Toast notifications**: Three status paths (completed/needsInfo/failed) with correct icons and auto-dismiss. Works.
- **improv_watch polling**: Detects new prompts with timeout. Works.
- **Prompt ID assignment**: Sequential prompt-1, prompt-2, etc. Works.
- **localStorage persistence**: Change history survives reloads. Works.
- **Dark glass visual aesthetic**: Panel, button, and overlays follow the spec's design language accurately.
- **Keyboard shortcuts**: P, M, C, Q, J, K, D, R all wired and suppressed in text inputs. Works.
- **prefers-reduced-motion**: Properly respects the media query. Works.
- **ARIA roles**: dialog, list, listitem, aria-labels, aria-labelledby present. Works.

### 1.2 Delivered But Broken at Ship
- **Done button**: The `markDone` callback was wired but the panel was not re-rendering after state change. Clicking "Done" did nothing visible. Fixed in punchlist session.
- **Send All**: `submitPrompt` checked the live element selection (which is empty after queueing). A queued prompt lost its element references by the time Send All fired. Required a new `submitFromQueue` path that uses stored elements. Fixed in punchlist session.
- **Revert**: The spec said "Phase 4 - undoes the change" but the implementation tried to apply old CSS values via PreviewEngine constructable stylesheets. This doesn't work because the actual change was made to source files, not to a stylesheet layer. The PreviewEngine override has no effect on the real DOM after a page reload. Revert was redesigned as "send a push_prompt with revert instructions back to Claude" - fundamentally different from the spec's vision of instant undo. Partially fixed in punchlist session; the new approach is a workaround, not a real revert.
- **Click snaps to top**: The `render()` method rebuilt the entire DOM list, resetting scroll position. Fixed by saving/restoring `scrollTop`.
- **Claude button styling**: Multiple iterations (5 commits) to get the button to match the toolbar's visual language. The initial implementation used a completely different style (wrong background, wrong hover, wrong active state).

### 1.3 Delivered Differently Than Specified
- **Claude button location**: Spec says "appears in the action pill next to the queue count." Implementation puts it at fixed `bottom:20px;left:20px` - a separate floating button, not integrated into the toolbar pill at all. This is a significant UX departure.
- **Badge count**: Spec says "Badge shows count of unreviewed changes." Implementation replaced the badge with a pulse animation after user feedback. The punchlist explicitly removed the badge. This is an intentional deviation but the spec was never updated.
- **Auto-refresh timing**: Spec says reload on completed. Implementation adds a 2-second delay for toast/highlight visibility. Reasonable but undocumented.
- **needsInfo pulse**: Spec says "pulse the Claude button." Implementation pulses on ALL unreviewed changes, not just needsInfo. The pulse is the only unreviewed indicator (badge was removed).
- **Changes panel position**: Spec says "fixed panel similar to settings panel." Implementation positions it at `bottom:68px;left:20px` - anchored to the Claude button, not to the toolbar. Settings panel is at `bottom:68px;right:20px`. They're on opposite sides of the screen.
- **Prompt clearing**: Spec says Claude clears prompts after reading. Implementation writes `[]` to the file after `improv_get_prompts` reads them. This is correct but means if Claude crashes mid-processing, the prompts are lost. No retry mechanism.

### 1.4 Not Delivered (Specified But Missing)
- **Watch agent goal prompt**: The spec calls for a persistent agent/goal that Claude runs. The SKILL.md has instructions but there is no actual goal file, no `/goal` command, no agent configuration. The user must manually tell Claude to enter the watch loop.
- **Phase 3: Element highlights**: `_highlightChangedElements` exists but is fragile. It uses `document.querySelectorAll(selector)` on selectors provided by Claude. If Claude reports a selector that doesn't match the DOM (common with React/dynamic content), nothing highlights. No fallback or fuzzy matching.
- **Phase 4: Live CSS preview before file write**: The spec envisions Claude injecting CSS changes via PreviewEngine *before* writing to files, with an Apply/Revert workflow. What was built is: Claude writes to files, then PreviewEngine injects the same values as a redundant layer, then the page reloads 2 seconds later. The preview is cosmetic, not functional. There is no "preview before commit" workflow.
- **Apply/Revert workflow**: Spec Phase 4 describes: preview changes -> user clicks Apply -> commit to files, OR user clicks Revert -> clear preview. This does not exist. Changes go straight to files. Revert sends a prompt to Claude asking it to undo.
- **Diff visualization in browser**: Listed as Phase 4 item 14 in the spec. Not implemented.
- **Focus trapping**: Spec says "Tab cycles within panel, not out to page." Not implemented. Tab escapes the panel into the page DOM.
- **Focus return**: Spec says "Focus returns to trigger button when panel closes." Not implemented.
- **Before/after toggle on completed changes**: Added during punchlist as "Show Changes" / "Preview" buttons, but the Preview toggle uses PreviewEngine which only works if the page hasn't reloaded since the change. After reload, toggling preview does nothing visible because the stylesheet layer applies to already-current values.

---

## 2. Architecture Mistakes

### 2.1 In-Memory Prompt Buffer (Each MCP Session Gets Its Own Process)

**The problem:** Each Claude Code session spawns its own MCP server process via stdio. The browser connects to whichever process grabbed port 9223. A second session (e.g., Claude Agents for the watch loop) gets its own process. In-memory `pendingPrompts[]` meant browser prompts went to process A while Claude's watch loop polled process B.

**When it should have been caught:** During spec design. The spec describes the architecture as "Server (MCP + WebSocket)" as a single box. Anyone who understood MCP's stdio transport model would have flagged that the server is not a singleton. This is a fundamental architecture misunderstanding, not an edge case.

**The fix applied:** File-based prompt buffer at `~/.claude/improv/prompts.json`. Simple, works for single-user. But it introduced file I/O on every 500ms poll cycle in `improv_watch`, and the read-then-clear pattern in `improv_get_prompts` is not atomic (two processes could read simultaneously, both get prompts, both clear the file, one set gets processed twice).

**What should have been done:** Either (a) the spec should have specified a single persistent server process with a known socket, not per-session stdio; or (b) the file-based approach should have been the design from the start with proper file locking. The fact that this required a `decision` memory to document means it was discovered mid-implementation, not designed.

### 2.2 The Dist-Patching Workflow

**The problem:** For weeks, improv's 215KB minified dist was the source of truth. All development happened by patching a minified file. The May 12 session spent an entire day on source reconstruction - mapping 16 minified class names to source files, comparing line-by-line against a beautified version of the dist.

**The cost:** The reflection from 2026-05-12 called this out explicitly: "the team's most complex tool is the one most likely to skip the verification gate." The clip-path animation approach for toolbar collapse (documented in `session_2026-05-12_improv-toolbar-collapse.md`) went through 5 failed approaches because there was no way to inspect, debug, or set breakpoints on a minified file. Each fix took 3-5 attempts.

**The lesson:** Source reconstruction should have happened before any new feature work. Building Phase 1-4 of the claude loop on top of a codebase that was just reconstructed from a minified file introduced compounding risk. Bugs from the reconstruction mixed with bugs from the new features, making both harder to isolate.

### 2.3 The clip-path Animation Approach

**The problem:** The toolbar collapse/expand mechanism went through 5 failed approaches: `clip-path: inset()` (clips border and box-shadow), `max-width` transition (`max-width` doesn't actively size elements), dynamic `scrollWidth` measurement (unreliable during transitions), `display: none` on children (breaks width calculation), and `visibility: hidden + width: 0` (collapses below target width).

**The root cause:** CSS `animation fill-mode: both/forwards` permanently locks computed styles to the animation's final keyframe, blocking ALL CSS transitions. This was the actual bug, but it took 5 workaround attempts before it was identified. A developer with browser devtools open would have seen this in the Computed Styles panel in minutes.

**When it should have been caught:** Before attempting any animation work. The `improv-pill-in` entry animation with `fill-mode: forwards` is a known CSS gotcha. The fix was a single `animationend` listener that sets `animation: none`.

### 2.4 PreviewEngine as a Revert Mechanism

**The problem:** The spec envisioned PreviewEngine (constructable stylesheets) as the mechanism for live preview and revert. But constructable stylesheets operate as an overlay - they add CSS rules on top of existing styles. They cannot "undo" a change that was made to a source file. After a page reload, the source file's styles are the baseline. Applying "old values" via constructable stylesheet only works if the old values would actually override the current computed style, which requires the right specificity and the right property.

**Why this was architecturally wrong:** Source file changes are permanent. CSS overlay changes are ephemeral. You cannot revert a permanent change with an ephemeral mechanism. The punchlist session recognized this and pivoted to "send a revert prompt to Claude" - which is honest but means Revert is not instant and requires Claude to be in the watch loop.

**What the spec should have said:** True revert requires either (a) git-level undo (`git checkout -- <file>`) triggered from the browser, or (b) the preview-before-commit workflow where changes are shown via PreviewEngine first and only written to files on explicit Apply. Option (b) was in the spec as Phase 4 but was never actually built as described.

### 2.5 The `(this.promptMode as any)` Pattern

**The problem:** `index.ts` accesses PromptMode internals through 30+ `(this.promptMode as any)._propertyName` casts. This means ImprovCore is tightly coupled to PromptMode's internal structure but without any type safety. If PromptMode renames a private property, the code silently breaks at runtime.

**Why this happened:** The source reconstruction from the minified dist preserved the original coupling patterns. The minified code accessed these properties directly (no TypeScript privacy enforcement in JavaScript). When reconstructing to TypeScript, the private properties stayed private but the access patterns from ImprovCore weren't updated to use a proper API.

**What should have been done:** Define a public interface on PromptMode for the properties ImprovCore needs: `setColor(c)`, `setShowHints(v)`, `setShowLabels(v)`, `getQueueButton()`, etc. The `as any` casts are a type safety escape hatch that defeats the purpose of using TypeScript.

---

## 3. Process Failures

### 3.1 The Ralph Loop Testing Methodology

The ralph loop ran 13 iterations. Here is what each iteration tested vs. what it should have tested:

| Iteration | What Was Tested | What Should Have Been Tested |
|---|---|---|
| 1 | Server restart, push_prompt returns promptId, localStorage persistence, three status paths, toast display | Same + end-to-end: select element, type prompt, verify it appears in improv_get_prompts, call improv_respond, verify toast appears |
| 2 | TypeScript errors, add Q shortcut, a11y polish | Actually click Done/Reply/Revert in the panel and verify they work |
| 3 | TypeScript errors (0 errors), production build (215KB) | Run the full user workflow: select -> prompt -> send -> wait -> review -> done |
| 4 | "Interactive feature testing" - Done button, Reply button | Good - this is when Done was verified. But Send All and Revert were not tested |
| 5 | "End-to-end prompt mode UI verified on dish-playscapes.lndo.site" | Good - but only tested prompt sending, not the response/review cycle |
| 6 | Panel slide animation, Claude button entrance + pulse | Visual polish before core functionality was verified |
| 7 | Production build deployed, "full verification" | Unclear what "full verification" means. Send All and Revert were still untested |
| 8 | Phase 4 - diff arrows + revert button | Added revert button but didn't test that clicking it actually reverts anything |
| 9 | "Regression audit - all fixes survived reconstruction" | Checked that nothing broke, but didn't check that features worked end-to-end |
| 10 | "Clear done" button | New feature added before existing features were verified |
| 11 | Integration test script (test-loop.js) | Wrote a test script - but it tests the WebSocket path, not the full user workflow |
| 12-13 | How-to-use guide, misc | Documentation for features that don't fully work |

**The pattern:** The ralph loop tested compilation, visual rendering, and individual button clicks in isolation. It never tested the full user workflow end-to-end: "I am a user in the browser. I select an element. I type a prompt. I click Send All. Claude processes it. I see the result in the changes panel. I click Done. I click Revert on another one." That workflow has 6 steps and the loop tested each step individually, never chained.

**Why:** The ralph loop was running in a Claude Code session that could build and deploy code, but could not simultaneously act as a user in the browser AND as the watch-loop Claude agent. The testing was inherently single-actor. Multi-actor workflows require multi-actor testing.

### 3.2 Polish Before Correctness

Iterations 6 (animation polish), 10 (clear done button), and 12 (how-to-use guide) all happened before Send All, Revert, and the scroll-snap bug were caught. The loop was adding polish and features to a system whose core actions were broken. This is the classic "painting the walls before the foundation is set" failure.

**Why it happened:** Each iteration verified "does the thing I just built compile and render?" rather than "does the system as a whole work?" Compilation success and visual rendering are necessary but not sufficient. The ralph loop was optimizing for velocity (more iterations = more features) rather than coverage (each iteration = one more verified workflow).

### 3.3 The Integration Test Script

Iteration 11 produced `test-loop.js`. This script tests the WebSocket transport path: connect, push_prompt, receive improv_response. It does NOT test:
- Whether the browser UI renders the response correctly
- Whether Done/Reply/Revert buttons fire their callbacks
- Whether the changes panel scrolls correctly
- Whether Send All sends all queued items
- Whether auto-reload triggers

The test is valuable for the transport layer but does not cover the application layer. For a browser-based tool, the application layer IS the product.

---

## 4. What Worked Well

### 4.1 The Spec
The spec itself was well-structured: clear architecture diagram, phased implementation, explicit "what exists today" section, detailed design principles (keyboard nav, a11y, visual language). The phases were correctly ordered from MVP to polish. The design principles section with exact CSS values, transition timings, and typography scale is excellent reference material.

### 4.2 The File-Based Prompt Buffer Decision
Once the in-memory buffer problem was identified, the pivot to file-based storage was fast and pragmatic. The `decision` memory correctly documented alternatives considered, why this approach won, and when to revisit. This is how architectural decisions should be recorded.

### 4.3 The Source Reconstruction
The May 12 source reconstruction session was painful but necessary. The class-to-file mapping (16 minified names to source files), the beautified dist as reference, the systematic comparison - this was disciplined work that unblocked all future development. The "never rebuild" rule being explicitly killed was the right call.

### 4.4 The Server Resilience Fix
`killStaleProcess()` in `server/index.ts` is a pragmatic solution to a real problem. Detecting stale processes via `lsof`, killing non-self PIDs, waiting 500ms, then falling back to port retry (9223-9232) is belt-and-suspenders reliability. This was well-designed.

### 4.5 The Changes Panel UI
The visual design of the changes panel is solid: dark glass aesthetic, proper spacing, status dots, property pills with before/after values, inline reply input with focus border color sync, keyboard navigation. The filtered entries logic (skip non-actionable responses) was a good UX decision from the punchlist. The scroll position preservation fix is clean.

### 4.6 The improv_respond Tool
The MCP tool schema is clean, the WebSocket broadcast works, the browser listener stores and renders correctly. This is the core of the loop and it works well.

### 4.7 The Claude Icon
Sourcing the Claude logo from Lobehub and using the #D97757 brand color was a good design decision. The button entrance animation, hover state (subtle orange warmth), and active state (solid orange, white icon) follow the toolbar's visual language after the punchlist fixes.

---

## 5. Proposed Improvements

### 5.1 Process Changes

| Problem | Fix |
|---|---|
| Ralph loop tested compilation, not workflows | Add a mandatory "full workflow test" checkpoint after every 3 iterations. The test must chain: action -> result -> verification, not individual steps |
| Polish before correctness | Enforce a "all core actions work end-to-end" gate before any polish iteration begins. No animation, no docs, no extra features until: Send, Done, Reply, Revert all verified in sequence |
| Single-actor testing of multi-actor workflows | Use two terminal sessions: one as the user (via Chrome MCP or cmux), one as the watch-loop agent. Or build a test harness that simulates both actors |
| Integration test covers transport only | Write browser-level tests using Playwright or similar that drive the actual UI: click elements, type prompts, verify panel state |

### 5.2 Architecture Changes

| Problem | Fix |
|---|---|
| In-memory buffers across MCP processes | Accept the file-based approach but add file locking via `flock` or `lockfile` to prevent concurrent read-clear races. Or move to a SQLite database |
| PreviewEngine as revert mechanism | Remove the fake revert. Replace with either: (a) `improv_revert` MCP tool that runs `git checkout -- <files>` and broadcasts to browser, or (b) true preview-before-commit where Claude calls `improv_preview` (CSS injection) and `improv_commit` (file write) as separate steps |
| `(as any)` casts for PromptMode | Define a public API on PromptMode. Add an interface: `IPromptModeController { setColor(c: string): void; setShowHints(v: boolean): void; ... }`. Remove all `as any` casts |
| Prompt loss on crash | Add a `processing` state to the prompt file. `improv_get_prompts` marks prompts as `processing` instead of deleting. `improv_respond` marks them `completed`. On next `improv_get_prompts`, re-deliver any prompts stuck in `processing` for more than 60 seconds |
| No watch agent automation | Write an actual goal/agent config file that Claude Agents can pick up. Include the project path, the `.improv` file location, and the watch loop instructions. Or add `/improv watch` as a CLI command |

### 5.3 Code Changes

| Problem | Fix |
|---|---|
| Claude button not in toolbar pill | Move the Claude button into the toolbar as a mode button, or into a badge area next to the close button. It should not be a separate floating element |
| Changes panel on wrong side of screen | Move to `right: 20px` to anchor near the toolbar, or make position dynamic based on toolbar location |
| No focus trapping in panels | Add a focus trap using `MutationObserver` or a simple `Tab` key handler that cycles through focusable elements within the panel |
| No focus return on panel close | Store `document.activeElement` before opening, restore it in `hide()` |
| Highlight fragility with dynamic selectors | Add fallback: if `querySelectorAll(selector)` returns nothing, try a simplified version (strip pseudo-classes, try parent selector). Log a warning if no match found |

---

## 6. Updated Spec: What Was Actually Built

### Architecture (Actual)

```
                      BROWSER                          SERVER                          CLAUDE
                  (improv-core.js)               (MCP + WebSocket)              (manual watch loop)

  User selects elements          push_prompt          Write to prompts.json
  User types instruction    ----------------->   --------------------->
  User clicks Send                                                         (user tells Claude to
                                                                            call improv_watch)
                                                                           improv_watch polls file
                                                                           improv_get_prompts reads+clears
                                                                           Claude reads context
                                                                           Claude edits source files
                                                                           Claude calls improv_respond
                                                   improv_response              |
                             <-----------------   <---------------------
  Toast notification
  Element highlight (2s)
  PreviewEngine injection
  Auto-reload (2s delay)
  Change stored in localStorage
  Claude button appears (pulse)
  User opens changes panel
  User reviews: Mark Done / Reply / Show Changes / Revert (sends new prompt)
```

### What Works

1. **Prompt submission**: Browser -> WebSocket -> file-based buffer -> MCP tool. Reliable.
2. **Response display**: MCP tool -> WebSocket broadcast -> toast + localStorage. Reliable.
3. **Changes panel**: Scrollable list, status dots, property pills, keyboard nav. Works after punchlist fixes.
4. **Mark Done**: Updates reviewed flag, persists to localStorage, removes Claude button when all reviewed. Works after punchlist fix.
5. **Reply**: Inline input, sends push_prompt with reference to original promptId. Works.
6. **Show Changes**: Expands detail view with selector/property/oldValue/newValue. Works.
7. **Keyboard shortcuts**: P, M, C, Q, J, K, D, R with input suppression. Works.
8. **Marker color**: 6 swatches, persists via localStorage, syncs across all UI elements. Works.
9. **Server resilience**: Stale process detection, port retry 9223-9232. Works.

### What Partially Works

1. **Element highlights**: Works if Claude reports accurate CSS selectors. Fragile with dynamic content.
2. **Preview toggle**: Works only before page reload. After reload, toggling preview has no visible effect.
3. **Revert**: Sends a new prompt to Claude requesting undo. Requires Claude to be in watch loop. Not instant. Not guaranteed.
4. **Auto-reload**: Works but the 2-second delay is arbitrary. HMR may reload before the response arrives.

### What Does Not Work / Does Not Exist

1. **Watch agent automation**: No goal file, no agent config. User must manually instruct Claude.
2. **Preview-before-commit**: Changes go straight to files. No approval gate.
3. **True revert**: No git-based undo. No way to restore previous file state from the browser.
4. **Diff visualization**: Not implemented.
5. **Focus trapping in panels**: Not implemented.
6. **Focus return on panel close**: Not implemented.
7. **Claude button in toolbar pill**: Button is a separate floating element.
8. **Crash recovery for prompts**: Prompts are deleted on read. If Claude crashes, they're gone.
9. **Component scanner**: `improv_get_components` returns "not yet connected."
10. **Selection capture**: `improv_get_selection` returns "not yet implemented."

### Design Principles (Implemented)

- Dark glass aesthetic: #1a1a1a bg, rgba(255,255,255,0.1) border, 16px border-radius. Yes.
- 32x32 minimum hit area (44x44 for Claude button). Yes.
- Transitions: 120ms hover, 200ms panel, 300ms toolbar. Yes.
- markerColor as sole accent. Yes (except Claude button which uses #D97757).
- WCAG AA text contrast rules. Yes.
- Typography scale (10px labels, 12-13px content). Yes.
- tabular-nums on counts. Yes.
- prefers-reduced-motion respected. Yes.
- ARIA roles on panels and lists. Yes.
- focus-visible rings using --improv-marker CSS variable. Yes.

### Design Principles (Not Implemented)

- Focus trapping inside open panels. No.
- Focus return to trigger button on close. No.
- aria-live="polite" on badge counts. No (badge was removed).
- Tooltips with role="tooltip" and aria-describedby. Tooltips exist but lack ARIA connection.

---

## 7. Severity Assessment

| Issue | Severity | User Impact |
|---|---|---|
| No watch agent automation | High | Users must manually start the loop every session |
| Revert doesn't actually revert | High | Users think they're undoing changes but they're sending a new request |
| Preview toggle doesn't work after reload | Medium | The "before" view shows current state, which is the same as "after" |
| Prompt loss on crash | Medium | Rare but unrecoverable when it happens |
| Claude button not in toolbar | Low | Cosmetic - the button works, it's just in the wrong place |
| No focus trapping | Low | Accessibility gap but keyboard nav within the panel works |
| `(as any)` type casts | Low | Developer experience issue, not user-facing |

---

## 8. Timeline of Key Events

| When | What | Impact |
|---|---|---|
| May 12, early | Source reconstruction begins | Correct decision - unblocked all future work |
| May 12, late | Toolbar collapse/expand rewrite | 5 failed approaches, root cause was animation fill-mode |
| May 12, reflection | Corpus analysis flags improv debt | Correctly identified dist-as-source and verification gaps |
| May 13, AM | Spec written | Good spec, but missed MCP process model |
| May 13, mid | Phase 1 deployed | improv_respond + toast + localStorage working |
| May 13, mid | Phase 2 deployed | Changes panel + Claude button + keyboard shortcuts |
| May 13, mid | Phases 3+4 claimed | Element highlights + "live preview" but preview is cosmetic |
| May 13, ralph 4-6 | Polish begins | Animation, entrance effects added before core verified |
| May 13, ralph 7-9 | Build verification | Production builds confirmed but features untested end-to-end |
| May 13, ralph 10-13 | Features + docs | Clear done, test script, how-to-use guide |
| May 13, PM | User testing | 8 bugs found: Done broken, Send All broken, Revert broken, scroll broken, styling wrong, filtering needed, UX labels wrong, no before/after toggle |
| May 13, PM | Punchlist fixes | All 8 items fixed with varying quality (Revert is a workaround, not a fix) |

---

## 9. Root Cause Summary

The postmortem reduces to three root causes:

1. **The testing methodology verified construction, not behavior.** "Does it compile? Does it render? Does the button appear?" are necessary but insufficient. "Does clicking the button do what the user expects?" was never asked during the ralph loop.

2. **The architecture was designed for a single-process model but deployed in a multi-process reality.** The MCP stdio transport means every Claude Code session gets its own server. The spec treated the server as a singleton. This mismatch required a mid-implementation pivot (file-based buffer) that introduced its own issues.

3. **Phases 3 and 4 were claimed as complete when they were only surface-level implementations.** Element highlights exist but are fragile. Live preview exists but doesn't preview anything the user can't already see. Revert exists but doesn't revert. The implementations passed the "does it compile and render?" bar but not the "does it do what the spec says?" bar.

---

## 10. Action Items

1. **Immediate:** Write a real watch agent goal/config file that Claude Agents can auto-start.
2. **Immediate:** Replace the fake revert with `git checkout` via a new `improv_revert` MCP tool.
3. **Immediate:** Add file locking to `prompts.json` read/write.
4. **Short-term:** Implement true preview-before-commit (improv_preview + improv_commit as separate tools).
5. **Short-term:** Move Claude button into toolbar or establish a proper floating button design system.
6. **Short-term:** Add focus trapping and focus return to all panels.
7. **Process:** Add a mandatory "end-to-end workflow test" gate to the ralph loop after every 3 iterations.
8. **Process:** No polish iterations until all core user actions are verified in sequence.
9. **Code quality:** Remove all `(as any)` casts on PromptMode - define a public interface.
10. **Documentation:** Update the spec to reflect what was actually built (this postmortem serves as a start).
