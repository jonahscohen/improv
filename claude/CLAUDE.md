## Question-Asking Protocol (MANDATORY - MECHANICAL ENFORCEMENT VIA TOOL)

**CRITICAL RULE: Always use AskUserQuestion. Never ask questions in plain text.**

Every question you have must go through the AskUserQuestion tool. This is the mechanical enforcement that makes it failure-proof. The tool requires you to provide options, which prevents open-ended questions by design.

**When you have a question:**
1. Reframe it from open-ended into 2-3 concrete, mutually-exclusive options
2. Mark one option as (Recommended) 
3. Call AskUserQuestion with multiSelect: false
4. Let the user select or provide their own answer

**You cannot ask questions in plain text.** Not "What do you think?" Not "Should we do X?" Only use the tool.

**Before calling the tool:**
- Read relevant memory files to ground your options
- Ensure options are mutually exclusive
- Ensure the recommended option makes sense given the context
- Ensure no option contradicts what the user has already decided

**This is non-negotiable and mechanically enforced.** The tool call itself is the gate. If you ask a question without using the tool, you've violated the rule and the user will see it immediately.

---

## Design Work and Impeccable (MANDATORY for UI tasks)

The `impeccable` plugin is enabled in `~/.claude/settings.json` with `autoUpdate: true`. It ships one `/impeccable` skill with 23 commands that cover design briefs, implementation, and QA for frontend work. Use `/impeccable` as the front door for every design or QA task in every project, not as an optional tool.

### Project-level setup (do this first, once per project)

Every `/impeccable` command reads two files at the project root:

- `PRODUCT.md` - register (brand vs product), users, brand personality, anti-references, strategic principles. Required.
- `DESIGN.md` - colors, typography, components, layout. Optional, strongly recommended.

Before any design work, check whether PRODUCT.md exists at the project root and has real content (not `[TODO]` placeholders, not under 200 characters). If it is missing, empty, or a stub, run `/impeccable teach` first. It is interactive (asks about users, brand, anti-references) and writes PRODUCT.md. After it returns, resume the original task with the fresh context. Do not improvise a design on a project with no PRODUCT.md.

If DESIGN.md is missing and there is already code in the project, nudge the user once per session: "Run `/impeccable document` to capture the current visual system so variants stay on-brand." Proceed even if they skip.

### DESIGN.md format (Google spec)

When writing or updating a project's `DESIGN.md` (via `/impeccable document`, `/impeccable extract`, or by hand), conform to the [google-labs-code/design.md](https://github.com/google-labs-code/design.md) spec: YAML frontmatter for tokens (colors, typography, rounded, spacing, components with `{token.path}` references), markdown prose body for rationale, sections in canonical order (Overview, Colors, Typography, Layout, Elevation, Shapes, Components, Do's and Don'ts). After writing or modifying the file, run `npx @google/design.md lint DESIGN.md` and address every error or warning (broken token references, WCAG contrast failures, schema violations) before reporting done. Generated UI code must reference tokens via the `{path.to.token}` form rather than hard-coding hex values, so the design system stays the single source of truth.

### Entry-command routing (pick one before writing code)

| User's intent | Command |
|---|---|
| Net-new feature or page, build from scratch | `/impeccable craft <feature>` |
| Plan the design only, no code yet | `/impeccable shape <feature>` |
| Add motion, color, personality, or boldness | `/impeccable animate`, `colorize`, `delight`, `bolder`, `overdrive` |
| Tone down a loud or over-stimulated UI | `/impeccable quieter` or `distill` |
| Fix typography, spacing, layout, responsive, copy, perf | `/impeccable typeset`, `layout`, `adapt`, `clarify`, `optimize` |
| Production-ready sweep (errors, i18n, edge cases) | `/impeccable harden` |
| First-run flows, empty states, activation | `/impeccable onboard` |
| Pull reusable tokens and components into the design system | `/impeccable extract` |
| Iterate visually on elements in a live browser | `/impeccable live` |

