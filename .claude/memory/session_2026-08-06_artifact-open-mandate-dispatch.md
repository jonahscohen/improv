---
name: Artifact-open mandate hook trio dispatched
description: New verification-cluster trio that forces Claude to open/show any self-created artifact (image, doc, html, pdf) instead of leaving it in a random dir; modeled on screenshot-open-mandate
type: project
relates_to: [session_2026-08-05_elias-plan-recovered-and-build-dispatch.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

**Jonah's ask (2026-08-06):** when Claude creates an artifact/reference/document/image on its own, it must OPEN and SHOW it to the user - stop leaving things in random directories that Jonah has to dig up and beg to have opened. "You show me what you make."

**Design (dispatched to `surface-hook-builder`, opus-executor):** a three-hook trio in the VERIFICATION cluster, generalizing the existing screenshot pattern to all artifacts:
- `artifact-open-mandate.sh` (PostToolUse Write/Artifact/image-gen): appends an in-scope net-new artifact path to `~/.claude/.artifact-pending.$SESSION_KEY` (per-session, APPEND, dedup, require-exists, 1-day reaper - all copied from screenshot-open-mandate) and injects a "open it and show the user" reminder. Artifact-tool creations self-satisfy (publishing already shows it).
- `artifact-open-clear.sh` (PostToolUse Read/Artifact): clears a pending path when it is surfaced (Read renders images/pdf + surfaces doc/html; Artifact publish shows html; screenshot counts too). Shared SESSION_KEY derivation.
- `artifact-open-stop.sh` (Stop): blocks ONCE per burst listing every unshown artifact; clean stop re-arms; fail-open.

**Scope decision (narrow + hard exclusions - the repo has scars from over-broad detectors):** IN = images/visual (.png .jpg .jpeg .gif .webp .avif .svg .pdf), pages (.html .htm), documents (.md .txt .csv .rtf .docx). HARD-EXCLUDED = anything under a `.claude/` segment (NEVER a beat), temp/scratch (`/tmp`, `/private/tmp`, `/var/folders`, `*/scratchpad/*`), node_modules/.git/dist/build, internal repo docs (docs/superpowers/plans/, TASKS.md, MEMORY*.md, CLAUDE.md, README.md, CHANGELOG/PRODUCT/DESIGN.md, lockfiles), and source/config extensions (.sh .js .ts .json .css .yaml etc - a stylesheet/config is not a "document to show").

**Polarity:** DEFAULT ON via a DISABLE marker `~/.claude/.artifact-surface-disabled` (concise-style), so it is active immediately. Hard Stop-block enforcement (Jonah said "mandates"/"no more" = hard, not a nudge).

**Wiring contract:** same end-to-end path the ELIAS trio just followed (bd8f2a76) - cluster-wirings.json + install.sh verification cluster list (~2165) + browser-tree.json x3 + registry/parity + README count bumps (+3 hooks) + per-hook tests + Codex/independent review. No shared library, no exemption entries.

**Note:** the UserPromptSubmit hook mis-routed this to "sidecoach document flow" (false trigger on the word "document"); this is hooks infra, not design - ignored.

**Files touched:** none yet by lead (dispatch only); builder will produce the trio + tests + wiring + beats, all uncommitted for Jonah.
