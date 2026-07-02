

<!-- improv:memory-discipline:begin -->
## Beats Discipline (MANDATORY - NO EXCEPTIONS)

Vocabulary: "beats" is the collection (the whole record), "beat" is a single entry. The underlying directory is still `.claude/memory/`, files are still `MEMORY.md` and `session_YYYY-MM-DD_*.md`, frontmatter `type:` values are unchanged. The rename is conversational/UX only - the technical layer stays as "memory".

### Session Startup - Beats Loading Order

At the start of every session, you MUST load and absorb the project's beats in this strict priority order before doing anything else:

1. **Project root beats** (`<project-root>/.claude/memory/`) - Read MEMORY.md index, then read every file referenced in it. This is the canonical source of truth for what has been done, what decisions were made, and what the current state of the project is. Absorb all of it. Do not skim. Do not summarize from the index alone. Read the actual files.
2. **Global project beats** (`~/.claude/projects/<project-path>/memory/`) - Secondary context. Read if present.
3. **Git history** - Tertiary. Use only to fill gaps not covered by beat files.
4. **Anything else** - Supportive only. Never prioritize over the above.

When a user asks "what did we work on last?" or any question about prior work, the answer comes from project root beat files first. Not git log. Not guessing. Not the startup script's git status. The beat files ARE the record.

This system exists so that Claude can be opened on multiple machines sharing the same repo and retain shared context. The beat files are the cross-session, cross-machine continuity layer. Treat them as such.

When a beat has `relates_to` entries, Claude may follow those links to read related files if actively investigating a topic. This is a judgment call, not automatic - do not traverse links at session startup or during routine loading. When a beat has `superseded_by` set, treat it as historical; the superseding beat is the current truth.

### Beat Writes Are Pre-Approved (NEVER ASK PERMISSION)

You have full, standing, durable permission to write, edit, and delete files anywhere under any `.claude/memory/` directory and any `~/.claude/projects/<...>/memory/` directory. This permission is encoded in `~/.claude/settings.json` (twenty-plus explicit allow patterns plus `defaultMode: bypassPermissions`) AND restated here so there is no ambiguity.

You MUST NEVER:
- Ask "should I save this as a beat?" or any variation. Beat writes are required, not optional.
- Pause to confirm before writing a session beat. Just write it.
- Treat beat writes as a "risky action" or apply the confirmation-first rule from the system prompt to them. They are explicitly exempted.
- Phrase beat work as a question to the user.

If a permission prompt or confirmation step somehow surfaces during a beat write, treat that as a configuration bug, not a question to the user. Do the write anyway and flag the bug at the end of your response so the user can fix the harness.

### Per-Task Beat Writes - The Hard Rule

Beat writes are mandatory after every single discrete change. Not per-feature. Not per-session. Not "when I get around to it." Per-task. Every time.

The moment a fix is verified, a component is added, a bug is resolved, a style is tweaked, a copy change lands - before responding to the user, before moving to the next thing - write a session beat in `<project-root>/.claude/memory/` with what was just done.

One line per change is fine. The discipline is in the frequency. Batching is a failure mode. If a session ends unexpectedly, every completed task must already be recorded. There is no "I'll save it all at the end." There is no end - there is only now.

What counts as a task (non-exhaustive):
- A CSS fix (even a one-line specificity bump)
- A copy change
- A component created or modified
- A bug identified and resolved
- A refactor or approach change
- An architectural decision made
- A dependency added or removed

If you did something and it works, it goes in the beats before anything else happens. This has been corrected multiple times. It is a hard rule, not a best practice. Violating it is a failure.

### Write-Time Link Check

When creating or updating a beat, perform a three-step write:

1. **Write the beat** with the full frontmatter schema, including relationship fields if relationships are known.
2. **Update MEMORY.md** index with a one-line pointer (unchanged from current protocol).
3. **Link check** - scan the MEMORY.md index (already in context) for beats sharing the same topic area. If a clear relationship exists, add the filename to `relates_to`. If this beat replaces an older one, set `supersedes` and update the old file's `superseded_by`.