When unsure, invoke `/impeccable` with no argument. It renders the full command menu grouped by category.

Once an entry command is loaded, let its reference file drive. Do not improvise around it.

### Tactical implementation layer (make-interfaces-feel-better)

Installed via `install.sh` as the `make-interfaces-feel-better` Anthropic Skill. It auto-triggers on UI keywords (border radius, animation, optical alignment, hover state, tabular numbers, "feel better," etc.) and supplies 16 specific tactical rules with exact values: `scale(0.96)` on press, concentric border radius (`outer = inner + padding`), icon swaps via opacity+scale+blur (`scale 0.25->1, opacity 0->1, blur 4px->0`), image outlines `rgba(0,0,0,0.1)` never tinted, hit areas at least 40x40px, `transition: all` banned, `font-variant-numeric: tabular-nums` on dynamic numbers, `text-wrap: balance` on headings, etc. Full reference at `~/.claude/skills/make-interfaces-feel-better/`.

This skill is the tactical layer that sits between Impeccable's strategy (PRODUCT.md, register, anti-references) and DESIGN.md's tokens (colors, typography, spacing). Apply it during implementation, not as a separate pass:

- If the skill auto-triggers, follow it. Address every applicable item from its 14-point checklist.
- If you are modifying UI but the skill did NOT auto-trigger, manually invoke `/make-interfaces-feel-better` before reporting done. The skill's `description` field is keyword-driven and may miss subtle UI work; an explicit invocation is the fallback.
- When summarizing UI changes (in PR descriptions, session memory, or to the user), use the skill's before/after table format. Group by principle, one row per diff. The free-form "I tightened up the button" summary is not acceptable.

### QA gate for UI work (before reporting done)

The existing Verification Protocol above (visual, interactive, side-by-side, completeness) still applies to UI work. In addition, any substantive UI change (new feature, redesign, significant component edit) must pass this triad before you report completion:

1. `/impeccable audit <target>` - runs the 5-dimension technical scan (a11y, performance, theming, responsive, anti-patterns) plus the `npx impeccable detect` CLI. Address all Critical and High findings.
2. `/impeccable critique <target>` - design review via independent sub-agents (AI-slop detection, Nielsen heuristics, cognitive load, emotional journey). Address anything above "minor".
3. `/impeccable polish <target>` - final alignment pass against the project's design system. Must run last.
4. `make-interfaces-feel-better` 14-point checklist - run through every item applicable to the change (concentric radius, optical alignment, shadows over borders, split/staggered enters, subtle exits, tabular nums, font smoothing, balanced text wrap, image outlines, scale-on-press, `initial={false}` on AnimatePresence, no `transition: all`, sparse `will-change`, 40x40 hit areas). The skill's review-output-format (before/after tables grouped by principle) is the canonical way to record what changed.
5. If the project has a `DESIGN.md` (per the Google spec): `npx @google/design.md lint DESIGN.md` and resolve every error/warning before reporting done.

Small, obviously-trivial edits (a one-line copy tweak, a named-token swap) can skip the gate. Anything where the aesthetic result is in question must run all five. "I'll skip polish because it probably looks fine" is not a valid judgment; run the commands.

### What impeccable is NOT for

Backend logic, non-UI refactors, build-tool work, infrastructure changes. Do not load `/impeccable` for those.

## Design Peer Skills (independent entry points)

Four skills that sit alongside Impeccable as independent entry points in the design stack. Each reads PRODUCT.md + DESIGN.md from the project root (same contract as Impeccable) but is invoked directly, not through Impeccable's routing.

### Social Media (`/social-media`)

Platform-specific sizing, safe zones, typography rules, and content best practices for 13 platforms: Instagram, YouTube, TikTok, Twitter/X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack. Auto-triggers on platform names and social content keywords. Provides constraints and validation - the spec sheet, not the paintbrush.

### Design Team (`/design-team`)

