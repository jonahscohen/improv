---
name: Marketing footers unified + cheatsheet.html deleted
description: Replaced every page's footer nav with one canonical footer (Home, justify, sidecoach, beats, foundation, reference, github) and deleted the now-unlinked cheatsheet.html. Verified via Playwright (footer link parity + cheatsheet 404).
type: project
relates_to: [session_2026-06-22_marketing-nav-unify-mobile-polish.md]
---

Collaborator: Jonah Cohen

Follow-up to the nav unification, per Jonah's multi-select (build drift guard + unify footers + delete cheatsheet; he did NOT pick restoring the home-nav Yes&/Back-to-top, so those stay removed).

## Footers
Footers varied per page (each omitted its own page; index's footer was just a lone GitHub link). Replaced every `<nav aria-label="Footer">` with one identical canonical footer via an indentation-preserving python pass:
`Home | justify | sidecoach | beats | foundation | reference | github` (github lowercased to match the nav).
Applied to: index, sidecoach, justify, beats, foundation, reference, demo, sidecoach-demo. Verified: sidecoach + index footers both read the identical 7-link set; footer screenshot confirms render.

## cheatsheet.html deleted
`git rm -f marketing-site/cheatsheet.html` (plain `git rm` refused because the file had this-session edits). Safe: the only "cheatsheet.html" reference anywhere was a code snippet inside the page itself - no inbound links from other pages. Verified the URL now 404s. Zero capital `>GitHub<` remain across the site.

## Flag (not done)
styles.css still has ~22 orphaned `.cheatsheet__*` rules (the deleted page's styles) - harmless dead CSS, left in place. Offered to remove on request.

## Files touched
- deleted marketing-site/cheatsheet.html
- marketing-site/{index,sidecoach,justify,beats,foundation,reference,demo,sidecoach-demo}.html (footer nav)