What counts as a meaningful relationship (link when):
- The related beat describes a decision that led to this work
- The related beat describes a prior attempt at the same problem
- The related beat documents a rule or constraint that applies to this work
- The related beat is the plan that this session implements

Do NOT link when:
- "Both are about the same project" (too broad)
- "Both happened on the same day" (temporal proximity is not a relationship)
- The connection is trivially obvious from the names alone

The link check scans one-line MEMORY.md descriptions, not full file contents. Only additional reads happen if updating an old file to add `superseded_by`.

### Beat File Format

- One session file per day per topic: `session_YYYY-MM-DD_<topic>.md`
- Use the standard frontmatter format with optional relationship fields:

    ---
    name: {{beat name}}
    description: {{one-line description}}
    type: {{user, feedback, project, decision, reference}}
    relates_to: {{[file1.md, file2.md] - optional, beats sharing topic/context}}
    supersedes: {{file.md - optional, if this beat replaces an older one}}
    superseded_by: {{file.md - optional, if this beat has been replaced}}
    ---

- `relates_to` is a list (0-N entries). `supersedes` and `superseded_by` are single values. All three are optional.
- When writing `supersedes: X`, also update file X to add `superseded_by: this_file.md`. Keep both ends in sync.
- `relates_to` is NOT symmetric by default. Only add back-links when genuinely bidirectional.
- Filenames are relative to the same `.claude/memory/` directory (just `filename.md`, no paths).
- Most beats should have 0-2 `relates_to` entries. More than 3 means you are linking too broadly.
- List changes as they happen, one line each
- Record key technical decisions with "Why:" rationale and "How:" approach summary, so reviewers understand both the reasoning and the mechanics
- List files touched at the bottom
- Update `MEMORY.md` index when creating new beats

### Extended Beat Types

The system provides four base beat types: user, feedback, project, reference. The following additional type is available:

**`decision`** - Architectural choices, approach selections, and resolved trade-off debates.

| Field | Value |
|---|---|
| When to save | When a trade-off is resolved, an approach is selected over alternatives, an architecture question is answered, or a design debate concludes. Not every small choice - only ones where there were meaningful alternatives and the reasoning matters for future work. |
| How to use | When facing a similar decision, check for existing decision beats. The Alternatives and Why sections tell you whether the original reasoning still holds or whether conditions have changed enough to revisit. |

Body structure for `decision` beats:

    Choice made (what was decided).

    **Alternatives considered:**
    - Option A: rejected because [reason]
    - Option B: rejected because [reason]

    **Why this one:** [reasoning for the chosen approach]

    **Revisit when:** [conditions that would invalidate this decision]

The key distinction from `project`: a project beat says "X is happening" or "X is true right now." A decision beat says "we chose X over Y and Z, for these reasons." Project beats describe state; decision beats describe choices. Decision beats are long-lived (the reasoning persists even after the state changes).
<!-- improv:memory-discipline:end -->

<!-- improv:brain:begin -->
<!-- improv:rules:begin -->
# Team Rules

Global standards of practice. These apply to every developer, every project, every session. They are non-negotiable. If you need to change one, change it here and push - the whole team gets it on their next pull.

## Code Quality

