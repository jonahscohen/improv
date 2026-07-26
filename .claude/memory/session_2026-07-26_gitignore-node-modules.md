---
name: node_modules untracked (Decision C resolved - Jonah chose gitignore)
description: Jonah ruled gitignore on the committed node_modules (the ~2473 tracked dependency files). The root .gitignore already had node_modules/ but the files predated it, so git kept tracking them - untracked with git rm -r --cached (kept on disk). Lean repo, npm install rebuilds.
type: decision
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: node_modules still on disk (31 packages, build unaffected); git check-ignore confirms now ignored; 2473 files untracked
confidence: high
---

Collaborator: Jonah. 2026-07-26. Decision C resolved.

Choice: gitignore node_modules (lean repo + `npm install`), over keeping it vendored.

**Alternatives considered:**
- Keep vendored (self-contained, offline/zero-install): rejected - the ~2473 tracked files were 74% of the tracked file count, pure bloat for a standard npm project with a lockfile.
- Gitignore + npm install (chosen): standard practice; the repo stays lean and `npm ci`/`npm install` rebuilds node_modules from the lockfile.

**Why:** standard, dramatically lighter repo, and there was no offline/zero-clone-install requirement that justified vendoring.

**How:** root .gitignore ALREADY had `node_modules/` (non-anchored, matches sidecoach/node_modules) - the files just predated it, so git kept tracking them. `git rm -r --cached sidecoach/node_modules` untracked all 2473 (index-only; files stay on disk so builds/tests/the running agents are unaffected). git check-ignore now confirms it is ignored.

**Revisit when:** if a genuine offline / zero-install distribution requirement appears (unlikely - the plugin manifest + lockfile cover distribution).
