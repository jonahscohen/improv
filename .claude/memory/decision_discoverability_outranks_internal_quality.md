---
name: Discoverability and reachability outrank internal quality on the scoreboard
description: A capability nothing can invoke scores ZERO regardless of how good it is inside - encoded as the top two metric families, with image generation as the live precedent
type: decision
relates_to: [session_2026-07-29_scoreboard-harness.md, session_2026-07-29_image-generation.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: discoverability and reachability sweeps run with controls
confidence: high
---

Choice made: on `benchmark/SCOREBOARD.md`, the discoverability and reachability families are ranked above every other family, and a capability that nothing can invoke scores ZERO no matter how good its internals are. No partial credit.

**Alternatives considered:**
- Weight all metric families equally: rejected because it lets a deep, unreachable engine average out to a respectable score, which is the exact self-deception this scoreboard exists to prevent.
- Score capability presence (does the code exist) rather than capability reach (can anything call it): rejected because by that measure sidecoach already wins on image generation, and the honest answer is that it loses.

**Why this one:** the measurements say our engine is deeper and our reach is nearly nonexistent, so a scoreboard that does not rank reach first would report a win we have not earned.

Measured, with controls planted before any zero was believed:

- Installed skill surface: **2 loadable files** (SKILL.md and CHEATSHEET.md, both symlinks). LOCALPROJECTX carries **39** markdown files per harness mirror, and mirrors into **14** agent-harness directories plus a plugin, a CLI, a browser extension, and a functions API. Ours installs to one directory.
- Shipped tools named anywhere a model can read them: **8 of 15** for us (53%), **27 of 36** for them (75%). The seven invisible ones: sidecoach-artifacts, sidecoach-build-report, sidecoach-detect, sidecoach-image, sidecoach-present, sidecoach-taste-check, sidecoach-daemon.
- `sidecoach-detect` - the detector that powers `/sidecoach audit`, the engine that wins us four failure-behavior rows - is named **zero** times in the installed surface.
- Capabilities they document that we do not expose at all: **11** (android, craft-floor, doctor, hooks, init, ios, live, new-work, operate, routing, visualize).
- Per-capability playbooks: **4** reference docs for us against **32** for them.
- Craft-teaching corpus reach: `polish-craft` reaches **1 of 26** flow handlers. Their craft-floor equivalent is loaded before every UI edit by instruction in the skill entry document.

**The precedent this rule is written from - image generation.** Sidecoach has `src/image-generation.ts` (38KB) plus `src/image-asset-verify.ts` (27KB), a genuinely stronger unit than theirs: it verifies geometry and format from actual bytes, catches blank and flat renders, checks ink-on-image contrast, and refuses to hand back an asset it has not checked. It is referenced by exactly two files - itself and its own CLI. No flow handler imports it. It appears **0 times** in the installed skill surface. Nothing can find it and nothing can call it.

Theirs is weaker inside and is wired to a dedicated asset-producing subagent, to the `context.mjs` setup script that runs once per session, and to a playbook. Theirs gets called.

That is scored as a **LOSS**. Better-and-unreachable loses to worse-and-wired, every time, and the scoreboard says so in a row rather than in a footnote.

**Revisit when:** a capability's reachability is demonstrated by a command that shows a flow, agent, or hook actually invoking it on a real input - not by a claim that it is importable, and not by adding its name to a doc while nothing calls it. Naming a tool in SKILL.md fixes discoverability only; reachability needs an invoker.