Multi-agent design sprints with 16 specialized roles across 4 phases: Research (parallel text-only subagents) -> Build (parallel file-writing subagents) -> Review (main-thread creative director with full QA pipeline) -> Revise (one round, then CD fixes directly). Team state persists to `~/.claude/design-teams/`. Use for full pages, campaigns, or multi-section builds. Do not use for single components or minor tweaks.

### Visual Effects (`/visual-effects`)

Generative shader backgrounds (14 types including mesh gradient, fluid simulation, fractal glass, halftone field, swarm) and transformative FX post-processing (ASCII, dither, glitch, halftone, art effects, plus 17 stackable post-process effects). Ships actual shader source code as reference implementations. Full reference at `~/.claude/skills/visual-effects/`.

### Icon Source (`/icon-source`)

Rigorous protocol for sourcing icons from 8 approved libraries: Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols (static), plus Lucide Animated and Heroicons Animated (animated). Enforces one-library-per-project consistency, verbatim SVG path sourcing, and animated-vs-static selection criteria. Auto-triggers when any icon is needed during a build.

### The complete design stack

```
Orchestrator:  /design-build (runs strategy -> research -> type -> motion -> build -> QA as ONE sequence)
Strategy:      /impeccable (23 commands, PRODUCT.md + DESIGN.md)
Research:      component-gallery-reference (60 types, 95 systems)
Typography:    fontshare-reference (fontshare.com catalog, integrates with impeccable's reflex-reject list)
References:    design-references (personal catalog, auto-consults) + /curate (capture wizard)
Motion:        motion-reference (GSAP + Lenis canonical patterns - tweens, ScrollTrigger, Flip, SplitText, DrawSVG)
Tactical:      make-interfaces-feel-better (16 CSS polish rules)
Social:        /social-media (13 platforms, specs + validation)
Effects:       /visual-effects (14 shaders + 25 FX + post-processing)
Icons:         /icon-source (8 libraries, selection protocol)
Team:          /design-team (16 roles, 4-phase sprints, CD review gate)
Tokens:        DESIGN.md (Google spec, linted)
Brand:         PRODUCT.md (register, users, anti-references)
Verification:  cmux + Chrome MCP + QA gate pipeline
```

## Reflect (Memory Corpus Analysis)

The `reflect` skill spawns 5 parallel analysis agents against the accumulated `.claude/memory/` corpus to surface patterns, tensions, and gaps. It triggers naturally from conversation - "what patterns are you seeing?", "what are we missing?", "anything feel off?" - or via `/reflect`.

Five lens agents run in parallel:
- **Pattern Hunter** - recurring themes, revisited decisions, gravitational approaches
- **Tension Detector** - contradictions between rules, decisions, or stated vs actual practice
- **Gap Analyst** - missing decisions, underrepresented memory types, uncaptured reasoning
- **Drift Tracker** - gradual shifts in practice, emerging/fading concerns, scope changes
- **Decision Archaeologist** - stale decisions, met revisit conditions, outdated assumptions

A synthesis agent weaves all findings into a unified narrative with ranked findings, open questions, and recommended actions. The output saves to `.claude/memory/reflection_YYYY-MM-DD.md`.

A SessionStart hook (`reflect-nudge.sh`) counts new memory files since the last reflection. When the count exceeds the threshold (default 15, configurable via `REFLECT_THRESHOLD` env var), the session opener includes a one-line nudge. The user says yes and it runs, or no and it drops.

Default scope is the current project's `.claude/memory/`. Say "reflect across everything" or pass `--all` to include global project memories from `~/.claude/projects/*/memory/`.

## Voice Output

Claude can speak short verbal summaries aloud via OpenAI TTS API. Requires an OpenAI API key stored in macOS Keychain (`security add-generic-password -a 'claude-voice' -s 'openai-tts-api-key' -w 'YOUR_KEY'`). No key = feature unavailable, no fallback.

Three mute controls (all toggle the same file):
- In-session: "mute yourself" / "unmute"
- Terminal: `voice-on` / `voice-off`
- Manual: `touch ~/.claude/.voice-enabled` / `rm ~/.claude/.voice-enabled`

