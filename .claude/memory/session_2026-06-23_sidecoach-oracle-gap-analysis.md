---
name: Sidecoach vs oracle - rubric-mapped gap analysis (Phase 1, task #7)
description: Where exactly and why Sidecoach trails oracle on each of the 5 rubric dimensions, with file/feature evidence; plus where Sidecoach already leads (to protect). Grounding for the net-simplifying plan (task #8).
type: project
relates_to: [session_2026-06-23_sidecoach-oracle-capability-map.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen

Rubric-mapped, evidence-grounded. The /goal: beat oracle in every dimension it trails AND be simpler. No hand-waving - every claim cites a file/measurement from the capability-map session.

## GAP 1 - Design-taste DEPTH & CURRENCY (Sidecoach TRAILS)

Evidence:
- Sidecoach's taste corpus is `reference/_extracted/legacy-design-skill/` whose `SKILL.md` header reads `version: 3.1.1` ("Based on Anthropic's frontend-design skill"). Oracle is at 3.5.0. Sidecoach is pinned 0.4.0 behind, with NO update mechanism (oracle has context.mjs self-update polling oracle.style/api/version).
- The extraction is a FROZEN snapshot: 36 reference files (an OLDER, pre-consolidation layout: cognitive-load.md, color-and-contrast.md, heuristics-scoring.md, motion-design.md, personas.md, spatial-design.md, ux-writing.md, typography.md still split out) vs oracle 3.5.0's 27 consolidated files. MORE files, OLDER taste.
- 3.5.0-era taste that Sidecoach's corpus predates or under-encodes: second-order category-reflex check (reflex-reject AESTHETIC LANES, not just fonts), aphoristic-cadence copy detection, numbered-section-markers (01/02/03), provider-specific tells (gpt/gemini), the refined hero-eyebrow "accent-bold" branch. These live in oracle's detector registry + SKILL.md, which Sidecoach does not track.
- The verb registry (`verb-command-registry.ts`) `parityChecklist` ENFORCES that legacy-skill substrings appear in output - so the system is structurally pinned to parity-WITH-3.1.1, by design. Taste is downstream by construction.

Why it trails: one-time extraction with no sync path, pinned to an older release, and a parity mechanism that rewards matching the old text rather than exceeding it.

## GAP 2 - DETECTOR ENGINE (Sidecoach TRAILS on coverage + coherence; LEADS on a few idioms)

Evidence:
- Oracle ships ONE unified, runnable scanner: `detect.mjs` -> 4 engines (regex / static-html jsdom-free / browser-Puppeteer / visual-screenshot-contrast), ~35 registry antipatterns, REAL rendered WCAG contrast via OKLCH->sRGB conversion + `var()` resolution + gradient-stop worst-case (`detector/rules/checks.mjs`, 2668 lines), import-graph, framework dev-server detection, stdin/PostToolUse-hook mode, exit codes (0/2). `npx oracle detect src/` just works.
- Sidecoach has NO single runnable scanner. Detection is scattered across ~8 modules with overlapping turf:
  - `taste-validator.ts` (7 idiom checks, runnable via bin/sidecoach-taste-check.js) - STRONG; fabricated-svg provenance + observer-race + hero-radial-blob are AHEAD of oracle.
  - `absolute-ban-detector.ts` (6 bans) - regex only, scans just 1-2 directory levels deep, computes NO rendered contrast / OKLCH / var resolution.
  - `validators/browser-evidence-collector.ts` - real Playwright, hermetic, computes WCAG contrast ratio - but COUPLED to the lane convergence pipeline, not a standalone `detect <path>`.
  - `category-reflex-detector.ts` - scores `DesignReference` METADATA strings (title/description), with hardcoded saturatedUntil dates (2027-xx); it is NOT a code/UI scanner at all.
  - `absolute-ban-detector` + `category-reflex-detector` + `validators/checks/anti-pattern-checks` all overlap on "slop", three different shapes.
- Net: Sidecoach's static file scanning cannot reproduce oracle's signature output (rendered contrast on OKLCH/Tailwind-v4 tokens, element-level eyebrow/icon-tile detection over a walked tree) without spinning the whole lane/convergence machine.

Why it trails: capability exists but is fragmented and engine-coupled; no unified, file-or-URL, exit-code scanner; coarser per-rule precision on the most-cited checks (contrast, eyebrow, icon-tile, repeated kickers).

## GAP 3 - MAINTAINABILITY / COMPLEXITY (Sidecoach TRAILS, badly)

Evidence:
- 138 non-test src files, ~40,163 SLOC, 144 test files, 37 flow-handler files, 26 flows, + a 1284-SLOC MCP server.
- SIX+ overlapping routing/orchestration implementations: `intent-detector.ts` (613), `lane-classifier.ts` (188), `slash-command-router.ts` (369), `verb-command-registry.ts` (645), `sidecoach-entry-point.ts` (248, its OWN phase-keyword vocabulary), `modes.ts` (deprecated, still shipped), `command-routing-adapter.ts`, `orchestrator.ts` (471) + `sidecoach-orchestrator.ts` (1809).
- The classifier is TRIPLICATED across languages: `src/lane-classifier.ts` + `mcp-server/src/keyword-resolver.ts` + `claude/hooks/sidecoach_lanes.py`, kept from drifting only by a parity corpus + tests (the file's own header documents this as a deliberate duplication forced by tsconfig rootDir). Any rule change = 3 edits + parity re-verify.
- Lane spec churned v1-v10 (10 decision beats in MEMORY index) with repeated self-introduced regressions (multiple "regression was v8-introduced" notes).

Why it trails: many subsystems solving the same problem (routing) in parallel; cross-language duplication; harness coupling. High blast radius per change. This is the dimension the mission calls out as the single biggest objective to fix.

## GAP 4 - DISTRIBUTABILITY (Sidecoach TRAILS)

Evidence:
- Oracle: `.claude-plugin/plugin.json` (name, version 3.5.0, homepage oracle.style, repo, author, skills, agents), Apache-2.0, pure `.mjs` (no build), `pin`/`unpin` writes `/cmd` shortcuts across 11 harness dirs, self-update check. Installable anywhere via the plugin cache.
- Sidecoach: no plugin manifest. SKILL.md hardcodes an absolute path (`/Users/spare3/Documents/Github/improv/sidecoach/bin/sidecoach-monitor.js`) - non-portable. Requires a TS build (`ts-node generate-lanes + generate-validators + tsc`) before anything runs. No homepage, no versioned release, no pin/unpin, no update path. Tightly bound to this machine's hook layer + MCP wiring.

Why it trails: built as an in-repo bespoke system for one workstation, not as a portable artifact.

## GAP 5 - FOCUS / WORKFLOW SIMPLICITY (Sidecoach TRAILS)

Evidence:
- Oracle: ONE vocabulary the user learns (23 commands in 6 named categories) + a context-aware menu on no-arg. Routing is 4 readable SKILL.md rules. The mental model is "type a verb."
- Sidecoach: FOUR parallel user-facing vocabularies for the SAME work - phase commands, 22 verb commands, 6 lanes (lane_build/ship/delight/live/calm/converge), and natural-language intent - documented as "three command surfaces" in SKILL.md (which itself is 222 lines vs oracle's tighter SKILL.md). The user must understand lanes vs verbs vs phases vs NL, and the SKILL.md tells the model to invoke a node engine, parse JSON, print a panel verbatim, and not paste guidance. More concepts, more ceremony, more ways to be wrong.

Why it trails: surface sprawl. Multiple vocabularies + an engine-invocation protocol where oracle has one verb list + markdown.

## WHERE SIDECOACH ALREADY LEADS (protect - do not regress)
- QA gate triad (audit/critique/polish) + BuildReport with per-domain letter grades - more rigorous than oracle's single critique snapshot.
- Beats memory integration (cross-session/cross-machine continuity) - oracle has only a single cached critique snapshot.
- Reference systems wired into flows (component.gallery, fontshare, design-references, motion, icon-source) with lane-start preflight.
- Crash-safe convergence loop + checkpointing + lane lease/lock/CAS - oracle's flows are stateless.
- taste-validator idiom checks AHEAD of oracle (fabricated-svg provenance enforcing icon-source, observer-race reveal-stuck-invisible, hero-radial-blob, hex-in-interactive-state, Tailwind/shadcn context awareness).
- browser-evidence hermeticity (blocks cross-origin + ws + service workers) - more security-conscious than oracle's Puppeteer render.
- project-drift token governance (CSS custom props vs DESIGN.md) - oracle has nothing equivalent.

## STRATEGIC READ (for the plan)
The capability is NOT the deficit - Sidecoach already has more raw machinery than oracle, and leads on several axes. The deficits are (1) COHERENCE/SIMPLICITY (4 vocabularies, 6 routing impls, scattered detection, triplicated classifier) and (2) CURRENCY (frozen 3.1.1 taste, no sync) and (3) PORTABILITY (no plugin manifest, absolute paths, build required). The winning move is consolidation, not addition: collapse the routing+vocabulary surface to ONE, unify detection into ONE runnable scanner that absorbs the strong idiom checks AND oracle's rendered-contrast coverage, fold current 3.5.0 taste forward with an update path, and package as a portable plugin - while preserving the QA/memory/reference/convergence/hermeticity leads. That nets simpler AND more capable simultaneously.
