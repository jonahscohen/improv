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
  <a href="#discipline">Discipline</a> ·
  <a href="#memory">Memory</a> ·
  <a href="#design">Design</a> ·
  <a href="#workflow">Workflow</a> ·
  <a href="#reference">Reference</a>
</p>

---

**The problem.** Working with Claude is fast. Working with Claude *well* is a discipline problem. The model forgets between sessions, has no opinions of its own, and will cheerfully ship a half-verified fix unless something stops it. Most "AI workflow" advice tries to solve this by adding ceremony, which the model promptly skips under pressure.

**The opinion.** Externalize the discipline into files the harness enforces. Rules in CLAUDE.md, loaded every session. Hooks in settings.json that block bad behavior at the tool boundary. Memory in `.claude/memory/` that persists across machines. A personal catalog that grows from your eye. Reflection that audits the whole system for drift.

**The system.** Twelve components, one curl, one shortcut. Four houses of thought: **Discipline** (the refusal layer), **Memory** (the persistence layer), **Design** (the 6-layer pipeline), **Workflow** (how you use it). All additive. All undoable. Pick the houses you want; the rest is a no-op.

**The proof.** Built on itself. The reflection skill exists because the corpus needed it. The personal-catalog system exists because public catalogs missed the patterns worth remembering. The second-fix gate evolved from a real same-file regression that shipped before the underlying root cause was found. Nothing in here is a feature in search of a problem.

---

