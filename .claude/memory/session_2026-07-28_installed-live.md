---
name: The install landed - today's work is live on Jonah's machine
description: Ran the installer against the live machine after the justify HOME-escape fix cleared the gate. verify-skills green, retired skills removed, shims intact, and the updated skill descriptions appeared in the lead's own context mid-run.
type: project
relates_to: [session_2026-07-28_deploy-decision.md, session_2026-07-28_install-rehearsal.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: verify-skills exit 0; retired skills confirmed removed; CLAUDE.md 451 lines with both key sections; all 10 shims clean; live skill list observed updating in-context
confidence: high
---

# Installed (2026-07-28)

Jonah approved the deploy gated on the justify HOME-escape fix. That fix landed and was
verified (escape suite 16/0, offline re-install 15/0, delegated writes 106/0), so the gate
cleared and the install ran.

## What was run

    bash install.sh --only <92 active components + skills> --yes

Built from the manifest's own state map rather than guessed: 92 components read `active`,
3 read `none` (`ampersand`, `model-routing`, `sidecoach-detect`). A bare `--yes` would have
installed those three, which Jonah never chose, so the picked set was enumerated explicitly
and a dry-run confirmed all three stayed unpicked.

`skills` was included deliberately. The rehearsal established that
`install_bundled_skill voice-output` appears in exactly one place, inside the loop gated on
`picked skills`, so picking the ten individual design keys would refresh nine and leave
voice-output stale with no flag that fixes it.

## Preconditions, all met before running

1. justify fix landed and verified.
2. `skills` in the picked set.
3. Online (`registry.npmjs.org` HTTP 200) - justify and lotus rebuild unconditionally and
   one step fetches; offline this exits 1 having changed nothing.
4. Backups taken for the three files the installer does NOT back up: `~/.claude/CLAUDE.md`,
   `~/.zshrc`, `~/.claude.json`, at
   `/Users/spare3/Documents/improv-preinstall-backup-20260728-205711/`. The two retired
   skills were already preserved at `improv-preserved-skills-20260728/`.

## Result

- `--verify-skills` exit 0: **15 skills, 56 files match their repo source**. It reported 14
  problems before.
- Both delegated skills verified current.
- `design-build` and `design-references` **removed** by the retirement sweep - its first
  real run, and it worked on ownership proven from the installer's own state record.
- `curate` now carries its Mode B recall behaviour (5 references).
- `~/.claude/CLAUDE.md` 451 lines with both key sections present.
- All ten `justify-*` shims in `/opt/homebrew/bin` still resolve correctly - the escape fix
  held through a real install.

## The confirmation nobody had to run

Mid-install, the skill list injected into THIS session's context changed. `design-build` and
`design-references` vanished from it and the reworded descriptions appeared - the ones that
now read "Invoke this skill when the task involves" rather than claiming to auto-trigger.
That is the deployment observed from the consuming side rather than inferred from the
installer's own output, which is the strongest evidence available and it arrived for free.

## Files touched

- none in the repo (deployment only)
