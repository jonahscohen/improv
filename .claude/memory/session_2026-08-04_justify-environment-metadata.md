---
name: Justify environment metadata on prompts
description: Every annotation/manipulation/prompt now carries viewport+DPR+browser+OS as documented metadata for Claude's context
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

**Goal (Jonah, 2026-08-04):** every time someone makes an annotation or micro-adjustment/manipulation in Justify, the environment it was authored in must be a documented part of the prompt - metadata valuable to Claude when translating a prompt's parameters. Asked for "viewport resolution"; on the AskUserQuestion he chose Other and added "while we're at it...browser type, browser version, operating system." Final metadata set: **viewport WxH + devicePixelRatio + browser name + browser version + OS**. (Physical screen resolution deliberately NOT included - he did not ask and it is rarely actionable for CSS translation.)

**Baseline (stamped @83523ddd):** vitest 264/265 pass; the 1 failure is a flaky `EADDRINUSE` port race in a server test, pre-existing and unrelated.

**Live surfaces Claude actually reads (the contract):**
- Prompt mode: `formatElementInfo` in `core/prompt/index.ts:39` -> `context: o` -> push_prompt -> justify_watch/get_prompts. Already had `Viewport: WxH` (line 64).
- Annotations: `justify_get_annotations` JSON in `server/mcp-tools.ts`. Had NO environment.
- Manipulate direct-apply: `justify_apply_changes` text in `server/mcp-tools.ts:324`. Had NO environment block.
- Manipulate->prompt (Send All): reuses prompt-mode context, so inherits viewport.
- Test-only mirrors (not wired to MCP, but kept consistent): `context-extractor.ts formatContext`, `annotate/output-formatter.ts formatAnnotations` (its forensic case MISLABELS the element bbox as "Viewport" - a real bug to fix), `engine/output.ts formatChanges` (already has an Environment/Viewport block).

**Done so far:**
- NEW `core/environment.ts` - single source of truth. `captureEnvironment()` (only browser-coupled export; guards window/navigator for jsdom), pure `detectBrowser` (ordered probes: Edge/Opera/Firefox/Samsung before Chrome, Safari via `Version/` token last), `detectOS` (client-hints `userAgentData.platform` hint trusted over UA; iOS/Android before macOS/Linux), `formatEnvironmentLines` (DPR `@Nx` suffix only when !=1). EnvironmentInfo interface.
- NEW `__tests__/core/environment.test.ts` - 16 tests, all green (Chrome/Safari/Firefox/Edge/Android UAs + DPR/version formatting).

**Why one shared module:** four core formatters render the env; a single `formatEnvironmentLines` keeps them from drifting. Server side (get_annotations emits structured JSON; apply renders text) is handled separately per the codebase's core<->server type-duplication pattern.

**Implementation COMPLETE (all surfaces):**
- Types: `EnvironmentInfo` in core/types.ts (canonical) + server/types.ts (mirror); `environment?` on AnnotationData, server Annotation, AddParams, and prompt ElementInfo/ContextData.
- Capture: `captureEnvironment()` called at annotation submit (both `_submitAnnotation` + `_submitTextAnnotation` in annotate/index.ts), at manipulate apply (core/index.ts push_changes + manipulate/index.ts applyChanges), and at prompt/context build (prompt/index.ts buildElementInfo, context-extractor buildContextFromElement).
- Document (what Claude reads): LIVE prompt `formatElementInfo` (prompt/index.ts) emits full env block; LIVE `justify_get_annotations` JSON carries `environment`; LIVE `justify_apply_changes` renders an Environment block from `pendingChangesEnv` (stored per push_changes, cleared on apply + on justify_clear). Mirrors kept consistent: formatContext, formatChanges (engine/output Environment block), formatAnnotations detailed/forensic (+ forensic mislabel FIXED: element bbox is now `**Element box:**`, real env is `**Environment:**`).
- Format: `formatEnvironmentLines` -> `Viewport: 1440x900 @2x` (DPR suffix only when !=1), `Browser: Chrome 131`, `OS: macOS`. Server has a byte-identical mirror in mcp-tools.ts.