<a id="install"></a>

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jonahscohen/claude-dotfiles/main/bootstrap.sh | bash
```

One curl. One shortcut installed: `ampersand`. Type it from any terminal to launch the component picker.

```bash
ampersand                       # interactive TUI
ampersand --pull                # pull latest, then TUI
ampersand --preset minimal      # brain + config + memory + skills + nvm
ampersand --only memory         # just one component
```

Twelve components in the picker, defaults are all on, every component is additive. The four houses below explain what they actually do.

---

<a id="discipline"></a>

## Discipline

**Why doesn't Claude ship sloppy work here?** Because the harness refuses, not advises.

Rules in CLAUDE.md are advisory - the model skips them under pressure. Hooks at the tool boundary are mechanical - they fire before the tool runs and block the call. Eighteen hooks across five roles enforce the disciplines that mattered. Each hook traces back to a specific real failure that drove its creation.

### The five roles

**Refusal hooks** intercept and block:

- `bash-guard` - blocks AI-attribution lines in commits, force-push to `main`/`master`, `rm` against `.claude/memory`, legacy model IDs
- `content-guard` - blocks the same patterns inside file content, plus emdashes, endashes, emoji
- `voice-gate` - blocks TTS calls when voice is muted (no wasted OpenAI round-trips)
- `validation-guard` - blocks DOM shortcut tricks during UI validation (no `.click()`, no synthetic events, no `getComputedStyle` for state inspection)
- `memory-approve` - auto-approves memory-path writes so they don't need permission prompts

**Gate hooks** block until verification fires. State machines, not refusals:

- `verify-before-done` + `verify-clear` + `verify-manual` - track unverified code edits and gate `git commit` until a screenshot, test run, or external probe clears the flag
- `screenshot-open-mandate` + `screenshot-open-clear` - force you to actually Read a screenshot before claiming you looked at it
- `second-fix-gate` (v2) - warns once when a second fix lands on the same file within ten minutes with no verification between. Stays silent on purely-additive sequential edits. Manual override via `touch ~/.claude/.suppress-fix-gate` (30-minute auto-expiring)

**Nudge hooks** advise but don't block:

- `memory-nudge` - reminds Claude after every code change that memory is dirty
- `reflect-nudge` - surfaces when enough new memories have accumulated to warrant `/reflect`

**Toggle hooks** flip state on chat phrases. "voice on" / "voice off" flip `~/.claude/.voice-enabled`. "auto-resume on" / "off" flip cmux auto-resume policy.

**Lifecycle hooks** run on session boundaries. SessionStart loads memory + voice mandate. PreCompact flushes pending memory before context compresses. PostCompact reloads after. SessionEnd `resume-guard` blocks cmux auto-resume so a stale session doesn't surprise you on next launch.

### The pattern

This isn't a feature; it's a method. The escalation goes: rule violated → feedback memory written → rule violated again → hook built → violations stop.

Several specific lineages in the 2026-05-19 reflection:

- Memory writes failed enough times that `memory-nudge` got built.
- Screenshots got described-without-Reading often enough that `screenshot-open-mandate` got built.
- A same-file regression during a WebSocket debugging session shipped before the underlying root cause was found - `second-fix-gate` came out of that.

When something fails twice, the next response is a hook.

### Verification protocol

Seven rules in CLAUDE.md gate task completion. UI changes need a screenshot, then an interactive screenshot for clickable elements, then a side-by-side against the design source. Non-UI changes need a `<step> -> verify: <check>` plan before implementation, with runnable verify clauses (not "looks right").

### Permission posture

`defaultMode: bypassPermissions` + `skipDangerousModePermissionPrompt: true`. Every tool call auto-approves. This is on purpose - the friction of per-tool prompts is worse than letting hooks be the gate, and the hooks already block the dangerous patterns. If you want different defaults it's a one-line edit in `claude/settings.json`.

→ [Full hook inventory](#hook-inventory) · [CLAUDE.md walkthrough](#deep-brain)

---

<a id="memory"></a>

## Memory

**Why does Claude remember here?** Because we externalize the record into files git carries.

Memory turns Claude Code from a stateless code generator into a colleague who remembers what was decided last week and why. It is the most load-bearing thing in this repo.

### Three layers

**Project root memory** (`<project>/.claude/memory/`) is the canonical record for that project. Session files (`session_YYYY-MM-DD_<topic>.md`), feedback files, reference files, decision files. Indexed by `MEMORY.md`. Committed to git. Read by every collaborator's Claude.

**Global cross-project memory** (`~/.claude/memory/`) is per-machine, durable across all projects. The attribution policy, Yes&-wide feedback, hook verification discipline. Symlinked from the dotfiles by the `memory` component, so every Yes& dev's machine has the same baseline.

**Per-project global memory** (`~/.claude/projects/<project-path>/memory/`) is automatically written by Claude Code for telemetry-style state.

### The lifecycle

Every discrete change writes a memory entry before Claude responds. Not per-feature - per-task. A CSS fix, a copy change, a refactor decision - each lands in `<project>/.claude/memory/session_YYYY-MM-DD_<topic>.md` immediately. Batching is a failure mode the `memory-nudge` hook catches.

Three lifecycle hooks make memory concrete:

- **SessionStart** runs `~/.claude/startup-check.sh` which loads project + global memory into context.
- **PreCompact** flushes pending memory before context compresses.
- **PostCompact** reloads memory after compression.

### Reflection

The `/reflect` skill spawns five parallel analysis agents (Pattern Hunter, Tension Detector, Gap Analyst, Drift Tracker, Decision Archaeologist) against the accumulated memory corpus. They surface what's emerging that no single session would notice - contradictions between rules, hooks that misfire, decisions that have gone stale, drift in practice.

A SessionStart `reflect-nudge` hook counts new memories since the last reflection. When the threshold is exceeded (default 15, configurable via `REFLECT_THRESHOLD`), the session opener nudges you. The output saves to `.claude/memory/reflection_YYYY-MM-DD.md` and informs the next round of hooks and rules. The 2026-05-19 reflection itself drove most of the hook layer's maturation.

### Attribution and collaboration

Every memory entry records a `Collaborator:` line derived from `git config user.name`. Alice's Claude tags her name; Bob's tags his. Memory files commit and push like any source file. The next teammate's Claude reads it at session start with attribution baked in.

The assistant is invisible in the output. No AI-attribution lines in commits, no auto-generated credit comments, no AI attribution anywhere. Humans are named; the assistant isn't.

For ironclad enforcement on projects where teammates haven't installed the dotfiles, drop a `CLAUDE.md` at the project root that re-states the rules. Claude Code reads project-root CLAUDE.md regardless of machine config.

→ [Memory file format](#deep-memory-format) · [Project-level CLAUDE.md template](#project-claude-md)

---

<a id="design"></a>

## Design

**Why does generated UI look right here?** Because six skills stack from strategy down to tactical, each firing at the right beat.

Most AI-generated UI looks the same because most prompts ask for the same vague thing. This repo routes design work through layered skills, each addressing a different question:

| Layer | Skill | Question it answers |
|---|---|---|
| 1. Strategy | `/impeccable` plugin | Who is this for? What's NOT us? |
| 2. Research | `component-gallery-reference` | How does the industry build this component? |
| 3. Typography | `fontshare-reference` | Which typeface? (refuses training-data defaults) |
| 4. References | `design-references` + `/curate` | What did you see in the wild worth borrowing? |
| 5. Motion | `motion-reference` | GSAP + Lenis canonical patterns |
| 6. Tactical | `make-interfaces-feel-better` | Exact-value polish at implementation time |

Plus two foundations:

- **Tokens** - `DESIGN.md` at the project root, per the [google-labs-code/design.md](https://github.com/google-labs-code/design.md) spec. Lints clean before UI ships.
- **Brand** - `PRODUCT.md` at the project root. Register, users, anti-references. Strategy reads it before every command.

### How the layers stack on a real build

A typical "build me a hero section" task routes the pipeline in roughly this order:

1. `/impeccable shape <feature>` reads PRODUCT.md and proposes a brand direction.
2. `component-gallery-reference` triggers if the build maps to a standard component (hero, header, navigation).
3. `design-references` triggers in parallel, surfacing captured references with matching category / pattern / feel.
4. `fontshare-reference` triggers if type decisions are in scope.
5. `motion-reference` triggers if the hero has scroll or motion behavior.
6. `icon-source` (peer skill) triggers if icons are needed.
7. `make-interfaces-feel-better` fires during implementation for the tactical polish.
8. `/impeccable audit + critique + polish` runs at QA time.

Not every layer fires for every task. The pipeline routes by what the task actually needs.

### The personal catalog (Layer 4)

This is the layer that earns its keep over time. `design-references` consults a local catalog at `~/.claude/design-references/` that grows from your eye. `/curate` is the capture wizard - paste a URL or screenshot, walk a 5-step flow (source → auto-tag proposal → why-interesting body → slug → save).

Tagging is hybrid: strict Category from a controlled vocab (`list`, `navigation`, `command-palette`, `inline-affordance`, etc.); free-form Pattern + Feel for the personality words. Public catalogs (component.gallery, fontshare) have no home for "the way Linear's inbox staggers" or "Vercel's deploy log streaming blur" - that's what this layer covers.

`fontshare-reference` also bakes in `/impeccable`'s **reflex-reject list** so the obvious training-data defaults (Inter, Fraunces, Outfit, Instrument Serif, et al.) get refused at type-selection time. Fontshare's own emerging defaults (General Sans, Cabinet Grotesk, Satoshi, Clash Display) get flagged the same way.

### Peer skills

The `skills` component also bundles four peers that aren't part of the strategy-to-tactical pipeline but ship alongside:

- **`social-media`** - platform specs for 13 social platforms (sizes, safe zones, typography rules)
- **`design-team`** - multi-agent design sprints (16 roles, 4 phases) for full pages or campaigns
- **`visual-effects`** - actual shader source for generative backgrounds + 17 stackable post-process FX
- **`icon-source`** - one-library-per-project discipline, eight approved libraries, verbatim path sourcing

→ [Design pipeline tour](#deep-design-stack) · [Curate wizard flow](#deep-curate)

---

<a id="workflow"></a>

## Workflow

**How do I actually use this every day?** One curl, one shortcut, all-additive.

### Daily commands

```bash
ampersand                       # interactive TUI from any directory
ampersand --pull                # pull latest, then TUI
ampersand --preset minimal      # brain + config + memory + skills + nvm
ampersand --only memory         # one component
ampersand --only memory,skills  # multiple components
ampersand --dry-run             # preview without writing
ampersand --yes                 # everything, non-interactive
```

`ampersand` re-launches the installer from any directory. `ampersand --pull` syncs the dotfiles repo via `git pull --ff-only` first (never silently merges divergent local changes).

### Custom clone locations

The dotfiles can live anywhere. The Ghostty config uses a `__DOTFILES_DIR__` placeholder that the installer replaces at install time, so cloning to `~/code/dots`, `/opt/dots`, or anywhere else works:

```bash
CLAUDE_DOTFILES_DIR=~/code/dots curl -fsSL .../bootstrap.sh | bash    # env var
curl -fsSL .../bootstrap.sh | bash -s -- --dir ~/code/dots             # flag
```

Re-running `install.sh` from a new clone refreshes the `ampersand` function's path automatically.

### Onboarding a new Yes& dev

1. `curl -fsSL https://raw.githubusercontent.com/jonahscohen/claude-dotfiles/main/bootstrap.sh | bash`
2. TUI defaults or `--preset all`
3. New terminal or `source ~/.zshrc`

