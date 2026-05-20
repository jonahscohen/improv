<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/yes-and-logo-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="assets/yes-and-logo-light.webp">
    <img alt="Yes&" src="assets/yes-and-logo-light.webp" width="320">
  </picture>
</p>

<h1 align="center">claude-dotfiles</h1>

<p align="center"><i>The Yes& Claude Code stack. The way we think about agentic coding, made installable.</i></p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#what-you-get">What you get</a> ·
  <a href="#how-it-thinks">How it thinks</a> ·
  <a href="#day-to-day">Day to day</a> ·
  <a href="#reference">Reference</a>
</p>

---

**The problem.** Working with Claude is fast. Working with Claude *well* is a discipline problem. The model forgets between sessions, has no opinions of its own, and will cheerfully ship a half-verified fix unless something stops it. Most "AI workflow" advice tries to fix this by adding ceremony, which the model promptly skips under pressure.

**The opinion.** Externalize the discipline into files the harness enforces. Rules in CLAUDE.md, loaded every session. Hooks in settings.json that block bad behavior at the tool boundary. Memory in `.claude/memory/` that persists across machines and Yes& devs. A personal catalog that grows from your eye. Reflection that audits the whole system for drift.

**The system.** Twelve components, one curl, one shortcut. A 6-layer design pipeline. Eighteen hooks across refusal, gates, nudges, and lifecycle. A learning catalog you populate via `/curate`. All opinionated, all additive, all undoable.

**The proof.** Built on itself. The reflection skill exists because the corpus needed it. The personal-catalog system exists because public catalogs missed the patterns worth remembering. The second-fix gate evolved from a real same-file regression that shipped before the underlying root cause was found. Nothing in here is a feature in search of a problem.

Five sections. Stop after any one and still know what you need:

