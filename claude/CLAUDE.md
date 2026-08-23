## Question-Asking Protocol (MANDATORY - MECHANICAL ENFORCEMENT VIA TOOL)

**CRITICAL RULE: EVERY question you pose to the user goes through AskUserQuestion. No exceptions, no size threshold.**

Scope (revised 2026-07-12 - this REVOKES the 2026-05-26 binary carve-out):
- **Binary questions** (yes/no, true/false, this-or-that, "should I ship or wait") -> AskUserQuestion with TWO options. The plain-text exemption for binaries is GONE. A yes/no is posed as a 2-option question with the recommended option marked. "It is just a yes/no" is not a reason to drop to plain text - the quick binary is the most common shape of the deflection this mandate exists to prevent.
- **Three or more options** -> AskUserQuestion, as before.
- **Free-form questions** -> AskUserQuestion still applies. The tool always presents an "Other" option, so the user can type an answer you did not anticipate.

**Every question, regardless of shape:**
1. Reframe it into concrete, mutually-exclusive options (a binary is simply two options)
2. Mark the option you believe is best with "(Recommended)" - your judgment matters; make it visible
3. Call AskUserQuestion with multiSelect: false (or true if multiple selections are valid)
4. Let the user select or provide their own answer

**Before calling the tool:**
- Read relevant beats to ground your options
- Ensure options are mutually exclusive
- Ensure the recommended option makes sense given the context
- Ensure no option contradicts what the user has already decided

**The hook is the mechanical gate.** `multiple-choice-detect-stop.sh` is the live enforcer (Stop event, pairs with `multiple-choice-inject-prompt.sh`); `multiple-choice-enforce.sh` is its detection twin. Both flag plain-text option lists AND plain-text questions posed to the user - binaries included. **A hook fire on a binary question is now INTENDED, not a false positive.** Do not argue with it and do not rephrase around it - re-ask through the tool.

**Still a genuine false positive (do NOT weaken your writing to dodge it):** a factual numbered ENUMERATION that is not a question - a list of findings, capabilities, or files with no question attached. The hook carves these out (a list with no trailing question does not fire), and a rhetorical question inside prose ("Why did it break? The cache key rolled over.") is not a question to the user and does not fire either. If the hook ever fires on one of those, that is a bug in the hook worth reporting, not a violation by you.

**The "size doesn't matter" principle is now absolute.** Don't rationalize "this is just a quick yes/no" or "this 3-option question is small enough to skip the tool." Every question goes through the tool, every time. That rationalization IS the failure mode the mandate exists to prevent.

---

## Design Work and Sidecoach (MANDATORY for UI tasks)

The `/sidecoach` skill is the front door for every design or QA task. Its frontmatter description helps the model select it for design work; separately, the live `sidecoach-keyword.sh` hook injects a context nudge on matching prompt keywords. Neither is the Skill tool firing itself - a hook can inject context but cannot call a tool, so the skill still loads only when you invoke it. It owns its own command list, routing tables, design-stack diagram, and detailed QA gate protocol. Load the skill for any UI work - do not improvise routing.

**Default evaluation gate (front-end/design intent).** Sidecoach is part of the default evaluation for ALL front-end work, not just when a verb is typed. The `sidecoach-keyword.sh` UserPromptSubmit hook watches for natural front-end/design requests (via the tunable `sidecoach-intent.json` lexicon) and injects a one-line self-question: would a sidecoach flow or mode produce a stronger result here? Treat that injection as a real prompt to yourself - for substantive UI work (a new component, page, layout, redesign, or visual/UX/motion/typography pass) evaluate sidecoach before hand-coding; for genuinely trivial edits (one-line CSS, a copy change, a single prop) skip it and proceed. The hook deliberately stays silent on trivial tweaks and during an active build (cooldown), so when it does fire, take it seriously. Even when the hook does not fire, keep the question live for any front-end task. The trigger lexicon and cooldown live in `claude/hooks/sidecoach-intent.json` and are yours to tune.

