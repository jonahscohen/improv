---
name: SAFE external expert-taste-source ingest (Krehel + Kowalski) built
description: Read-only quarantine fetcher that pulls allowlisted taste SKILL.md bodies from external repos as UNTRUSTED DATA - never instructions, never executed, never auto-applied. Manifest + fetcher + test, hardened through two Codex passes.
type: project
relates_to: [reference_external_taste_sources.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests / codex-review
confidence: high
---

Built the SAFE external expert-taste-source ingestion component in sidecoach/, per the design in reference_external_taste_sources.md. Pulls expert taste content in as UNTRUSTED DATA for the miner; nothing fetched ever auto-applies or executes.

## What shipped

- **sidecoach/data/taste-sources.json** - pinned allowlist manifest. Two sources (jakub-krehel-skills = jakubkrehel/skills; emil-kowalski-skills = emilkowalski/skills), both MIT, each with upstream_copyright. allowlisted_paths are ONLY the taste SKILL.md bodies (jakub: better-ui/typography/colors/accessibility/layout/writing; emil: emil-design-eng/animate/review-animations/improve-animations/find-animation-opportunities/animation-vocabulary/apple-design). Superseded repo B (jakubkrehel single-skill interfaces repo) intentionally EXCLUDED. 13 paths total.
- **sidecoach/bin/sidecoach-taste-ingest.js** - read-only quarantine fetcher. Modes: --check (dry-run plan, default), --fetch (network), --offline --fixture (hermetic), --verify-allowlist (guard-only). Writes into reference/_extracted/external/<source>/skills/<name>/SKILL.md wrapped as UNTRUSTED SOURCE EXCERPT (nonce-tagged sentinels + dynamic tilde fence), plus provenance.json (source, repo_url, commit_sha, retrieved_utc, path, license, upstream_copyright, sha256) and snapshot.json (per-path sha256 for diff-since-last, reusing the sidecoach-refs content-hash shape). Fail-loud exit codes: 0 ok / 2 usage / 3 manifest / 4 allowlist / 5 network / 6 io / 10 changes(--fail-on-change) / 70 internal.
- **sidecoach/src/__tests__/taste-ingest.test.ts** - registered required:true in scripts/run-tests.ts. Green.
- **sidecoach/fixtures/taste-sources/** - manifest-good, manifest-forbidden (negative), bodies + bodies-changed for hermetic diff test.

## Hard safety constraints (all enforced in CODE, independent of the manifest)

Why: the manifest is data; a hostile/buggy manifest must not be able to cause a forbidden fetch. The guard is the load-bearing safety check and runs before any network or disk side effect.

- NEVER fetch/store AGENTS.md, CLAUDE.md, opencode.json, or anything under .claude-plugin/ (agent-directive injection vectors). Only exact-case SKILL.md bodies pass. Matching is case-insensitive for the forbidden set and rejects percent-encoding, so agents.md / .CLAUDE-PLUGIN / %2eclaude-plugin are all caught.
- Source slug validated (^[a-z0-9][a-z0-9-]*$) + every write goes through assertWithin(quarantineRoot, dest) so a "../.claude-plugin" source cannot escape the quarantine.
- Never executes fetched content: the process spawns nothing, requires nothing it fetched, no npx/installer. A test asserts the bin source contains no child_process/exec/spawn/npx.
- Network fetch restricted to https + a GitHub host allowlist with bounded redirects (SSRF-safe).
- Fetched bodies stored verbatim inside the untrusted fence; manifest metadata sanitized (yamlScalar) + control chars rejected at load so metadata can't break out of the front matter.

## Verification (proven, not claimed)

- Real network fetch works: jakub source pinned to real commit 6c43b20c, all 6 taste SKILL.md bodies fetched, ZERO forbidden files written. Proved the exclusion is MEANINGFUL - jakub's repo actually ships AGENTS.md/CLAUDE.md/opencode.json (all HTTP 200 upstream) and the fetcher never touches them.
- Diff-since-last: unchanged source no-ops (all "unchanged"); changed body flags "changed". --fail-on-change is a read-only gate (exits 10, advances NO baseline, idempotent).
- Forbidden manifest exits 4 and writes nothing. Corrupt snapshot (invalid JSON / null / array hashes) fails loud (exit 6).
- Test suite green via ts-node (the exact runner invocation). tsc --noEmit clean.

## Cross-model review (mandate)

Ran the deterministic Codex wrapper (~/.claude/hooks/codex-review.py) twice - the codex-rescue AGENT is blocked for REVIEW intent (silent-downgrade guard), so the wrapper is the sanctioned path. Pass 1 (real Codex, 195s) found 8 issues; folded in all High/Medium (encoded/case guard bypass, unvalidated source slug -> quarantine escape, unbounded redirect SSRF, --fail-on-change baseline mutation, YAML metadata injection, silent corrupt-snapshot reset, spoofable sentinels). Pass 2 (105s) confirmed the fixes sound with no guard bypass, and found 2 edge cases (null/array hashes accepted; unwrapped redirect URL throw) - both fixed and tested.

## Build-index registration (post-report fix, flagged by lead)

The tool-index generator (scripts/generate-tool-index.ts) sweeps bin/sidecoach-*.{js,mjs,sh} and HARD-FAILS the build if any has no DESCRIPTIONS entry. The new bin had none, so `npm run build` failed at generate-tool-index. Registered `sidecoach-taste-ingest` in DESCRIPTIONS. A concurrent edit also added an entry, producing a duplicate-key TS1117 build error; removed my duplicate and kept the refined on-disk one. `npm run build` now GREEN (0 tsc errors, generate-tool-index --check OK), unit test still green.

## Files touched
- sidecoach/scripts/generate-tool-index.ts (DESCRIPTIONS entry for the new bin)
- sidecoach/data/taste-sources.json (new)
- sidecoach/bin/sidecoach-taste-ingest.js (new)
- sidecoach/src/__tests__/taste-ingest.test.ts (new)
- sidecoach/fixtures/taste-sources/* (new: manifest-good, manifest-forbidden, bodies, bodies-changed)
- sidecoach/scripts/run-tests.ts (one line: register the suite)
