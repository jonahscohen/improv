---
name: Codex-designed repairs to the skills and docs auto-trigger edit
description: Codex designed and re-reviewed 8 repairs across CLAUDE.md, 18 SKILL.md files and browser-tree.json; the QA-triad contradiction resolved as manual-with-partial-hook-coverage, terminology standardized on "when the task involves", trigger tokens proven unchanged in repo AND installed copies
type: project
relates_to: [session_2026-07-28_codex-vets-skills-edit.md, session_2026-07-28_skills-never-fire.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: codex-review (2 passes, both exit 0) + 226 hook-test assertions + a mutation-tested invariant checker
confidence: high
---

Repair pass on the skills/docs edit that `session_2026-07-28_codex-vets-skills-edit.md` flagged. Codex designed every fix and re-reviewed the final diff, per Jonah's directive that Codex drive the repairs rather than the Claude side self-assess. Both wrapper calls used `~/.claude/hooks/codex-review.py` (never `codex exec`, never the codex-rescue agent) and both returned exit 0.

## The premise correction that reframed the unit

A prior agent claimed skills never auto-trigger because zero hooks invoke the Skill tool. Codex rejected it and is right: a shell hook cannot invoke a tool at all, so that is a strawman. The repo actually conflates THREE distinct mechanisms, and the repairs turn on separating them:

1. **Hook-injected context nudges** - real and automatic. `sidecoach-keyword.sh` (17870 bytes, UserPromptSubmit, live in settings) genuinely fires on prompt keywords.
2. **Skill-tool invocation** - explicit. Only the model or the user does it. No hook can.
3. **Description-based model selection** - real, and what "auto-trigger" loosely means to any normal reader.

"No mechanism auto-fires skills" is FALSE as written and was not propagated.

## Decisions

**QA triad contradiction (design-build:15 vs CLAUDE.md:42): resolved as a required MANUAL or ORCHESTRATED step, not mechanical.**
Why: measured, not assumed. Live `~/.claude/settings.json` registers `sidecoach-keyword.sh`, `sidecoach-taste-gate.sh`, `sidecoach-postresponse.sh`, `sidecoach-sessionstart.sh`, `sidecoach-preamble.sh`. Of those, only `sidecoach-taste-gate.sh` does QA work, and it is a strict SUBSET of `/sidecoach audit`: it fires on `.html`/`.css` writes under a directory containing DESIGN.md, runs the anti-pattern ban sweep on both, and runs the taste validator only on an edited `.html` (`fp.endswith(".html")` gate at taste-gate line 118) plus the project `styles.css`. `sidecoach-detect.sh` says in its own header it is "NOT auto-registered into settings.json" and is off by default; it is absent from live settings. `sidecoach-postresponse.sh` only prints results of an ALREADY-ACTIVE flow. Nothing anywhere runs `/sidecoach critique` or `/sidecoach polish`.
How: both files now state the same thing and name the partial coverage precisely rather than either overclaiming enforcement or denying that any exists.

**Terminology standardized on "Invoke this skill when the TASK involves" across all 14 edited descriptions.**
Why: "request" overfits to explicit user wording; "task" admits inferred work. Several of these skills exist precisely to be selected when the user does NOT name the domain (`motion-reference`: "use even when the user does not name a library"; `design-references`: "use even when the user does not mention references explicitly"). "request" would have quietly REDUCED invocation for exactly the skills that most need inferred selection.

**Install drift NOT fixed here - reported to the installer owner instead.** `install_bundled_skill()` uses `safe_cp`, so `~/.claude/skills/*` are copies, while every `claude/hooks/*.sh` deploys as a SYMLINK via `link_or_copy()` and data files via `link_or_copy_data()`. `sidecoach` is the lone skill with an explicit `ln -sf` (install.sh:5547-5549), which is why its edit went live mid-session while the others stayed inert.

## Changes

- `claude/CLAUDE.md:32` - sidecoach front-door sentence now separates description-based selection from the `sidecoach-keyword.sh` context nudge, and states plainly that a hook can inject context but cannot call a tool.
- `claude/CLAUDE.md:42-49` - QA gate relabeled a required manual/orchestrated step; item 4's wait-and-see branch ("manually invoke /tactical-polish if it doesn't fire") deleted; a new paragraph names the real mechanical coverage and its exact limits.
- `claude/CLAUDE.md:57` - peer-skills sentence no longer claims each "auto-triggers on its own keywords".
- `claude/skills/sidecoach/SKILL.md:3` - "Also triggers on:" -> "Also invoke this skill when the task involves:" (the frontmatter used to argue trigger language was fiction still carried it).
- `claude/skills/sidecoach/SKILL.md:230` - tactical-polish "Applies on UI keywords" -> "is the tactical reference for UI detail work" (the old phrasing still implied automatic firing).
- `claude/skills/sidecoach/SKILL.md:232` - restored the trivial-edit carve-out that the new unconditional mandate had collided with (line 226), and removed the baked-in "measured across 417 real transcripts ... invoked zero times" statistic. A point-in-time diagnostic in a durable instruction file keeps steering with false authority once stale.
- `claude/skills/lotus/SKILL.md:3`, `claude/skills/voice-output/SKILL.md:3` - same frontmatter reframing; voice-output's negative case restated as "has no keyword invocation list" rather than "does NOT auto-trigger".
- `claude/skills/design-build/SKILL.md:3, 8, 14, 174, 197, 248, 255, 257` - terminology reconciled WITHOUT erasing the dated 2026-05-20 retrospective finding; the finding is now explicitly attributed as "called auto-triggering in the 2026-05-20 retrospective". Also fixed a pre-existing count error: Phase 7 said tactical-polish has "14 rules" while listing 16.
- `claude/skills/design-references/SKILL.md:138`, `claude/skills/curate/SKILL.md:128` - "Do not auto-trigger on X" -> "Do not invoke this skill on X".
- 8 descriptions moved from "when the request involves" to "when the task involves" (component-gallery-reference, consolidate, curate, design-team, fontshare-reference, reflect, tactical-polish, task-list).
- `claude/hooks/browser-tree.json:156` - "design skills that auto-trigger during UI work" -> "design-pipeline skills the model can select for UI work". Also `:547` - the `sidecoach-taste-gate` one-liner said "Reviews UI files the moment they are written", broader than reality; now states the `.html`/`.css` + DESIGN.md scope and the html-only taste-validator limit.

## Verification

Built `/tmp/verify-trigger-invariant.py`, a two-check invariant prover with distinct exit codes (1 token drift, 2 unreviewed payload change, 3 missing installed file, 4 IO/git error):
- CHECK A normalizes every framing phrase to a sentinel and diffs the description against HEAD.
- CHECK B extracts every quoted and backticked literal in order and diffs that list.
Both checks run against the repo AND the installed copies in `~/.claude/skills`, because measuring the repo alone was the wrong artifact. Result: 18 skills, all pass; `design-build` and `voice-output` allowlisted on CHECK A only (intentional prose rewrite) and still pass CHECK B. Mutation test: adding one token to icon-source made it exit 1 with the drifted list printed, so the checker is not a rubber stamp.

Hook suites re-run green after the fold: test-hook-registry (52), test-component-browser (139), test-hook-data-parity (35), test-sidecoach-keyword (exit 0).

Codex pass 2 raised three findings, all verified against source and all folded: the taste-gate CSS/HTML asymmetry (confirmed at taste-gate line 118), the stale browser-tree taste-gate description, and the 14-vs-16 rule count. Codex also identified the one real hole in the invariant proof: it covers only the frontmatter `description`, and for the two allowlisted files it would miss an UNQUOTED trigger-token change. Acceptable here because design-build's invocation literals are all quoted or backticked and voice-output has no keyword list, but a future rewrite of an allowlisted description is not protected.

## Hook error encountered (Hook Error Response Protocol)

Mid-session the PostToolUse `codex-failure-watcher.sh` began failing on every Bash call: `line 221: syntax error near unexpected token ')'` on a line of Python (`m = re.match(r"""...""", cmd[k:])`).

Root cause, by the delta method rather than source diving: the same hook ran clean earlier in this session, including through both codex-review wrapper calls. `git show HEAD:claude/hooks/codex-failure-watcher.sh | bash -n` passes; the WORKING TREE copy fails `bash -n` at 221. The file is ` M` with +304/-31 and its mtime was 49 seconds before the first failure. Grep finds NO heredoc opener anywhere in the working-tree version, so roughly 300 lines of Python are sitting at bash top level with no `python3 <<'PYEOF'` wrapper. That is an in-flight, incomplete edit by another actor, not a latent bug and not this unit's change.

Deliberately NOT repaired here: `claude/hooks/codex-failure-watcher.sh` is outside this unit's ownership and is being actively written by another agent right now. Editing it would collide with a live writer and could destroy work mid-edit. Reported to the team lead instead, with the root cause and the `bash -n` reproduction, so the owning agent finishes or reverts its own edit. The hook is symlinked (`~/.claude/hooks/codex-failure-watcher.sh` -> repo), so the fix goes live the instant the source is valid again; no reinstall and no session restart needed.

## Reported to the team lead, not fixed here

Install drift needs an `install.sh` change and `install.sh` is owned by a sibling agent. Codex's recommendation is BOTH: (a) route `install_bundled_skill()` through the existing `link_or_copy_data()` primitive so skills deploy exactly like hooks (symlink in a git checkout, copy in a throwaway clone - `hook_deploy_mode()` already makes that call correctly, which is why symlinking wholesale is wrong for the `git clone /tmp && install && rm -rf` case), and (b) add a `verify_installed_skills` check near the install helpers, called at the end of install.sh and exposed via a `--verify-installed-skills` flag, with exit 0 all good / 1 missing-or-stale / 2 usage error. Six installed copies currently match neither HEAD nor the working tree: component-gallery-reference, design-build, fontshare-reference, lotus, social-media, task-list. design-build and lotus were untouched this session, so the drift predates it.

## Files touched

- claude/CLAUDE.md
- claude/hooks/browser-tree.json
- claude/skills/sidecoach/SKILL.md
- claude/skills/design-build/SKILL.md
- claude/skills/lotus/SKILL.md
- claude/skills/voice-output/SKILL.md
- claude/skills/design-references/SKILL.md
- claude/skills/curate/SKILL.md
- claude/skills/component-gallery-reference/SKILL.md
- claude/skills/consolidate/SKILL.md
- claude/skills/design-team/SKILL.md
- claude/skills/fontshare-reference/SKILL.md
- claude/skills/reflect/SKILL.md
- claude/skills/tactical-polish/SKILL.md
- claude/skills/task-list/SKILL.md
