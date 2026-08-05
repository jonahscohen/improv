<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/yes-and-logo-dark.webp">
    <source media="(prefers-color-scheme: light)" srcset="assets/yes-and-logo-light.webp">
    <img alt="Yes&" src="assets/yes-and-logo-light.webp" width="320">
  </picture>
</p>

<h1 align="center">Improv</h1>

<p align="center"><i>The Yes& Claude Code stack, made installable.</i></p>

<p align="center">
  <a href="#what-is-this">What is this?</a> ·
  <a href="#install">Install</a> ·
  <a href="#clusters">Feature clusters</a> ·
  <a href="#workflow">Daily use</a> ·
  <a href="#reference">Reference</a>
</p>

---

<a id="what-is-this"></a>

## What is this?

Claude Code is capable, but it starts every conversation with a blank slate: no memory of what you decided last week, no house style until you give it one, no sense of what "done" actually means for your team. Improv is a set of files you copy onto your machine once that closes those gaps - not by teaching Claude anything new, but by giving it habits: things it reads before it starts, checks that run while it works, and a place to write down what happened so the next session doesn't start from zero either.

Concretely, that means:

- **It remembers.** Every real change gets written down in a plain markdown file, inside the project itself, so it travels with `git pull` and survives longer than any one conversation.
- **It follows your rules without being reminded.** Team standards live in a file Claude reads at the start of every session, and the ones that matter most are backed by checks that physically block the wrong action instead of just suggesting against it.
- **It has better default taste.** A design system, a component reference, a personal catalog of interfaces worth learning from, and checks that catch the most common "obviously AI-made" tells before they ship.
- **It stays honest about whether work is actually finished.** Claiming a UI change works without a screenshot, or a fix works without a test, gets caught and held until the model actually looks.

Everything below is a separate, optional piece. Install all of it, install one piece, or come back for the rest later. Nothing here is destructive - anything it's about to change gets backed up first, and every piece can be turned back off on its own.

---

