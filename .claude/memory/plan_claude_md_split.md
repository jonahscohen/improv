---
name: Plan - CLAUDE.md slim-core split
description: Audit + refactor plan to slim installed CLAUDE.md (378 lines) into a <100-line core plus on-demand topic skills, and reconcile installed-vs-source drift
type: project
relates_to: [reflection_2026-05-19.md]
---

# Plan - CLAUDE.md slim-core split

Scope: finding #5 in `reflection_2026-05-19.md`. Goal of THIS file is a plan + diff, not an executed refactor. No CLAUDE.md edits performed in this session.

## 1. Diff inventory

### Line counts

| File | Path | Lines |
|---|---|---|
| Installed CLAUDE.md | `/Users/spare3/.claude/CLAUDE.md` | **378** |
| Source workflow body | `/Users/spare3/Documents/Github/claude-dotfiles/claude/CLAUDE.md` | 226 |
| Source team rules | `/Users/spare3/Documents/Github/claude-dotfiles/claude/RULES.md` | 80 |
| Source memory-discipline | `/Users/spare3/Documents/Github/claude-dotfiles/claude/memory-discipline-section.md` | 119 |
| **Concatenated source total** | RULES + CLAUDE + memory-discipline | **425** |

### Architectural correction to the reflection's framing

The reflection assumed `claude/CLAUDE.md` (226 lines) was the canonical source and the installed file (378 lines) was 67% drift. **That's wrong.** The installer (`install.sh`, brain component, lines 1261-1301) concatenates THREE source files into the user's `~/.claude/CLAUDE.md` between marker comments:

1. `claude/RULES.md` -> goes between `<!-- claude-dotfiles:rules:begin -->` and `<!-- claude-dotfiles:rules:end -->`
2. `claude/CLAUDE.md` -> appended right after, still inside the outer `<!-- claude-dotfiles:brain:begin -->` / `:brain:end -->` block
3. `claude/memory-discipline-section.md` -> appended in its own `<!-- claude-dotfiles:memory-discipline:begin -->` / `:end -->` block (by the memory component, install.sh line 1444-1458)

So "installed = 378, source = 226" was comparing one of three input files to the assembled output. The real source total is **425 lines**. The installed file is actually 47 lines SHORTER than what a fresh install would produce.

### What the diff between installed and concat-of-sources actually shows

`diff <(cat RULES.md CLAUDE.md memory-discipline-section.md) ~/.claude/CLAUDE.md` reveals these substantive differences (drift in EITHER direction):

| Section | Direction | What's different |
|---|---|---|
| `## Voice Output` | source -> installed, installed has a DIFFERENT version | Installed file has the "voice-mandate hook" voice section (5 paragraphs about the hook arbitrating mute state). Source `claude/CLAUDE.md` has a totally different voice section ("Claude can speak short verbal summaries..." with config JSON, 13 voices list, Discord OGG pipeline). These are not merged - they are two divergent histories. Installed mtime = May 18 16:06; source CLAUDE.md mtime = May 11 18:14. **Installed is newer.** |
| `## Verification Protocol` items 1 & 2 | installed-only | Two large "HARD RULE" sub-blocks: screenshot-must-be-Read enforcement (item 1) and validation-through-real-input-only with BLOCKED-pattern list (item 2). 32 lines. Documents validation-guard.sh and bash-guard.sh constraints. Source RULES.md verification items 1 and 2 are bare one-liners. **Installed newer.** |
| `## Design Peer Skills` | source-only | 30 lines describing /social-media, /design-team, /visual-effects, /icon-source plus the "complete design stack" table. Present in `claude/CLAUDE.md`, missing from installed. **Source newer.** |
| `## Reflect (Memory Corpus Analysis)` | source-only | 17 lines about the reflect skill, five lens agents, SessionStart nudge. Present in `claude/CLAUDE.md`, missing from installed. **Source newer.** |
| `## Voice Output` (the OTHER one) | source-only | The "Claude can speak..." version with voice config, 13 voices, Discord OGG pipeline. Missing from installed. **Source newer.** |
| Marker comments | wrapping | Installed has `<!-- claude-dotfiles:brain:begin -->`, `:rules:begin/end`, `:brain:end`, `:memory-discipline:begin/end` wrapping. Source files don't have them (installer adds them at concat time). |