**Verification:** `tsc -p tsconfig.server.json --noEmit` exit 0; `node build.js --core-only` builds; `npx vitest run` = **286 passed / 33 files** (was 265; +21 new/extended: environment.test.ts 16, plus output-formatter/context-extractor/annotation-store env cases). EADDRINUSE flake did not recur.

**Codex cross-model review (real Codex 0.142.5, 98.7s):** 5 findings, ALL FOLDED and re-verified.
1. (Med) `pendingChangesEnv` could show the WRONG/stale batch env in justify_apply_changes (multi-tab, or a no-env batch after an env one). FIX: ambiguity invariant - env shown only when every accumulated batch agrees; the moment two batches disagree or one lacks a usable env, drop to null and OMIT (never guess). `environmentsEqual` in server/environment.ts.
2. (Med) Untrusted `params.environment as EnvironmentInfo` could CRASH apply (`environment:{}` -> destructure undefined viewport) and `"1"` string DPR -> bogus `@1x`. FIX: `normalizeEnvironment()` coerces/validates shape + numeric coercion; `formatEnvironmentLines` now null-safe.
3. (Med) iPadOS desktop mode reports a Macintosh UA -> misclassified macOS. FIX: `detectOS` takes maxTouchPoints; touch-capable "Mac" -> iPadOS. captureEnvironment passes navigator.maxTouchPoints.
4. (Med) Annotation env only in detailed/forensic markdown. FIX: added to `standard` too (live get_annotations JSON standard already carried it).
5. (Low) Raw env passthrough in get_annotations (oversized/instruction-bearing userAgent). FIX: `normalizeEnvironment` on push_annotations ingest - strips control chars, caps lengths (name 64, version 32, os 64, ua 512).

NEW `server/environment.ts` (formatEnvironmentLines null-safe mirror + normalizeEnvironment + environmentsEqual), tested by NEW `__tests__/server/environment.test.ts`. This also resolves the client/server formatter drift-risk note (single tested server module).

**FINAL verification:** `tsc -p tsconfig.server.json --noEmit` exit 0; `node build.js --core-only` builds; `npx vitest run` = **299 passed / 34 files** (was 265 at baseline; +34 across environment.test.ts, server/environment.test.ts, and env cases in output-formatter/context-extractor/annotation-store). EADDRINUSE flake did not recur.

**Self-analysis (per protocol):** wasted ~4 tool calls on an invisible control-char that got embedded in server/environment.ts's sanitize regex (`/[ -]+/` displayed as space-hyphen but carried a control byte the Edit tool kept normalizing). Root cause: typed a literal control-char range into Write instead of `\x` hex escapes; Read rendered it benign so I could not see the mismatch. Fix that worked: rewrote the file via a bash single-quoted heredoc using `/[\x00-\x1F\x7F]+/g`. Lesson: for control-char/whitespace regexes, ALWAYS use `\x`/`\u` escapes, never literal invisibles - and when an Edit repeatedly "can't find" a line the Read shows verbatim, suspect invisible bytes and switch to heredoc/sed rather than retrying the Edit.

**Files touched:** NEW justify/core/environment.ts, justify/server/environment.ts, justify/__tests__/core/environment.test.ts, justify/__tests__/server/environment.test.ts. MODIFIED justify/core/{types.ts,index.ts}, justify/core/annotate/{index.ts,annotation-store.ts,output-formatter.ts}, justify/core/prompt/{index.ts,context-extractor.ts}, justify/core/engine/output.ts, justify/core/manipulate/index.ts, justify/server/{types.ts,mcp-tools.ts}, and the three extended test files (output-formatter, context-extractor, annotation-store).