**Project setup gate.** Do not improvise design on a project without a real PRODUCT.md (under 200 chars or containing `[TODO]` counts as missing). If missing, run `/sidecoach teach` first. If DESIGN.md is missing and the project has CSS, nudge the user once per session to run `/sidecoach document` and proceed if they skip.

**DESIGN.md must conform to the Google spec** (YAML token frontmatter + six-section markdown body in canonical order). After writing or modifying it, run `npx @google/design.md lint DESIGN.md` and resolve every finding. Generated UI code must reference tokens via `{path.to.token}` rather than hard-coded hex.

**Diagnosing or critiquing existing UI IS a sidecoach audit - run it, do not eyeball it.** When asked to look at, review, diagnose, or critique an existing page or component ("what's wrong with this page", "how does this look", "this feels off, take a look", "is the copy real or fluff"), that request IS `/sidecoach audit <target>` (plus `/sidecoach critique <target>` for the design-judgment layer). Run it as the FIRST step, before forming or stating an opinion - not after a build, not only when there is a change to verify. The audit renders the page and runs the detection engine: objective defects (contrast, heading order, broken images, justified text) and taste defects (marketing-buzzword, tiny-text, nested-cards, anti-pattern bans) that a freeform human read provably misses. Running audit when nothing is being built is NOT "dressing up an opinion as a formal pass" - the freeform eyeball read is the opinion; the audit is the measurement. A diagnosis is not "upstream of" sidecoach; it IS sidecoach's primary read path. Reaching for Chrome or a screenshot to hand-critique a page instead of running the audit is the exact failure this rule exists to prevent. (Recorded 2026-06-26 after a session reasoned its way out of an audit on a pure-diagnosis request because the only framing it had was the post-build gate below.)

**QA gate before reporting done** (the other use of the same tools; a required manual or orchestrated step, not something that fires on its own) on any substantive UI change:
1. `/sidecoach audit <target>` - address all Critical and High findings
2. `/sidecoach critique <target>` - address anything above "minor"
3. `/sidecoach polish <target>` - final alignment, must run last
4. `tactical-polish` 16-point checklist - invoke `/tactical-polish` for substantive UI detail work. Record changes in its before/after table format grouped by principle.
5. If DESIGN.md exists: `npx @google/design.md lint DESIGN.md` with zero findings.

Mechanical coverage that actually exists today: `sidecoach-taste-gate.sh` (PostToolUse) fires on every `.html`/`.css` write under a directory containing DESIGN.md. It invokes `sidecoach/bin/sidecoach-detect.js` on the FILE THAT WAS JUST WRITTEN and injects the findings. For an `.html` it RENDERS the file's `file://` URL and runs the held-out-validated rendered detectors (marketing-buzzword v4, tiny-text, nested-cards, low-contrast, plus the a11y objective lens) alongside the absolute-ban and static-check lenses; for a `.css` it runs the static ban + polish lenses only (a lone stylesheet has no renderable target). It fails CLOSED: when the engine is not built, the detector aborts, or the Playwright browser is missing (so the rendered lane cannot run), it says the page is UNVERIFIED rather than going silent. That is still a SUBSET of `/sidecoach audit` (it scans the single edited file, not the whole project). `/sidecoach critique`, `/sidecoach polish`, and `/sidecoach audit` outside a DESIGN.md project have no hook behind them - you run them or they do not happen. `sidecoach-detect.sh` is opt-in and not registered by default. Two more hooks close the QA-gate loop end to end. `sidecoach-orchestrate-edit.sh` (PostToolUse) is the WRITE boundary: on a substantive design edit it injects the audit -> critique -> polish directive AND arms `~/.claude/.needs-qa-gate.<session>` with the target basename. `sidecoach-qa-gate-stop.sh` (Stop) is the FINISH boundary: it blocks reporting that change "done" until it sees PROOF the gate ran this session since the arm - the audit, critique, AND polish sidecoach Skill invocations all present since the arm (a single stage does not clear it, and prose describing the gate never does - the agent authors its own transcript text, so only a real, un-forgeable Skill tool_use counts) - clearing instead when the tree provably holds no dirty design file (fail-closed tree-corroboration) or the user replies "qa done" / "skip qa" (`qa-gate-manual.sh`, UserPromptSubmit). It carries the full 4-layer anti-loop (stop_hook_active, once-per-arm burst flag, atomic claim, fail-open) and defers to `verify-before-done-stop.sh` when that gate will block the same burst, so the two never double-block.