Starts muted. Preferences in `~/.claude/.voice-config`:
```json
{"voice": "onyx", "verbosity": "short", "speed": 1.25}
```

13 voices: alloy, ash, ballad, cedar, coral, echo, fable, marin, nova, onyx, sage, shimmer, verse.

Verbosity controls how much Claude says when speaking:
- `"short"` (default) - 1-2 sentences. Status, confirmations, brief answers.
- `"normal"` - 3-4 sentences. Includes brief context or reasoning.
- `"verbose"` - Full spoken paragraph. What changed, why, what's next. Still conversational.

**Speed**: `0.25` to `4.0`, default `1.0`. Values above 1.0 speed up speech.

Never speak code, diffs, file paths, or structured output at any verbosity level.

### Discord voice replies

When voice is active and responding to a Discord message, generate a TTS audio file and attach it as an OGG alongside the text reply. This gives the user both a written and spoken response in-chat, mirroring how they send voice messages.

Pipeline:
1. Compose the reply text.
2. Run `~/.claude/tts-generate "reply text" /tmp/discord-reply-<timestamp>.ogg` via Bash. It reads voice/model/speed from `~/.claude/.voice-config` and the API key from Keychain. Prints the output path on stdout.
3. Attach the OGG to the Discord reply via the `files` parameter on `mcp__plugin_discord_discord__reply`.
4. Also speak the reply locally via `mcp__voice-output__speak` as usual.

The spoken content should be the conversational reply itself, not a meta-summary ("Jonah said X, I replied Y"). Match or closely mirror the Discord reply text so it sounds like a real back-and-forth.

If `~/.claude/tts-generate` is missing, run `ampersand --only voice-output` to install it.

## Permission Posture (deliberate choice)

This machine ships with `defaultMode: bypassPermissions` and `skipDangerousModePermissionPrompt: true` in `~/.claude/settings.json`. That means every tool call - Bash, Write, Edit, MultiEdit, all of them - auto-approves without prompting, AND Claude Code's own "are you sure" warning on the bypass mode is suppressed.

This is intentional for a personal Yes& workstation. The team has decided the friction of every-tool-prompt outweighs the safety it adds, and the PreToolUse hooks (`bash-guard.sh`, `content-guard.sh`) already block the specific categories we care about: AI-attribution lines, force-pushes to main/master, `rm` against `.claude/memory`, legacy model IDs, emojis, emdashes.

If you (a different developer, a forked install, a public reuse) want different defaults: edit `claude/settings.json` and change `defaultMode` to `default` (per-tool prompting) or `acceptEdits` (auto-approve edits but not bash). Remove `skipDangerousModePermissionPrompt` if you want Claude Code's own warning to show. Both changes are local to settings.json and propagate through the dotfiles symlink.

The hook layer stays useful regardless of `defaultMode` - hooks fire BEFORE the permission prompt would, so they continue blocking forbidden patterns even in fully-prompting mode.

## Voice transcription (audio attachments)

When a Discord (or any other) message arrives with an audio attachment - voice memo, recorded note, dictation - transcribe it before responding. Do not ask the user to retype what they said.

The dotfiles' `voice` component installs whisper.cpp + ffmpeg locally and symlinks `~/.claude/transcribe`. Pipeline:

1. Download the attachment (`mcp__plugin_discord_discord__download_attachment` for Discord, or read the path the user provided).
2. Run `~/.claude/transcribe <path-to-audio>` via Bash. The transcript prints on stdout, diagnostics on stderr.
3. Use the transcript as if the user had typed it. If the transcription is empty or obviously garbled, tell the user and ask them to retype - don't fabricate a guess.

The script handles OGG/Opus (Discord), m4a (iOS), mp3, flac, and wav. It pre-converts to 16 kHz mono PCM via ffmpeg, then runs whisper-cli with the ggml-base.en model from `~/.cache/whisper/`. Override the model with `WHISPER_MODEL=/path/to/other.bin` if you need multilingual or higher-accuracy variants.

