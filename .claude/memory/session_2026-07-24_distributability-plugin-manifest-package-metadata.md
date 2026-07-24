---
name: Distributability GAP4 closeout - plugin manifest + package.json files allowlist + dogfood/test paths de-absolutized
description: Second and final bite of the distributability mission-primary gap. Closes the three items the SKILL.md-portability beat left deferred - the missing .claude-plugin/plugin.json, sidecoach/package.json's missing repository + files allowlist (a bare publish shipped 6132 files / 196.9MB), and the /Users/spare3 absolute HOME paths in src/dogfood-*.ts + 7 src/__tests__/*.ts. Codex cross-model review caught a runtime reference/ read my grep missed (folded); flagged one pre-existing external coupling (claude/hooks/sidecoach-lanes.json) as the remaining open item.
type: project
relates_to: [session_2026-07-24_distributability-skill-portability.md, session_2026-06-23_sidecoach-oracle-gap-analysis.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - all 5 gate checks green (manifest JSON.parse + fields; npm pack 6 top-level entries / 5.7MB / LEAKS NONE; grep /Users/spare3 in src exit 1; npm test 75 suites; npm run build exit 0 + generate-validators --check OK no drift). Codex cross-model review exit 0, both findings addressed.
confidence: high
---

Collaborator: Jonah. 2026-07-24. Named teammate "distrib". HEAD `e378a632`, three other teammates live in the tree. This closes the deferred list from `session_2026-07-24_distributability-skill-portability.md` (which fixed the live SKILL.md path blocker in commit `71e7902d`). No commit made (per task).

## Drift check FIRST (Team Rule #10) - the spec's own claims were partly stale
- "No plugin manifest anywhere" - TRUE. Created it.
- "package.json is bare: no description, no license, no repository, no files" - PARTLY STALE. At HEAD it ALREADY had description, author ("Jonah"), license ("MIT"), keywords (added in prior committed work 2e113048/da729219/996175e1, not by a live teammate - confirmed package.json is NOT in the concurrent uncommitted diff). Genuinely missing and grounded: `repository` + `files`. So deliverable 2 reduced to those two.
- Absolute paths in src/dogfood-*.ts + src/__tests__/*.ts - TRUE (10 hits across 10 files).

## What was done

### 1. Plugin manifest - `/.claude-plugin/plugin.json` (repo root)
Placement is FORCED, not a free design pick: a Claude Code plugin manifest cannot reference files outside its own root (`../` breaks post-install - confirmed against the official plugins-reference schema via the claude-code-guide agent). The sidecoach skill lives at `claude/skills/sidecoach/`, so the ONLY root that can (a) reach the real SKILL.md via an in-root `./claude/skills/sidecoach` path AND (b) avoid sweeping the 18 sibling skills is the repo root - it has no top-level `skills/` dir, so the default `<root>/skills/` scan finds nothing and the explicit `skills: ["./claude/skills/sidecoach"]` array adds exactly one skill. A `sidecoach/`-rooted manifest literally cannot see the skill (it is a repo-sibling of sidecoach/). Grounded fields only: name `sidecoach`, description (from SKILL.md/README), author `{name: "Jonah"}` (package.json), repository `https://github.com/jonahscohen/improv` (git remote), license MIT (package.json), keywords (package.json verbatim), skills array.
- OMITTED (per spec's omit-if-unknown clause, flagged): `version` (no coherent plugin-level version - package.json 0.1.0 is the intent-detector SUBpackage, README says "v3" as a generation title not a semver; the two conflict so any single value misleads), `homepage` (none declared anywhere; spec said do not invent), `author.email` (repo package metadata declares none; git email is a local-deploy hostname, session gmail is user-global not repo), `agents` (claude/agents/ does not exist - sidecoach provides ZERO agents). Also did NOT sweep the sibling design skills (social-media/design-team/visual-effects/icon-source) - they are independent per CLAUDE.md, not sidecoach's.

### 2. package.json - `repository` + `files` allowlist
Why it mattered: an UNMODIFIED `npm pack --dry-run` shipped **6132 files / 196.9 MB** (the entire eval/ corpus = 285M and mcp-server/ = 53M were in the tarball). Added a `files` allowlist. Membership verified by INSPECTION of what shipped dist code reads at runtime, not assumption:
- `dist/` (compiled engine + types), `bin/` (CLI + monitor/detect/present), `data/` (dist/icon-source-reference.js:203 reads `../data/icons/lucide.json`), `reference/` (dist/reference-loader.js:76 reads `../reference` - see Codex fold below).
- Result: 6 top-level entries (README.md, bin/ 8, data/ 1, dist/ 1201, package.json, reference/ 36), **5.7 MB**, LEAKS NONE, no .shots/corpus.
- `repository` is an object with `directory: "sidecoach"` (monorepo subdir) pointing at the git remote.
- Did NOT rename `sidecoach-intent-detector` (spec forbade). No external references to the name were found beyond package-local (bin self-map, README). Flagged the stale description ("14 workflows" vs SKILL's 26) but left it - out of scope, orchestrator's call.

### 3. Absolute HOME paths -> `__dirname`-relative (10 files)
`/Users/spare3/...` literals replaced with `path.resolve(__dirname, ...)`. Depth arithmetic is stable across src (ts-node) and dist (compiled) because src/ and dist/ are both direct children of sidecoach/:
- dogfood-runner.ts: repo root = `resolve(__dirname,'..','..')`. dogfood-craft-step2 / dogfood-teach-step1: `resolve(__dirname,'..','..','marketing-site')` (added `path` import to dogfood-runner). The existing fail-loud guard (marketing-site moved out of the repo 2026-07-13) still fires - behavior preserved, just portable.
- 6 tests reading repo-root `reference/DESIGN.md`: `resolve(__dirname,'..','..','..','reference','DESIGN.md')`. sprint9-product-md-parser reading `sidecoach/PRODUCT.md`: `resolve(__dirname,'..','..','PRODUCT.md')`. Codex confirmed every depth resolves to the identical old absolute target from both src and dist.

## Codex cross-model review (deterministic wrapper, exit 0, 271s) - findings + folds
Ran `git diff <my 11 files> + git diff --no-index /dev/null .claude-plugin/plugin.json | ~/.claude/hooks/codex-review.py "<prompt>" -C <repo>`. It CONFIRMED all __dirname depths, the manifest schema validity, and the data/ coverage. Two findings:
- **P2 (FOLDED):** `files` omitted `reference/`, which shipped `dist/reference-loader.js:76` reads at runtime via `resolve(__dirname,'..','reference')`. My original grep missed it because reference-loader aliases `__dirname` to `MODULE_DIR` first, dodging the `path.resolve(__dirname` pattern. Verified in the COMPILED dist (not just .ts), then added `"reference/"` to the allowlist. It is 540K / 36 files, soft-fail (module doc: "additive, never load-bearing") but a consumer needs it for full flow guidance. NOTE: reference/_extracted/external/ carries vendored third-party design libs (refactoring-ui, taste-skill, emil-design-eng, bencium-design, typeui-fundamentals, shadcn-ui, vercel guidelines) - shipping it redistributes them, same as the public git repo already does. Flagged for orchestrator awareness.
- **P1 (OPEN - deliberately not fixed):** shipped `dist/sidecoach-orchestrator.js:1014` (the `/sidecoach <phrase>` live-wiring path) reads `resolve(__dirname,'..','..','claude','hooks','sidecoach-lanes.json')` - a repo-SIBLING outside the sidecoach/ package. npm never ships repo-siblings, so a published `sidecoach-intent-detector` cannot resolve it. PRE-EXISTING and INDEPENDENT of my allowlist (the old 196MB default-pack also excluded claude/hooks - it is outside the package dir either way). Not fixed because: (a) out of the 3 assigned deliverables, (b) touches sidecoach-orchestrator.ts, a high-traffic file other teammates are in, (c) the fix (copy the registry into sidecoach/data/ and repoint the read) DUPLICATES a file install.sh separately deploys, introducing a sync problem - a design decision that belongs to the orchestrator, not an executor.

## Self-analysis (why P2 needed a second model to catch)
My runtime-dependency sweep grepped `path\.(resolve|join)\(\s*__dirname` and missed the ONE module that assigns `MODULE_DIR = __dirname` before resolving. Failure mode: I pattern-matched on the literal `__dirname` token adjacency instead of tracing the data flow (any alias of __dirname). Lesson for next packaging audit: grep for BOTH `__dirname` and any `const X = __dirname` alias, or better, inspect compiled dist for all `readFileSync`/`resolve` call sites rather than trusting a single token pattern. The cross-model review is exactly the backstop that caught it.

## Verify checks (real output)
1. Manifest: JSON.parse OK; keys name/description/author/repository/license/keywords/skills; skill dir + SKILL.md exist; version/homepage/agents absent (intended).
2. `npm pack --dry-run`: 6 top-level entries, 5.7MB, 1248 files, LEAKS NONE (eval/mcp-server/node_modules/fixtures/bundles/pages/docs/benchmarks/parity/scripts/src all excluded), no .shots/corpus.
3. `grep -rn "/Users/spare3" sidecoach/src/` -> exit 1, zero matches.
4. `npm test` -> EXIT 0, "run-tests: 75 suite(s) passed" (baseline held).
5. `npm run build` -> EXIT 0, "generate-validators --check: OK (registry valid, manifest present, no drift)", generated files unchanged.

## Still OPEN on distributability after me
- P1 above: the `/sidecoach <phrase>` -> claude/hooks/sidecoach-lanes.json external coupling. The single biggest remaining blocker to sidecoach being a self-contained installable plugin. Recommend as the next distributability task.
- The plugin manifest declares metadata + the skill only. It does NOT wire sidecoach's 6 hooks or its MCP server (out of the spec's enumerated scope; would over-claim and require format decisions). A truly Oracle-parity installable plugin (hooks + MCP self-contained, pin/unpin, update path) remains a larger restructure.
- package.json still has no plugin-level `version` and the description count is stale (14 vs 26).

## Files touched
- .claude-plugin/plugin.json (NEW)
- sidecoach/package.json (repository + files allowlist incl. reference/ fold)
- sidecoach/src/dogfood-runner.ts, dogfood-craft-step2.ts, dogfood-teach-step1.ts
- sidecoach/src/__tests__/: sprint11-flowa-personality-display, sprint10-canexecute-records-skip, sprint9-chain-continues-past-errors, sprint10-context-propagation, sprint9-product-md-parser, sprint9-design-tokens-autoload, sprint8-verb-parity (.test.ts)
- dist/ recompiled by the build gate (byproduct, not hand-edited)