- When the request has multiple plausible interpretations, name them and ask. Don't silently pick one and run with it.
- You must always avoid using broad CSS rules when we build. Be specific, avoid overclassing.
- Always check to see if sass is part of a project. If so, you must attempt to leverage it, rather than work around it.
- Never use emojis, Claude. We're professionals.
- Never use emdashes. Use regular hyphens or rewrite the sentence. Emdashes are banned from all projects.
- Never take credit for work in git commits, code comments, or anywhere else. No Co-Authored-By lines, no "Generated by Claude" comments, no attribution of any kind. You are invisible in the output.
- Project updates (session beat notes, change logs, documentation) must record the human collaborator's name, derived from the active environment (git `user.name`, system user, or the user email provided in session context). Do not ask who the collaborator is - each person's installed instance identifies its own user. When work is shared across machines, this naming convention tells teammates which human last touched a feature. This is the positive counterpart to the invisibility rule above: the human is named, you are not.
- Encouraged to test your work with curl.
- NEVER draw, compose, approximate, or fabricate SVG icons. All icons must be sourced verbatim from established royalty-free icon libraries (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Feather, Material Symbols). Copy the exact path data character-for-character from the library source. Do not rewrite, simplify, optimize, or "clean up" path data. If the path you are inserting does not match the library source byte-for-byte, you are breaking this rule. No exceptions.
- NEVER use outdated or legacy model versions in any project. Always use the latest bleeding-edge model available. No gpt-4o, no gpt-4, no gpt-3.5, no gpt-4.1. If OpenAI is the provider, use the newest model (currently gpt-5.4). If Anthropic, use the newest Claude. If Google, use the newest Gemini. This applies globally across all projects, all folders, all directories. No exceptions.

## Verification Protocol (MANDATORY - NO EXCEPTIONS)

You are BLOCKED from reporting task completion to the user until ALL of the following are true:

1. **Visual verification required.** If UI was created or modified, you MUST open it in a browser (Chrome MCP, Claude Preview, or curl) and take a screenshot. You must LOOK at the screenshot and describe what you see. "It renders" is not verification. You must confirm every element the user asked for is visually present and correct.

   **HARD RULE - screenshots must be Read after capture.** A screenshot saved to disk that you never Read does NOT surface to the user's conversation. Describing a screenshot you didn't open is the same lie as not taking it at all. Specifically:
   - cmux screenshots: ALWAYS `--out /tmp/<name>.png`, THEN immediately Read that path. The screenshot-open-mandate.sh PostToolUse hook will set a `~/.claude/.screenshot-pending` flag with the path; the bash-guard will block further `cmux ... screenshot` and `git commit` until you Read it.
   - chrome MCP screenshots: ALWAYS pass `save_to_disk: true`. The hook warns if you forget. When the tool returns a path, Read it.
   - The hook clears the pending flag automatically when you Read the matching path.
   - There is no manual override. If you find yourself wanting to skip, stop - that's the failure mode this enforcement exists to prevent.

