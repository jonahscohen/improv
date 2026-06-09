---
name: Rename claude-dotfiles project to "Improv" - plan (not yet executed)
description: Jonah decided to rename the whole project to Improv; chose plan-first. Triage of 915 occurrences + collision + phased plan.
type: decision
relates_to: [decision_improv_renamed_to_endow.md]
---

Collaborator: Jonah. 2026-06-08.

Decision: rename the **claude-dotfiles** project to **"Improv"**. User chose "plan it first, don't execute" (AskUserQuestion). NOTHING renamed yet.

## Triage of 915 "claude-dotfiles" occurrences (185 files: 91 beats + 94 non-beat)
- **A. Brand/display name (rename target, ~120 hits):** README (10), marketing-site visible copy (62 across 6 pages), reference (21), CLAUDE.md/docs product mentions, the Figma feature-tree title.
- **B. Outward infrastructure:** git remote github.com/jonahscohen/claude-dotfiles, local repo dir, install domain get.claude-dotfiles.dev, the curl install command. Needs Jonah's hands (GitHub rename + DNS).
- **C. Technical/internal, keep stable:** install.sh shell-marker tokens `# === claude-dotfiles:* ===` (6 unique) - renaming BREAKS uninstall on already-installed machines (markers in ~/.zshrc won't match); package.json names; ~/.claude paths are unaffected (they're .claude, not claude-dotfiles).
- **D. Historical record, leave alone (~600 hits):** absolute paths + citations in beats and docs/superpowers/plans. Repo convention = don't rewrite history, add a substitution note (mirrors improv->endow).

## Name collision (the catch)
"improv" already appears in 92 non-beat files as the RETIRED name of the Justify tool (improv -> offers -> endow -> justify): sidecoach 48, docs 12, claude 12, justify 11, reference 3, test-site-1 2, marketing 1, lotus 1; plus gitignored public/improv-core.js. New PROJECT "Improv" (capital, the toolkit) coexists with legacy lowercase "improv" (= old Justify). Plan: leave legacy refs historical; introduce "Improv" only as project brand. See [[decision_improv_renamed_to_endow.md]].

