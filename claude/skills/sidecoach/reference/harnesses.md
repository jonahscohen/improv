# harnesses: where sidecoach is installed, and how to prove it loaded

Load this when sidecoach is being used outside Claude Code, when a teammate asks whether their
harness has it, or after editing `SKILL.md` - because an edit reaches one harness immediately
and five others only after a reinstall.

## The install targets

`install.sh --only sidecoach` deploys the skill payload to `~/.claude/skills/sidecoach` and then
mirrors the same payload into every OTHER agent harness whose home directory already exists on
the machine.

| Harness | Skill root | Proof it loads |
|---|---|---|
| Claude Code | `~/.claude/skills/sidecoach` | the session's own skill listing |
| OpenCode | reads `~/.claude/skills` directly | `opencode debug skill` |
| Gemini CLI | `~/.gemini/skills/sidecoach` | `gemini skills list` |
| Codex CLI | `~/.codex/skills/sidecoach` | `codex debug prompt-input` |
| Cursor | `~/.cursor/skills/sidecoach` | no enumerator ships - presence only |
| Kiro | `~/.kiro/skills/sidecoach` | no enumerator ships - presence only |
| cross-harness | `~/.agents/skills/sidecoach` | read by several of the above |

Three of those are proven to LOAD it by the harness's own loader. Cursor and Kiro ship no
enumerator, so for those two the honest claim is "the payload is present at the documented
root", which is weaker, and it should be stated as weaker rather than rounded up.

**A harness whose home directory does not exist is skipped, never created.** Writing
`~/.trae/skills/sidecoach` on a machine with no Trae would raise the install count and reach
nobody. Reach is measured in harnesses that load it, not directories that contain it.

## Verifying, and the one command that answers it

```
./install.sh --verify-harness-skills sidecoach
```

Read-only. Exit 0 the mirrored payload matches the repo source everywhere, 1 something is
missing, stale or a dangling link, 2 usage. It distinguishes those three cases by name rather
than reporting a single "problem", because the fixes differ.

## Why the mirrored copies are real files, and what that costs

`~/.claude/skills` gets symlinks on a dev checkout, so editing `SKILL.md` is live immediately in
Claude Code. The mirrored harness copies are REAL FILES instead, and that is a measured decision
rather than an inconsistency: **Codex CLI does not follow a symlinked `SKILL.md`.** Deploying
links made sidecoach invisible in Codex while every byte-compare reported clean; swapping one
link for one copy made it appear immediately. Claude Code, OpenCode and Gemini CLI all follow
links; nothing on disk distinguishes the two behaviours.

The cost of copying is staleness, and it is a real cost with a real remedy:

**After editing `SKILL.md` or anything under `reference/`, run `./install.sh --only sidecoach --yes`,
or the other five harnesses keep serving the previous text.** The verify command above tells you
whether they are current, the end of every install run checks it automatically, and
`sidecoach doctor` reports the same class of gap.

The trade was made this way round because the two failures are not symmetrical. A stale copy has
three detectors. A symlink a harness silently ignores had none.

## Adding a harness

Add a row to `HARNESS_SKILL_ROOTS_DEFAULT` in `install.sh` as
`label:home-relative-path:skills-root-relative-path`. Both paths must be relative to `$HOME`;
absolute paths and `..` are refused, because relative paths are what makes a redirected `$HOME`
actually redirect.

Before adding one, PROBE IT. Two things to check, in this order:

1. **Does the harness already read `~/.claude/skills`?** OpenCode does, and a row for it would
   have deployed a second copy of a payload it already loads while inflating the target count
   with a gap that never existed. Several harnesses advertise Claude compatibility; check before
   adding.
2. **Does its loader actually see the file?** Not "is the path in its documentation" - run its
   enumerator. Codex's documented project path and its real global root are different
   directories, and the binary wins that disagreement.

## Related

- `doctor.md` - the same discoverability question asked about capabilities rather than harnesses.
- `tools.md` - the tools referenced by the payload that gets mirrored.