<a id="install"></a>

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/jonahscohen/improv/main/bootstrap.sh | bash
```

One command. It clones this repo and installs one shortcut: `ampersand`. Type it from any terminal, any time, and a page opens in your browser showing everything on offer.

```bash
ampersand                       # opens the installer in your browser
ampersand --cli                 # the same picker, without leaving the terminal
ampersand --pull                # pull the latest version first, then open it
ampersand --preset minimal      # just the essentials, no picker needed
ampersand --only memory         # a single piece, no picker needed
```

The browser installer lists every piece as a row you can turn on or off, shows exactly what's staged before anything happens, and applies it all in one pass. `--cli` gives you the identical picker as a terminal menu instead, for anyone who'd rather not leave the keyboard.

Nothing installs anything you didn't choose, nothing overwrites a file you already had without backing it up first, and every piece can be turned back off later without disturbing the rest.

---

<a id="clusters"></a>

## Feature clusters

Ten clusters: six in the core suite, four add-ons. Each is independent - turn on all of them, one of them, or come back for more later.

### The suite

**Foundation** - the base install everything else builds on: your team's rules appended into Claude's own instructions file (your existing content untouched), the safety and quality hooks, a status line showing project, branch, model, and context used, and the `ampersand` shortcut itself.

**Beats** - the memory system. Every real change writes a short note to a plain markdown file inside the project, so the next session - yours tomorrow, or a teammate's next week - starts with full context instead of from scratch. Includes `/reflect`, which reads back over weeks of notes and surfaces patterns no single session would notice on its own.

**Sidecoach** - the design assistant. Twenty-six flows behind commands like `audit`, `critique`, `polish`, and `craft`, plus plain-language detection so you don't have to remember the exact word. It watches for design work as you type and pulls your project's brand and design docs in automatically.

> **Honest note: Sidecoach is unfinished.** The detector half is real and measured - `/sidecoach audit` genuinely catches contrast failures, broken heading order, and banned visual patterns, and that engine has been tested against held-out pages with high accuracy. But the half meant to teach Claude how to design *well*, not just flag what's wrong, isn't built yet - most flows return a findings list rather than real design instruction. If you're expecting a mentor, what's here today is a rigorous inspector. This is recognized internally too: the installer's own `justify` preset leaves Sidecoach out on purpose, "until it is ready to be the taste layer." Closing that gap is ongoing work, not a secret.

**Justify** - click something in your running site and nudge its spacing, type, or color right in the browser; the change writes back into your actual source file. No copying values back and forth by hand.

**Tiltlab** - a local playground for animated backgrounds and visual effects. Browse roughly 25 shader and post-processing effects, stack and tune them against a live preview, then export the exact stack as a drop-in package.

**Lotus** - an AI Figma plugin that works directly on the canvas: generate, modify, restyle, export to code, audit accessibility, or get a design critique, using whichever AI provider you supply a key for. Its bridge also lets Claude Code read and edit a Figma file's design system directly.

### Add-ons

**Design Tools** - reference material Claude pulls in while building an interface: a sixteen-point tactical-polish checklist, how established design systems build a given component, a curated typeface catalog, GSAP/Lenis motion patterns, your own growing catalog of interfaces worth learning from, platform specs for thirteen social networks, a multi-agent design-sprint mode, ready shader and effect source, a rule for sourcing icons from real libraries instead of inventing them, and a check that holds a Figma-based build to the file it came from. Each piece installs on its own.

**Guardrails** - the checks that catch a mistake before it ships. Blocked shell commands (force-pushes to main, deleting your own notes, AI-attribution lines in commits), a requirement that a claimed fix was actually verified with a screenshot or a test, real selectable questions instead of buried plain text, source-grounded answers instead of guesses, plus narrower guards around API drift, git hygiene, model routing, cheaper-agent suggestions, Codex review requests, Chrome tab hygiene, and chart/widget quality. Thirteen sub-groups, most of them always on.

**Voice & chat** - Claude speaking its replies aloud (needs your own OpenAI key, arrives muted), transcribing voice memos you send it (runs fully offline, no key needed), and a Discord launcher so you can talk to a session from your phone.

**Dev surface** - the terminal itself: cmux, the split-pane terminal with a built-in browser pane, which is how Claude actually looks at your UI; a `/task-list` command for tracking what's next; and a guard that refuses any ClickUp action that would change something.

There's an eleventh, hidden cluster - **Personal** - that only shows up with `--personal`. It's one person's terminal color scheme and screen effects; skipping it changes nothing about how Claude behaves.

→ [Every component, by cluster](#component-table) · [Every hook, by cluster](#hook-inventory)

---

<a id="workflow"></a>

## Daily use

```bash
ampersand                       # opens the browser installer from any directory
ampersand --cli                 # the terminal picker instead
ampersand --pull                # pull latest, then open the installer
ampersand --preset minimal      # brain + config + memory + skills + nvm
ampersand --only memory         # one cluster
ampersand --only memory,skills  # multiple clusters
ampersand --dry-run             # preview without writing anything
ampersand --yes                 # everything, non-interactive
```

`ampersand` re-launches the installer from any directory. `ampersand --pull` syncs the repo via `git pull --ff-only` first (never silently merges divergent local changes).

### Custom clone locations

The dotfiles can live anywhere. The Ghostty config uses a `__DOTFILES_DIR__` placeholder the installer replaces at install time, so cloning to `~/code/dots`, `/opt/dots`, or anywhere else works:

```bash
IMPROV_DIR=~/code/dots curl -fsSL .../bootstrap.sh | bash    # env var
curl -fsSL .../bootstrap.sh | bash -s -- --dir ~/code/dots             # flag
```

Re-running `install.sh` from a new clone refreshes the `ampersand` function's path automatically.

### Onboarding a new Yes& dev

1. `curl -fsSL https://raw.githubusercontent.com/jonahscohen/improv/main/bootstrap.sh | bash`
2. Take the browser installer's defaults, or `--preset all`
3. New terminal, or `source ~/.zshrc`

