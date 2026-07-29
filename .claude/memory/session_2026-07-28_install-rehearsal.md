---
name: Installer rehearsal - the exact delta 23 commits would apply to this machine
description: Sandboxed the installer end to end against a real copy of the live write surface and measured the delta file by file. It completes cleanly and leaves verify_installed_skills GREEN, but only if the picked set includes the `skills` bundle key - voice-output's skill has no a la carte owner. Six installed skills whose content matches no commit were preserved before anything ran. Found that justify/install.sh escapes HOME and repointed the live /opt/homebrew/bin shims mid-rehearsal.
type: project
relates_to: [session_2026-07-28_skill-retirement.md, session_2026-07-28_skill-deploy-verify.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: sandboxed installer runs in four temp HOMEs seeded from a real clone of the live write surface; 8 negative controls (instrument, preservation comparator, safe-edit both directions, verifier tamper, ownership guard x4 states, deploy-mode probe); before/after sha256 inventory of 21210 live paths proving zero installer-owned paths changed; two independent read-only reviews of the five source claims (codex exec + clean-context Claude)
confidence: high
---

Collaborator: Jonah. 2026-07-28. Authored against HEAD 8ae761a4.

REHEARSAL ONLY. Nothing was installed to the live `~/.claude` or `~/.zshrc`. The deploy is
Jonah's call.

# The situation being measured

Twenty-three commits landed 2026-07-28 and almost none of it is live: every agent was
correctly told to sandbox, so `install.sh` had never actually run. `design-build` and
`design-references` were still installed, and 14 of 15 examined skills were stale copies.

# The exact delta a real install would apply

Measured by seeding a temp HOME with an APFS clone of the live write surface (`~/.claude`
minus the giant runtime dirs, plus `.zshrc`, `.claude.json`, `.config/cmux`, `.local/bin`,
`Library/LaunchAgents`, `.cache/whisper`), running the REAL repo's `install.sh` with `HOME`
overridden, and diffing a sha256 inventory before and after.

**(a) Retirement cleanup - 2 directories removed, no backup taken**

    - ~/.claude/skills/design-build/         (SKILL.md, content matches NO commit)
    - ~/.claude/skills/design-references/    (SKILL.md, matches commit 3239cd68)

Both fire because the live `.dotfiles-state` records them `active`, which is the positive
ownership claim `remove_retired_skills` demands. `rm -rf` runs with NO `backup_if_exists`
call, so design-build's bytes exist nowhere afterwards.

**(b) 54 skill files: real file -> symlink into the repo**

52 files in the main pass, plus `tilt-lab/SKILL.md` and `voice-output/SKILL.md` in the
`skills`-bundle pass. Across 14 skills: component-gallery-reference, consolidate, curate,
design-team, fontshare-reference, icon-source, motion-reference (2 files), reflect,
social-media, tactical-polish (6 files), task-list, tilt-lab, visual-effects (30 files),
voice-output. `hook_deploy_mode` returns `symlink` for this checkout, so from then on a repo
edit is live with no re-install.

**(c) Hooks: zero files created or changed, 2 wired into settings.json**

Every hook is already on disk as a correct symlink. The only settings.json change, measured
index-independently as a set of (event, matcher, command) triples, is two ADDITIONS:

    + PostToolUse [Bash]  ~/.claude/hooks/codex-failure-watcher.sh
    + PreToolUse  [Agent] ~/.claude/hooks/codex-rescue-guard.sh

Nothing is unwired. `permissions`, `mcpServers`, `env`, `enabledPlugins`, `statusLine` are
byte-identical. A naive key-path diff reports "+35 keys, -28 keys" - that is an array-index
shift artifact, not 28 removals, and it is worth knowing before someone panics at it.

**(d) Everything else**

- `~/.claude/CLAUDE.md`: 443 -> 451 lines. The two marker blocks SWAP ORDER (live is
  memory-discipline then brain; after, brain then memory-discipline). 4 lines are replaced
  by 7 - the a84186c5/534c1c38 rewrites saying what actually invokes a skill, the
  design-build retirement note, and the curate Mode-B note. Verified as a reorder-plus-edit,
  not a loss, by comparing sorted line multisets.
- `~/.zshrc`: +5 lines, one marker-guarded block adding the `voice-on` / `voice-off` aliases.
- `~/.claude.json`: the lotus MCP server's `command` changes from
  `/Users/spare3/.nvm/versions/node/v20.19.6/bin/node` to `/Users/spare3/.claude/cmux/node`.
- `~/.claude/justify/`: 4587 -> 6597 files. The current install holds only `dist/` and
  `server/`; a real run lands the whole justify source tree (`core/`, `assets/`).
- `~/.local/bin/sidecoach`: CREATED (absent today).
- `~/.claude/.dotfiles-state`: rewritten (sha stamp, run time, retired keys dropped).
- `~/Library/LaunchAgents/`: both plists already exist and would be rewritten identically.
- `/opt/homebrew/bin/`: 8 justify shims rewritten - see the escape finding below.

# The headline answer

**Yes, with one condition.** A real install on a machine in exactly this state completes
cleanly (exit 0) and the no-arg `./install.sh --verify-skills` sweep goes GREEN - measured,
0 -> 1 -> 0 across the rehearsal: 14 problems before, 2 after the main pass, 0 after adding
`skills,tilt-lab`, final `15 skill(s), 56 file(s) match their repo source`, exit 0.

The condition: **`claude/skills/voice-output/` has no a la carte owner.** `install_bundled_skill
voice-output` appears at exactly one place in the repo - the bundle loop gated on
`picked skills`. The `voice-output` component installs the TTS server and never touches its own
skill. So an install picking the ten individual design-skill keys covers nine of them and
leaves voice-output stale, and the sweep stays red at 1 problem that no other flag fixes.
Include `skills` (or use `--yes`).

Two refinements from the independent review, both of which soften this and matter to the
decision. First, it is a ONE-SHOT gap on this machine: `link_or_copy_data` symlinks on a
non-temp git checkout, so once `skills` deploys voice-output as a link there is no second copy
that can drift, and the sweep stays green from then on regardless of how later runs are
scoped. Second, "the sweep can never go green" is only true for an installed-but-stale skill -
`verify_installed_skills` has `[ -d "$root/$name" ] || continue` (line 732), so a skill that
was never installed is skipped rather than failed. This machine is the installed-but-stale
case, so the red is real here, but the claim does not generalise to a fresh machine.

Two adjacent facts the review surfaced that I had not looked for: `detect_component
voice-output` (line 3045) probes only `~/.claude/voice-output`, so the component can never
report itself stale on account of its skill; and `deactivate_voice_output` removes
`~/.claude/voice-output` but NOT `~/.claude/skills/voice-output`, where `deactivate_justify`
(3539) does remove its skill dir - so deactivating voice-output orphans the skill.

# The six irrecoverable skills, preserved BEFORE anything ran

Installed content matching no commit in any branch (so overwriting destroys it):

    component-gallery-reference   fontshare-reference   social-media
    consolidate                   lotus                 design-build

Preserved at `/Users/spare3/Documents/improv-preserved-skills-20260728/` - a directory copy
plus a tarball of all 20 installed skills (58 files, 2 symlinks). Verified byte-identical
against the live originals twice (through the copy and through a tarball round-trip), with a
comparator negative control proving a one-line tamper is detected.

Note `lotus`: its SKILL.md is templated at install time by `lotus/install.sh`, which writes it
with its own `atomic_install_file` (lotus/install.sh:634) and never calls `backup_if_exists`.
It is overwritten with no backup at all. `justify` does the same thing through a different
primitive - `atomic_write_from_stdin` (justify/install.sh:972-979), because its SKILL.md is
generated from a heredoc rather than copied. I first wrote that both used
`atomic_install_file`; the independent review caught it.

An earlier measurement of this set was WRONG and the correction matters: zsh applies history
modifiers to parameter expansions, so `git rev-parse "$c:claude/skills/..."` silently became
`$c` with the `:c` modifier applied plus `laude/skills/...`, and every history lookup
returned "absent". The Bash tool on this machine is zsh 5.9, not bash. Always
`"${c}:${path}"`, and be suspicious when a history walk reports that NOTHING ever matched.

# What genuinely ran, and what the component set never reached

RAN:

- **Retirement sweep** - removed both skills, and its ownership guard was exercised across
  all four state values.
- **`verify_installed_skills`** - both the end-of-install gate (scoped to what the run
  deployed) and the read-only `--verify-skills` sweep, red and green, plus a tamper control.
- **The `.zshrc` safe-edit primitive** - against a real copy of Jonah's actual `~/.zshrc`,
  in both directions (wrote the block; refused and preserved the file when read-only).
- **Delegated installers** - `justify/install.sh` and `lotus/install.sh` both ran to
  completion, and `verify_delegated_skill` passed for both. `sidecoach` and `tilt-lab` builds
  ran too.
- **The failure ledger** - exercised, and it did NOT carry the read-only-`.zshrc` failure.
  See below.

NOT REACHED: the `ampersand` component (state `not-installed`, so a faithful run does not
pick it) and the two default-off hooks `sidecoach-detect` and `model-router-guard`. Nothing
about those is verified here.

# Findings

**0. A RE-INSTALL OF THIS ALREADY-COMPLETE MACHINE EXITS 1 IF THE NETWORK IS DOWN.** The
single most decision-relevant thing found, and it came from the independent review rather than
from my runs, because both my runs had network. `justify/install.sh:709-724` and
`lotus/install.sh:560-570` rebuild unconditionally with `|| exit 4` on each step, and
justify's chain includes `npx -y tsc`, which FETCHES. Those non-zero exits are caught at
install.sh:6959-6966 and 6978-6983 and routed into `PARTIAL_FAILURES`, so the whole run prints
"did NOT fully apply every component" and exits 1 - having changed nothing about the machine.
Run this online, or leave `justify` and `lotus` out of the picked set.

**1. `justify/install.sh` escapes `$HOME`, and its guard does not catch a non-temp sandbox.**
It plants 8 CLI shims into the first writable of `/usr/local/bin`, `/opt/homebrew/bin`,
`~/.local/bin`. The guard added after the 2026-07-16 incident only refuses when the target
resolves under a TEMP root. A sandbox HOME at `/Users/spare3/Documents/reh-sandbox-B` is not
a temp path, so the guard passed and the run repointed all 8 live `/opt/homebrew/bin/justify-*`
symlinks at the sandbox. Detected in the run log, restored to
`/Users/spare3/.claude/justify/*.sh`, and corroborated against the two sibling shims the run
never touched (`justify-validating`, `justify-working`) which still pointed there. Any agent
who "sandboxed" a justify install by overriding HOME alone has silently broken the live CLI.

Three details from the independent review that make this worse than I first stated. The planting
loop refuses only a regular FILE or a DIRECTORY at a shim name; an existing SYMLINK - which is
exactly what a healthy shim is - falls straight through to `ln -sfn` and is silently repointed.
The verification loop afterwards then PASSES, because the links do resolve correctly into the
sandbox, so the run reports success over a broken host CLI. And when the guard DOES fire it is
not a warning but `exit 1` aborting the whole justify install, while the remedy it prints ("set
BIN_DIR inside the temp tree") cannot work, because line 762 unconditionally resets
`BIN_DIR=""` before the probe and discards any environment override.

**2. The read-only-`.zshrc` failure is fail-loud but does NOT go through the ledger.** The run
exits 1 with an explicit "FAILED to write ... your original contents are at <path>" and the
file is left byte-identical - the primitive is sound. But the abort happens at a bare
redirect under errexit, so the run dies mid-way: the "This run did NOT fully apply every
component" summary never prints and later components are skipped entirely. The message also
claims it "FAILED to restore" when the original was never modified.

**3. `config` and `memory` fight over `startup-check.sh` on every run.** `config` copies it
with `safe_cp`; `memory` then symlinks it, backing up the real file `config` just created.
Net change zero, but every run emits a spurious `[warn] Backed up .../startup-check.sh` and
writes a redundant backup file.

**4. `.backups/` does not cover the whole rollback.** It captured 54 files (52 skill files,
settings.json, startup-check.sh) and restores correctly - 52 of 52 verified byte-identical to
the live pre-install originals. Not covered: the two deleted retired skills, `~/.claude/CLAUDE.md`,
`~/.zshrc`, `~/.claude.json`, and anything the delegated installers write. Also, the
`settings.json` it saves has the pre-run hook set (93 hooks) but `config`'s restructured
PreCompact/PostCompact grouping - restoring it is functionally correct, structurally not the
original file.

**5. A real install does not dirty the repo, despite building in it.** `--only sidecoach`
runs `npm install && npm run build` inside `$REPO_DIR`, and `sidecoach/dist` holds 1205
TRACKED files; `generate-lanes` writes `sidecoach/src/lanes.generated.ts` and
`LANES.generated.md`. Measured against an isolated clone: `git status --porcelain` was
identical before and after, so the generated output matches what is committed. The build is
reproducible. This was isolated in a clone rather than trusted, because the failure mode
would have been 1205 dirty tracked files in the live repo.

**6. Component detection reports a hook "active" on file presence, not settings wiring.** All
95 leaves except three read `active`, yet the run wired two hooks that were on disk and
unwired. `is_our_hook` checks the symlink; it does not check settings.json.

# Independent review - two reviewers, five claims, read-only

Both were run because the first (Codex) returned only terse verdicts and this unit's whole
value is the delta being right. The second went materially deeper and changed two conclusions,
which is the argument for not stopping at one reviewer on a unit someone will act on.

Run as `codex exec --sandbox read-only` on the five load-bearing source claims above.
Verdicts: CLAIM 1 CONFIRMED, CLAIM 2 CONFIRMED, CLAIM 3 CONFIRMED, CLAIM 4 **PARTIAL**,
CLAIM 5 CONFIRMED. The PARTIAL is a real error of mine, corrected above: justify writes its
SKILL.md with `atomic_write_from_stdin`, not `atomic_install_file`. Substance unaffected -
neither primitive calls `backup_if_exists`.

Four further findings it raised, all cited and all folded here:

- **install.sh:6087-6091** - the memory block backs up `~/.claude/settings.json` on every run
  where it is a real file, BEFORE knowing whether the merge changes anything. This is the
  mechanism behind the redundant settings.json backup measured in finding 4.
- **install.sh:6998-7005 and 7088** - a Sidecoach BUILD FAILURE is only a `warn`. The run then
  installs the skill anyway and prints "Sidecoach installed". A machine with a broken
  sidecoach build gets a confident success line.
- **install.sh:6950-6963 with justify/install.sh:643-661,708-722** - picking `justify` ALWAYS
  recopies its payload and reruns `npm install` plus both builds. There is no
  already-current skip, which is why the rehearsal's justify pass moved 2010 files.
- **install.sh:6973-6980 with lotus/install.sh:559-568** - picking `lotus` ALWAYS rebuilds the
  plugin and the MCP server inside the repo checkout.

Taken together the last two are the practical argument for NOT re-running `--yes` casually on
this machine: `justify`, `lotus` and `sidecoach` all rebuild unconditionally inside the repo,
and `sidecoach/dist` holds 1205 tracked files.

**Second reviewer (independent Claude, clean context, read-only).** CLAIM 1 PARTIAL, 2
CONFIRMED, 3 CONFIRMED, 4 PARTIAL (same `atomic_write_from_stdin` correction, independently),
5 CONFIRMED. Its CLAIM 1 refinements and the CLAIM 5 detail are folded into their own sections
above rather than left here. Its own four findings, beyond Codex's:

- **install.sh:6088-6089** - `memory` calls `backup_if_exists "$USER_SETTINGS"`
  UNCONDITIONALLY, before the merge, and the merge is itself idempotent via `already_present`
  markers (6100-6128). So every run writes a full settings.json copy into a fresh
  `.backups/<timestamp>/` and prints "Backups saved to" having changed nothing. This is why my
  rehearsal produced two backup directories.
- **install.sh:6998-6999** - `sidecoach` has NO `node_modules`/`dist` guard (contrast tilt-lab
  at 7300-7307, which skips when `node_modules` exists), and its failure path is `warn`, not
  `record_component_failure`. A broken or offline sidecoach build reaches "Installation
  complete." and exit 0.
- **justify/install.sh:709-724 and lotus/install.sh:560-570** - the fatal unconditional
  rebuild, promoted to finding 0 above.
- **install.sh:6329-6337** - `ghostty` (behind `--personal`) backs up before an unconditional
  `sed > target`, so it also accumulates a timestamped backup dir per run with byte-identical
  content. Not in this machine's set; recorded because it is the same defect class as 3 and 4.

Note the pattern across findings 3, 4, the settings.json one and the ghostty one: four separate
sites take a backup BEFORE knowing whether they will change anything. That is why `.backups/`
has 349 entries.

# Rollback plan

If Jonah applies this and something is wrong:

1. **The two deleted skills** - `tar xzf /Users/spare3/Documents/improv-preserved-skills-20260728/skills-installed-live.tar.gz`
   and copy `skills-installed-live/design-build` and `.../design-references` back into
   `~/.claude/skills/`. Not in `.backups`. design-references is also recoverable from git at
   `3239cd68:claude/skills/design-references/SKILL.md`; design-build is not recoverable from
   git at all. Re-running the installer will delete them again unless the `.dotfiles-state`
   keys stay absent.
2. **Any skill file** - `cp -R <repo>/.backups/<newest-timestamp>/.claude/skills/. ~/.claude/skills/`,
   or from the same preservation tarball. Verified restorable.
3. **`~/.claude/CLAUDE.md`** - not backed up. Both blocks are marker-guarded
   (`<!-- improv:brain:begin/end -->`, `<!-- improv:memory-discipline:begin/end -->`), so
   delete the block you want gone. Pre-existing dated `.bak` copies are in `~/.claude/`.
4. **`~/.zshrc`** - not backed up. Delete the `# === improv:voice-output:begin/end ===` block;
   it is the only addition.
5. **`settings.json`** - `cp <repo>/.backups/<newest-timestamp>/.claude/settings.json ~/.claude/settings.json`,
   accepting the PreCompact/PostCompact regrouping. Or delete the two added hook entries.
6. **`~/.claude.json`** - Claude Code keeps its own rolling backups at
   `~/.claude/backups/.claude.json.backup.<epoch-ms>`; the installer takes none. The only
   installer change is the lotus MCP `command` path.
7. **`/opt/homebrew/bin/justify-*`** - if these ever point somewhere wrong,
   `ln -sfn ~/.claude/justify/<script>.sh /opt/homebrew/bin/<name>` for each of the 8.
8. **Whole-component removal** - `./install.sh --apply-plan` with the leaf in `uninstall`.
   Note the known pre-existing defect: deactivating `tactical-polish` reports failure and
   abandons the rest of the plan even though the skill is removed.

# Negative controls - a clean result that could not have failed proves nothing

| Control | Result |
|---|---|
| Snapshot instrument, one byte changed in a fixture | diff non-empty - instrument is not blind |
| Preservation comparator, one line appended | tamper detected |
| `--only nvm` with the line already present, read-only `.zshrc` | exit 0 - THE TEST WAS VACUOUS, redesigned |
| `--only nvm` with the line ABSENT, writable | exit 0, `.zshrc` 60 -> 63 lines |
| `--only nvm` with the line ABSENT, read-only | exit 1, `.zshrc` byte-identical |
| `--verify-skills` clean, then link replaced by a real file, then restored | 0 -> 1 -> 0 |
| Retirement sweep across state `active` / `inactive` / `not-installed` / no key | removed / left / left / left |
| `hook_deploy_mode` for real repo, clone, `$TMPDIR` repo | symlink / symlink / copy |

The third row is the honest one. My first negative case exited 0 and I nearly recorded that
as "the ledger does not fire". It did not fire because Jonah's `.zshrc` already had the nvm
line, so nothing needed writing - the assertion could not have failed for the reason I
thought it was testing. The same failure mode is recorded in
`session_2026-07-28_skill-deploy-verify.md`, one section down from where I read it.

# Proof the live machine is untouched

sha256 inventory of 21210 live paths before, 21211 after. 19 lines differ, across 15 paths,
every one of them Claude Code's own runtime: `.claude.json` and ten of its rolling backups,
`.last-fix-file`, a `.justify-watch-standing-by.<session-id>` flag from a hook in this very
session, `sidecoach-flow-history.json`, and a teammate inbox. A pattern match for every
installer-owned path class (`hooks/`, `skills/`, `agents/`, `CLAUDE.md`, `settings.json`,
`.dotfiles-state`, the top-level scripts, `.zshrc`, `.config/cmux`, `.local/bin`,
`LaunchAgents`) against the diff returns nothing, and the pattern was controlled against a
synthetic hit line to prove it is not vacuous.

`~/.claude/skills` still has 19 entries including both retired ones, and `--verify-skills`
still reports the same 14 problems across 15 skills it reported at the start.

Repo: HEAD 8ae761a4 unchanged, no commits. `.backups/` restored to its exact pre-rehearsal
listing of 349 entries (both rehearsal backup dirs copied out to the preservation directory,
then removed). The working tree carries another agent's concurrent sidecoach taste-validator
work; none of it is mine, and all my scratch lived in `/tmp/reh` and four now-deleted
`~/Documents/reh-*` trees.

# Trap notes for the next agent

- `install.sh` derives `REPO_DIR` from `dirname "$0"`, so a copy under `$TMPDIR` both resolves
  back wrong AND flips `hook_deploy_mode` to `copy`. Run the REAL script with `HOME` overridden.
- `BACKUP_DIR` is `$REPO_DIR/.backups/<ts>`, so a sandboxed run still writes into the repo. It
  is gitignored, so `git status` will not tell you.
- Overriding `HOME` is NOT sufficient isolation. `justify/install.sh` writes to
  `/opt/homebrew/bin` and `sidecoach`/`lotus` build inside `$REPO_DIR`. Use a non-temp clone
  for those, and check `/opt/homebrew/bin` afterwards.
- The Bash tool is zsh. `"$var:literal"` is a history modifier, not concatenation.

# Files touched

None in the repo except this beat and the MEMORY.md index line. No code changed, so the
code-review gate has no diff to review; instead every instrument used here carries a negative
control, and the five load-bearing source claims went through two independent read-only reviews
(a different-model Codex pass and a clean-context Claude pass). Between them: three claims
confirmed twice, one correction found by both, and two conclusions materially refined - the
voice-output gap is one-shot rather than permanent, and an offline re-install of this
already-complete machine exits 1 without changing anything.

One live repair was made outside the repo and outside `~/.claude`: the eight
`/opt/homebrew/bin/justify-*` symlinks, which this rehearsal repointed at a sandbox and which
were restored to `/Users/spare3/.claude/justify/*.sh`.