## Phased plan (each reversible; approve before execute)
1. Brand & docs: README title/prose, marketing-site + reference visible copy, CLAUDE.md/docs product mentions, Figma retitle. Leave install command/URLs/domain for phase 3.
2. Installer (careful): rename user-facing echo strings to Improv; KEEP marker token "claude-dotfiles" internally (or add dual-marker migration) for uninstall-compat; leave package.json names.
3. Outward infra (Jonah's hands + my prep): GitHub repo rename + git remote + URL refs; install domain decision; optional local folder rename ./claude-dotfiles -> ./improv (re-point cmux surfaces/tooling).
4. History: add a "renamed to Improv" decision beat w/ substitution note; do NOT rewrite the ~600 historical paths.

## Open decisions for Jonah
1. Install domain: keep get.claude-dotfiles.dev or new (which)?
2. Rename local folder + GitHub repo now, or brand-only for now?
3. Legacy lowercase "improv" (Justify history): leave (recommended) or sweep?
4. Shell-marker token: keep "claude-dotfiles" internally for compat (recommended) or rename w/ migration?

## APPROVED decisions (2026-06-08)
- Domain `claude-dotfiles.dev` was a made-up placeholder -> becomes `improv.dev` placeholder (still not real).
- Rename GitHub repo + local folder: claude-dotfiles -> improv (lowercase). Brand/display -> "Improv" (capital).
- Shell-marker tokens -> `improv:` WITH dual-match migration (deactivate matches old `claude-dotfiles:` AND new `improv:`).
- Beats stay frozen = ALL `.claude/memory/**` (root + nested: sidecoach, justify, reference, tilt-lab).
- docs/superpowers/** FROZEN like beats (archive). `.bak` + `.backups/` frozen.
- Legacy improv -> justify: AUDIT FINDING - already done in live code. Guard hooks already use `__justify` (only `.bak` say `__improv`). sidecoach/src/flows.ts "improv" hits are the WORD "improve" (must NOT touch). justify/install.sh "improv" = intentional retirement notes (must stay). Net: improv->justify is ~a no-op for live assets (maybe one stale .gitignore line). Word-boundary only; protect "improve".

## SWEEP set (live assets)
README.md, marketing-site/*, reference/*.html + main.js, claude/CLAUDE.md + RULES.md, install.sh, bootstrap.sh, SIDECOACH_*.md, TASKS.md, top-level docs, Figma feature-tree title. Casing: technical (folder/repo/domain/marker/path) -> `improv`; brand/prose/title -> `Improv`/`IMPROV`.

## Execution order
branch feat/rename-to-improv -> technical seds (urls/domain/paths/markers) -> brand edits (Improv) -> install.sh marker dual-match migration -> verify (grep + site screenshots) -> Figma retitle -> infra LAST (gh repo rename improv + git remote + folder move ./claude-dotfiles->./improv, stop servers first, session cwd breaks).

## STAGE A DONE (2026-06-08, branch feat/rename-to-improv)
Identity/brand renamed in 24 folder-independent files: README, marketing-site/*, reference/*, claude/CLAUDE.md, claude/RULES.md, install.sh, bootstrap.sh, SIDECOACH_AUDIT_REPORT, TASKS, skills, memory-discipline-section, tilt-lab-launcher.
- brand word claude-dotfiles -> Improv; CLAUDE-DOTFILES -> IMPROV; github URLs -> jonahscohen/improv; domain get.claude-dotfiles.dev -> get.improv.dev.
- Shell markers `# === claude-dotfiles:X ===` -> `=== improv:X ===`; HTML markers `<!-- claude-dotfiles:X -->` -> `<!-- improv:X -->` (both lowercase).
- Migration: added `migrate_legacy_markers()` to install.sh (rewrites legacy `claude-dotfiles:` markers in ~/.zshrc + ~/.claude/CLAUDE.md to `improv:`); called at top of deactivate_component() and before the brain install block. Satisfies "markers renamed with a migration."
- Verified: bash -n install.sh + bootstrap.sh OK; marketing site renders IMPROV eyebrow + get.improv.dev; reference title "Improv reference".

### Self-analysis (bug caught by verification)
My brand perl pass `(?<![/\w])claude-dotfiles(?![/\w]) -> Improv` wrongly capitalized the HTML-comment install markers `<!-- claude-dotfiles:brain:begin -->` to `<!-- Improv:... -->` (the `:` after the token isn't blocked by the lookahead). Why: I only pre-lowercased the shell `=== ` markers, not the `<!-- ` HTML markers, before the brand pass. Caught it by reading the CLAUDE.md diff the harness surfaced. Fixed by lowercasing `<!-- Improv:` -> `<!-- improv:`. Lesson: handle ALL marker syntaxes (=== and <!--) before any brand-casing pass.

## STAGE B - REMAINING (not started; breaks this session)
- FS paths `/Github/claude-dotfiles` + `claude-dotfiles/` (~30 leftover in Stage-A files + sidecoach/*, hooks, lotus/install.sh) -> improv. Coupled to the actual folder move.
- `gh repo rename improv` + `git remote set-url`.
- Local folder `./claude-dotfiles -> ./improv` (stop the 8765/8766 servers first; THIS session's cwd dies -> needs restart in new path).
- sidecoach: edit src absolute paths + .mcp.json + REBUILD dist (never hand-edit dist).
- Final: grep clean (no claude-dotfiles outside beats/docs-superpowers/.bak), re-verify install dry-run, Figma feature-tree retitle.

## STAGE B IN PROGRESS (2026-06-08, user said "go now")
- Stopped the running 8765/8766 http servers (folder is about to move).
- FS-path + identifier sweep across all non-frozen, non-dist files: `/Github/claude-dotfiles` + `claude-dotfiles/` + bare paths -> improv; `CLAUDE_DOTFILES_DIR/REPO` -> `IMPROV_DIR/REPO`; brand stragglers in new files -> Improv. install.sh swept with `claude-dotfiles(?!:)` so the `migrate_legacy_markers` legacy token `claude-dotfiles:` is preserved (verified intact, lines ~1089/1096/1097).
- Legacy improv->justify cleanup: `.gitignore` `public/improv-core.js` -> `public/justify-core.js` (actual built file is justify-core.js).
- sidecoach/dist: restored from HEAD then path-string-renamed only (clean diff). FULL rebuild blocked by a PRE-EXISTING tsconfig rootDir error (`src/__tests__/t16-bench-ledger.test.ts` imports `benchmarks/runner/run-all.ts` outside rootDir) - NOT caused by the rename. Flag to fix separately; run `cd sidecoach && npm run build` after that's fixed.
- Gotcha logged: `mapfile` is unavailable in zsh - the first two sweep loops were silent no-ops; use a pipe-fed `while IFS= read -r` loop (or a hardcoded array, as Stage A did) instead.
- VERIFY: zero `claude-dotfiles` outside frozen (beats/docs-superpowers/.bak/.backups) except the intentional install.sh migration token. bash -n install.sh + bootstrap.sh OK.

### STILL TO DO in Stage B (this session, then it breaks)
1. commit Stage B.
2. `gh repo rename improv` + `git remote set-url origin .../improv.git`.
3. Figma feature-tree retitle claude-dotfiles -> Improv (file DdAztWiuZpXbmyrJutSfLw).
4. FOLDER MOVE LAST: `mv ~/Documents/Github/claude-dotfiles ~/Documents/Github/improv` -> THIS session's cwd dies. User restarts Claude in `~/Documents/Github/improv`, then merges feat/rename-to-improv to main + verifies (install dry-run, sidecoach rebuild once the pre-existing tsconfig error is fixed).

Status: STAGE B executing; folder move + restart imminent.