**Escalation-ladder fork.** A twice-failed mandate that is NOT mechanizable at the write boundary (you cannot force a multi-step review to run from a PostToolUse hook) does not get more prose - it gets a finish-boundary ARTIFACT gate: block "done" until there is evidence the pass actually ran. `sidecoach-qa-gate-stop.sh` is the first instance of that rung, built because the orchestrate-edit directive was a write-time nudge nothing verified at Stop (the tactical-polish-0/8 hole). When another mandate hits the same shape, add a finish-boundary evidence gate before adding another injected reminder.

Trivial copy tweaks or named-token swaps can skip the gate. Substantive aesthetic work cannot. "I'll skip polish because it probably looks fine" is not a valid judgment.

**Sidecoach dependents.** tilt-lab (the local visual-effects workbench, `/tilt-lab` skill) is a sidecoach-dependent capability: it owns generative and shader BACKGROUNDS. When a hero or section calls for an animated/shader/gradient backdrop, that is a sidecoach concern delegated to tilt-lab - audition and tune the effect there, export the embed, and mount it with `mountStack` behind the content (absolute, reduced-motion-aware, tokens matched). Reach for it through sidecoach's flow, not as a separate detour.

**Sidecoach is NOT for:** backend logic, non-UI refactors, build-tool work, infrastructure changes.

## Design Peer Skills

Four independent design skills sit alongside Sidecoach. Their frontmatter descriptions help the model select them for matching work, but no hook calls the Skill tool - selection is yours to make. Each reads PRODUCT.md + DESIGN.md:

- **`/social-media`** - platform-specific sizing, safe zones, and content rules for 13 platforms (Instagram, YouTube, TikTok, X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack).
- **`/design-team`** - multi-agent design sprints with 16 roles across 4 phases (research, build, CD review, revise). Use for full pages, campaigns, multi-section builds; not single components.
- **`/visual-effects`** - 14 generative shader backgrounds + 26 transformative FX + 17 post-process effects with shader source.
- **`/icon-source`** - rigorous protocol for sourcing from 8 approved libraries (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols, plus Lucide/Heroicons Animated). One library per project, verbatim path sourcing, animated-vs-static selection criteria.

The full design stack diagram (orchestrator, strategy, research, typography, motion, tokens, brand, verification layers) lives inside the `sidecoach` skill.

**There is no separate design-pipeline skill.** `design-build` held the orchestrator layer and was retired on 2026-07-28 after 0 invocations in two months; `sidecoach` holds that layer now. The reason it failed is preserved in the sidecoach skill's QA gate section and is worth knowing before anyone proposes rebuilding it: wrapping steps that nothing invokes inside one more step that nothing invokes does not make them run. Do not add a new orchestrator skill as the fix for the QA gate not firing - run the gate.

**`/curate` owns the personal design-reference catalog in both directions** - Capture (save a reference to `~/.claude/design-references/`) and Recall (surface matches from it during a UI build). The read half was a separate `design-references` skill until 2026-07-28 and was merged in; the catalog itself is unchanged and is user data, never deleted by the installer.

## Reflect (Beats Corpus Analysis)

The `reflect` skill spawns 5 parallel analysis agents against the accumulated beats in `.claude/memory/` to surface patterns, tensions, and gaps. It triggers naturally from conversation - "what patterns are you seeing?", "what are we missing?", "anything feel off?" - or via `/reflect`.

Five lens agents run in parallel:
- **Pattern Hunter** - recurring themes, revisited decisions, gravitational approaches
- **Tension Detector** - contradictions between rules, decisions, or stated vs actual practice
- **Gap Analyst** - missing decisions, underrepresented beat types, uncaptured reasoning
- **Drift Tracker** - gradual shifts in practice, emerging/fading concerns, scope changes
- **Decision Archaeologist** - stale decisions, met revisit conditions, outdated assumptions