- **[Install](#install)** - the curl one-liner. Done.
- **[What you get](#what-you-get)** - everything that lands on your machine, summarized.
- **[How it thinks](#how-it-thinks)** - the opinions and disciplines behind the choices.
- **[Day to day](#day-to-day)** - the commands, workflows, and team patterns you'll actually use.
- **[Reference](#reference)** - the dense lookup material, in collapsible chapters.

---

<a id="install"></a>
<a id="quick-start"></a>

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jonahscohen/claude-dotfiles/main/bootstrap.sh | bash
```

One curl. One shortcut installed: `ampersand`. Type it from any terminal to launch the component picker. Type `ampersand --pull` to pull the latest from GitHub first.

Already cloned? `cd` into the repo:

```bash
./install.sh                    # interactive TUI
./install.sh --preset minimal   # brain + config + memory + skills + nvm
./install.sh --only memory      # just one component
```

That's the whole quick start. Read on for what you got and why.

---

<a id="what-you-get"></a>
<a id="orient"></a>

## What you get

Everything the installer puts on your machine, summarized.

### What this is

The version-controlled answer to "how is Yes& running Claude Code right now." When a Yes& developer learns something durable - a CSS-detail rule, an icon-sourcing discipline, a way to make Claude remember yesterday - it lands in one of three layers: `claude/RULES.md` for team standards everyone shares, `claude/CLAUDE.md` for the operational playbook, or `claude/CLAUDE.local.md` for personal overrides that stay yours. Next `ampersand --pull` and the team layers are on every Yes& dev's machine. These dotfiles aren't a config. They're the engineering team's earned practice, made portable.

### What it does for you

1. **A reproducible baseline.** New Yes& developer, fresh Mac, one curl. Indistinguishable from the rest of the engineering team by lunch.
2. **A discipline carrier.** Hooks block legacy model IDs, AI-attribution lines, and emoji before they land. CLAUDE.md mandates verification before "done." None of it is optional once installed.
3. **A 6-layer design pipeline.** Strategy (Impeccable), research (component-gallery-reference), typography (fontshare-reference + reflex-reject list), references (your personal catalog at `~/.claude/design-references/`), motion (motion-reference for GSAP + Lenis), tactical (make-interfaces-feel-better). Each layer fires at a different beat in the workflow. Generated UI lands on-brand by default, not by accident.
4. **Memory across machines, across Yes& devs.** The memory subsystem makes Claude take notes after every task. Notes commit, notes pull, everyone knows what was decided and why.
5. **Additive across the board.** Every component appends, merges, or creates new files. Nothing is replaced. Pick any combination without risking your existing config. Uninstall removes exactly what was installed, nothing more.

### What's in the box

Twelve components. Pick any combination. Defaults are all on, so most Yes& devs just hit enter. Every component is additive.

| Component | One-line | Touches |
|---|---|---|
| `brain` | Team rules + workflow instructions | Appends to `~/.claude/CLAUDE.md` between markers (your content preserved) |
| `config` | Hooks, plugins, permissions | JSON-merges into `~/.claude/settings.json` (your settings preserved) |
| `memory` | Memory discipline rules + 3 lifecycle hooks + loader | Appends to CLAUDE.md, JSON-merges into settings.json |
| `skills` | Design pipeline (research, typography, references, motion, polish) + 4 peer skills | Adds to `~/.claude/skills/` + seeds `~/.claude/design-references/` catalog |
| `statusline` | Custom prompt-bar render | Symlinks `~/.claude/statusline-command.sh` |
| `cmux` | Split-pane terminal config | Symlinks `~/.config/cmux/settings.json` |
| `nvm` | Fix for "claude: command not found" in fresh terminals | Marker-guarded line in `~/.zshrc` |
| `ampersand` | The `ampersand` zsh shortcut | Marker-guarded block in `~/.zshrc` |
| `discord` | Smart Discord chat agent launcher | Marker-guarded line in `~/.zshrc`, symlinks scripts to `~/.claude/` |
| `voice-input` | Local voice-to-text (whisper.cpp + ffmpeg) | Brews dependencies, symlinks `~/.claude/transcribe` |
| `voice-output` | Voice responses via OpenAI TTS | MCP server at `~/.claude/voice-output/`, aliases in `~/.zshrc` |
| `reflect` | Memory corpus analysis (5-agent reflection skill + nudge hook) | Adds `~/.claude/skills/reflect/`, `~/.claude/hooks/reflect-nudge.sh` |

### What's NOT here

- **Claude Desktop config** is mostly the same runtime as Claude Code now (Desktop bundles Claude Code), so most dotfiles benefits apply automatically. The Discord launcher is the exception - it's a shell wrapper, and Desktop doesn't go through your shell.
- **Claude.ai connectors** (ClickUp, Google Drive, etc.) are account-bound, not machine-bound. Authorize once at claude.ai, propagates to every signed-in device.
- **MCP servers** (Claude in Chrome, etc.) need OAuth or per-machine credentials. Configure per-app, not via dotfiles.

If those distinctions blurred, the [reference section on plugins/connectors/MCP](#deep-plugins) breaks them down.

---

<a id="how-it-thinks"></a>
<a id="believe"></a>

## How it thinks

You've seen what's in the box. Here's the opinions and disciplines behind why each piece is shaped the way it is.

### The opinion, in five sentences

1. **Discipline beats cleverness.** Hooks that mechanically refuse certain patterns (legacy model IDs, AI-attribution lines, emoji, force-push to main) are more reliable than hoping the model behaves.
2. **Memory beats context.** A version-controlled record of what we decided yesterday is more useful than re-explaining the project to Claude every session.
3. **Layered design beats one-layer prompting.** Six skills stack from strategy down to tactical, each firing at a different beat: Impeccable, component-gallery-reference, fontshare-reference, design-references + /curate, motion-reference, make-interfaces-feel-better. Stack them; route, don't improvise.
4. **Verification beats vibes.** UI work isn't done until it's screenshotted and checked. Non-UI work isn't done until each step has a runnable verify clause.
5. **Additive beats wholesale.** Other devs and teams should be able to take what they want and leave the rest. Every component appends, merges, or creates new files. `brain` appends to your CLAUDE.md between markers. `config` JSON-merges into your settings.json. Nothing is replaced, nothing is overwritten.

The five disciplines that come out of those opinions:

### Memory: Claude as a colleague who remembers

Memory turns Claude Code from a stateless code generator into a colleague who remembers what we decided last week and why. The flow:

1. You ask Claude to do something.
2. Claude does it. Verifies. Confirms.
3. Before responding, Claude writes a memory entry to `<project>/.claude/memory/session_YYYY-MM-DD_<topic>.md` with frontmatter, a `Collaborator: <your name>` line, a `Why:`, a `How:`, and files touched.
4. Claude updates `MEMORY.md` to index the new entry.
5. THEN Claude responds.

Memory commits to your project's git like any source file. Your teammate pulls, their Claude reads it at session start. The next Yes& dev starts where you left off, with `Collaborator:` attribution baked in. → [Memory in detail](#deep-memory).

### The design pipeline: six layers, each firing at the right beat

Most AI-generated UI looks the same because most prompts ask for the same vague thing. Yes& devs stack six skills, each addressing a different question at a different moment:

- **Strategy / brand:** [Impeccable](https://impeccable.style) plugin. PRODUCT.md + 23 commands. *Who is this for? What's NOT us?*
- **Research:** `component-gallery-reference` skill. *How does the industry build this component? What's the accessibility floor?*
- **Typography:** `fontshare-reference` skill. *Which typeface? Bakes in Impeccable's reflex-reject list so the obvious 2024-era defaults (Inter, Fraunces, etc.) get refused.*
- **References:** `design-references` + `/curate` skills. *What did you see in the wild that should inform this build? Personal catalog that grows from your eye.*
- **Motion:** `motion-reference` skill. *GSAP + Lenis canonical patterns - tweens, ScrollTrigger, Flip, SplitText, DrawSVG, smooth-scroll integration.*
- **Tokens:** [google-labs-code/design.md](https://github.com/google-labs-code/design.md) spec at the project root. Canonical source of truth for colors, type, spacing, components.
- **Tactical:** [make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better) skill. Sixteen exact-value rules at implementation time.

Each fires at the right beat. Strategy at brief time. Research at component-build time. Typography at type-system time. References as ambient inspiration. Motion when animation enters scope. Tokens at write time. Tactical at every implementation. All seven at QA time. → [Design pipeline in detail](#deep-design-stack).

### Verification Protocol: nothing ships on vibes

Seven rules in CLAUDE.md that gate task completion. UI changes need a screenshot, then an interactive screenshot for clickable elements, then a side-by-side against the design source. Non-UI changes need a `<step> -> verify: <check>` plan written before implementation, with verify clauses that are runnable commands, not "looks right." → [The full Verification Protocol](#deep-brain).

### Hooks: refusal, not advice

Eighteen hooks split into five roles:

- **Refusal hooks** (PreToolUse hard-deny). `bash-guard` blocks AI-attribution lines in commands, force-push to main/master, `rm` against `.claude/memory`, and legacy model IDs. `content-guard` blocks the same patterns inside file content, plus emdashes, endashes, and emoji. `voice-gate` denies speak calls when voice is muted (no wasted OpenAI TTS round-trips). `validation-guard` blocks DOM-shortcut tricks during UI validation - no `.click()`, no synthetic events, no `getComputedStyle` for state inspection. `memory-approve` carves out memory paths so they auto-approve even with otherwise-strict permissions.
- **Gate hooks** (state-machine gates that block until verification fires). `verify-before-done` + `verify-clear` + `verify-manual` track unverified code edits and gate `git commit`. `screenshot-open-mandate` + `screenshot-open-clear` force you to Read a screenshot you took before claiming it counted. `second-fix-gate` (v2) warns once when two fixes land on the same file within 10 min with no verification between - intentionally silent on additive sequential edits.
- **Nudge hooks** (PostToolUse advisory). `memory-nudge` injects a dirty-state reminder after every code change. `reflect-nudge` surfaces when the memory corpus has accumulated enough since the last reflection (default threshold: 15 new files).
- **Toggle hooks** (state flips on user phrases). `voice-toggle` flips `~/.claude/.voice-enabled` on "voice on/off". `resume-toggle` flips cmux auto-resume on similar phrases.
- **Lifecycle hooks**. SessionStart runs the memory loader + voice mandate. PreCompact flushes pending memory before context compresses. PostCompact reloads. SessionEnd `resume-guard` blocks cmux auto-resume.

The hook layer evolved from real failures, not hypothetical ones - the lineage is rule → feedback memory → hook, formalized by the 2026-05-19 reflection. → [Hook lifecycle in detail](#deep-architecture).

### Permission posture: an honest tradeoff

`claude/settings.json` ships with `defaultMode: bypassPermissions` and `skipDangerousModePermissionPrompt: true`. Every tool call auto-approves. This is intentional for a Yes& machine - the friction of every-tool-prompt outweighs the safety it adds, and the hooks already block the specific patterns we care about. If you want different defaults, it's a one-line change in settings.json. → [Permission Posture in CLAUDE.md](#deep-brain).

---

<a id="day-to-day"></a>
<a id="practice"></a>

## Day to day

Enough theory. Here's what you do with it.

### Day-to-day workflows

The shortcuts you'll actually type once the dotfiles are installed.

#### `ampersand` - re-launch the installer (no pull)

```bash
ampersand                      # interactive TUI from any directory
ampersand --yes                # full non-interactive install
ampersand --preset minimal     # brain + config + memory + skills + nvm
ampersand --only memory        # just one component
ampersand --only memory,skills # multiple components
ampersand --dry-run            # preview without writing
```

Used when you're iterating on the dotfiles locally, or you want to re-pick components without waiting on the network.

#### `ampersand --pull` - pull latest from GitHub then re-launch

```bash
ampersand --pull                # most common use: sync + run TUI
ampersand --pull --preset all   # full sync + non-interactive
ampersand --pull --only memory  # sync + just memory
```

Used when you want to pick up changes another teammate pushed. Pulls via `git pull --ff-only` so it never silently merges divergent local changes.

#### Direct `./install.sh`

Still works if you prefer to be explicit, or if you're scripting against the installer in CI:

```bash
cd /path/to/claude-dotfiles
./install.sh --preset minimal
```

#### Custom clone location (three ways)

The dotfiles can live anywhere on disk. The Ghostty config uses a `__DOTFILES_DIR__` placeholder that the installer replaces with the actual repo path at install time, so cloning to `~/code/dots`, `/opt/dots`, or anywhere else works.

```bash
# Env var (works for both bootstrap and direct install.sh)
CLAUDE_DOTFILES_DIR=~/code/dots curl -fsSL .../bootstrap.sh | bash

# Bootstrap flag
curl -fsSL .../bootstrap.sh | bash -s -- --dir ~/code/dots

# Default (no flags): ~/Documents/Github/claude-dotfiles
curl -fsSL .../bootstrap.sh | bash
```

If you re-run `install.sh` from a different clone location later, the `ampersand` function in your `~/.zshrc` is automatically refreshed to point at the new path.

### For Yes& teams: collaboration & attribution

Two or more Yes& devs in the same codebase, Claude Code on both sides. Here's how memory and attribution flow.

#### Attribution

Every memory entry Claude writes gets a `Collaborator:` line baked in. The rule lives in CLAUDE.md's Code Quality section: "Project updates must record the human collaborator's name, derived from `git config user.name`." So when you work, your Claude tags your name. When your teammate works, theirs tags their name. Memory files commit and push like any source file, so attribution flows through git.

You end up with three layers of authorship:

- **Per memory entry:** `Collaborator: <name>` line at the top
- **Per memory file:** `git log` / `git blame` (which is identical, but ironclad)
- **Per task:** the `Why:` and `How:` fields explain reasoning so reading a session memory tells you "Alice fixed the auth bug because legal flagged session-token storage, here's how she approached it"

#### Project-level CLAUDE.md

For ironclad team-wide enforcement of memory discipline (especially if a teammate hasn't installed the dotfiles), drop a `CLAUDE.md` at the project root that re-states the rules. Claude Code always reads project-root CLAUDE.md regardless of dotfiles state, so it propagates to anyone who clones.

A minimal project-root CLAUDE.md template:

```markdown
## Memory Discipline (project-level)

After every discrete change in this project, write a memory entry to
`.claude/memory/session_YYYY-MM-DD_<topic>.md` before responding to the user.

Include:
- Frontmatter (name, description, type: project)
- A `Collaborator:` line with the human's name from `git config user.name`
- A `Why:` rationale and `How:` approach for non-trivial decisions
- A list of files touched

Update `.claude/memory/MEMORY.md` to index the new file.

This applies regardless of whether the developer has Yes&-dotfiles installed.
```

#### Merge conflict patterns to expect

The most contention-prone file is `MEMORY.md` (the index). Two devs working on the same day both want to add an index line. The convention "append at the bottom, one line per entry" makes most of these auto-merge cleanly. Session files themselves rarely conflict because the file naming includes the topic, so two devs working on different topics never touch the same file.

#### Onboarding a new Yes& dev

1. They run `curl -fsSL https://raw.githubusercontent.com/jonahscohen/claude-dotfiles/main/bootstrap.sh | bash`.
2. They take TUI defaults or pick `--preset all`.
3. New terminal or `source ~/.zshrc`.
4. They open any Yes& project. Claude reads its own `~/.claude/CLAUDE.md`, plus the project's root `CLAUDE.md`, plus the project's `.claude/memory/` files. They have full context the moment they start.

That's the entire onboarding. Same machine state as everyone else, same disciplines applied, same memory loaded.

### Boost an existing Claude Code (everything is additive)

Every component is additive. There is no distinction between a "boost" install and a "full" install - both use the same append-and-merge strategy. Pick any subset and your existing config stays intact.

#### Common patterns

```bash
# Just the team rules - appends to your CLAUDE.md between markers
ampersand --only brain

# Rules + hooks/plugins - merges into your settings.json
ampersand --only brain,config

# Memory subsystem on top of your existing setup
ampersand --only memory

# The full stack, still additive
ampersand --yes
```

#### Marker-guarded means undoable

Components that append to your `CLAUDE.md` use HTML comment markers:

```markdown
<!-- claude-dotfiles:brain:begin -->
... (team rules content) ...
<!-- claude-dotfiles:brain:end -->
```

To undo, delete from one marker to the other. The `config` component's JSON-merge adds hooks and plugins to your settings.json - to undo, remove the specific entries it added. The `~/.zshrc` blocks use `# === claude-dotfiles:shortcuts:begin ===` / `:end` markers and are sed-deletable as a range.

---

<a id="reference"></a>

## Reference

The dense lookup material, in collapsible chapters. You won't read this end to end - you'll grep it when something breaks or you're extending.

<a id="deep-components"></a>

<details>
<summary><b>Components, in detail</b></summary>

When the installer launches you get a checkbox TUI listing twelve components. Each is independently togglable. Defaults are all on. Every component is additive - nothing overwrites your existing config.

| Component | Plain-English | What changes on disk |
|-----------|---------------|----------------------|
| `brain` | **ADDITIVE.** Appends team rules (RULES.md) and shared workflow instructions to your CLAUDE.md between marker comments. Your existing content stays. Re-runs detect markers and skip. CLAUDE.local.md for personal overrides gets its own marker block | Appends to `~/.claude/CLAUDE.md` between markers |
| `config` | **ADDITIVE.** JSON-merges safety hooks, memory-write allow patterns, enabled plugins, and marketplace entries into your existing settings.json. Does NOT touch your defaultMode, model, or other preferences. Copies hook scripts to `~/.claude/hooks/` alongside your existing hooks | JSON-merges into `~/.claude/settings.json`; copies hooks to `~/.claude/hooks/` |
| `memory`  | **ADDITIVE.** Bolts our memory subsystem onto an existing Claude Code: appends Memory Discipline rules to your `CLAUDE.md` between marker comments, JSON-merges three lifecycle hooks into your `settings.json`, symlinks the loader script. Marker-guarded - re-runs are no-ops, removable cleanly | Symlinks `startup-check.sh`; appends to `CLAUDE.md`; merges into `settings.json` |
| `skills`  | **ADDITIVE.** Installs the design pipeline + peer skills. Bundled: `make-interfaces-feel-better` (tactical polish), `component-gallery-reference` (research), `fontshare-reference` (typography), `motion-reference` (GSAP + Lenis), `curate` + `design-references` (personal catalog), `social-media`, `design-team`, `visual-effects`, `icon-source`. Seeds the empty `~/.claude/design-references/` catalog with the 14-category vocab. Touches nothing else | Adds to `~/.claude/skills/`; seeds `~/.claude/design-references/` (preserves user data on re-run) |
| `statusline` | Custom prompt-bar render. The `statusLine` command in `settings.json` is tolerant of a missing script - unticking falls back cleanly to Claude Code's default | Symlinks `~/.claude/statusline-command.sh` |
| `cmux`    | cmux split-pane terminal config. Powers the in-app browser preview Claude uses to verify UI work | Symlinks `~/.config/cmux/settings.json` |
| `nvm`     | Fix for "claude not found in PATH" in fresh terminals on machines where Homebrew's nvm doesn't auto-activate. Harmless no-op on machines that don't use nvm | Appends `nvm use default --silent` to `~/.zshrc` (only if `nvm.sh` is already sourced) |
| `ampersand` | The `ampersand` zsh shortcut. `ampersand` re-launches the installer from any directory; `ampersand --pull` pulls latest from GitHub first. Forwards every other flag. Auto-migrates older block formats from prior versions of the installer | Marker-guarded shortcuts block in `~/.zshrc` |
| `discord` | **ADDITIVE.** Smart Discord chat agent launcher with cold/mid/warm onboarding states. Symlinks the launcher and onboarding scripts, adds the `discord-agent` shortcut to zshrc | Marker-guarded line in `~/.zshrc`; symlinks scripts to `~/.claude/` |
| `voice-input` | **ADDITIVE.** Local voice-to-text pipeline. Brews whisper.cpp and ffmpeg, symlinks the transcription script. Handles OGG/Opus, m4a, mp3, flac, wav. Uses ggml-base.en model from `~/.cache/whisper/` | Brews dependencies; symlinks `~/.claude/transcribe` |
| `voice-output` | **ADDITIVE.** Gives Claude a voice via OpenAI TTS. Speaks short verbal summaries while keeping code and technical detail as text. Requires an OpenAI API key in macOS Keychain. Starts muted - enable with `voice-on` | MCP server at `~/.claude/voice-output/`; `tts-generate` symlink; voice aliases in `~/.zshrc` |
| `reflect` | **ADDITIVE.** Memory corpus analysis. The `reflect` skill spawns 5 parallel analysis agents (Pattern, Tension, Gap, Drift, Staleness) against `.claude/memory/` to surface what's emerging across sessions. SessionStart `reflect-nudge` hook surfaces when enough new memories have accumulated since last run (default threshold: 15) | Adds `~/.claude/skills/reflect/`; copies `reflect-nudge.sh` to `~/.claude/hooks/`; touches `~/.claude/last-reflect-timestamp` |

The TUI also lets you pre-select via flags: `--yes` for everything, `--preset minimal` for `brain+config+memory+skills+nvm`, `--preset all`, `--preset none`, `--only csv` for an explicit subset, `--dry-run` to preview without writing.

</details>

<a id="deep-brain"></a>

<details>
<summary><b>The Claude Code brain (CLAUDE.md walkthrough)</b></summary>

`~/.claude/CLAUDE.md` is the global instruction file Claude reads at the start of every session in every project on this machine. The `brain` component builds it from three layers, each appended between its own marker comments so your existing content is never touched:

1. **RULES.md** (team standards) - Code quality, verification protocol, debugging protocol, style guide rules. Shared across the whole team. Push a rule here, every teammate gets it on their next `ampersand --pull`.
2. **CLAUDE.md** (shared workflow) - Memory discipline, design stack, permission posture, hooks documentation, voice transcription, Discord, cmux. The operational playbook.
3. **CLAUDE.local.md** (personal overrides) - Your machine-specific config. Gitignored by default. Create `claude/CLAUDE.local.md` in the repo for overrides that should travel with you across machines but not ship to teammates.

The `memory` component adds a fourth marker block (Memory Discipline rules) in its own markers. All four blocks coexist with whatever you already have in your CLAUDE.md. Here's what's in each section:

### Memory Discipline (mandatory, no exceptions)

Three sub-rules, all enforceable.

**Session Startup.** At the start of every session, Claude must load memory in this order: project root memory (`<project>/.claude/memory/MEMORY.md` and every file it references) first, global project memory (`~/.claude/projects/<path>/memory/`) second, git history third, anything else fourth. When you ask "what did we work on last?", the answer comes from the memory files, not git log, not guessing.

**Per-Task Updates.** Every discrete change writes a memory entry before Claude responds to you. Not per-feature. Not per-session. Per-task. A CSS fix, a copy change, a refactor decision - each lands in `<project>/.claude/memory/session_YYYY-MM-DD_<topic>.md` immediately. Batching is a failure mode.

**File Format.** One session file per day per topic. Frontmatter (`name`, `description`, `type: project`). One line per change. Decisions get a "Why:" rationale and a "How:" approach. Files touched at the bottom. Update `MEMORY.md` index on file creation.

### Verification Protocol (mandatory, no exceptions)

Seven numbered rules that gate task completion.

1. **Visual verification.** UI changes must be screenshotted and described. "It renders" is not verification.
2. **Interactive verification.** Buttons, dropdowns, toggles must be clicked/typed into and re-screenshotted.
3. **Side-by-side verification.** Building from a Figma reference means comparing implementation against source.
4. **Completeness check.** Re-read the original request, list every item, confirm each one exists.
5. **No lazy questions.** If the user asked for 5 things and Claude built 3, build the other 2 instead of asking "should I continue?"
6. **No false positives.** A passing type check is not a passing feature. Verify with eyes.
7. **For non-UI tasks, state a verifiable plan first.** Refactors, CLI changes, scripts: write `<step> -> verify: <check>` before implementing. Verify clauses must be runnable, not "looks right."

### Design Work and Impeccable (mandatory for UI tasks)

Routes every design and UI-QA task through the `/impeccable` plugin. Before any UI work: check that `PRODUCT.md` exists at project root with real content (not placeholders). If missing, run `/impeccable teach` first - it asks about register, users, brand personality, anti-references, and writes the file.

Includes an entry-command routing table mapping intent to command:

| User's intent | Command |
|---|---|
| Net-new feature, build from scratch | `/impeccable craft <feature>` |
| Plan only, no code yet | `/impeccable shape <feature>` |
| Add motion, color, personality | `/impeccable animate`, `colorize`, `delight`, `bolder`, `overdrive` |
| Tone down a loud UI | `/impeccable quieter` or `distill` |
| Fix typography, spacing, layout, copy, perf | `/impeccable typeset`, `layout`, `adapt`, `clarify`, `optimize` |
| Production-ready sweep | `/impeccable harden` |
| First-run flows, empty states | `/impeccable onboard` |
| Pull tokens into the design system | `/impeccable extract` |

Plus a tactical implementation layer (the `make-interfaces-feel-better` skill) that auto-triggers on UI keywords with sixteen specific rules and exact values.

### QA gate for UI work

Five steps that must pass before UI work is reported done:

1. `/impeccable audit <target>` - 5-dimension technical scan (a11y, perf, theming, responsive, anti-patterns) plus the `npx impeccable detect` CLI
2. `/impeccable critique <target>` - design review via independent sub-agents (AI-slop detection, Nielsen heuristics, cognitive load, emotional journey)
3. `/impeccable polish <target>` - final design-system alignment pass
4. `make-interfaces-feel-better` 14-point checklist - concentric radius, optical alignment, shadows over borders, split/staggered enters, subtle exits, tabular nums, font smoothing, balanced text wrap, image outlines (always pure-tone, never tinted), scale-on-press at exactly 0.96, `initial={false}` on AnimatePresence, no `transition: all`, sparse `will-change`, 40x40 hit areas
5. `npx @google/design.md lint DESIGN.md` if a DESIGN.md exists - resolve every error and warning before reporting done

### Permission Posture (deliberate choice)

`defaultMode: bypassPermissions` + `skipDangerousModePermissionPrompt: true` are set on purpose. Every tool call auto-approves. The hook layer still blocks AI-attribution lines, force-push to main/master, `rm` against `.claude/memory`, legacy model IDs, emojis, emdashes - regardless of permission mode. To change defaults: edit `claude/settings.json` and switch `defaultMode` to `default` (per-tool prompting) or `acceptEdits` (auto-approve edits but not bash). Remove `skipDangerousModePermissionPrompt` if you want Claude Code's own warning to show.

### Code Quality

A growing list of bullets. The non-obvious ones:

- When a request has multiple plausible interpretations, name them and ask. Don't silently pick one.
- Never use emdashes. Hyphens or rewrite.
- Never use emojis.
- Never take credit. No AI-coauthor attribution lines, no auto-generated credit comments. The assistant is invisible in the output.
- Project updates record the human collaborator's name (derived from `git config user.name`). The human is named, the assistant isn't.
- Never fabricate SVG icons. Source verbatim from Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Feather, or Material Symbols. Path data must match library source byte-for-byte.
- Never use legacy model versions. Always the newest available (gpt-5.4, latest Claude, latest Gemini).
- Style guides and component libraries must be fully isolated from the app's global styles.
- Each design-system component must be verified in browser against the design source before moving to the next. One at a time.

### cmux Browser Pane

Documents `cmux browser screenshot`, `navigate`, `snapshot --interactive` commands and their use as the primary preview method on this machine. Each project records its surface ID as a `reference_cmux_browser.md` memory.

</details>

<a id="deep-design-stack"></a>

<details>
<summary><b>The design pipeline tour</b></summary>

Six layered skills + tokens + brand. Each addresses a different question at a different beat in the build flow. The pipeline doesn't sequence linearly through every build - it routes by what the task actually needs.

### 1. Strategy / brand - Impeccable

A plugin (`impeccable@impeccable`) auto-installed via your `enabledPlugins`. Twenty-three commands ranging from `teach` (interactive PRODUCT.md authoring) to `craft` (build from scratch) to `audit/critique/polish` (the QA triad). Reads `PRODUCT.md` and `DESIGN.md` at the project root before every command, so output is always informed by the project's own register and anti-references.

The CLAUDE.md hard rule: before any UI work begins, Claude checks for `PRODUCT.md`. Missing or stub triggers `/impeccable teach`. Missing `DESIGN.md` plus existing code triggers a one-time-per-session nudge to run `/impeccable document`.

### 2. Research - component-gallery-reference

A bundled skill that has Claude browse [component.gallery](https://component.gallery) before building any standard UI component. The site catalogs 60 component types across 95 design systems (Polaris, Carbon, Primer, Spectrum, Material) with 2,672 examples.

The skill adds a research step before implementation: detect tech stack from `package.json`, browse the component page filtered by that stack, exclude examples tagged "Unmaintained" or "Accessibility issues", inventory the project's design system, synthesize a brief mapping gallery patterns onto the project. Then build with three layers: function from the gallery (semantic markup, ARIA, keyboard), identity from the project (fonts, colors), gap-fills derived from gallery patterns but styled with project tokens.

### 3. Typography - fontshare-reference

A bundled skill that researches typefaces via [fontshare.com](https://fontshare.com), Indian Type Foundry's curated open-source catalog. Sensible organization (sans/serif/display/mono + personality tags + variable + language filters), curated quality, designer-recommended pairings.

Critically, the skill bakes in Impeccable's **reflex-reject list** - the training-data-default typefaces (Inter, Fraunces, Outfit, Instrument Serif, Newsreader, Plus Jakarta Sans, DM Sans/Serif, IBM Plex, Space Grotesk, et al.) that have become monoculture. The skill also warns about fontshare's own emerging defaults (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) so the catalog doesn't become the new Inter.

Workflow: read PRODUCT.md, write three brand-voice words, list your reflex picks and reject any on the reject list, browse fontshare with the brand-voice words in mind, cross-check against anti-reflexes, verify weights / OpenType features / language coverage, pair within the family before adding a second face, document in DESIGN.md.

### 4. References - design-references + /curate (the personal catalog)

Two sibling skills plus a data directory at `~/.claude/design-references/`. This is where the system learns from your eye - the layer no public catalog can provide.

`/curate` is the capture wizard. Invoke it with a URL or screenshot, walk a 5-step flow (source → auto-tag proposal → why-interesting body → slug → save). Hybrid tagging: strict Category from a controlled vocab (`list`, `navigation`, `command-palette`, `inline-affordance`, etc.); free-form Pattern + Feel for the personality words. The wizard uses multiple-choice prompts so capture stays low-friction.

`design-references` is the retrieval skill. Auto-triggers on UI build keywords, greps the catalog for matching category / pattern / feel tags against the task context AND against PRODUCT.md voice words when present. Surfaces 0-5 references with body + URL + screenshot. Stays SILENT if no good matches - noisy surfacing destroys trust in the catalog.

What this layer covers that the public catalogs do not: one-off patterns. A particular animation. A particular interaction. A specific brand's distinctive treatment. The patterns that don't fit any standard taxonomy but are worth remembering when they show up.

### 5. Motion - motion-reference (GSAP + Lenis)

A bundled skill shipping canonical patterns for the GSAP + Lenis stack. Routes by task: tweens / timelines / stagger → `gsap`; scroll-driven (pin / scrub / snap) → `ScrollTrigger`; smooth-scroll feel → Lenis; layout transitions → `Flip`; SVG path draw → `DrawSVG`; text by word / char → `SplitText`; drag → `Draggable`; SVG morph → `MorphSVG`; path animation → `MotionPath`.

License note baked into the skill: as of Webflow's acquisition of GreenSock, **all formerly-paid GSAP plugins are now free** - SplitText, MorphSVG, DrawSVG, ScrollSmoother, Inertia, MotionPathHelper. No paywall.

Critical patterns shipped inline: the 3-line GSAP + ScrollTrigger + Lenis glue snippet, React `useGSAP` hook with scope, `ReactLenis` root provider, Flip layout transitions, SplitText stagger, DrawSVG path animation. Plus the gotchas that bite: SSR, `ScrollTrigger.refresh()` after dynamic content, Lenis breaking native `scrollIntoView`, iOS Safari + Lenis + `position: fixed`, plugin registration placement.

### 6. Tokens - DESIGN.md

Google's spec for representing a visual identity to coding agents. YAML frontmatter for tokens (colors, typography, rounded, spacing, components with `{path.to.token}` references), markdown body for rationale. Comes with `npx @google/design.md lint` for schema validation, WCAG contrast checks, broken-ref detection.

CLAUDE.md mandates: when writing or updating a project's DESIGN.md (via `/impeccable document`, `/impeccable extract`, or by hand), conform to the Google spec. Run lint after every write and resolve every error or warning. Generated UI references tokens via `{path.to.token}`, not hex literals, so the file stays the source of truth.

### 7. Tactical - make-interfaces-feel-better

An Anthropic Skill that auto-triggers on UI keywords: border radius, animation, optical alignment, hover state, tabular numbers, "feel better." Sixteen specific rules with exact values:

- Concentric border radius (`outer = inner + padding`)
- Optical centering (icons need manual nudge past geometric)
- Shadows over borders (layered transparent `box-shadow`)
- Interruptible animations (CSS transitions for state, keyframes only for staged)
- Split + stagger enters (semantic chunks, ~100ms delay each)
- Subtle exits (small fixed `translateY`, never full height)
- Contextual icon swaps via `opacity 0->1, scale 0.25->1, blur 4px->0`
- Font smoothing on root
- Tabular nums on dynamic counters
- `text-wrap: balance` on headings, `pretty` on body
- Image outlines `rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)` dark, NEVER tinted
- `scale(0.96)` on press, always 0.96
- `initial={false}` on AnimatePresence to skip first-load animations
- Never `transition: all`; specify exact properties
- `will-change` only on transform / opacity / filter, sparingly
- Minimum 40x40px hit area, no overlap

The skill's review-output-format (before/after tables grouped by principle) is the canonical UI-change summary across all Yes& work.

### Peer skills (sibling layers, not in the main pipeline)

The `skills` component also bundles four peer skills that aren't part of the strategy-to-tactical pipeline but ship alongside:

- **`social-media`** - platform specs for Instagram, YouTube, TikTok, Twitter / X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack. Safe zones, sizes, typography rules. The spec sheet, not the paintbrush.
- **`design-team`** - multi-agent design sprints with 16 specialized roles, four phases (Research → Build → Review → Revise). Use for full pages or campaigns, not single components.
- **`visual-effects`** - actual shader source for generative backgrounds (mesh gradient, fluid sim, fractal, halftone, swarm) plus 17 stackable post-process FX (ASCII, dither, glitch, halftone, etc.). Ships canonical implementations, not abstractions.
- **`icon-source`** - icon-library discipline. One library per project, verbatim path sourcing, animated-vs-static selection criteria. Eight approved libraries (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols, Lucide Animated, Heroicons Animated).

### How the layers stack on a real build

A typical "build me a landing-page hero" task fires the pipeline in roughly this order:

1. `/impeccable shape <feature>` reads PRODUCT.md and proposes the brand direction.
2. `component-gallery-reference` triggers if the build maps to a standard component (header, hero card, navigation).
3. `design-references` triggers in parallel, surfacing any captured references with matching category / pattern / feel tags.
4. `fontshare-reference` triggers if type decisions are in scope (new typeface, new pairing).
5. `motion-reference` triggers if the hero has scroll or motion behavior.
6. `icon-source` triggers if icons are needed.
7. `make-interfaces-feel-better` fires during implementation for the tactical polish.
8. `/impeccable audit + critique + polish` runs at QA time.

Not every layer fires for every task. Strategy and tactical fire on almost every UI build; the others route in based on what the task actually needs.

</details>

<a id="deep-memory"></a>

<details>
<summary><b>Memory: how Claude remembers, in detail</b></summary>

Memory turns Claude Code from a stateless code generator into a colleague who remembers what we decided last week and why. It's the most important thing in this repo.

### Three layers of memory

**Project root memory** (`<project>/.claude/memory/`) is the canonical record for that specific project. Session files (`session_YYYY-MM-DD_<topic>.md`), feedback files (`feedback_<topic>.md`), reference files (`reference_<topic>.md`). Indexed by `MEMORY.md`. Committed to the project's git repo. Pulled and read by every collaborator's Claude.

**Global cross-project memory** (`~/.claude/memory/`) is per-machine, durable across all projects you open with Claude Code. Things like the attribution policy, Yes&-wide feedback, hook verification discipline. Symlinked from the dotfiles repo when you tick the `memory` component, so every Yes& dev's machine has the same baseline.

**Per-project global memory** (`~/.claude/projects/<project-path>/memory/`) is automatically written by Claude Code itself for telemetry-style state. Secondary context, read at session start.

### Three lifecycle hooks make memory concrete

- **`SessionStart`** runs `~/.claude/startup-check.sh` which loads project memory + global memory + relevant feedback files into the model's session context. The status line "Loading memory..." is the visible signal.
- **`PreCompact`** fires when Claude's context window is about to be compressed. The hook emits a system reminder telling Claude to flush any pending memory entries to disk before context is lost. Status: "Flushing memory before compact..."
- **`PostCompact`** re-runs the startup loader after compaction, so post-compaction Claude has fresh memory loaded again. Status: "Reloading memory after compaction..."

### What memory is NOT for

- Code patterns, conventions, file paths, project structure - all derivable from reading the current state.
- Git history, who-changed-what - `git log` is authoritative.
- Debugging solutions or fix recipes - the fix is in the code; the commit message has context.
- Anything already in CLAUDE.md.
- Ephemeral task state, in-progress work, current conversation context.

These exclusions apply even when a user explicitly asks Claude to "save this." Memory is for what's surprising, durable, and not derivable.

</details>

<a id="deep-plugins"></a>

<details>
<summary><b>Plugins, connectors, MCP servers, Skills (the four-tier explanation)</b></summary>

People conflate these. They're four different mechanisms with four different config surfaces.

### 1. Plugins (Claude Code)

Declared in `~/.claude/settings.json` under `enabledPlugins`. Auto-installed by Claude Code on first launch from the official marketplace (or extra marketplaces declared in `extraKnownMarketplaces`). Live in `~/.claude/plugins/`. Sync across machines via the dotfiles symlink to settings.json.

The `config` component enables 23 plugins:

| Plugin | What it does |
|---|---|
| `claude-md-management` | Tools for managing CLAUDE.md files |
| `figma` | Design context and screenshots from Figma URLs |
| `firebase` | Firebase project tools |
| `hookify` | Helps you build Claude Code hooks |
| `skill-creator` | Helps you build Anthropic Skills |
| `sentry` | Error tracking and Seer-based issue analysis |
| `supabase` | Supabase project tools |
| `swift-lsp` | Swift Language Server integration |
| `superpowers` | Agentic skill bundle (brainstorming, debugging, etc.) |
| `agent-sdk-dev` | Tools for building Agent SDK applications |
| `typescript-lsp` | TypeScript Language Server integration |
| `security-guidance` | Defensive security context |
| `discord` | Discord channel integration for chat sessions |
| `impeccable` | The Yes& design brain (PRODUCT.md, /impeccable commands) |
| `feature-dev` | Guided feature development with codebase understanding |
| `ralph-loop` | Iterative development loop automation |
| `code-review` | Pull request code review tooling |
| `plugin-developer-toolkit` | Tools for building Claude Code plugins |
| `chrome-devtools` | Chrome DevTools integration for debugging |

### 2. Connectors (Claude.ai account-level)

OAuth integrations configured at [claude.ai](https://claude.ai) -> Settings -> Connectors. **Not** in your dotfiles. They're tied to your Anthropic account, not your machine, and propagate automatically when you sign in to Claude on any device.

ClickUp is a connector. So is Google Drive. So are most of the "work-app integrations" Claude offers. Authorize once per account.

### 3. MCP servers (per-app, per-machine)

Stand-alone servers exposing tools via the Model Context Protocol. Configured per Claude Code session via `claude mcp add`, or globally for Claude Desktop in `~/Library/Application Support/Claude/claude_desktop_config.json`.

Claude in Chrome is an MCP server (with a Chrome extension as the bridge). cmux can also expose its browser as an MCP server. **Not** in your dotfiles, because most MCP server configs need OAuth or per-machine credentials.

### 4. Skills (Anthropic Skills, in `~/.claude/skills/`)

Reusable prompt and behavior modules that auto-trigger on keyword matches. Some installed via `npx skills add <github-repo>`, others bundled with this repo and copied directly. Live in `~/.claude/skills/`.

The `skills` component installs 10 skills:

| Skill | Layer | Source |
|---|---|---|
| `make-interfaces-feel-better` | Tactical CSS polish (16 rules) | npx (jakubkrehel/make-interfaces-feel-better) |
| `component-gallery-reference` | Research (60 component types, 95 systems) | Bundled with this repo |
| `fontshare-reference` | Typography (fontshare.com + reflex-reject list) | Bundled with this repo |
| `motion-reference` | Animation / scroll (GSAP + Lenis canonical patterns) | Bundled with this repo |
| `curate` | Personal-catalog capture wizard (`/curate`) | Bundled with this repo |
| `design-references` | Personal-catalog retrieval (auto-consults on UI builds) | Bundled with this repo |
| `social-media` | Platform specs for 13 social platforms | Bundled with this repo |
| `design-team` | Multi-agent design sprints (16 roles, 4 phases) | Bundled with this repo |
| `visual-effects` | Shader + post-process FX (14 shaders, 17 effects) | Bundled with this repo |
| `icon-source` | Icon library discipline (8 approved libraries) | Bundled with this repo |

The `reflect` component (separate from `skills`) adds an 11th skill: `reflect` itself (multi-agent corpus analysis) plus its SessionStart nudge hook.

All skills are fully additive - they don't depend on your CLAUDE.md or settings.json structure, so they're safe to install alongside any existing Claude Code config.

### Quick decision table

| If you want... | You configure... |
|---|---|
| The Yes& design brain on Claude Code | Plugin (settings.json - `config` component) |
| Drag-drop Figma URLs into a chat | Plugin (`figma`) |
| ClickUp tasks accessible to Claude.ai | Connector (claude.ai UI, account-bound) |
| Local browser automation in a chat | MCP server (per-app config) |
| Tactical UI polish rules that auto-fire | Skill (`make-interfaces-feel-better`) |
| Industry-validated UI component patterns | Skill (`component-gallery-reference`) |
| Anti-monoculture typography research | Skill (`fontshare-reference`) |
| GSAP + Lenis canonical animation patterns | Skill (`motion-reference`) |
| A personal catalog of patterns you've seen in the wild | Skill (`curate` + `design-references`) |
| Memory corpus analysis across all your sessions | Skill (`reflect` - `reflect` component) |

</details>

<a id="deep-customization"></a>

<details>
<summary><b>Customization (env vars, flags, deep config)</b></summary>

### Bootstrap-time flags

```bash
curl -fsSL .../bootstrap.sh | bash                    # default - clones to ~/Documents/Github/claude-dotfiles
curl -fsSL .../bootstrap.sh | bash -s -- --dir PATH   # custom clone location
curl -fsSL .../bootstrap.sh | bash -s -- --yes        # full non-interactive install after clone
curl -fsSL .../bootstrap.sh | bash -s -- --preset minimal  # specific preset
```

Or with env vars:

```bash
CLAUDE_DOTFILES_DIR=~/code/dots CLAUDE_DOTFILES_REPO=https://github.com/your-fork/claude-dotfiles.git curl -fsSL .../bootstrap.sh | bash
```

### Installer flags

```bash
./install.sh                    # interactive TUI (default)
./install.sh --yes              # install everything non-interactively
./install.sh --preset NAME      # all | minimal | none
./install.sh --only KEYS        # comma-separated subset, e.g. brain,config,memory,nvm
./install.sh --dry-run          # show resolved picks, touch no files
./install.sh --help             # full usage
```

Valid component keys: `brain`, `config`, `memory`, `skills`, `statusline`, `cmux`, `nvm`, `ampersand`, `voice`, `discord`.

### Presets

| Preset | Components |
|---|---|
| `all` | Everything (same as `--yes`) |
| `minimal` | `brain` + `config` + `memory` + `skills` + `nvm` |
| `none` | Nothing (useful with `--dry-run`) |

### Settings.json customization

`config` JSON-merges hooks, plugins, and permission patterns into your existing `~/.claude/settings.json`. It does not touch your `defaultMode`, model preferences, or other settings. To customize:

- **Adding a plugin**: edit `enabledPlugins` in `claude/settings.json` in the repo and add `"<plugin>@<marketplace>": true`. Commit, push, `ampersand --pull` on other machines to re-merge, restart Claude Code.
- **Tightening permissions**: edit `permissions.allow` in your own `~/.claude/settings.json` directly. Or change `defaultMode` from `bypassPermissions` to `default` to require approval on tool calls.
- **Adding a hook**: append to the appropriate `hooks.<event>` array in `claude/settings.json` in the repo. Commit, push, re-run install to re-merge.

### CLAUDE.md customization

`brain` appends team rules between marker comments in your `~/.claude/CLAUDE.md`. Your own content above and below the markers is preserved. To update the team rules: edit `claude/CLAUDE.md` in the repo, commit, push, and re-run `ampersand --pull` to re-append. To remove the team rules: sed-delete from the marker begin to marker end. To re-add: re-run `install.sh --only brain`.

</details>

<a id="deep-architecture"></a>

<details>
<summary><b>Architecture (under the hood)</b></summary>

### Install strategy

| Target | Strategy | Why |
|---|---|---|
| `~/.claude/CLAUDE.md` | Marker-guarded append | Your content preserved; our rules appended between markers; `git pull` + re-run updates our block |
| `~/.claude/settings.json` | JSON-merge (python3) | Your settings preserved; our hooks/plugins/patterns merged in; does not touch defaultMode |
| `~/.claude/hooks/*.sh` | File copy from repo | Hook scripts copied alongside your existing hooks; re-run updates from repo |
| `~/.claude/memory/*.md` | Symlink to repo | Memory edits write directly into the repo working tree |
| `~/.claude/skills/<skill>/` | npx-installed or file copy | Skills versioned by their own repo or bundled with ours |
| `~/.config/cmux/settings.json` | Symlink to repo | Same as before |
| `~/.zshrc` | Marker-guarded append | Labeled blocks that can be sed-deleted cleanly |

### Hook lifecycle

Eighteen hooks across six events, grouped by role. Once the `config` and other components merge them into `~/.claude/settings.json`, they fire automatically.

**Refusal hooks** (PreToolUse - hard deny, block the tool call):

| Matcher | Hook | Purpose |
|---|---|---|
| `Bash` | `bash-guard.sh` (5s) | Blocks AI-coauthor lines, force-push to main / master, `rm` against `.claude/memory`, legacy model IDs, project-specific anti-patterns (e.g. `window.__improv.*` for validation work) |
| `Write\|Edit\|MultiEdit` | `content-guard.sh` (5s) | Same pattern set inside file content - attribution, emdashes / endashes, emoji unicode ranges, legacy model IDs |
| `Write\|Edit\|MultiEdit` | `memory-approve.sh` (5s) | Auto-approves memory-path writes regardless of permission mode |
| `mcp__voice-output__speak` | `voice-gate.sh` (5s) | Denies speak calls when `~/.claude/.voice-enabled` is absent (no wasted OpenAI TTS round-trips when muted) |
| `mcp__claude-in-chrome__javascript_tool` | `validation-guard.sh` (5s) | Blocks `.click()`, synthetic events, `getComputedStyle`, `getBoundingClientRect`, `.textContent`, underscore-prefixed app methods - the DOM shortcuts that fake UI validation without going through the real event path |

**Gate hooks** (state-machine gates - block `git commit` or further work until verification fires):

| Event | Hook | Purpose |
|---|---|---|
| `PostToolUse(Write\|Edit\|MultiEdit)` | `verify-before-done.sh` (5s) | Sets `~/.claude/.needs-verification` on edits to `.ts/.tsx/.css/.sh/.py` files. `bash-guard` blocks `git commit` while the flag is set. Clears on cmux screenshot Read, localhost curl, test commands (`npm test`, `vitest`, `pytest`, `node *test*.js`), external curl probes with port / path, and `/tmp/*.log` Reads. |
| `PostToolUse(Read)` | `verify-clear.sh` (5s) | Clears `.needs-verification` on Read of a `.png` (the screenshot was actually opened, not just saved) |
| `UserPromptSubmit` | `verify-manual.sh` (5s) | Recognizes phrases like "looks good" / "ship it" / "approved" and clears verification manually when the user explicitly signs off |
| `PostToolUse(Bash\|mcp__claude-in-chrome__computer)` | `screenshot-open-mandate.sh` (5s) | Sets `.screenshot-pending` after a screenshot is saved. `bash-guard` blocks subsequent `cmux ... screenshot` and `git commit` until the flag clears |
| `PostToolUse(Read)` | `screenshot-open-clear.sh` (5s) | Clears `.screenshot-pending` when a matching `.png` path is Read |
| `PostToolUse(Write\|Edit\|MultiEdit)` | `second-fix-gate.sh` v2 (5s) | Warns once when a second fix lands on the same file within 10 min with `.needs-verification` still set. Suppressed on purely-additive Edit / MultiEdit (where `new_string` contains `old_string`). Manual override via `touch ~/.claude/.suppress-fix-gate` (30-min auto-expiring TTL) |

**Nudge hooks** (PostToolUse advisory - inject reminder text, do not block):

| Matcher | Hook | Purpose |
|---|---|---|
| `Write\|Edit\|MultiEdit\|Bash` | `memory-nudge.sh` (5s) | Injects "PROJECT FILE CHANGED. You are in dirty state. Write memory before responding" after any non-memory file change |
| `SessionStart` | `reflect-nudge.sh` (5s) | Counts new memories since last reflection; if above threshold (default 15, configurable via `REFLECT_THRESHOLD`), surfaces a "want to run /reflect?" prompt at session start |

**Toggle hooks** (UserPromptSubmit - flip state on chat phrases):

| Trigger phrase | Hook | Effect |
|---|---|---|
| "voice on" / "voice off" / "mute yourself" / "unmute" | `voice-toggle.sh` (5s) | Touches or removes `~/.claude/.voice-enabled` |
| "resume on" / "resume off" / "auto-resume" | `resume-toggle.sh` (5s) | Touches or removes `~/.claude/.no-auto-resume` (cmux auto-resume policy) |

**Lifecycle hooks** (SessionStart / PreCompact / PostCompact / SessionEnd):

| Event | Hook | Purpose |
|---|---|---|
| `SessionStart` | `startup-check.sh` (10s) | Loads project + global memory at session start |
| `SessionStart` | `voice-mandate.sh` (5s) | Reads `~/.claude/.voice-enabled` and injects an active-mandate, muted-notice, or silence (gate for the voice subsystem) |
| `PreCompact` | inline command (5s) | Flushes pending memory before context compresses |
| `PostCompact` | `startup-check.sh` (10s) | Re-loads memory after compression |
| `SessionEnd` | `resume-guard.sh` (5s) | Blocks cmux auto-resume so a stale session doesn't surprise you on next launch |

All hooks are pipe-tested before they ship (the `bash-guard.sh` hook discipline of verified-via-stdin-test is itself a feedback memory: `feedback_hook_verification_discipline.md`). The full inventory + flag-file registry + precedence rules live at `.claude/memory/decision_hook_system_architecture.md` if you need the authoritative version - this README table summarizes.

The hook layer evolved from real failures - rule → feedback memory → hook is the documented escalation pattern. The 2026-05-19 reflection traces several specific lineages: memory writes failed enough times that `memory-nudge` was built; screenshots got described-without-Reading often enough that `screenshot-open-mandate` was built; a same-file regression shipped during the 2026-05-19 improv WSS debugging that drove `second-fix-gate`.

### Idempotency model

Every section of `install.sh` is idempotent:

- **Symlinks**: `make_symlink` checks if the target already points where we want; if so, no-op. Otherwise backs up any pre-existing real file, removes stale symlinks, creates fresh.
- **`.zshrc` appends** (nvm, shortcuts, discord): marker-guarded with grep checks. If the marker is present, no-op. The shortcuts block (ampersand) also self-heals: if the marker is present but the baked `cd "$REPO_DIR"` doesn't match the current `$REPO_DIR`, the entire block is sed-deleted and re-appended at the new path. The same self-heal recognizes any older block format we ever shipped and rewrites it to the current one.
- **Settings.json JSON-merge** (`config`, `memory`): marker-based detection on substrings (hook command paths, plugin names). If detected, no-op. Otherwise python3 reads the existing settings.json, adds the missing entries, writes back. Does not touch defaultMode or other user preferences.
- **CLAUDE.md marker-append** (`brain`, `memory`): marker-guarded on `<!-- claude-dotfiles:<component>:begin -->`. If present, no-op. Otherwise appends the block between markers.
- **Hook file copy** (`config`): copies hook scripts to `~/.claude/hooks/`. Overwrites only our own scripts (same filename), never touches hooks you wrote.
- **npx skills add**: idempotent via the skills CLI's own logic.

### Backup discipline

Any pre-existing real (non-symlink) file at a target path gets copied to `.backups/<timestamp>/<original-path>` before the installer overwrites it. Backups are gitignored so they don't pollute the repo. To recover from a bad install, walk `.backups/` and copy back what you want.

### Multi-location support

The dotfiles can be cloned to any path - `~/code/dots`, `/opt/dots`, `~/dotfiles/yes-and`. The `ampersand` shortcut bakes in the install-time `$REPO_DIR`. If you move the repo, re-running `install.sh` from the new location triggers the path-drift self-heal that rewrites the shortcut block.

</details>

<a id="troubleshooting"></a>

<details>
<summary><b>Troubleshooting</b></summary>

### "claude: command not found" in fresh terminals

Cause: Homebrew's nvm sources `nvm.sh` (making the `nvm` command available) but doesn't activate a default Node version. The cmux claude wrapper is first in PATH, runs when you type `claude`, looks for the real claude binary elsewhere in PATH, finds nothing because nvm hasn't activated.

Fix: tick the `nvm` component in the installer. It appends `nvm use default --silent` to your `.zshrc`. Open a new terminal (or `source ~/.zshrc`) and `claude` should resolve.

### `ampersand: command not found` immediately after install

Cause: shell functions defined inside install.sh's child process don't escape into the parent shell. Your current zsh hasn't read the updated `.zshrc` yet.

Fix: `source ~/.zshrc` once, or open a new terminal window. Subsequent shells read `.zshrc` at startup so this only happens once per machine.

### Permissions prompts on every markdown write

Cause: should not happen with `defaultMode: bypassPermissions` set, but Claude Code or its harness sometimes escalates anyway.

Fix: `claude/settings.json` already includes explicit `Write(**/*.md)`, `Edit(**/*.md)`, `MultiEdit(**/*.md)` allow rules. If you're still seeing prompts, restart your Claude Code session - permissions are loaded at session start. If they persist, broaden the allow list.

### gum not installed and I don't want to install it

The TUI degrades gracefully to a numbered text menu if gum isn't available and you decline to brew-install it. Same components, same flags, less polish. Pick numbers to toggle off, press enter to confirm.

### Memory entries from a teammate on a different machine

Pull the project: `git pull` in the project repo. The memory files are in `<project>/.claude/memory/` like any other source. Claude reads them at session start.

### Fresh install on a new Mac, where do I start

```bash
curl -fsSL https://raw.githubusercontent.com/jonahscohen/claude-dotfiles/main/bootstrap.sh | bash
```

Take TUI defaults. New terminal. Done.

### I want to install without pulling first

Use `ampersand` (no `--pull`). Same install process, no `git pull` step. Useful when you're iterating on the dotfiles locally and don't want to pull until you've finished a series of edits.

### My team has its own Claude Code config and I don't want to overwrite it

Every component is additive. `brain` appends to your CLAUDE.md between markers. `config` JSON-merges into your settings.json. Nothing is replaced. Just run `ampersand` and pick what you want.

```bash
ampersand --pull --only brain,config,memory,skills
```

That installs the team rules, hooks/plugins, memory subsystem, and skills. Your existing content in CLAUDE.md and settings.json stays intact.

### How do I undo the dotfiles entirely

For marker-appended files (CLAUDE.md): sed-delete from the marker begin to marker end. For JSON-merged settings (settings.json): remove the specific hook/plugin entries that were added. For symlinked files (statusline, memory, cmux): `rm` them and copy back from `.backups/<some-timestamp>/` if needed. For appended `.zshrc` blocks: sed-delete the marker-guarded ranges.

We don't ship an automated uninstaller because it would require us to know which timestamp's backups to use. Manual is safer.

</details>

<a id="deep-contributing"></a>

<details>
<summary><b>Contributing (for Yes& devs)</b></summary>

### Adding a new component

1. Add the key to `KEYS=(...)` in `install.sh` and add a TITLE + DESC in the same arrays. Bump the PICKS array length.
2. Add an apply block (`if picked <key>; then ... fi`) in the appropriate numbered section. Renumber subsequent sections to stay sequential.
3. If the component modifies `~/.zshrc`, use a marker-guarded append pattern (see the `nvm` or `ampersand` blocks for examples). Always include path-drift self-heal logic if the block bakes in `$REPO_DIR`.
4. If the component modifies `~/.claude/settings.json` JSON-style, use the python3 stdlib merge pattern from the `memory` component. Marker-detection is mandatory.
5. Update `--help` valid keys list and the post-install summary's `picked <key> && echo "..."` line.
6. Update the README component table.
7. Write a session memory entry: `.claude/memory/session_YYYY-MM-DD_<topic>.md`. Index in `MEMORY.md`.
8. Commit, push, `ampersand --pull` on a different machine to verify.

### Adding a new skill to the `skills` component

Edit the apply block in install.sh's section 3. Add another `npx --yes skills add <github-repo>` invocation alongside the existing `make-interfaces-feel-better` line. Wrap in a non-fatal warn pattern so a failed skill install doesn't abort the run. Update the component description and post-install summary.

### Adding a new plugin to the `config` component

Edit `claude/settings.json`. Add `"<plugin>@<marketplace>": true` to `enabledPlugins`. If the marketplace isn't already known, add it to `extraKnownMarketplaces` with `source` and `autoUpdate`. Re-run install to merge, restart Claude Code to install.

For Yes& devs: bias toward enabling plugins the whole engineering team benefits from. Plugins that only one developer needs should live in their personal Claude Code config, not the shared dotfiles.

### Adding a new CLAUDE.md rule

Edit `claude/CLAUDE.md`. Decide which existing section the rule belongs to (Memory Discipline, Verification Protocol, Design Work and Impeccable, Code Quality, etc.) - rules under the wrong heading get ignored. If the rule needs cross-team enforcement on projects where the dotfiles aren't installed, also drop it into a project-root CLAUDE.md template that we ship to the team.

### Memory entry conventions

Every change to the dotfiles repo writes a session memory entry. Format:

```markdown
---
name: <one-line title>
description: <one-line summary used by future Claude to decide relevance>
type: project
---

Collaborator: <your name from git config user.name>

# What changed

[bullet list of concrete changes]

# Why

[motivation]

# How to apply

[is it live immediately, do other machines need to pull, etc.]

# Files touched

- file1.ext
- file2.ext
```

Index it in `.claude/memory/MEMORY.md` as a one-line entry.

### Pull request hygiene

Branch from `main`. Squash-merge with a clear title. Don't take credit in commit messages, the dotfiles enforce that for code, and we extend the convention to repo work.

</details>

<a id="deep-opinion"></a>

<details>
<summary><b>Why we built this (the long version)</b></summary>

Every Yes& developer runs Claude Code. Each of us figured out the same lessons one fix at a time: how to make Claude remember yesterday, how to keep it from inventing icons, how to stop it from writing 800 lines when 80 was the brief, how to get the design output to actually feel on-brand. Those lessons used to live in scattered private CLAUDE.md files, half-remembered Teams threads, and the sediment of pull-request comments.

We pulled them into one place, made them installable, and made them yours by typing `ampersand`.

This repo is the version-controlled answer to "how is Yes& running Claude Code right now."

### What this isn't

It isn't a Claude Code tutorial - we assume you've got `claude` working. It isn't a productivity-hack collection - the opinions here are constraints, not optimizations. It isn't a Yes& proprietary - the additive components are safe outside our team, by design.

</details>

---

## License & footer

The dotfiles are MIT licensed. Bundled tools (Impeccable, make-interfaces-feel-better, gum, etc.) are licensed by their respective authors - see each repository for terms.

The Yes& brand mark and logo are property of Yes&.

If you found this useful and you're not at Yes&, good - the additive components are built to layer onto your own setup. Issues and PRs welcome at [github.com/jonahscohen/claude-dotfiles](https://github.com/jonahscohen/claude-dotfiles).

We start with yes. You build what's next.