Same machine state as everyone else, same disciplines applied, same memory loaded.

### Boost an existing Claude Code

Every component is additive - no "boost" vs "full" mode, both use the same append-and-merge strategy:

```bash
ampersand --only brain                    # just team rules
ampersand --only brain,config             # rules + hooks/plugins
ampersand --only memory                   # memory subsystem only
ampersand --yes                           # everything
```

CLAUDE.md changes live between `<!-- Improv:brain:begin -->` / `<!-- :end -->` comments - sed-delete the range to undo. `~/.zshrc` blocks use the same pattern. `settings.json` is JSON-merged; specific entries can be removed without touching the rest.

→ [Bootstrap + installer flags](#deep-customization) · [Troubleshooting](#troubleshooting)

---

<a id="reference"></a>

## Reference

Lookup material. You won't read this end to end - you'll grep it when something breaks or you're extending.

<a id="component-table"></a>
<details>
<summary><b>Every component, by cluster</b></summary>

The ten clusters from above, broken into their actual `--only` keys (`claude/hooks/browser-tree.json` is the one source both the browser and terminal picker read, so this list cannot drift from what either shows):

| Cluster | `--only` keys |
|---|---|
| Foundation | `brain`, `config`, `statusline`, `ampersand`, `nvm` |
| Beats | `memory`, `reflect` |
| Sidecoach | `sidecoach` |
| Justify | `justify` |
| Tiltlab | `tilt-lab` |
| Lotus | `lotus` |
| Design Tools | `tactical-polish`, `component-gallery`, `fontshare`, `motion`, `curate`, `social-media`, `design-team`, `visual-effects`, `icon-source`, `figma` |
| Guardrails | `safety`, `verification`, `question-discipline`, `grounding`, `api-drift`, `planning-git`, `surface`, `model-routing`, `agent-routing`, `fable`, `codex`, `chrome`, `visualizer` |
| Voice & chat | `discord`, `voice-input`, `voice-output` |
| Dev surface | `cmux`, `task-list`, `clickup` |
| Personal (hidden, `--personal` only) | `ghostty`, `shaders` |

`skills` is also a valid `--only` key on its own: it takes the whole Design Tools skill bundle at once, where the individual keys above take just one (e.g. `--only icon-source`). `config` installs Foundation's CORE only (permissions/plugins/statusline + startup-check + hud). Every Guardrails sub-group is individually `--only`-able down to a single hook, e.g. `--only bash-guard`.

**Presets:**

| Preset | What it turns on |
|---|---|
| `all` | Everything |
| `minimal` | `brain` + `config` + `memory` + `skills` + `nvm` + `reflect` |
| `justify` | `justify` + `memory` + `safety` + `verification` + `grounding` - the supporting cast that makes running Justify trustworthy, with Sidecoach deliberately left out until it's ready (see the Sidecoach note above) |
| `none` | Nothing (useful with `--dry-run`) |

</details>

<a id="hook-inventory"></a>
<details>
<summary><b>Every hook, by cluster (74 total)</b></summary>

Hooks fall into a few mechanical shapes regardless of which cluster owns them:

- **Refusal hooks** intercept and block outright - a forbidden shell command, a banned content pattern, a disallowed tool call.
- **Gate hooks** are state machines: they arm on one event and won't release until a specific later event clears them (a screenshot actually opened, a test actually run).
- **Nudge hooks** advise without blocking - a reminder injected into context, never a denial.
- **Toggle hooks** flip a flag on a chat phrase ("voice on", "resume off").
- **Lifecycle hooks** run on session boundaries - start, compaction, end.

Counted by which cluster owns them:

| Cluster | Hooks | Sub-groups |
|---|---|---|
| Guardrails | 42 | safety (5), verification (8), question-discipline (2), grounding (10), api-drift (3), planning-git (2), surface (2), model-routing (1), agent-routing (1), fable (1), codex (2), chrome (3), visualizer (1) |
| Dev surface | 9 | cmux (8), clickup (1) |
| Sidecoach | 8 | sessionstart, preamble, postuserp, keyword, taste-gate, craft-floor, postresponse, detect |
| Beats | 7 | memory (6), reflect (1) |
| Justify | 4 | source-guard, watch-guard, watch-standing-by, queue-drain-stop |
| Voice & chat | 3 | voice-gate, voice-mandate, voice-toggle |
| Design Tools | 2 | figma-fidelity-stop, figma-fidelity-arm |

Four hooks are pinned always-on regardless of what's installed (`beats-rebuild`, `beats-staleness-guard`, `hook-registry-guard`, `hook-registry-stop`); one ships default-off until you turn it on (`sidecoach-detect`).

The authoritative full inventory - every hook's exact description, which cluster owns it, and the precedence rules between them - lives in `claude/hooks/browser-tree.json` (machine-readable, read by both installer surfaces) and `.claude/memory/decision_hook_system_architecture.md` (prose).

</details>

<a id="deep-memory-system"></a>
<details>
<summary><b>The memory system in detail</b></summary>

**Why does Claude remember here?** Because the record is externalized into files git carries, not left inside a conversation that ends.

### Three layers

**Project root memory** (`<project>/.claude/memory/`) is the canonical record for that project. Session files (`session_YYYY-MM-DD_<topic>.md`), feedback files, reference files, decision files. Indexed by `MEMORY.md`. Committed to git. Read by every collaborator's Claude.

**Global cross-project memory** (`~/.claude/memory/`) is per-machine, durable across all projects. The attribution policy, Yes&-wide feedback, hook verification discipline. Symlinked from the dotfiles by the `memory` component, so every Yes& dev's machine has the same baseline.

**Per-project global memory** (`~/.claude/projects/<project-path>/memory/`) is automatically written by Claude Code for telemetry-style state.

### The lifecycle

Every discrete change writes a memory entry before Claude responds - not per-feature, per-task. A CSS fix, a copy change, a refactor decision each lands in `<project>/.claude/memory/session_YYYY-MM-DD_<topic>.md` immediately. Batching is a failure mode the `memory-nudge` hook catches.

Three lifecycle hooks make this concrete: **SessionStart** loads project + global memory into context. **PreCompact** flushes pending memory before context compresses. **PostCompact** reloads it after.

### Reflection

`/reflect` spawns five parallel analysis agents (Pattern Hunter, Tension Detector, Gap Analyst, Drift Tracker, Decision Archaeologist) against the accumulated memory corpus. They surface what's emerging that no single session would notice - contradictions between rules, hooks that misfire, decisions gone stale, drift in practice. A `reflect-nudge` hook counts new memories since the last reflection and nudges above a configurable threshold (default 15).

### Attribution and collaboration

Every memory entry records a `Collaborator:` line derived from `git config user.name`. Alice's Claude tags her name; Bob's tags his. Memory files commit and push like any source file, and the next teammate's Claude reads them at session start with attribution baked in.

The assistant is invisible in the output - no AI-attribution lines in commits, no auto-generated credit comments. Humans are named; the assistant isn't.

For ironclad enforcement on projects where teammates haven't installed the dotfiles, drop a project-root `CLAUDE.md` that re-states the rules ([template below](#project-claude-md)) - Claude Code reads it regardless of machine config.

</details>

<a id="deep-brain"></a>
<details>
<summary><b>CLAUDE.md sections in detail</b></summary>

`~/.claude/CLAUDE.md` is the global instruction file Claude reads at the start of every session. The `brain` component builds it from three layers, each appended between marker comments so your existing content is never touched:

1. **RULES.md** (team standards) - Code quality, verification protocol, debugging protocol. Push a rule here, every teammate gets it on `ampersand --pull`.
2. **CLAUDE.md** (shared workflow) - Memory discipline, design stack, permission posture, voice, cmux, Discord.
3. **CLAUDE.local.md** (personal overrides) - Machine-specific, gitignored by default.

The `memory` component adds a fourth marker block (Memory Discipline rules). All four coexist with whatever you already have.

**Verification Protocol** - the rules that gate task completion:

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

**QA gate for UI work** - steps before "done":

1. `/sidecoach audit <target>` - the detection engine (a11y, contrast, heading order, anti-patterns)
2. `/sidecoach critique <target>` - design review via independent sub-agents
3. `/sidecoach polish <target>` - final design-system alignment pass
4. `tactical-polish` 16-point checklist - concentric radius, optical alignment, shadows over borders, tabular nums, scale-on-press at 0.96, etc.
5. `npx @google/design.md lint DESIGN.md` if a DESIGN.md exists

**cmux Browser Pane** - the primary visual verification surface. Commands run via Bash: `cmux browser --surface <id> screenshot --out /tmp/<name>.png` (then Read the PNG), `navigate "<url>"`, `snapshot --interactive`. Each project records its surface in a `reference_cmux_browser.md` memory.

</details>

<a id="deep-design-stack"></a>
<details>
<summary><b>The design pipeline tour</b></summary>

Seven layers, ending in tokens and tactical polish, over a `PRODUCT.md` brand foundation. Each addresses a different question at a different beat. You do not walk all seven on every build - skip what the task does not need, deliberately.

### 1. Strategy - Sidecoach

A plugin (`sidecoach`) auto-installed via your `enabledPlugins`. 26 flows behind a typed surface of 21 verb commands, plus natural-language intent detection - which is the surface to lead with. Commands range from `teach` (interactive PRODUCT.md authoring) to `craft` (build from scratch) to `audit/critique/polish` (the QA triad). Reads `PRODUCT.md` and `DESIGN.md` at project root before every command.

The CLAUDE.md hard rule: before any UI work begins, Claude checks for `PRODUCT.md`. Missing or stub triggers `/sidecoach teach`. Missing `DESIGN.md` plus existing code triggers a one-time-per-session nudge to run `/sidecoach document`.

As covered in the [feature-cluster note above](#clusters): the detection half of this layer (`audit`) is real and measured; the coaching half - actual design instruction, not just a findings list - is still being built.

### 2. Research - component-gallery-reference

A bundled skill that has Claude browse [component.gallery](https://component.gallery) before building any standard UI component. The site catalogs 60 component types across 95 design systems (Polaris, Carbon, Primer, Spectrum, Material) with roughly 2,700 examples.

Workflow: detect tech stack from `package.json`, browse the component page filtered by stack, exclude examples tagged "Unmaintained" or "Accessibility issues", inventory the project's design system, synthesize a brief mapping gallery patterns onto project tokens. Then build with three layers: function from the gallery, identity from the project, gap-fills derived from gallery patterns styled with project tokens.

### 3. Typography - fontshare-reference

A bundled skill that researches typefaces via [fontshare.com](https://fontshare.com), Indian Type Foundry's curated open-source catalog.

Critically bakes in sidecoach's **reflex-reject list** - the training-data-default typefaces (Inter, Fraunces, Outfit, Instrument Serif, Newsreader, Plus Jakarta Sans, DM Sans/Serif, IBM Plex, Space Grotesk, et al.) get refused as primaries on greenfield work. Fontshare's own emerging defaults (General Sans, Cabinet Grotesk, Switzer, Satoshi, Clash Display) get flagged the same way.

### 4. References - /curate

The personal-catalog system. `~/.claude/design-references/` holds one folder per reference (markdown + screenshot). The catalog grows from your eye. One skill owns it in both directions.

**Capture.** Five-step wizard: source -> auto-tag proposal -> why-interesting body -> slug -> save. Hybrid tagging: strict Category (controlled vocab), free-form Pattern + Feel.

**Recall.** Greps the catalog for matching category/pattern/feel against the task context and against PRODUCT.md voice words, scores the hits, and surfaces the top 0-5 scoring 3 or better. Stays silent if nothing scores - noisy surfacing destroys trust.

### 5. Motion - motion-reference (GSAP + Lenis)

A bundled skill shipping canonical patterns for the GSAP + Lenis stack. Routes by task: tweens/timelines → `gsap`; scroll-driven → `ScrollTrigger`; smooth-scroll feel → Lenis; layout transitions → `Flip`; SVG path draw → `DrawSVG`; text by word/char → `SplitText`; drag → `Draggable`; SVG morph → `MorphSVG`; path animation → `MotionPath`.

License note baked into the skill: as of Webflow's acquisition of GreenSock, **all formerly-paid GSAP plugins are now free**.

### 6. Tokens - DESIGN.md

Google's spec for representing a visual identity to coding agents. YAML frontmatter for tokens (colors, typography, rounded, spacing, components with `{path.to.token}` references), markdown body for rationale. `npx @google/design.md lint` for schema validation, WCAG contrast checks, broken-ref detection.

CLAUDE.md mandates: conform to the Google spec, run lint after every write, resolve every error or warning. Generated UI references tokens via `{path.to.token}`, not hex literals.

### 7. Tactical - tactical-polish

An Anthropic Skill carrying sixteen specific rules with exact values. Invoke `/tactical-polish` yourself for substantive detail work:

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

The recall side of `/curate` scores matches: Category match +3, each Pattern match +1, each Feel match +1, Source match +3. Top 0-5 references with score ≥ 3 are surfaced. Below threshold = silent.

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

The `config` component enables ~20 plugins via `settings.json`: `claude-md-management`, `figma`, `firebase`, `hookify`, `skill-creator`, `sentry`, `supabase`, `swift-lsp`, `superpowers`, `agent-sdk-dev`, `typescript-lsp`, `security-guidance`, `discord`, `feature-dev`, `ralph-loop`, `code-review`, `plugin-developer-toolkit`, `chrome-devtools`.

The `skills` component bundles the 9 skills listed under Design Tools above, plus `sidecoach` ships as its own plugin. The `reflect` component adds the `reflect` skill on top, plus a SessionStart nudge hook.

Connectors (ClickUp, Google Drive, etc.) are NOT in the dotfiles - they're account-bound and authorize at claude.ai. MCP servers (Claude in Chrome, etc.) are NOT in the dotfiles either - they need OAuth or per-machine credentials.

</details>

<a id="deep-customization"></a>
<details>
<summary><b>Customization (env vars + flags)</b></summary>

**Bootstrap-time flags:**

```bash
curl -fsSL .../bootstrap.sh | bash                          # default - clones to ~/Documents/Github/improv
curl -fsSL .../bootstrap.sh | bash -s -- --dir PATH         # custom clone location
curl -fsSL .../bootstrap.sh | bash -s -- --yes              # full non-interactive install
curl -fsSL .../bootstrap.sh | bash -s -- --preset minimal   # specific preset

IMPROV_DIR=~/code/dots IMPROV_REPO=https://github.com/your-fork/improv.git \
  curl -fsSL .../bootstrap.sh | bash
```

**Installer flags:**

```bash
./install.sh                    # opens the browser installer (the default now)
./install.sh --cli              # terminal bucket browser instead
./install.sh --browser          # older name for --cli, kept for muscle memory
./install.sh --gui              # same as no flags - explicit, if you want to be
./install.sh --yes              # install everything non-interactively
./install.sh --preset NAME      # all | minimal | justify | none
./install.sh --only KEYS        # comma-separated subset
./install.sh --personal         # also show the hidden Personal cluster
./install.sh --dry-run          # show resolved picks, touch no files
./install.sh --manifest         # print the component manifest as JSON, then exit
```

**The GUI installer** starts a small server bound to `127.0.0.1` only, opens your browser to it, and renders the component tree as clickable rows with a live install log. It's a front-end over the same idempotent installer: nothing runs until you click Apply, the exact plan is validated against the component allowlist before anything is touched, and every request is gated by a one-time token in the URL. Leave the terminal open while you use it; Ctrl-C stops the server. `--personal` on the launcher carries through to the server automatically, so the hidden cluster shows up there too.

Valid `--only` keys are listed in full [above](#component-table).

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
- **CLAUDE.md marker-append** - marker-guarded on `<!-- Improv:<component>:begin -->`. If present, no-op.
- **Hook file copy** - overwrites only our own scripts (same filename), never touches hooks you wrote.

**Backup discipline** - any pre-existing real (non-symlink) file at a target path gets copied to `.backups/<timestamp>/<original-path>` before overwrite. Backups are gitignored. To recover: walk `.backups/` and copy back.

**Multi-location support** - the dotfiles can be cloned to any path. The `ampersand` shortcut bakes in the install-time `$REPO_DIR`; if you move the repo and re-run `install.sh` from the new location, the path-drift self-heal rewrites the shortcut block.

</details>

<a id="troubleshooting"></a>
<details>
<summary><b>Troubleshooting</b></summary>

**The browser installer didn't open** - `--gui` needs `python3` on your PATH; if it's missing the launcher says so and exits. If a browser window still doesn't appear, the URL it printed (`GUI installer running at http://127.0.0.1:...`) opens the same page manually. Or skip the browser entirely with `ampersand --cli`.

**"claude: command not found" in fresh terminals** - Homebrew's nvm sources `nvm.sh` but doesn't activate a default Node version. Fix: tick the `nvm` component. It appends `nvm use default --silent` to `.zshrc`. New terminal or `source ~/.zshrc`.

**`ampersand: command not found` immediately after install** - shell functions defined inside install.sh's child process don't escape into the parent shell. Fix: `source ~/.zshrc` once, or open a new terminal.

**Permission prompts on every markdown write** - should not happen with `defaultMode: bypassPermissions` set. `claude/settings.json` already includes `Write(**/*.md)`, `Edit(**/*.md)`, `MultiEdit(**/*.md)` allow rules. If persisting, restart Claude Code (permissions load at session start).

**gum not installed** - `--cli`'s terminal picker degrades gracefully to a numbered text menu. Same components, same flags, less polish.

**Memory entries from a teammate on a different machine** - pull the project: `git pull`. Memory files are in `<project>/.claude/memory/` like any other source. Claude reads them at session start.

**Fresh install on a new Mac** - `curl -fsSL https://raw.githubusercontent.com/jonahscohen/improv/main/bootstrap.sh | bash`. Take the browser installer's defaults. New terminal. Done.

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
6. Update the README's [component table](#component-table).
7. Write a session memory entry. Index in `MEMORY.md`.

**Adding a new skill to the `skills` component** - edit install.sh section 3. Add another `npx --yes skills add <github-repo>` invocation or a file-copy block (for bundled skills). Update the component description.

**Adding a new plugin to the `config` component** - edit `claude/settings.json`. Add `"<plugin>@<marketplace>": true` to `enabledPlugins`. If the marketplace isn't already known, add it to `extraKnownMarketplaces`. Re-run install to merge, restart Claude Code.

**Adding a new CLAUDE.md rule** - edit `claude/CLAUDE.md`. Decide which existing section the rule belongs to (Memory Discipline, Verification Protocol, Design Work, Code Quality, etc.). For cross-team enforcement on projects without the dotfiles, also drop it into a project-root CLAUDE.md template.

**PR hygiene** - branch from `main`. Squash-merge with a clear title. Don't take credit in commit messages.

</details>

---

## License & footer

The dotfiles are MIT licensed. Bundled tools (gum, etc.) are licensed by their respective authors - see each repository for terms.

The Yes& brand mark and logo are property of Yes&.

If you found this useful and you're not at Yes&, good - the additive components are built to layer onto your own setup. Issues and PRs welcome at [github.com/jonahscohen/improv](https://github.com/jonahscohen/improv).

We start with yes. You build what's next.