A synthesis agent weaves all findings into a unified narrative with ranked findings, open questions, and recommended actions. The output saves to `.claude/memory/reflection_YYYY-MM-DD.md`.

A SessionStart hook (`reflect-nudge.sh`) counts new beats since the last reflection. When the count exceeds the threshold (default 15, configurable via `REFLECT_THRESHOLD` env var), the session opener includes a one-line nudge. The user says yes and it runs, or no and it drops.

Default scope is the current project's `.claude/memory/`. Say "reflect across everything" or pass `--all` to include global project beats from `~/.claude/projects/*/memory/`.

## Presentation by Surface (rich visualizer vs text panel)

The `claude-surface.sh` SessionStart hook detects which Claude Code SURFACE the session runs in - via `CLAUDE_CODE_ENTRYPOINT` plus the `CMUX_*` vars (full value map in `reference_claude_code_surface_detection.md`) - and injects it into context every session. Adapt how you PRESENT reporting and data to that surface:

- **RICH surfaces** (desktop = `claude-desktop`, web / Cowork = `remote*`, VS Code = `claude-vscode`) render HTML-based custom visuals and artifacts (Anthropic: "Custom visuals in chat and Cowork"). When you present REPORTING, DATA, CHARTS, TABLES, or GRAPHS here, prefer Claude's visualizer - a self-contained interactive/visual artifact (HTML / SVG / React: a chart, a table, a dashboard) - and be creative where it earns its keep. Plain text is the fallback, not the default. Mechanism: produce HTML-based visual content; "custom visuals" are ephemeral inline, "artifacts" are persistent/shareable.
- **TEXT-ONLY surfaces** (terminal, cmux, mobile = `remote_mobile`, sdk) cannot render custom visuals (Anthropic: not available on iOS/Android; terminals are text). Present as clean text / markdown / ASCII - for example the sidecoach executive report (deliverable blocks + before/after tables). Do NOT build visual artifacts to display data; they will not render.

The surface is in your context each session - honor it. When unsure whether a specific visual renders in the current surface, fall back to clean markdown/text. Sidecoach and Justify final outputs follow the executive-report contract (Jonah 2026-07-04): deliverable blocks with before/after tables and a sentence or two per deliverable - markdown on text surfaces, the same report as a visualizer artifact on rich surfaces. The old ASCII panels are retired.

## Voice Output

Voice is governed by the SessionStart `voice-mandate` hook at `~/.claude/hooks/voice-mandate.sh`. It checks two conditions: voice-output is installed in `mcpServers`, AND `~/.claude/.voice-enabled` exists (voice is not muted). If both are true the hook injects a `VOICE OUTPUT IS ACTIVE` mandate. If voice is muted the hook injects a `VOICE OUTPUT IS MUTED` notice. If voice-output is not installed the hook injects nothing.

**Single source of truth: the hook output, every turn.** Do not ToolSearch for `mcp__voice-output__speak` or call it unless the active mandate appears in your context for the current turn. The mandate is the permission slip; without it, voice does not exist for this session.

**When the active mandate is present in context:** load the speak tool via ToolSearch and include a `mcp__voice-output__speak` call in the FIRST batch of tool calls of every response. Concise 1-2 sentence summaries. No code, diffs, or file paths. Greetings, error messages, status updates - all spoken.

**When the muted notice is present (or no mandate at all):** do not ToolSearch for speak, do not call speak, and drop spoken-style lines from text output. Skip voice machinery entirely. This saves the OpenAI TTS API cost the user explicitly opted out of by muting.

**Mid-session mute toggles re-fire the hook.** When the user types `voice on` or `voice off`, the UserPromptSubmit `voice-toggle` hook flips the flag file and the next SessionStart-equivalent context injection reflects the new state. Always read the current turn's context for the mandate, not a remembered earlier state.

**Why this is structured this way:** an unconditional "always speak" rule previously caused Claude to load and call speak even when the user had explicitly muted, wasting turns on `BLOCKED: voice is muted` responses. The hook is the authoritative gate. Follow the hook, not a remembered rule.

