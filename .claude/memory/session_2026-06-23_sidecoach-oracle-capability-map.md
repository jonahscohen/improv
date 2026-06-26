---
name: Sidecoach vs oracle 3.5.0 - cold-ground capability map (Phase 1, task #6)
description: Factual side-by-side capability map of oracle 3.5.0 (oracle baseline) and Sidecoach, produced by the sidecoach-architect teammate after reading both systems in full. Grounding for the gap analysis + net-simplifying plan.
type: project
relates_to: [feedback_sidecoach_mission_beat_oracle.md, reference_sidecoach_reference_routing_map.md]
---

Collaborator: Jonah Cohen

Phase 1 grounding (task #6). No code changed. Evidence: every file path below was read or measured this session.

## ORACLE 3.5.0 (the baseline)

- DISTRIBUTION: clean Apache-2.0 plugin. `.claude-plugin/plugin.json` (version 3.5.0, homepage oracle.style, repo github.com/oracle, author Paul Bakaus). 1 skill + 1 agent (oracle-manual-edit-applier). Pure ESM `.mjs` scripts - NO build step. Runs via `npx oracle` / `node scripts/*.mjs`. Self-update check baked in (context.mjs polls oracle.style/api/version, daily throttle + weekly renotify, opt-out env).
- SURFACE: ONE SKILL.md + 23 commands in 6 categories (Build / Evaluate / Refine / Enhance / Fix / Iterate) + `pin`/`unpin` (writes standalone `/cmd` shortcuts across 11 harness dirs). 27 reference `.md` (one per command + `brand.md`/`product.md` registers + `codex.md`, `interaction-design.md`, `init.md`).
- ROUTING: 4 SKILL.md routing rules, agent-reasoned (no scoring engine). No-arg -> `context-signals.mjs` emits JSON (setup/critique/git/devServer/scan targets) and the agent reasons over it for 2-3 context-aware picks + the full menu. First word = command -> load `reference/<cmd>.md`. Clear intent -> map to command. Else general invocation.
- SETUP: `context.mjs` (loads PRODUCT.md/DESIGN.md as one block; `NO_PRODUCT_MD` -> init; extracts register brand|product). `palette.mjs` (brand seed color for greenfield).
- DETECTOR ENGINE: ONE unified, runnable scanner. `detect.mjs` -> `detector/cli/main.mjs`. FOUR engines: regex (`engines/regex/detect-text`), static-html (`engines/static-html/detect-html` + `css-cascade`, jsdom-free), browser (`engines/browser/detect-url`, Puppeteer), visual (`engines/visual/screenshot-contrast`). Registry ~35 antipatterns (`registry/antipatterns.mjs`: slop + quality + gated gpt/gemini provider tells). `rules/checks.mjs` (2668 lines) = pure detection: real WCAG contrast w/ OKLCH->sRGB conversion + `var()` resolution + gradient-stop worst-case, checkBorders/side-tab, checkMotion (bounce/elastic, layout-transition), checkGlow (dark-mode glow), checkIconTile, checkHeroEyebrow (tracked-caps AND accent-bold), repeated-section-kickers, numbered markers, cream-palette, italic-serif-display, em-dash/buzzword/aphoristic copy. Import-graph awareness, framework dev-server detection, stdin/hook mode, exit codes 0 clean / 2 findings. No network for the file path.
- TASTE DEPTH/CURRENCY: rich + current 2026. SKILL.md + brand.md/product.md carry: cream/sand/beige OKLCH band (L 0.84-0.97, C<0.06, hue 40-100) call-out, color-commitment axis (Restrained/Committed/Full/Drenched), reflex-reject font list (~24 faces) + reflex-reject aesthetic lanes (editorial-typographic), category-reflex first+second order, absolute bans (match-and-refuse), font-selection procedure (3 brand-voice words), register split brand vs product.
- LIVE: substantial in-browser variant mode (live-server/live-browser/live-poll/live-inject + manual-edit-applier agent + svelte/sveltekit adapters, HMR hot-swap).

## SIDECOACH (current state)

- DISTRIBUTION: bespoke, harness-coupled. SKILL.md hardcodes an absolute path (`/Users/spare3/.../sidecoach/bin/sidecoach-monitor.js`). Requires TS build (`npm run build` = generate-lanes + generate-validators + tsc). MIT, author Jonah. No versioned plugin manifest, no homepage/pin/update-check. MCP server (1284 SLOC) exposes classify_intent / list_lanes / sidecoach_lane. Deps: @anthropic-ai/sdk, playwright, js-yaml, proper-lockfile.
- SURFACE / SIZE: 138 non-test src files, ~40,163 SLOC, 144 test files, 37 flow-handler files, 26 flows. FOUR user-facing vocabularies: (1) phase commands, (2) 22 verb commands, (3) 6 lanes (lane_build/ship/delight/live/calm/converge), (4) natural-language intent.
- ROUTING (the overlap): SIX+ implementations. `intent-detector.ts` (613), `lane-classifier.ts` (188 - TRIPLICATED: engine TS + `mcp-server/src/keyword-resolver.ts` + Python `claude/hooks/sidecoach_lanes.py`, kept in sync by a parity corpus), `slash-command-router.ts` (369), `verb-command-registry.ts` (645), `sidecoach-entry-point.ts` (248 - its OWN separate phase-keyword vocab: research/implement/review/clone/migrate/refactor...), `modes.ts` (deprecated, still present), `command-routing-adapter.ts`, plus `orchestrator.ts` (471) + `sidecoach-orchestrator.ts` (1809).
- DETECTION (scattered across ~8 modules):
  - `taste-validator.ts` STRONG, runnable CLI, 7 idiom-level checks some AHEAD of oracle: fabricated-svg provenance (enforces icon-source rule), observer-race (reveal-stuck-invisible - oracle only warns in prose), hero-radial-blob, translateY-in-hover, hex-in-interactive-state, border-radius-inconsistency, large-inline-style; Tailwind/shadcn context-aware carve-outs.
  - `absolute-ban-detector.ts` 6 bans, regex, but only 1-2 dir levels deep, NO contrast/OKLCH/var/browser.
  - `validators/browser-evidence-collector.ts` Playwright, hermetic (blocks cross-origin + ws + service workers), computes WCAG contrast ratio + computed style + DOM evidence. STRONG, arguably ahead on hermeticity, but coupled to the lane convergence pipeline, not a standalone scanner.
  - `validators/checks/*` (a11y/anti-pattern/polish/theming).
  - `category-reflex-detector.ts` reference-metadata keyword scorer w/ stale hardcoded saturatedUntil dates (2027-xx); NOT a code scanner.
  - `project-drift-detector.ts` token-governance (CSS custom props vs DESIGN.md tokens) - UNIQUE, oracle has nothing like it.
  - `regression-detector.ts` flow-output QA (run-to-run status/guidance/checklist deltas), not UI.
- TASTE DEPTH: largely EXTRACTED from oracle into `reference/_extracted/legacy-design-skill/`. The verb registry's `skillRefPath` points there and `parityChecklist` enforces that legacy reference substrings APPEAR in output (parity-with-legacy, not taste-ahead). Plus external extractions (bencium, emil, refactoring-ui, shadcn, taste-skill, typeui, vercel) + make-interfaces-feel-better (16 tactical rules).
- RUNTIME MATURITY: build GREEN; `npm test` = 56 suites PASS (incl Playwright browser-evidence). So "unverified maturity" is now verified-as-tests-pass - BUT tests verify engine mechanics (guidance/checklist/finding shapes), NOT design-outcome superiority over oracle.

## WHAT SIDECOACH ALREADY LEADS ON (protect)
QA gate triad (audit/critique/polish) + BuildReport domain letter grades; beats memory integration; reference systems (component.gallery, fontshare, design-references, motion, icon-source) wired into flows; convergence loop with crash-safe checkpointing + lane lease/lock/CAS; taste-validator idiom checks (ahead of oracle); browser-evidence hermeticity; project-drift token governance; icon-source provenance enforcement.

## Files read this session (evidence)
oracle: SKILL.md, command-metadata.json, plugin.json, detect.mjs, detector/cli/main.mjs, detector/rules/checks.mjs, detector/registry/antipatterns.mjs, context.mjs, context-signals.mjs, pin.mjs, reference/brand.md, reference/craft.md.
sidecoach: claude/skills/sidecoach/SKILL.md, LANES.generated.md, absolute-ban-detector.ts, category-reflex-detector.ts, project-drift-detector.ts, regression-detector.ts, taste-validator.ts, validators/browser-evidence-collector.ts (head), sidecoach-entry-point.ts, lane-classifier.ts, verb-command-registry.ts (head); measured src LOC/file/test/handler counts; ran build + test.