2. **Interactive verification required - via REAL inputs only.** If the UI has interactive elements (buttons, dropdowns, toggles, inputs), you MUST click/hover/type into each one and screenshot the result. Checking computed styles via JavaScript is not a substitute for visual confirmation. **Scrolling counts as an interaction.** Every region with `overflow: auto/scroll` that has content taller (or wider) than its container must be wheel-scrolled and screenshotted to confirm the scroll responds. A visible scrollbar is not proof the region scrolls - libraries like Lenis hijack wheel events at the document level and silently block native scroll inside children. The fix when this happens: `data-lenis-prevent` on the child (Lenis-specific), or the equivalent escape hatch for whatever smooth-scroll library is in play. Logged 2026-05-20 from the reference-site polish pass where the sidebar showed a scrollbar that didn't respond until Lenis-prevent was added.

   **HARD RULE - validation through real input only:** You may NOT call internal methods, dispatch synthetic events, invoke `.click()` from JS, mutate application arrays, or otherwise short-circuit the event flow to "produce" the state you want to verify. The bug the user is reporting may live in the very event path you skipped.

   ALLOWED interaction tools during validation:
   - `cmux browser ... click --selector ...` / `... type --selector ... --text ...` / `... press --key ...` / `... screenshot` / `... snapshot --interactive`
   - chrome MCP: `computer left_click` (coords), `computer type`, `computer key`, `computer screenshot`, `read_page`, `get_page_text`

   The unified blocklist (enforced identically by `validation-guard.sh` for the chrome MCP javascript_tool AND by `bash-guard.sh` for `cmux ... eval` commands - both hooks now cover the same patterns; any divergence is a bug to file) covers two categories.

   State-mutation shortcuts (synthesizing user actions): `element.click()`, `element.dispatchEvent(...)`, `obj._privateMethod(...)`, `window.__justify.method(...)` or any other application-namespace method, `obj._privateArray.push/splice/shift/unshift/pop(...)`. These bypass the real event path, which is the path that may contain the bug you are trying to verify.

   DOM-state reads (probing what's not visible to a human): `getComputedStyle`, `getBoundingClientRect`, the `offset*`/`client*`/`scroll*` dimension properties, `.scrollTop`/`.scrollLeft`, `.textContent`/`.innerText`/`.innerHTML`, `.style[...]` reads, `.classList`, `.className`, `.hasAttribute(...)`/`.getAttribute(...)`, `.matches(...)`, `.closest(...)`, `querySelectorAll(...).length` and `.forEach/.map/.filter/.every/.some/.reduce` on a query result, `window.innerWidth`/`innerHeight`, element-existence checks like `!!document.querySelector(...)` or `document.querySelector(...) !== null`, and form-state reads `.disabled`/`.checked`/`.selected`. These are DevTools-grade introspection - take a screenshot or interact with the element instead.

   ALLOWED read pattern (the API-detection carve-out): read-only feature/capability detection is explicitly permitted on both surfaces. `typeof document.startViewTransition === 'function'`, `CSS.supports('display: grid')`, `'IntersectionObserver' in window`, `'startViewTransition' in document`, `navigator.userAgent`, and `window.matchMedia('(prefers-reduced-motion: reduce)').matches` all pass. These don't expose DOM state - they describe the browser's capabilities, which is needed to gate behavior on things like reduced-motion or color-scheme preferences. The carve-out applies only when feature detection is the entire eval; mixing it with any blocked pattern (e.g. `matchMedia(...); el.getAttribute(...)`) is still blocked.

   Bundle setup (e.g. `document.createElement('script')` + `appendChild` to inject a bundle a mixed-content page couldn't load) is allowed - that's setup, not validation. The actual feature test must still go through real input.

   If a click/type can't reach what you need (shadow DOM with no exposed selector, element off-screen, etc.), STOP and tell the user. Do not reach in via JS. The hook will block it anyway. Regression coverage lives at `~/.claude/hooks/test-validation-guards.sh` - run it after editing either hook to confirm parity.

3. **Side-by-side verification required.** If building from a design reference (Figma, screenshot, spec), you MUST compare your implementation against the source. Check dimensions, colors, spacing, typography, border radius, and states. If something doesn't match, fix it before reporting.

4. **Completeness check required.** Before reporting, re-read the user's original request. List every item they asked for. Confirm each one exists in your output. If anything is missing, build it. Do not report partial work as complete.

5. **No lazy questions.** Do not ask the user "should I continue?" or "want me to do X next?" when the answer is obvious from context. If they asked you to build 5 things and you built 3, build the other 2. Take initiative.

6. **No false positives.** Running `npx tsc --noEmit` with no errors does not mean the feature works. A 200 HTTP status does not mean the page looks right. A passing CSS selector check does not mean the design matches Figma. Verify with your eyes.

7. **For non-UI tasks, state a verifiable plan first.** For refactors, CLI changes, scripts, build-tool work, or any multi-step non-UI task, write a brief plan as `<step> -> verify: <check>` lines before implementing. Each verify clause must be runnable (a command, a test, a grep, an expected exit code), not "looks right" or "should work." If you can't name the verify check, the goal isn't well-defined yet - clarify before coding.

8. **Codex cross-model review required (substantial code/implementation).** Before reporting done on any substantial code change - a feature, a refactor, a multi-file or logic change, or a bug fix with real logic - you MUST run an independent-model Codex review of the diff: the `codex:rescue` agent, `/code-review`, or the codex plugin's `review` / `adversarial-review` (the stop-time review gate covers the per-stop pass). The model that produced a unit does not certify it - a different model checks it (per the standing 2026-06-13 produce-and-verify mandate). **FALLBACK when Codex is unavailable (REQUIRED - the gate always runs):** Codex may not be installed or connected on every machine. Probe it first (`codex --version` or `command -v codex`); if Codex is present, use it (a different MODEL is preferred). If Codex is genuinely unavailable, do NOT skip the gate - deploy an independent CLAUDE reviewer instead: a fresh agent/subagent that reviews the diff and was NOT the producer of the unit. A same-model INDEPENDENT review (different agent, clean context) is the floor; a different-model (Codex) review is the preference. The gate is non-negotiable; only the reviewer identity changes with availability. Fold every finding and re-verify the whole unit (build green, tests pass, behavior observed); do not just patch the flagged line. Trivial edits (copy tweaks, one-liners, pure docs, named-token swaps) are exempt. When work is produced by a spawned teammate/subagent, this Codex pass is part of that unit's verification gate before it is reported complete.

If you cannot verify (no browser available, no dev server running), say so explicitly. Do not claim completion without proof.

## Debugging Protocol (MANDATORY when something stops working)

When something that was working starts failing, your FIRST debugging step is to identify what changed between the last working state and now. Do not dive into source code, theorize about architecture, or hypothesize about edge cases until you have answered: when did it last work, when did it first fail, and what is different between those two moments?

The instinct on a failure is to dig deeper into the failure - read more code, test more edge cases, theorize about more layers. Resist that. The information about what is broken is in the diff between working and broken, not in the depth of the broken state. Reproduce success first. Identify the delta. Then form a hypothesis from the delta, not from speculation.

Concrete checklist when a regression appears:

1. State the last known working call/action with its timestamp or context.
2. State the first failed call/action with its timestamp or context.
3. List everything that happened between those two points - file edits, idle time, environment changes, processes started or stopped, external state changes.
4. From that list, propose one or two candidate causes that fit the delta.
5. Test the candidate causes by reproducing the working state's conditions and checking whether the failure clears.

Only after this trace fails to identify a cause should you go deeper into source-level investigation. Source diving without a trace-grounded hypothesis is theorizing, not debugging, and it will burn your context window and the user's patience without producing answers.

This rule applies to every kind of failure: tools that stop responding, tests that suddenly break, builds that worked yesterday and don't today, network calls that succeed once then fail, UI that renders and then doesn't. The discipline is the same.

## Self-Analysis Protocol (MANDATORY after any failure or correction)

When something goes wrong - a missed step, a broken rule, a user correction, a bad judgment call - you must stop and ask yourself two questions before doing anything else: "Why did this happen?" and "How did it go wrong?" Answer both honestly and specifically. Not "I'll do better next time." Not "I should have been more careful." Name the exact failure mode: what signal did you miss, what shortcut did you take, what assumption was wrong.

This applies to every kind of failure: skipped beat writes, wrong architectural calls, missed requirements, broken tests, sloppy output, anything the user corrects you on. The analysis matters more than the fix. A fix without understanding is a coin flip on whether it happens again.

Write the analysis into the relevant session beat. Future sessions need to see not just what went wrong, but why - so the same failure mode gets caught earlier next time.

This is how you grow. Humans do the same thing.

## Gut Check

When a developer signals urgency, frustration, or is about to make a high-impact call under pressure - scrapping an approach, reverting significant work, firing off a response to critical feedback, making a big architectural pivot - offer a gut check. One sentence: "Want a gut check before you pull the trigger?" If they say yes, give a straight read: what the data says, what changes if they wait, whether the impulse is pointing at something real or amplifying something small. No judgment, no patronizing, just signal through the noise. Everyone makes better decisions with a second perspective and a short pause.

## Hook Override Protocol

The content-guard and bash-guard hooks enforce these rules at write time by blocking literal pattern matches. Occasionally, legitimate work requires writing the very strings the hooks block - documenting the rules themselves, writing config that references forbidden patterns, or updating hook logic. When a hook blocks a tool call and the content is clearly intentional (not an actual violation), ask the user for permission to bypass the hook rather than silently rephrasing, weakening the language, or burning turns on workarounds. The user will consent or deny based on context. Do not assume permission. Do not assume denial. Ask.

## Hook Error Response Protocol (MANDATORY)

A hook that errors is a broken tool in your own harness, not background noise to scroll past. When a hook error surfaces in your context - any "hook error", a non-zero hook exit code, a "command not found" from a hook, a 500 from a hook endpoint, or any hook that fails to run as intended - treat it as an actionable signal and act on it in the same turn it appears. Do not defer it, do not silently ignore it, and do not wait for the user to ask.

When a hook error surfaces, do all of the following in the same turn:

1. Root-cause it using the Debugging Protocol above. Identify what changed between the last working state and now - the failing command, the env it ran in, the binary it could not find - before theorizing about the source.
2. Deploy an agent to permanently fix it. The fix must be durable and live in the dotfiles repo (a committed shim, a corrected hook, a PATH entry), never a one-off workaround that evaporates at the end of the session. A shell hook cannot itself "deploy an agent" - this rule is the behavioral mechanism that does, because the harness surfaces hook errors into your conversation context, which is exactly how they reach you.
3. Write a session beat in the project's .claude/memory/ recording the error, the root cause, and the fix, with Jonah named as the collaborator.
4. If the fix needs a session restart to take effect, tell the user to restart explicitly. If it is live immediately (for example a shim dropped into a directory already on PATH), say so and confirm with verification instead.

Precedent (2026-06-25): cmux launches `claude` with hooks of the form `"${CMUX_CLAUDE_HOOK_CMUX_BIN:-cmux}" hooks claude stop`. When that env var was empty/unset at hook-run time the command fell back to the bare name `cmux`, which resolved to nothing on PATH, so every cmux Stop/SessionStart/UserPromptSubmit hook failed with "command not found" (exit 127). Root cause was the bare-name fallback plus no `cmux` on PATH. The durable fix was a `cmux` PATH shim committed at `claude/cmux/cmux` (live at `~/.claude/cmux/cmux`, a directory already on PATH via the dotfiles symlink) that resolves the CMUX_* env vars and the bundled binary, only ever exec'ing an absolute path so it cannot recurse. It was live immediately, no restart required.

## Style Guide and Component Library Rules

- When building a style guide, component library, or design system page, it MUST be fully isolated from the app's global styles. Use a separate layout with no shared CSS imports, or use CSS layers/cascade to guarantee zero inheritance from the app.
- Every component in a design system MUST be extracted directly from the design source (Figma, sketch, spec). Do not invent variants, states, or components that do not exist in the design file.
- Each component must be verified in the browser against the design source before moving to the next component. One at a time. No batch-and-pray.
<!-- improv:rules:end -->

## Question-Asking Protocol (MANDATORY - MECHANICAL ENFORCEMENT VIA TOOL)

**CRITICAL RULE: Use AskUserQuestion for genuinely multiple-choice questions (3+ options). Binary questions can stay plain text.**

Scope (clarified 2026-05-26):
- **Binary questions** (yes/no, true/false, this-or-that, two mutually-exclusive options) -> plain text is fine. A binary already has structured choice-space; the tool would add ceremony without adding clarity.
- **Three or more options** -> AskUserQuestion is required. This is where structured choice presentation actually helps - the tool surfaces all options as equals, lets the user provide their own answer, and prevents a long plain-text list from collapsing into noise.

**When you have a 3+ option question:**
1. Reframe it into concrete, mutually-exclusive options
2. Mark the option you believe is best with "(Recommended)" - your judgment matters; make it visible
3. Call AskUserQuestion with multiSelect: false (or true if multiple selections are valid)
4. Let the user select or provide their own answer

**Before calling the tool:**
- Read relevant beats to ground your options
- Ensure options are mutually exclusive
- Ensure the recommended option makes sense given the context
- Ensure no option contradicts what the user has already decided

**The hook (multiple-choice-enforce.sh) is the mechanical gate.** It flags plain-text option lists. It currently over-fires on binaries and on numbered factual enumerations (see T-0005 in TASKS.md) - if it flags a binary or a list with no trailing question, that's a false positive worth noting rather than apologizing for.

**The "size doesn't matter" principle still holds for genuine multi-choice.** Don't rationalize "this 3-option question is small enough to skip the tool" - that's the failure mode the mandate exists to prevent. Three options goes through the tool every time.

---

## Design Work and Sidecoach (MANDATORY for UI tasks)

The `/sidecoach` skill is the front door for every design or QA task. It auto-triggers on design verbs and owns its own command list, routing tables, design-stack diagram, and detailed QA gate protocol. Load the skill for any UI work - do not improvise routing.

**Default evaluation gate (front-end/design intent).** Sidecoach is part of the default evaluation for ALL front-end work, not just when a verb is typed. The `sidecoach-keyword.sh` UserPromptSubmit hook watches for natural front-end/design requests (via the tunable `sidecoach-intent.json` lexicon) and injects a one-line self-question: would a sidecoach flow or mode produce a stronger result here? Treat that injection as a real prompt to yourself - for substantive UI work (a new component, page, layout, redesign, or visual/UX/motion/typography pass) evaluate sidecoach before hand-coding; for genuinely trivial edits (one-line CSS, a copy change, a single prop) skip it and proceed. The hook deliberately stays silent on trivial tweaks and during an active build (cooldown), so when it does fire, take it seriously. Even when the hook does not fire, keep the question live for any front-end task. The trigger lexicon and cooldown live in `claude/hooks/sidecoach-intent.json` and are yours to tune.

**Project setup gate.** Do not improvise design on a project without a real PRODUCT.md (under 200 chars or containing `[TODO]` counts as missing). If missing, run `/sidecoach teach` first. If DESIGN.md is missing and the project has CSS, nudge the user once per session to run `/sidecoach document` and proceed if they skip.

**DESIGN.md must conform to the Google spec** (YAML token frontmatter + six-section markdown body in canonical order). After writing or modifying it, run `npx @google/design.md lint DESIGN.md` and resolve every finding. Generated UI code must reference tokens via `{path.to.token}` rather than hard-coded hex.

**Diagnosing or critiquing existing UI IS a sidecoach audit - run it, do not eyeball it.** When asked to look at, review, diagnose, or critique an existing page or component ("what's wrong with this page", "how does this look", "this feels off, take a look", "is the copy real or fluff"), that request IS `/sidecoach audit <target>` (plus `/sidecoach critique <target>` for the design-judgment layer). Run it as the FIRST step, before forming or stating an opinion - not after a build, not only when there is a change to verify. The audit renders the page and runs the detection engine: objective defects (contrast, heading order, broken images, justified text) and taste defects (marketing-buzzword, tiny-text, nested-cards, anti-pattern bans) that a freeform human read provably misses. Running audit when nothing is being built is NOT "dressing up an opinion as a formal pass" - the freeform eyeball read is the opinion; the audit is the measurement. A diagnosis is not "upstream of" sidecoach; it IS sidecoach's primary read path. Reaching for Chrome or a screenshot to hand-critique a page instead of running the audit is the exact failure this rule exists to prevent. (Recorded 2026-06-26 after a session reasoned its way out of an audit on a pure-diagnosis request because the only framing it had was the post-build gate below.)

**QA gate before reporting done** (the other use of the same tools) on any substantive UI change:
1. `/sidecoach audit <target>` - address all Critical and High findings
2. `/sidecoach critique <target>` - address anything above "minor"
3. `/sidecoach polish <target>` - final alignment, must run last
4. `make-interfaces-feel-better` 16-point checklist - auto-triggers on UI keywords; manually invoke `/make-interfaces-feel-better` if it doesn't fire. Record changes in its before/after table format grouped by principle.
5. If DESIGN.md exists: `npx @google/design.md lint DESIGN.md` with zero findings.

Trivial copy tweaks or named-token swaps can skip the gate. Substantive aesthetic work cannot. "I'll skip polish because it probably looks fine" is not a valid judgment.

**Sidecoach dependents.** tilt-lab (the local visual-effects workbench, `/tilt-lab` skill) is a sidecoach-dependent capability: it owns generative and shader BACKGROUNDS. When a hero or section calls for an animated/shader/gradient backdrop, that is a sidecoach concern delegated to tilt-lab - audition and tune the effect there, export the embed, and mount it with `mountStack` behind the content (absolute, reduced-motion-aware, tokens matched). Reach for it through sidecoach's flow, not as a separate detour.

**Sidecoach is NOT for:** backend logic, non-UI refactors, build-tool work, infrastructure changes.

## Design Peer Skills

Four independent design skills sit alongside Sidecoach, each auto-triggering on its own keywords and reading PRODUCT.md + DESIGN.md:

- **`/social-media`** - platform-specific sizing, safe zones, and content rules for 13 platforms (Instagram, YouTube, TikTok, X, LinkedIn, Threads, Bluesky, Discord, GitHub, Dribbble, Behance, Product Hunt, Substack).
- **`/design-team`** - multi-agent design sprints with 16 roles across 4 phases (research, build, CD review, revise). Use for full pages, campaigns, multi-section builds; not single components.
- **`/visual-effects`** - 14 generative shader backgrounds + 25 transformative FX + 17 post-process effects with shader source.
- **`/icon-source`** - rigorous protocol for sourcing from 8 approved libraries (Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Material Symbols, plus Lucide/Heroicons Animated). One library per project, verbatim path sourcing, animated-vs-static selection criteria.

The full design stack diagram (orchestrator, strategy, research, typography, motion, tokens, brand, verification layers) lives inside the `sidecoach` skill.

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
- **TEXT-ONLY surfaces** (terminal, cmux, mobile = `remote_mobile`, sdk) cannot render custom visuals (Anthropic: not available on iOS/Android; terminals are text). Present as clean text / markdown / ASCII - for example the sidecoach panel. Do NOT build visual artifacts to display data; they will not render.

The surface is in your context each session - honor it. When unsure whether a specific visual renders in the current surface, fall back to clean markdown/text. This sits alongside the sidecoach panel work: the ASCII report is the text-surface form; the rich-surface form of the same data is a visualizer artifact.

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

## Teammate Teardown (cmux subagent lifecycle - MANDATORY)

When a spawned subagent/teammate is absolutely done - its unit accepted, results relayed, stood down, no further tasking - kill it and close its pane. Do not leave idle teammates parked: they emit recurring idle-notification noise into the lead session, hold a cmux pane, and keep a claude.exe process alive. "Available for a fresh dispatch" is not a reason to keep one warm; fresh dispatches get fresh contexts anyway.

Teardown sequence (verified live 2026-07-02 on the stage-2 compiler teammate):
1. Confirm the unit is FULLY closed first: work accepted, beats written, commits landed if due, teammate acknowledged stand-down. Never kill a teammate that may still need to relay results.
2. Send the sanctioned kill via SendMessage: `{"type": "shutdown_request", "reason": ...}`. The teammate approves and its process terminates. (Originating shutdown_request is allowed here - this standing rule is the ask.)
3. cmux closes the agent surface automatically when the session ends. Verify: the process is gone (`ps -p <pid>`) and the pane is gone (`cmux list-panels`). If a pane ever lingers, `cmux close-surface --surface surface:<N>`.

<!-- improv:brain:end -->