### Infrastructure + Discord voice replies

Setup and pipeline detail - OpenAI TTS key in macOS Keychain, the 13 voices, `~/.claude/.voice-config` prefs, mute via `~/.claude/.voice-enabled`, and the `~/.claude/tts-generate` OGG pipeline for Discord voice replies - lives in `claude/docs/voice-discord-infra.md`. Read it when doing voice or Discord-voice work. Behavioral essentials (unchanged, hook-enforced): voice is gated by the `voice-mandate` hook above; never speak code/diffs/paths; when replying on Discord with voice active, attach a TTS OGG that mirrors the reply text.

## Permission Posture (deliberate choice)

This machine ships with `defaultMode: bypassPermissions` and `skipDangerousModePermissionPrompt: true` in `~/.claude/settings.json`. That means every tool call - Bash, Write, Edit, MultiEdit, all of them - auto-approves without prompting, AND Claude Code's own "are you sure" warning on the bypass mode is suppressed.

This is intentional for a personal Yes& workstation. The team has decided the friction of every-tool-prompt outweighs the safety it adds, and the PreToolUse hooks (`bash-guard.sh`, `content-guard.sh`) already block the specific categories we care about: AI-attribution lines, force-pushes to main/master, `rm` against `.claude/memory`, legacy model IDs, emojis, emdashes.

If you (a different developer, a forked install, a public reuse) want different defaults: edit `claude/settings.json` and change `defaultMode` to `default` (per-tool prompting) or `acceptEdits` (auto-approve edits but not bash). Remove `skipDangerousModePermissionPrompt` if you want Claude Code's own warning to show. Both changes are local to settings.json and propagate through the dotfiles symlink.

The hook layer stays useful regardless of `defaultMode` - hooks fire BEFORE the permission prompt would, so they continue blocking forbidden patterns even in fully-prompting mode.

## Frontier Model Confirm Token (NEVER write it yourself)

The `.5` frontier models (claude-fable-5, claude-opus-5, claude-sonnet-5) are gated: on a frontier session your own Write/Edit/Bash are blocked (delegate production to a preferred model - Opus 4.8 / Sonnet 4.6 / Haiku 4.5), and routing a sub-agent onto a frontier model is blocked. The ONLY thing that lifts either gate is the USER typing "confirm" (or "confirm <model>"), which the `frontier-confirm-arm.sh` UserPromptSubmit hook turns into a one-shot token at `~/.claude/.frontier-confirm`.

You MUST NEVER write, create, move, copy, or otherwise author `~/.claude/.frontier-confirm` (or any file named `.frontier-confirm`) through the Bash, Write, Edit, MultiEdit, or NotebookEdit tools. Writing it would forge the user's confirm and route work onto a pricier model they never approved - the exact thing the gate exists to prevent. `bash-guard.sh` and `content-guard.sh` block the obvious vectors, but the rule stands regardless: only the user's typed confirm arms it. When you believe a frontier model is warranted, state why and ask the user to confirm; do not reach for the token file. (This does not touch the `frontier-confirm.sh` / `frontier-confirm-arm.sh` HOOK SCRIPTS, which you may edit normally - only the dotfile token is off-limits.)

## Voice transcription (audio attachments)

When a message arrives with an audio attachment (voice memo, recorded note, dictation), transcribe it BEFORE responding - do not ask the user to retype what they said. Run `~/.claude/transcribe <path-to-audio>` via Bash (handles OGG/Opus, m4a, mp3, flac, wav; transcript on stdout) and use the result as if the user typed it. If it is empty or obviously garbled, tell the user and ask them to retype - never fabricate a guess. Pipeline internals (whisper.cpp + ffmpeg, model override) and install (`ampersand --only voice`) are in `claude/docs/voice-discord-infra.md`.

## Discord Chat Agent (smart launcher + onboarding)