If `~/.claude/transcribe` is missing on a fresh machine, run `ampersand --only voice` to install. If it errors with "model missing" or "ffmpeg not found", the same install fixes both.

## Discord Chat Agent (smart launcher + onboarding)

The `discord` component adds a state-aware wrapper around `claude` so opening a session prompts intelligently based on what's already configured on the machine. Three states:

- **Cold** (no bot token in macOS Keychain): the wrapper offers `[s] Set up now`, `[k] Skip this session`, `[n] Never ask again`. `s` runs `~/.claude/discord-onboard.sh`; `n` writes `~/.claude/channels/discord/.skip-launcher` so the prompt never reappears (delete the file to undo).
- **Mid** (token configured but no users paired in `access.json`): the wrapper offers `[p] Pair now` (launches Claude with the Discord channel attached so the user can DM the bot) or `[s] Skip`.
- **Warm** (token + at least one paired user): `Connect to Discord Chat Agent? (y/n)` prompt, waits indefinitely for an answer, default Yes.

`~/.claude/discord-onboard.sh` is the interactive walkthrough. It runs `--status` to print state and exits, or interactively dispatches to one of two paths:

1. "I already have a Discord bot": prompts for the bot token (hidden input), pipes it into `discord-setup.sh` to land in macOS Keychain.
2. "Walk me through making a new one": numbered Developer Portal steps (create application, enable Message Content Intent, reset token, generate OAuth URL, authorize), with `Press enter when done` between each, then prompts for the token.

Both paths end with the same pairing instructions: start a Claude session with the Discord channel attached, DM the bot to receive a 6-character pairing code, then run `/discord:access pair <code>` in a Claude terminal session.

If a colleague asks how to set up Discord on their machine, point them at `bash ~/.claude/discord-onboard.sh` (after they've installed at least the `claude` component of the dotfiles).

**Reply tool fails with "channel ... is not allowlisted" but you're already paired.** This is a recoverable failure mode caused by the bot's in-memory channel-allowlist dropping out of sync with `access.json`. The pairing flow writes a one-shot signal file at `~/.claude/channels/discord/approved/<userId>` containing the DM `chat_id`, the bot polls the directory, picks up the file, adds the chat to its in-memory allowlist, then deletes the file. If the bot restarts without re-pairing, the in-memory list is empty and the marker is gone, so DMs silently fail even though `access.json` still lists the user. Recovery: `bash ~/.claude/discord-onboard.sh --repair` walks the allowFrom list, prompts for the chat_id of any user missing a marker, and writes the file. The bot then re-arms in-memory state on its next poll.

## cmux Browser Pane (visual verification tool)

`cmux` is the browser-surface CLI wired into this machine's Claude Code harness. Use it to take screenshots and drive a real browser pane for visual verification instead of (or in addition to) the `mcp__claude-in-chrome__*` tools. This is the preferred surface for verifying UI changes per the Verification Protocol above.

**Core commands** (run via Bash):
- Screenshot: `cmux browser --surface <surface-id> screenshot --out /tmp/<name>.png` then use the Read tool on the PNG to view it.
- Navigate: `cmux browser --surface <surface-id> navigate "<url>"`
- Interactive snapshot (DOM + refs for clicking): `cmux browser --surface <surface-id> snapshot --interactive`

**Surfaces are per-project.** Every project that uses cmux should record its surface id and dev-server URL as a `reference_cmux_browser.md` memory in that project's memory dir, e.g.:

```
---
name: cmux browser for <project>
description: How to use cmux browser to verify <project> UI at <url>
type: reference
---

<project> dev server runs at <url>.
cmux surface handle: surface:<NN>
```

If a project's memory does not yet declare a surface id, ask the user for it before running cmux commands - don't guess.

**When to use:**
- Any UI/CSS/layout change - take a cmux screenshot, Read the image, and describe what you see before reporting done.
- Interactive verification - use `snapshot --interactive` to get element refs, then drive clicks/hovers.
- When the user says "refresh the tab in cmux" or similar, this is the tool they mean.

