---
name: Improv local dev server ports (marketing-site + reference)
description: How to serve the two static sites in this repo and on which ports - marketing-site 4830, reference 4831, both via the no-cache serve.py
type: reference
---

Two static sites in the improv repo, each served by the no-cache dev server
`serve.py` (sends Cache-Control: no-store so a plain reload always shows working-tree
edits). serve.py serves its CWD, so run it FROM the site dir.

- marketing-site -> http://localhost:4830
  `cd marketing-site && python3 serve.py 4830`
- reference (the "reference site" - the full Yes& Claude Code stack docs:
  index.html + styles.css + main.js + DESIGN.md + PRODUCT.md) -> http://localhost:4831
  `cd reference && python3 serve.py 4831`  (serve.py copied in from marketing-site)

The reference site is a docs/reference manual: top nav (Install/Discipline/Memory/
Design/Components/Marketing site/GitHub) + a left sidebar grouped by "houses"
(Discipline, Memory, ...) + main content with install curl + quick-start. No justify
core injected by default (run /justify against it if you want in-browser tweaking).

Collaborator: Jonah.
