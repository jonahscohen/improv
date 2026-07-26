---
name: Orphan improv skill removed - stale rename orphan (improv -> justify)
description: Diagnosed ~/.claude/skills/improv/SKILL.md as a STALE rename orphan (superseded by justify), not a live skill missing its source. Removed it reversibly; deployed skill set now matches the repo and stays so on deploy.
type: project
relates_to: [session_2026-07-13_state-of-the-union.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: shell (repo-vs-deployed diff, installer grep)
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-26.

## What it was: a STALE RENAME ORPHAN (improv -> justify), not a live skill missing its source.

The deployed `~/.claude/skills/improv/SKILL.md` (7254 bytes, real file, mtime 2026-05-17) described a "Visual micro-adjustment tool for in-browser design refinement" - the exact tool that is now **justify**. Evidence it is the pre-rename version of justify, not an independent live skill:

- **Content identity.** improv and justify describe the same tool: same port **9223**, same three modes (Manipulate / Prompt / Annotate+Layout), same Claude-to-browser watch loop. improv loads `http://localhost:9223/improv-core.js` via `improv_*` MCP tools; justify loads `justify-core.js` on the same 9223 and evolved to a persistent HTTP daemon (no MCP). justify is the successor.
- **The project's own audit already named it.** `session_2026-07-13_state-of-the-union.md` Finding #4 (verbatim): "~/.claude/skills/improv/SKILL.md is deployed with no source - rename orphan install.sh will never clean." Ranked next-step #2 (verbatim): "delete orphan ~/.claude/skills/improv". `docs/plans/2026-07-14-parallel-dispatch-plan.md:79` Finding 4 repeats it.
- **The installer documents the rename.** `install.sh:76-85` records that `justify-source-guard.sh` "sat frozen at a pre-rename source path for a month." `justify/install.sh:178-179,222` warn that a "legacy `improv`" install binds the same 9223 and should be retired in favor of `justify`.
- **No repo source for improv, anywhere.** No `claude/skills/improv/` dir; no SKILL.md in the repo with `name: improv`; `git ls-files | grep skills/improv` = empty; every `improv` string in `install.sh` is installer/repo branding or marker comments (the *repo* was renamed claude-dotfiles -> improv - a separate rename from the *skill* rename). No installer path deploys `~/.claude/skills/improv`, so it is a pure pre-rename leftover.

## The successor (justify) is deployed AND sourced - proven before removing the orphan.

- Deployed: `~/.claude/skills/justify/SKILL.md` (13556 bytes) present.
- Sourced: generated from a git-tracked heredoc in `justify/install.sh:154-238` (`name: justify`), `__JUSTIFY_SRC__` sed-substituted at install time. That is why there is no standalone `claude/skills/justify/SKILL.md` - the source is the installer heredoc.
- Kept in sync on deploy: main `install.sh:4643-4646` runs `bash "$REPO_DIR/justify/install.sh"` when the `justify` component is picked.

## Fix applied
- Moved the orphan out of the live skill set to a reversible backup: `~/.claude/skills/improv/` -> `~/.claude/.orphan-backups/skills-improv-20260726-050552/` (SKILL.md preserved intact).
- **Why reversible (mv) not `rm`:** a hard delete of a file with no repo source is irreversible; the orphan is a duplicate of justify with no unique value, but moving to a stable backup satisfies the goal (deployed set no longer contains improv) while keeping it recoverable. The successor already carries all the content.
- Did **not** touch `~/.claude.json` - checked read-only: no legacy `improv` MCP server is registered (nor `justify`; justify now runs as an HTTP daemon, not MCP), so there was no MCP conflict to resolve. `justify/install.sh:178` says to ask before deleting a legacy improv MCP server's files anyway - out of scope here.

## Verification - deployed skill set now consistent with the repo
- `~/.claude/skills/`: improv **absent**, justify **present**. 18 skills, each with a repo source (17 from `claude/skills/*/SKILL.md` + justify from its heredoc installer).
- repo-vs-deployed diff: the only "deployed but not under claude/skills/" entry is `justify` - expected/correct (heredoc-sourced).
- Will it stay consistent on deploy? Yes. No installer path recreates `skills/improv`. `install.sh` "only ever adds and never prunes" (2026-07-14 finding), and `prune_broken_skill_symlinks` only clears broken *symlinks* - the orphan was a real file, which is exactly why the installer would never have cleaned it. Manual removal was the only path, and it is now done.

## Side observations (not acted on - out of scope)
- `claude/skills/consolidate/SKILL.md` exists in the repo but is NOT deployed on this machine (the reverse case: sourced-but-not-deployed). It is not an orphan (it has a source) and is a separate, benign per-machine selection gap.

## Files touched
- `~/.claude/skills/improv/` -> moved to `~/.claude/.orphan-backups/skills-improv-20260726-050552/` (deployed dotfile; no repo change)
- `.claude/memory/session_2026-07-26_orphan-improv-skill.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)

LEAD-INTEGRATED 2026-07-26 (commit f80f80ba): verified deployed `~/.claude/skills/` has improv absent + justify present, backup dir intact at `~/.claude/.orphan-backups/skills-improv-20260726-050552/`; committed the beat (the dir move is outside the repo, so no repo diff for it).
