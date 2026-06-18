---
name: Committed all accumulated work; excluded the justify TLS private key
description: big catch-up commit to main; caught that git add -A was about to commit a private key and gitignored the certs dir
type: project
relates_to: [session_2026-06-18_sidecoach-panel-skill-and-verify.md]
---

Collaborator: Jonah

Jonah asked to commit all changes. Working tree was a large accumulation (64 modified, 332
untracked) spanning this session (Sidecoach real panel, justify reliability/UX fixes, tilt-lab
Pixel, content-guard emoji-presentation) plus prior-session work (marketing-site, beats) and
rebuilt dist. Committed everything to main (this repo's normal commit line - every recent commit
is on main; the branch-first default does not fit a solo dotfiles main-line + an explicit
"commit all" request).

SECURITY CATCH worth keeping: `git add -A` staged `justify/server/certs/cert.pem` AND
`justify/server/certs/key.pem` - a TLS PRIVATE KEY. These are NOT in HEAD (new) and were never
gitignored. The justify daemon generates them per-machine on first run (ws-server `ensureCert`),
so they are machine-local secrets that must never be committed. Action: unstaged them and added
`justify/server/certs/` to the root `.gitignore`. Lesson: on a `git add -A` of a big working tree,
always grep the staged set for `\.pem$|\.key$|/certs/|\.env|id_rsa|/secrets/` before committing.

The repo intentionally tracks build artifacts (sidecoach/dist, public/justify-core.js, marketing
bundles) - so committing the rebuilt dist is consistent, not a mistake.

Files: .gitignore (added justify/server/certs/). Commit covers ~416 files.