Same machine state as everyone else, same disciplines applied, same memory loaded.

### Boost an existing Claude Code

Every component is additive - no "boost" vs "full" mode, both use the same append-and-merge strategy:

```bash
ampersand --only brain                    # just team rules
ampersand --only brain,config             # rules + hooks/plugins
ampersand --only memory                   # memory subsystem only
ampersand --yes                           # everything
```

CLAUDE.md changes live between `<!-- claude-dotfiles:brain:begin -->` / `<!-- :end -->` comments - sed-delete the range to undo. `~/.zshrc` blocks use the same pattern. `settings.json` is JSON-merged; specific entries can be removed without touching the rest.

→ [Bootstrap + installer flags](#deep-customization) · [Troubleshooting](#troubleshooting)

---

<a id="reference"></a>

## Reference

Lookup material. You won't read this end to end - you'll grep it when something breaks or you're extending.

<a id="component-table"></a>
<details>
<summary><b>The twelve components</b></summary>

| Component | What it does | Where it lands |
|---|---|---|
| `brain` | Team rules + workflow appended to CLAUDE.md between markers | `~/.claude/CLAUDE.md` (your content preserved) |
| `config` | Safety hooks + plugins + permissions JSON-merged into settings.json | `~/.claude/settings.json` + `~/.claude/hooks/` |
| `memory` | Memory discipline rules + 3 lifecycle hooks + startup loader | CLAUDE.md + settings.json + symlinked loader |
| `skills` | 10 design + peer skills + the personal-catalog seed | `~/.claude/skills/` + `~/.claude/design-references/` |
| `statusline` | Custom prompt-bar render | symlink at `~/.claude/statusline-command.sh` |
| `cmux` | Split-pane terminal config (in-app browser preview) | symlink at `~/.config/cmux/settings.json` |
| `nvm` | "claude: command not found" fix for fresh terminals | marker-guarded line in `~/.zshrc` |
| `ampersand` | The `ampersand` zsh shortcut | marker-guarded block in `~/.zshrc` |
| `discord` | Discord chat agent launcher (cold/mid/warm onboarding) | marker-guarded line in `~/.zshrc` + symlinks |
| `voice-input` | Local voice-to-text (whisper.cpp + ffmpeg) | brews + symlink at `~/.claude/transcribe` |
| `voice-output` | OpenAI TTS responses (starts muted) | MCP server + zsh aliases |
| `reflect` | Memory corpus analysis (5-agent skill + nudge hook) | `~/.claude/skills/reflect/` + nudge hook |

Flags: `--yes` for everything, `--preset minimal/all/none`, `--only csv` for explicit subsets, `--dry-run` to preview.

</details>

<a id="hook-inventory"></a>
<details>
<summary><b>The eighteen hooks (full inventory by role)</b></summary>

**Refusal hooks** (PreToolUse, hard deny):

| Matcher | Hook | Purpose |
|---|---|---|
| `Bash` | `bash-guard.sh` | AI-attribution lines, force-push to main/master, `rm` against `.claude/memory`, legacy model IDs |
| `Write\|Edit\|MultiEdit` | `content-guard.sh` | Same patterns inside file content + emdashes/endashes + emoji unicode ranges |
| `Write\|Edit\|MultiEdit` | `memory-approve.sh` | Auto-approves memory-path writes |
| `mcp__voice-output__speak` | `voice-gate.sh` | Denies speak calls when voice is muted |
| `mcp__claude-in-chrome__javascript_tool` | `validation-guard.sh` | Blocks DOM shortcut tricks during UI validation |

**Gate hooks** (state machines, block until verification):

| Event | Hook | Purpose |
|---|---|---|
| `PostToolUse(Write\|Edit\|MultiEdit)` | `verify-before-done.sh` | Sets `.needs-verification`; clears on screenshot Read, test commands, external curl, `/tmp/*test*.log` Read |
| `PostToolUse(Read)` | `verify-clear.sh` | Also clears `.needs-verification` on image Read |
| `UserPromptSubmit` | `verify-manual.sh` | Recognizes "looks good"/"ship it" phrases as manual sign-off |
| `PostToolUse(Bash\|...computer)` | `screenshot-open-mandate.sh` | Sets `.screenshot-pending` after a screenshot saves; bash-guard blocks further work until cleared |
| `PostToolUse(Read)` | `screenshot-open-clear.sh` | Clears `.screenshot-pending` on matching `.png` Read |
| `PostToolUse(Write\|Edit\|MultiEdit)` | `second-fix-gate.sh` (v2) | Warn-once when 2 fixes land on same file in 10 min with verify still pending. Silent on purely-additive edits. Override: `touch ~/.claude/.suppress-fix-gate` |

**Nudge hooks** (advisory):

| Matcher | Hook | Purpose |
|---|---|---|
| `Write\|Edit\|MultiEdit\|Bash` | `memory-nudge.sh` | Dirty-state reminder after non-memory edits |
| `SessionStart` | `reflect-nudge.sh` | Counts new memories since last `/reflect`; nudges above threshold |

**Toggle hooks** (UserPromptSubmit, state flips on chat phrases):

| Phrase | Hook | Effect |
|---|---|---|
| "voice on/off", "mute yourself", "unmute" | `voice-toggle.sh` | Toggles `~/.claude/.voice-enabled` |
| "resume on/off", "auto-resume" | `resume-toggle.sh` | Toggles cmux auto-resume policy |

**Lifecycle hooks**:

| Event | Hook | Purpose |
|---|---|---|
| `SessionStart` | `startup-check.sh` | Loads project + global memory |
| `SessionStart` | `voice-mandate.sh` | Injects active-mandate, muted-notice, or silence based on voice state |
| `PreCompact` | inline | Flushes pending memory before compression |
| `PostCompact` | `startup-check.sh` | Reloads memory after compression |
| `SessionEnd` | `resume-guard.sh` | Blocks cmux auto-resume |

The authoritative version of this inventory + flag-file registry + precedence rules lives in `.claude/memory/decision_hook_system_architecture.md`.

</details>

<a id="deep-brain"></a>
<details>
<summary><b>CLAUDE.md sections in detail</b></summary>

`~/.claude/CLAUDE.md` is the global instruction file Claude reads at the start of every session. The `brain` component builds it from three layers, each appended between marker comments so your existing content is never touched:

1. **RULES.md** (team standards) - Code quality, verification protocol, debugging protocol. Push a rule here, every teammate gets it on `ampersand --pull`.
2. **CLAUDE.md** (shared workflow) - Memory discipline, design stack, permission posture, voice, cmux, Discord.
3. **CLAUDE.local.md** (personal overrides) - Machine-specific, gitignored by default.

The `memory` component adds a fourth marker block (Memory Discipline rules). All four coexist with whatever you already have.

**Verification Protocol** - seven rules that gate task completion:

1. **Visual verification** - UI changes need a screenshot. "It renders" isn't verification.
2. **Interactive verification** - buttons, dropdowns, toggles must be clicked and re-screenshotted.
3. **Side-by-side verification** - implementations get compared against the design source.
4. **Completeness check** - re-read the original request, confirm every item exists.
5. **No lazy questions** - if the user asked for 5 things and Claude built 3, build the other 2.
6. **No false positives** - passing type check ≠ passing feature. Verify with eyes.
7. **For non-UI tasks** - state a `<step> -> verify: <check>` plan before implementing.

**Code Quality** - the non-obvious bullets:

- Multiple plausible interpretations → name them and ask. Don't silently pick one.
- Never emdashes. Hyphens or rewrite.
- Never emojis.
- Never take credit. No AI-coauthor attribution lines, no auto-generated credit comments. The assistant is invisible in the output.
- Project updates record the human collaborator from `git config user.name`.
- Never fabricate SVG icons. Source verbatim from approved libraries.
- Never use legacy model versions. Always the latest available.
- Style guides and component libraries fully isolated from app global styles.
- Each design-system component verified in-browser against the design source before moving on.

**QA gate for UI work** - five steps before "done":

1. `/impeccable audit <target>` - 5-dimension scan (a11y, perf, theming, responsive, anti-patterns) + `npx impeccable detect`
2. `/impeccable critique <target>` - design review via independent sub-agents
3. `/impeccable polish <target>` - final design-system alignment pass
4. `make-interfaces-feel-better` 14-point checklist - concentric radius, optical alignment, shadows over borders, tabular nums, scale-on-press at 0.96, etc.
5. `npx @google/design.md lint DESIGN.md` if a DESIGN.md exists

**cmux Browser Pane** - the primary visual verification surface. Commands run via Bash: `cmux browser --surface <id> screenshot --out /tmp/<name>.png` (then Read the PNG), `navigate "<url>"`, `snapshot --interactive`. Each project records its surface in a `reference_cmux_browser.md` memory.

</details>

<a id="deep-design-stack"></a>
<details>
<summary><b>The design pipeline tour</b></summary>

Six layered skills + tokens + brand. Each addresses a different question at a different beat. The pipeline doesn't sequence linearly through every build - it routes by what the task actually needs.

### 1. Strategy - Impeccable

A plugin (`impeccable@impeccable`) auto-installed via your `enabledPlugins`. Twenty-three commands ranging from `teach` (interactive PRODUCT.md authoring) to `craft` (build from scratch) to `audit/critique/polish` (the QA triad). Reads `PRODUCT.md` and `DESIGN.md` at project root before every command.

The CLAUDE.md hard rule: before any UI work begins, Claude checks for `PRODUCT.md`. Missing or stub triggers `/impeccable teach`. Missing `DESIGN.md` plus existing code triggers a one-time-per-session nudge to run `/impeccable document`.

### 2. Research - component-gallery-reference

A bundled skill that has Claude browse [component.gallery](https://component.gallery) before building any standard UI component. The site catalogs 60 component types across 95 design systems (Polaris, Carbon, Primer, Spectrum, Material) with 2,672 examples.

Workflow: detect tech stack from `package.json`, browse the component page filtered by stack, exclude examples tagged "Unmaintained" or "Accessibility issues", inventory the project's design system, synthesize a brief mapping gallery patterns onto project tokens. Then build with three layers: function from the gallery, identity from the project, gap-fills derived from gallery patterns styled with project tokens.

### 3. Typography - fontshare-reference

A bundled skill that researches typefaces via [fontshare.com](https://fontshare.com), Indian Type Foundry's curated open-source catalog.

Critically bakes in `/impeccable`'s **reflex-reject list** - the training-data-default typefaces (Inter, Fraunces, Outfit, Instrument Serif, Newsreader, Plus Jakarta Sans, DM Sans/Serif, IBM Plex, Space Grotesk, et al.) get refused as primaries on greenfield work. Fontshare's own emerging defaults (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) get flagged the same way.

### 4. References - design-references + /curate

The personal-catalog system. `~/.claude/design-references/` holds one folder per reference (markdown + screenshot). The catalog grows from your eye.

`/curate` is the capture wizard. Five-step flow: source → auto-tag proposal → why-interesting body → slug → save. Hybrid tagging: strict Category (controlled vocab), free-form Pattern + Feel.

`design-references` is the retrieval skill. Auto-triggers on UI build keywords, greps the catalog for matching category/pattern/feel against the task context AND against PRODUCT.md voice words. Surfaces 0-5 references. Stays silent if nothing scores - noisy surfacing destroys trust.

### 5. Motion - motion-reference (GSAP + Lenis)

A bundled skill shipping canonical patterns for the GSAP + Lenis stack. Routes by task: tweens/timelines → `gsap`; scroll-driven → `ScrollTrigger`; smooth-scroll feel → Lenis; layout transitions → `Flip`; SVG path draw → `DrawSVG`; text by word/char → `SplitText`; drag → `Draggable`; SVG morph → `MorphSVG`; path animation → `MotionPath`.

License note baked into the skill: as of Webflow's acquisition of GreenSock, **all formerly-paid GSAP plugins are now free**. The skill ships the 3-line GSAP + ScrollTrigger + Lenis glue snippet, React `useGSAP` hook with scope, `ReactLenis` root provider, and the gotchas that bite (SSR, ScrollTrigger refresh after dynamic content, iOS Safari + Lenis + fixed-position quirks).

### 6. Tokens - DESIGN.md

Google's spec for representing a visual identity to coding agents. YAML frontmatter for tokens (colors, typography, rounded, spacing, components with `{path.to.token}` references), markdown body for rationale. Comes with `npx @google/design.md lint` for schema validation, WCAG contrast checks, broken-ref detection.

CLAUDE.md mandates: conform to the Google spec, run lint after every write, resolve every error or warning. Generated UI references tokens via `{path.to.token}`, not hex literals.

### 7. Tactical - make-interfaces-feel-better

An Anthropic Skill that auto-triggers on UI keywords. Sixteen specific rules with exact values:

- Concentric border radius (`outer = inner + padding`)
- Optical centering (icons need manual nudge past geometric)
- Shadows over borders (layered transparent `box-shadow`)
- Interruptible animations (CSS transitions for state, keyframes only for staged)
- Split + stagger enters (~100ms delay each)
- Subtle exits (small fixed `translateY`)
- Contextual icon swaps via opacity + scale + blur
- Font smoothing on root
- Tabular nums on dynamic counters
- `text-wrap: balance` on headings, `pretty` on body
- Image outlines `rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)` dark, never tinted
- `scale(0.96)` on press
- `initial={false}` on AnimatePresence
- Never `transition: all`
- `will-change` only on transform/opacity/filter, sparingly
- Minimum 40x40px hit area, no overlap

The skill's review-output-format (before/after tables grouped by principle) is the canonical UI-change summary.

</details>

<a id="deep-curate"></a>
<details>
<summary><b>The /curate wizard flow</b></summary>

Invoke `/curate <url>` (or just `/curate` for the full interactive flow). The wizard runs in 5 steps via the AskUserQuestion tool:

1. **Source** - URL, screenshot, description-only, or mixed
2. **Auto-tag proposal** - Claude fetches the URL, examines screenshots, and proposes Category (from strict vocab), Patterns (free-form), Feel (free-form). User confirms or edits.
3. **Why interesting** - a 1-3 sentence note explaining what's worth remembering for future-you. The load-bearing part of the record.
4. **Slug** - folder name in `<source>-<feature>-<date>` format. Auto-suffixed on collision.
5. **Save** - writes `~/.claude/design-references/<slug>/ref.md` with frontmatter (title, category, patterns, feel, source, url, screenshot, saved date) and the body. New categories are appended to `_vocab/categories.txt`.

The retrieval side (`design-references` skill) scores matches: Category match +3, each Pattern match +1, each Feel match +1, Source match +3. Top 0-5 references with score ≥ 3 are surfaced. Below threshold = silent.

</details>

<a id="deep-memory-format"></a>
<details>
<summary><b>Memory file format + project-level CLAUDE.md template</b></summary>

Every change writes a session memory entry:

```markdown
---
name: <one-line title>
description: <one-line summary used by future Claude to decide relevance>
type: project
---

Collaborator: <name from git config user.name>

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

<a id="project-claude-md"></a>**Project-level CLAUDE.md template** - for ironclad enforcement on projects where teammates haven't installed the dotfiles. Claude Code reads project-root CLAUDE.md regardless of machine config:

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

**Merge conflicts** - the most contention-prone file is `MEMORY.md` (the index). The convention "append at the bottom, one line per entry" makes most of these auto-merge. Session files themselves rarely conflict because the file naming includes the topic.

</details>

<a id="deep-plugins"></a>
<details>
<summary><b>Plugins vs Connectors vs MCP servers vs Skills</b></summary>

People conflate these. Four different mechanisms, four different config surfaces:

| Type | Lives in | Bound to | Configured via |
|---|---|---|---|
| **Plugins** | `~/.claude/plugins/` | Machine | `enabledPlugins` in settings.json |
| **Connectors** | claude.ai account | Account | claude.ai → Settings → Connectors (OAuth) |
| **MCP servers** | per-app config | Machine | `claude mcp add` or per-app config files |
| **Skills** | `~/.claude/skills/` | Machine | `npx skills add <repo>` or bundled with this repo |

The `config` component enables ~20 plugins via `settings.json`: `claude-md-management`, `figma`, `firebase`, `hookify`, `skill-creator`, `sentry`, `supabase`, `swift-lsp`, `superpowers`, `agent-sdk-dev`, `typescript-lsp`, `security-guidance`, `discord`, `impeccable`, `feature-dev`, `ralph-loop`, `code-review`, `plugin-developer-toolkit`, `chrome-devtools`.

The `skills` component bundles 10 skills:

| Skill | Source |
|---|---|
| `make-interfaces-feel-better` | npx (jakubkrehel/make-interfaces-feel-better) |
| `component-gallery-reference` | bundled |
| `fontshare-reference` | bundled |
| `motion-reference` | bundled |
| `curate` | bundled |
| `design-references` | bundled |
| `social-media` | bundled |
| `design-team` | bundled |
| `visual-effects` | bundled |
| `icon-source` | bundled |

The `reflect` component adds an 11th skill (`reflect`) plus a SessionStart nudge hook.

Connectors (ClickUp, Google Drive, etc.) are NOT in the dotfiles - they're account-bound and authorize at claude.ai. MCP servers (Claude in Chrome, etc.) are NOT in the dotfiles either - they need OAuth or per-machine credentials.

</details>

<a id="deep-customization"></a>
<details>
<summary><b>Customization (env vars + flags)</b></summary>

**Bootstrap-time flags:**

```bash
curl -fsSL .../bootstrap.sh | bash                          # default - clones to ~/Documents/Github/claude-dotfiles
curl -fsSL .../bootstrap.sh | bash -s -- --dir PATH         # custom clone location
curl -fsSL .../bootstrap.sh | bash -s -- --yes              # full non-interactive install
curl -fsSL .../bootstrap.sh | bash -s -- --preset minimal   # specific preset

CLAUDE_DOTFILES_DIR=~/code/dots CLAUDE_DOTFILES_REPO=https://github.com/your-fork/claude-dotfiles.git \
  curl -fsSL .../bootstrap.sh | bash
```

**Installer flags:**

```bash
./install.sh                    # interactive TUI
./install.sh --yes              # install everything non-interactively
./install.sh --preset NAME      # all | minimal | none
./install.sh --only KEYS        # comma-separated subset
./install.sh --dry-run          # show resolved picks, touch no files
```

Valid component keys: `brain`, `config`, `memory`, `skills`, `statusline`, `cmux`, `nvm`, `ampersand`, `discord`, `voice-input`, `voice-output`, `reflect`.

**Presets:**

| Preset | Components |
|---|---|
| `all` | Everything (same as `--yes`) |
| `minimal` | `brain` + `config` + `memory` + `skills` + `nvm` |
| `none` | Nothing (useful with `--dry-run`) |

**Customizing settings.json** - `config` JSON-merges hooks, plugins, and permission patterns into your existing `~/.claude/settings.json`. It does not touch `defaultMode`, model, or other preferences. To add a plugin: edit `enabledPlugins` in `claude/settings.json` in the repo, commit, push, `ampersand --pull`, restart Claude Code.

**Customizing CLAUDE.md** - `brain` appends team rules between markers. To update: edit `claude/CLAUDE.md` in the repo, commit, push, re-run `ampersand --pull`. To remove: sed-delete from marker begin to marker end.

</details>

<a id="deep-architecture"></a>
<details>
<summary><b>Architecture (install strategy, idempotency, backups)</b></summary>

**Install strategy by target:**

| Target | Strategy | Why |
|---|---|---|
| `~/.claude/CLAUDE.md` | Marker-guarded append | Your content preserved; re-runs detect markers and skip |
| `~/.claude/settings.json` | JSON-merge (python3) | Your settings preserved; does not touch `defaultMode` or other preferences |
| `~/.claude/hooks/*.sh` | File copy from repo | Hook scripts copied alongside your existing hooks |
| `~/.claude/memory/*.md` | Symlink to repo | Memory edits write directly into the repo working tree |
| `~/.claude/skills/<skill>/` | npx-installed or file copy | Skills versioned by their own repo or bundled with ours |
| `~/.config/cmux/settings.json` | Symlink to repo | Single source of truth |
| `~/.zshrc` | Marker-guarded append | Labeled blocks that can be sed-deleted cleanly |

**Idempotency** - every section of `install.sh` is idempotent:

- **Symlinks** - `make_symlink` checks if the target already points where we want; if so, no-op. Otherwise backs up any pre-existing real file, creates fresh.
- **`.zshrc` appends** - marker-guarded with grep checks. If the marker is present, no-op. The `ampersand` block self-heals: if `$REPO_DIR` doesn't match the baked path, the block is sed-deleted and re-appended.
- **settings.json JSON-merge** - marker-based detection on substrings (hook command paths, plugin names). If detected, no-op. Otherwise python3 reads existing settings.json, adds missing entries, writes back.
- **CLAUDE.md marker-append** - marker-guarded on `<!-- claude-dotfiles:<component>:begin -->`. If present, no-op.
- **Hook file copy** - overwrites only our own scripts (same filename), never touches hooks you wrote.

**Backup discipline** - any pre-existing real (non-symlink) file at a target path gets copied to `.backups/<timestamp>/<original-path>` before overwrite. Backups are gitignored. To recover: walk `.backups/` and copy back.

**Multi-location support** - the dotfiles can be cloned to any path. The `ampersand` shortcut bakes in the install-time `$REPO_DIR`; if you move the repo and re-run `install.sh` from the new location, the path-drift self-heal rewrites the shortcut block.

</details>

<a id="troubleshooting"></a>
<details>
<summary><b>Troubleshooting</b></summary>

**"claude: command not found" in fresh terminals** - Homebrew's nvm sources `nvm.sh` but doesn't activate a default Node version. Fix: tick the `nvm` component. It appends `nvm use default --silent` to `.zshrc`. New terminal or `source ~/.zshrc`.

**`ampersand: command not found` immediately after install** - shell functions defined inside install.sh's child process don't escape into the parent shell. Fix: `source ~/.zshrc` once, or open a new terminal.

**Permission prompts on every markdown write** - should not happen with `defaultMode: bypassPermissions` set. `claude/settings.json` already includes `Write(**/*.md)`, `Edit(**/*.md)`, `MultiEdit(**/*.md)` allow rules. If persisting, restart Claude Code (permissions load at session start).

**gum not installed** - the TUI degrades gracefully to a numbered text menu. Same components, same flags, less polish.

**Memory entries from a teammate on a different machine** - pull the project: `git pull`. Memory files are in `<project>/.claude/memory/` like any other source. Claude reads them at session start.

**Fresh install on a new Mac** - `curl -fsSL https://raw.githubusercontent.com/jonahscohen/claude-dotfiles/main/bootstrap.sh | bash`. Take TUI defaults. New terminal. Done.

**Existing Claude Code config I don't want to overwrite** - every component is additive. `ampersand --pull --only brain,config,memory,skills` installs the team rules, hooks/plugins, memory subsystem, and skills - your existing content stays intact.

**Undo entirely** - for marker-appended files (CLAUDE.md): sed-delete from the marker begin to marker end. For JSON-merged settings: remove the specific entries that were added. For symlinks: `rm` them and copy back from `.backups/<timestamp>/`. For appended `.zshrc` blocks: sed-delete the marker-guarded ranges. No automated uninstaller because we'd need to know which timestamp's backups to use - manual is safer.

</details>

<a id="deep-contributing"></a>
<details>
<summary><b>Contributing (for Yes& devs)</b></summary>

**Adding a new component:**

1. Add the key to `KEYS=(...)` in `install.sh` + a TITLE + DESC in matching arrays. Bump PICKS length.
2. Add an apply block in the appropriate numbered section.
3. If modifying `~/.zshrc`, use a marker-guarded append (see `nvm` or `ampersand` for the pattern, including path-drift self-heal).
4. If modifying `~/.claude/settings.json` JSON-style, use the python3 stdlib merge pattern from the `memory` component. Marker-detection is mandatory.
5. Update `--help` valid keys list and the post-install summary.
6. Update the README component table.
7. Write a session memory entry. Index in `MEMORY.md`.

**Adding a new skill to the `skills` component** - edit install.sh section 3. Add another `npx --yes skills add <github-repo>` invocation or a file-copy block (for bundled skills). Update the component description.

**Adding a new plugin to the `config` component** - edit `claude/settings.json`. Add `"<plugin>@<marketplace>": true` to `enabledPlugins`. If the marketplace isn't already known, add it to `extraKnownMarketplaces`. Re-run install to merge, restart Claude Code.

**Adding a new CLAUDE.md rule** - edit `claude/CLAUDE.md`. Decide which existing section the rule belongs to (Memory Discipline, Verification Protocol, Design Work, Code Quality, etc.). For cross-team enforcement on projects without the dotfiles, also drop it into a project-root CLAUDE.md template.

**PR hygiene** - branch from `main`. Squash-merge with a clear title. Don't take credit in commit messages.

</details>

---

## License & footer

The dotfiles are MIT licensed. Bundled tools (Impeccable, make-interfaces-feel-better, gum, etc.) are licensed by their respective authors - see each repository for terms.

The Yes& brand mark and logo are property of Yes&.

If you found this useful and you're not at Yes&, good - the additive components are built to layer onto your own setup. Issues and PRs welcome at [github.com/jonahscohen/claude-dotfiles](https://github.com/jonahscohen/claude-dotfiles).

We start with yes. You build what's next.
