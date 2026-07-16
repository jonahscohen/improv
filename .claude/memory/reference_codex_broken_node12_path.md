---
name: Codex CLI fails (SyntaxError) because the Bash-tool shell's node is v12
description: codex / codex --version / codex-review.py all die with "SyntaxError: Unexpected reserved word" at @openai/codex codex.js:188. Root cause is NOT codex - the non-interactive Bash-tool shell resolves `node` to v12.22.12, but codex 0.142.5 uses top-level await and needs node >=16. Durable fix = make codex resolve a node>=16 absolutely (codex-review.py or a PATH shim), independent of the shell's default node.
type: reference
relates_to: [reference_codex_review_tool.md, session_2026-07-15_stage3b-execution.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: reproduced (node --version = v12.22.12; codex engines >=16; codex.js:188 is a top-level await)
confidence: high
---

## SYMPTOM
Every Codex invocation from the Claude Code Bash tool fails immediately:
`codex`, `codex --version`, and `~/.claude/hooks/codex-review.py` all print
`SyntaxError: Unexpected reserved word` at
`@openai/codex/bin/codex.js:188` (`const childResult = await new Promise(...)`),
then exit. codex-review.py reports exit 5 (empty output). The codex-failure-watcher
hook fires ("CODEX FAILURE DETECTED").

## ROOT CAUSE (reproduced 2026-07-15, NOT theory)
- `command -v codex` -> `/Users/spare3/.nvm/versions/node/v20.19.6/bin/codex` (installed fine).
- BUT `node --version` in the Bash-tool shell = **v12.22.12**.
- codex `@openai/codex@0.142.5` declares `engines.node >=16` and uses **top-level await**
  (codex.js:188). Node v12 has no top-level await -> parse-time SyntaxError before any run.
- The codex launcher resolves node via `env node`, which finds the ancient v12 first on
  the non-interactive shell's PATH. So codex never reaches a compatible node.

This is an ENVIRONMENT/PATH problem in the Claude Code Bash tool's shell (its default
node is v12), NOT a codex bug and likely NOT broken for Jonah's interactive terminal
(where nvm may load a newer node). But it breaks all AUTOMATED cross-model review via
the Bash tool (codex-review.py, the codex:codex-rescue agent's underlying call).

## IMPACT
The produce-and-verify cross-model gate (CLAUDE.md Verification #8) cannot use real
Codex from an automated Bash context. The documented fallback (independent Claude
reviewer, fresh context) is the workaround and was used for Stage 3b.

## DURABLE FIX (candidates, for Jonah - lives in dotfiles)
1. Make `codex-review.py` invoke codex under an explicitly-resolved node >=16
   (find the nvm node>=16 bin absolutely, or `nvm exec` the bundled codex) instead of
   inheriting the shell's `node`. Smallest blast radius - fixes the reliable review path.
2. A `codex` PATH shim (the cmux-shim precedent, claude/cmux/cmux) that execs the bundled
   codex with an absolute node>=16, so ANY codex call works regardless of shell node.
3. Fix the Bash-tool shell's default node (ensure nvm default / PATH puts node>=16 first
   in non-interactive shells). Broadest, but touches shell-profile / harness node resolution.

Recommend (1) or (2) - a codex-owned resolution that does not depend on the ambient
`node`, mirroring how the cmux shim only ever execs an absolute path.