A state-aware wrapper around `claude` handles Discord setup and onboarding (cold / mid / warm states via `~/.claude/discord-onboard.sh`). If a colleague asks how to set up Discord on their machine, point them at `bash ~/.claude/discord-onboard.sh` (after they've installed at least the `claude` component). Recoverable failure to know: if the reply tool fails with "channel ... is not allowlisted" while you ARE paired, the bot's in-memory allowlist desynced from `access.json` - fix with `bash ~/.claude/discord-onboard.sh --repair`. Full launcher-state logic, the onboarding walkthrough, and the allowlist-resync mechanics are in `claude/docs/voice-discord-infra.md`.

## cmux Browser Pane (visual verification tool)

`cmux` is the browser-surface CLI wired into this machine's Claude Code harness. Use it to take screenshots and drive a real browser pane for visual verification instead of (or in addition to) the `mcp__claude-in-chrome__*` tools. This is the preferred surface for verifying UI changes per the Verification Protocol above.

**Core commands** (run via Bash):
- Screenshot: `cmux browser --surface <surface-id> screenshot --out /tmp/<name>.png` then use the Read tool on the PNG to view it.
- Navigate: `cmux browser --surface <surface-id> navigate "<url>"`
- Interactive snapshot (DOM + refs for clicking): `cmux browser --surface <surface-id> snapshot --interactive`

**Surfaces are per-project.** Every project that uses cmux should record its surface id and dev-server URL as a `reference_cmux_browser.md` beat in that project's beats dir, e.g.:

```
---
name: cmux browser for <project>
description: How to use cmux browser to verify <project> UI at <url>
type: reference
---

<project> dev server runs at <url>.
cmux surface handle: surface:<NN>
```

If a project's beats do not yet declare a surface id, ask the user for it before running cmux commands - don't guess.

**When to use:**
- Any UI/CSS/layout change - take a cmux screenshot, Read the image, and describe what you see before reporting done.
- Interactive verification - use `snapshot --interactive` to get element refs, then drive clicks/hovers.
- When the user says "refresh the tab in cmux" or similar, this is the tool they mean.

## Browser Tab Hygiene (Claude-in-Chrome MCP - MANDATORY)

Close your Claude-in-Chrome MCP tab group when browser work is done. Every session that opens a group and walks away leaves an orphaned tab group in the user's Chrome, and they pile up across sessions (flagged by Jonah 2026-07-11).

The rules:
- **Reuse one tab per session.** Call `tabs_context_mcp` once, reuse that tab with `navigate` for subsequent pages. Do not spawn a fresh group per verification.
- **Close before you finish.** When the browser verification for a task is done, call `tabs_context_mcp` then `tabs_close_mcp` on each tab id. Closing the last tab auto-removes the group. This is the browser counterpart of Teammate Teardown below - clean up what you opened.
- **Only the owning session can close its group.** `tabs_close_mcp` reaches only the current session's group, so a later session cannot clean up an earlier one's leftovers. Cleanup has to happen in-session, which is why this is a discipline and not something a future session fixes.

The `chrome-tabgroup-{track,clear,stop}.sh` hooks enforce this: track records an open group, clear drops the record when you close it, and the Stop hook blocks ONCE (per open-group burst, after the browser has been idle ~90s) to remind you to close before the session ends. A shell hook cannot close a Chrome tab - only your `tabs_close_mcp` call can - so the hook reminds and you act. The one gap the timer misses is a session that ends within ~90s of its last browser action; this rule is the backstop for that case. Threshold: `CHROME_TABGROUP_IDLE_SECONDS`. Tests: `test-chrome-tabgroup.sh`.

## Teammate Spawn Shape (cmux panes - read BEFORE composing the call)

In a cmux teams session, spawn a teammate by passing a `name` and OMITTING `run_in_background` entirely. That is the shape that produces a real visible pane. Do not pass `run_in_background: true` because the Agent tool's own schema advertises background as the default - that default is correct for ordinary subagents and wrong here, and the guard hook will deny it and cost you a turn.

Measured 2026-07-27 against 465 real Agent calls: 62 passed `true`, and every teammate that actually rendered as a pane was spawned with the key absent. The runtime selects the tmux backend from `name` plus a pane-capable session, never from this flag.

A PreToolUse hook cannot rewrite a tool argument, and an omitted parameter is invisible in the payload, so `agent-teams-guard.sh` can only correct this after the fact - it can never prevent it. This paragraph is the preventive layer; the hook is the backstop. If the session is not pane-capable (`TMUX` and `TMUX_PANE` are not both set) the guard says so plainly and does not deny, because named spawns there register as `in-process` and run invisibly no matter how the call is written. Recorded in session_2026-07-27_background-spawn-preference-defeat.md.

## Teammate Teardown (cmux subagent lifecycle - MANDATORY)

When a spawned subagent/teammate is absolutely done - its unit accepted, results relayed, no further tasking - STAND IT DOWN AND CONFIRM ITS PANE CLOSED. Do not leave idle teammates parked: they emit recurring idle-notification noise, hold a cmux pane, and keep a claude.exe process alive. "Available for a fresh dispatch" is not a reason to keep one warm; fresh dispatches get fresh contexts anyway. Teardown is NOT complete until `cmux list-panels` shows the teammate's surface GONE - standing an agent down but leaving its pane open is the exact half-teardown Jonah corrected on 2026-08-23.

THE ONE EXCEPTION: the justify-watch / any `justify-*` watcher agent is NEVER stood down or pane-closed on your own - ONLY the USER may (the justify-watcher shutdown guard). Everything below is for YOUR OWN spawned teammates.

Teardown is COOPERATIVE: the agent closes its OWN pane when it exits. There is NO clean force-close of a LIVE pane - the cmux-close-guard refuses one, and that refusal is exactly what protects the justify watcher. So the whole game is getting the agent to exit cooperatively.

1. Confirm the unit is FULLY closed first: work accepted, beats written, commits landed if due. Never tear down a teammate that may still need to relay results.
2. Send the sanctioned shutdown via SendMessage: `{"type": "shutdown_request", "reason": ...}`. The teammate approves, EXITS, and cmux closes its pane. (Originating a shutdown_request is allowed here - this standing rule is the ask.) Approval can lag a cycle or two; give it time and re-send once if needed.
3. VERIFY the pane is gone with `cmux list-panels` - the teammate's surface should no longer appear. Teardown is done ONLY when it is gone; do not report a clean team until you have looked.
4. NEVER `kill` a live teammate to force teardown. A hard kill does NOT close the pane: the teams backend treats the death as a CRASH and RESPAWNS the pane, and the respawned agent comes back WEDGED - it stops draining its inbox, so it no longer answers a shutdown_request, and you have made it UNCLOSABLE (a live pane the guard will rightly not force-close). Killing is what wedged two agents on 2026-08-23. This REVERSES the prior step-4 kill advice, which was wrong: the fix for a slow shutdown is patience with cooperative shutdown, never a kill.
5. Identify a pane -> agent DEFINITIVELY, never by type or elimination (general-purpose is ALSO the justify-watch pane shape; eliminating an "extra" general-purpose pane is what killed the daemon on 2026-07-12). Use `cmux list-panels --json`: each surface's `resume_binding.command` embeds `--agent-id <name>@session-<id>`. Match the surface to YOUR session's teammate name. Peers' surfaces and the justify watcher's surface appear in the SAME list and are OFF LIMITS.
6. FORCE-CLOSE is a rare last resort ONLY for a pane whose backing process is CONFIRMED DEAD (`ps` shows it gone AND it is not respawning) and positively identified as yours via step 5: `CMUX_CLOSE_CONFIRM=surface:<N> cmux close-surface --surface surface:<N>` - literal, on its own line (the guard blocks any close carrying a variable, and trips on a compound command that merely mentions the close token). Because a kill respawns rather than dies, a process is normally only truly "dead" AFTER a cooperative shutdown - at which point the pane is already closed - so force-close almost never applies.
7. If cooperative shutdown genuinely will not take after re-sending and waiting (a wedged agent, usually one a prior kill already broke), it is a harness wedge. Do NOT kill it (that worsens it). Tell the user it needs closing from the cmux app, and record the wedge in a beat.