### Drift summary

- **Installed-only content** (drift that would be wiped by next installer run): 2 sections - the May 18 voice-mandate rewrite (14 lines) and the two HARD RULE sub-blocks under Verification (32 lines). **46 lines of work would silently disappear** if you `bash install.sh --only brain` today.
- **Source-only content** (never reached the installed file): 3 sections - Design Peer Skills (30 lines), Reflect (17 lines), the older Voice Output spec (~40 lines including Discord OGG). **~87 lines of source content was never installed.**
- **Mtime check**: `~/.claude/CLAUDE.md` mtime is May 18 16:06 (recent direct edits per `session_2026-05-18_voice-mute-hook-gating.md`). `claude/CLAUDE.md` mtime is May 11 18:14. The installed file is 7 days newer because the user has been hand-editing it.

This is exactly the reflection's concern: source vs installed are no longer the same content, and the divergence cuts both ways. Next `install.sh` will overwrite installed with source's older voice section AND drop the new HARD RULE sub-blocks. Reconciliation MUST precede the slim-down.

## 2. Section-by-section keep/move/cut decision

For every top-level `##` section in the installed CLAUDE.md (in file order):

| # | Section | Class | Rationale |
|---|---|---|---|
| 1 | `## Code Quality` (10 bullets) | **CORE** (split) | Five sub-rules are universal (no emojis, no emdashes, no attribution, broad-CSS, sass-leverage, sourcing real SVGs, no legacy models, name the collaborator). Two are situational (sass-leverage, curl-test). All concise. Keep as core but trim. |
| 2 | `## Voice Output` (current, hook-based, 13 lines) | **REDUNDANT** (hook is canonical) | This entire section explains that the voice-mandate hook is the source of truth. The hook injects its own context each turn. CLAUDE.md restating "follow the hook output" is meta-instruction that the hook already enforces. Cut to one line in core: "Voice is hook-governed; see `hooks/voice-mandate.sh`." |
| 3 | `## Verification Protocol` (7 items, ~43 lines) | **CORE** (compressed) | Items 1-4 and 7 are the heart of the workflow. Items 5 (no lazy questions), 6 (no false positives) are restatements of #4. The HARD RULE sub-blocks under 1 and 2 (32 lines) are enforced by screenshot-open-mandate.sh, validation-guard.sh, and bash-guard.sh. REDUNDANT but worth a one-line "see hooks/" pointer. Strip to ~12 lines. |
| 4 | `## Debugging Protocol` (~17 lines) | **CORE** | Not enforced by any hook. Discipline rule the user explicitly relies on (cited in reflection finding #6). Keep verbatim. |
| 5 | `## Self-Analysis Protocol` (~9 lines) | **CORE** | Not enforced by any hook. Discipline rule for post-failure learning. Keep verbatim. |
| 6 | `## Gut Check` (4 lines) | **CORE** | Cheap, universally applicable, no hook covers it. Keep. |
| 7 | `## Hook Override Protocol` (4 lines) | **CORE** | Meta-rule that interacts with the hook layer itself. Tiny. Keep. |
| 8 | `## Style Guide and Component Library Rules` (3 bullets) | **TOPIC** -> `/impeccable` or `/component-gallery-reference` | Triggers only when building a style guide / component library. The /impeccable skill already enforces design-source extraction. Move to skill description or to a new `skills/component-library-rules.md`. |
| 9 | `## Design Work and Impeccable` (63 lines) | **TOPIC** -> already a skill | Entirely about the /impeccable plugin. Currently lives in CLAUDE.md as a permanent "load every turn" instruction even though impeccable is a plugin/skill with its own description. **Biggest single bloat.** Move 100% to `skills/impeccable-protocol.md` (or have /impeccable's own description carry the routing table). Keep ONE line in core: "For UI work, invoke /impeccable. See skill for routing." |
| 10 | `## Permission Posture` (~10 lines) | **CORE** | Explains why bypassPermissions is set. Important context for any session. But could compress to 3 lines: "Machine runs bypassPermissions deliberately. Hooks do the gating. See `claude/settings.json`." Keep compressed. |
| 11 | `## Voice transcription` (~14 lines) | **TOPIC** -> skill | Specific to Discord audio attachments. Only relevant on audio-attached messages. Move to a skill triggered by audio-attachment detection, or to `skills/voice-transcription.md`. |
| 12 | `## Discord Chat Agent` (~20 lines) | **TOPIC** -> already a skill (`/discord:access`) plus `discord-onboard.sh` | Mostly setup/install/repair info. Refer colleagues to `bash ~/.claude/discord-onboard.sh`. The recovery paragraph is operational knowledge that belongs in `discord-onboard.sh --help` or `skills/discord-setup.md`. Keep ONE line in core: "Discord setup: `bash ~/.claude/discord-onboard.sh`. Repair: `--repair`." |
| 13 | `## cmux Browser Pane` (~28 lines) | **TOPIC** -> skill | Specific to UI verification. Already partially covered by the screenshot-open-mandate hook. Move full spec to `skills/cmux-browser.md`. Keep one line in core: "UI verification = cmux. Project memory declares the surface id. See skill." |
| 14 | `## Memory Discipline` (~119 lines) | **CORE** (compressed) + REDUNDANT subset | Loading-order rule (CORE, used at session start). Pre-approved permission rule (CORE, mostly enforced by settings.json but worth restating). Per-task memory updates (REDUNDANT - memory-nudge.sh hook enforces it). Write-time link check (CORE - hook doesn't enforce). Memory file format (CORE - reference data). Extended Memory Types / decision body structure (CORE - reference data). Cut the "Per-Task Memory Updates - The Hard Rule" prose because the hook nags it; keep the bullet list of what counts as a task. **Target: cut 119 to ~50 lines.** |

### REDUNDANT items called out for removal (already hook-enforced)

- Voice Output - voice-mandate hook injects its own mandate
- Verification HARD RULE - screenshot reading: screenshot-open-mandate.sh
- Verification HARD RULE - validation-through-real-input: validation-guard.sh + bash-guard.sh
- Memory writes are pre-approved: settings.json allow rules + bypassPermissions
- Per-task memory updates - The Hard Rule: memory-nudge.sh

### STALE items found

- The 7-point Verification list duplicates itself: items 5 ("no lazy questions"), 6 ("no false positives") are restatements of item 4 ("completeness check") with different framing. Collapse.
- "Encouraged to test your work with curl" - one-line bullet under Code Quality; superseded by the cmux + verify-before-done.sh apparatus. Cut.
- The reflection (finding #7) flags `feedback_speak_responses.md` as contradicted by mute-by-default; the CLAUDE.md Voice Output section currently says the right thing (hook-gated), so the staleness is in the memory file not CLAUDE.md.

## 3. Proposed structure

### Slim core CLAUDE.md (~85 lines, target <100)

Sections, in order:

```
# Team Rules (1 line intro)
## Code Quality                        ~12 lines  (7 trimmed bullets)
## Verification Protocol               ~15 lines  (4 items, no HARD RULE sub-blocks)
## Debugging Protocol                  ~10 lines  (compressed but intact)
## Self-Analysis Protocol              ~6 lines
## Gut Check                           ~4 lines
## Hook Override Protocol              ~4 lines
## Permission Posture                  ~3 lines   (one-paragraph summary)
## Memory Discipline                   ~30 lines  (loading order, format, types, no nag rephrase)
```

Plus a footer pointing to skills/topic files:

```
## Topic Modules (load on demand)
- Voice output: see /voice-output skill or hooks/voice-mandate.sh
- Voice transcription: see skills/voice-transcription.md
- Impeccable design protocol: see /impeccable skill
- Discord setup: bash ~/.claude/discord-onboard.sh
- cmux browser: see skills/cmux-browser.md (per-project surface id in project memory)
- Reflect: /reflect or see skills/reflect/
- Design peer skills: /social-media /design-team /visual-effects /icon-source
- Style guide / component library rules: see skills/component-library-rules.md
```

### Skills/topic files to create

| New file | Source content (current location) | Lines moved |
|---|---|---|
| `claude/skills/impeccable-protocol/SKILL.md` | Installed CLAUDE.md lines 122-183 AND source `claude/CLAUDE.md` lines 1-62 | ~63 |
| `claude/skills/voice-transcription/SKILL.md` | Installed lines 195-207 AND source CLAUDE.md lines 165-177 | ~13 |
| `claude/skills/cmux-browser/SKILL.md` | Installed lines 228-255 AND source CLAUDE.md lines 198-225 | ~28 |
| `claude/skills/discord-setup/SKILL.md` | Installed lines 209-226 AND source CLAUDE.md lines 179-196 | ~18 |
| `claude/skills/component-library-rules/SKILL.md` | Installed lines 115-119 | ~5 |
| `claude/skills/voice-output/SKILL.md` | Already exists - audit description; merge the "Discord voice replies" sub-section from source CLAUDE.md lines 141-153 if not already present | ~13 add |
| `claude/skills/reflect/SKILL.md` | Already exists (folder present in `claude/skills/`) - audit description for the prose at source CLAUDE.md lines 99-114 | ~17 audit |
| `claude/skills/design-peer-skills/SKILL.md` (optional) | Source CLAUDE.md lines 64-97 (Design Peer Skills + complete design stack table) | ~33 |

Net: ~190 lines pulled from CLAUDE.md into ~5 new skill files (3 of these skills already exist as folders and just need their SKILL.md updated, not created).

### Reconciliation plan (installed -> source becomes canonical)

Single source of truth: the dotfiles repo. To get there:

**Step A: Merge installed-only content INTO source** (before any slimming)

1. Copy the May 18 voice-mandate Voice Output section from installed -> overwrite the older Voice Output section in `claude/CLAUDE.md`. (Newer wins.)
2. Copy the two HARD RULE sub-blocks from installed Verification Protocol -> add them to `claude/RULES.md` Verification Protocol items 1 and 2. (Hooks alone aren't a substitute for documenting the contract.)
3. Commit `claude/RULES.md` and `claude/CLAUDE.md`. Now the source repo represents the current understanding.

**Step B: Validate the round-trip BEFORE slimming**

4. Run `bash install.sh --only brain --force` (or whatever flag forces re-concat) into a temp dir. Diff its output against the post-Step-A merged `~/.claude/CLAUDE.md`. Expected: zero diff.
5. If there is diff, fix the marker handling in install.sh until round-trip is clean.

**Step C: Then slim**

6. Edit `claude/RULES.md`, `claude/CLAUDE.md`, `claude/memory-discipline-section.md` according to the keep/move/cut classifications above.
7. Create the new skill SKILL.md files. For each topic moved out, the skill's `description:` field must accurately auto-trigger when relevant (e.g., voice-transcription should trigger on audio attachments).
8. Run installer again, diff `~/.claude/CLAUDE.md` before/after, confirm the slim output is ~100 lines.
9. Commit.

**Step D: Forward-edits policy**

After this lands, document a rule: never hand-edit `~/.claude/CLAUDE.md` directly. All edits go to `claude/RULES.md`, `claude/CLAUDE.md`, or `claude/memory-discipline-section.md` and propagate via installer. Add a PreToolUse hook that warns on Write/Edit targeting `~/.claude/CLAUDE.md` directly (low-priority follow-up, not part of this refactor).

## 4. Risk / cost estimate

### Time

| Phase | Estimate |
|---|---|
| Step A (merge installed-only -> source) | 30 min |
| Step B (round-trip validate) | 30 min |
| Step C.6 (slim three source files) | 60 min |
| Step C.7 (create/audit 5-8 SKILL.md files) | 90 min (15min each) |
| Step C.8 (install, diff, confirm) | 30 min |
| **Total** | **~4 hours** (eight 30-min units) |

### Risk per cut

| Section | Cut/move risk | Mitigation |
|---|---|---|
| Voice Output (current installed version) | **LOW** | Hook already injects per-turn mandate. Moving to skill description just documents the hook. |
| Verification HARD RULE sub-blocks (screenshot, real-input) | **MEDIUM** | The hooks enforce the rules at write time, but the documentation is the FIRST defense (Claude reads it and avoids the pattern). Moving to skills/ means it's only loaded when the skill auto-triggers. Risk: Claude tries a synthetic click thinking the rule doesn't apply because it's not in core CLAUDE.md. Mitigation: leave a one-line "synthetic clicks blocked by validation-guard.sh - see skill" pointer in the core Verification Protocol. |
| Memory Discipline "Per-Task Memory Updates" prose | **MEDIUM** | memory-nudge.sh fires the nag. But reflection finding #1 notes the nag was over-triggering and getting tuned out. Cutting the prose AND keeping the nag could leave Claude with no canonical statement of the rule. Mitigation: keep a 3-line core summary + the bullet list of what counts as a task. Cut only the lecture paragraphs ("This has been corrected multiple times..."). |
| Impeccable section | **LOW** | Already exists as a plugin/skill. Moving the routing table into the skill description is the right architecture. |
| Style Guide / Component Library Rules | **LOW** | 3 bullets, narrow trigger condition. Skill description handles it. |
| Permission Posture (compress) | **LOW** | Just documentation. Settings.json is the real source. |
| Discord / cmux / voice-transcription | **LOW** | All narrow-trigger conditions (Discord message arrives, building UI, audio attachment present). Skill auto-triggers fit naturally. |
| Debugging Protocol | **HIGH if cut** | Not enforced by any hook. Discipline rule the user explicitly relies on (reflection finding #6). Keep in CORE verbatim. Not a candidate to move. |
| Self-Analysis Protocol | **HIGH if cut** | Same as above. Keep CORE. |

### Highest-risk single move

Cutting the validation-guard HARD RULE sub-blocks. The hook enforces at the JS-eval surface but Claude's planning happens upstream of the hook. If the documentation says nothing about "no synthetic clicks," Claude may plan a synthetic click, hit the hook, and burn turns recovering. Keep a one-line pointer in core to prevent this failure mode.

## 5. Recommended next step

**Step A only: reconcile installed -> source.** One concrete commit, no architectural change yet. Roughly:

1. Open a session, copy the May 18 voice-mandate Voice Output paragraph from `~/.claude/CLAUDE.md` -> overwrite the older Voice Output section in `claude/CLAUDE.md`.
2. Copy the two HARD RULE sub-blocks from `~/.claude/CLAUDE.md` Verification Protocol items 1 and 2 -> append them to the corresponding items in `claude/RULES.md`.
3. Commit `claude/CLAUDE.md` and `claude/RULES.md`.
4. Run `bash install.sh --only brain` (with whatever idempotence flag is needed) and confirm `~/.claude/CLAUDE.md` re-renders byte-identical to the pre-commit state.

After this single ~30-minute commit, the source repo represents truth, no work-in-progress is at risk, and the slim-down can be done as a separate session without time pressure. Jonah can pause here or continue to Step C in the same sitting; nothing forces the whole refactor to land in one PR.

The slim-down itself (Steps B/C) is the higher-leverage work but it's also the one most likely to introduce regressions. Doing reconciliation first means the slim-down is a pure subtraction operation against a stable baseline rather than a merge-and-subtract.

## Files referenced (read for this plan, none edited)

- `/Users/spare3/.claude/CLAUDE.md` (378 lines, installed)
- `/Users/spare3/Documents/Github/claude-dotfiles/claude/CLAUDE.md` (226 lines, source workflow)
- `/Users/spare3/Documents/Github/claude-dotfiles/claude/RULES.md` (80 lines, source team rules)
- `/Users/spare3/Documents/Github/claude-dotfiles/claude/memory-discipline-section.md` (119 lines, source memory section)
- `/Users/spare3/Documents/Github/claude-dotfiles/install.sh` (lines 1261-1301 brain component, 1444-1458 memory component)
- `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/reflection_2026-05-19.md` (finding #5)

## Collaborator
Jonah
