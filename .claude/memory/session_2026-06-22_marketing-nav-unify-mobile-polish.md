---
name: Marketing site nav unified to the sidecoach nav + mobile drawer polished (staggered reveal)
description: All 9 marketing pages now share the canonical sidecoach primary nav (justify, sidecoach, beats, foundation, reference, github) - cheatsheet link removed, github lowercased. Mobile drawer got a gentler reveal + staggered link cascade + reduced-motion fallback. Verified via Playwright on this host.
type: project
relates_to: [reference_dev_servers_ports.md]
---

Collaborator: Jonah Cohen

## Nav unification
Canonical = sidecoach's primary nav, minus cheatsheet, with github lowercased:
`justify | sidecoach | beats | foundation | reference | github`.
- 7 standard pages (beats, justify, foundation, demo, sidecoach-demo, reference, sidecoach): removed the `<li>cheatsheet</li>`, changed nav `GitHub` -> `github` (targeted `>GitHub</a></li>` so footers are untouched). Their order already matched once cheatsheet was dropped.
- index.html: replaced the nav-list - it had extras the others did not (a "Yes&" agency link, a "Back to top" link) and a different order. Now matches canonical.
- cheatsheet.html: its nav was bare `<a>` tags (no `.nav-list`), so the mobile drawer styles never applied. Converted to the canonical `<ul class="nav-list"><li>` structure. (cheatsheet.html the PAGE still exists; it is just no longer linked from the nav.)

## Mobile drawer polish (styles.css, @media max-width:767px)
- Gentler panel reveal: `.topbar nav` hidden transform `translateY(-100%)` -> `translateY(-10px)`, opacity transition bumped to `--duration-medium` (was fast) - the menu settles in rather than slamming down.
- Staggered link cascade: `.nav-list li` start `opacity:0; translateY(8px)`; `[data-mobile-open] .nav-list li` -> visible, with `:nth-child` `transition-delay` 90/130/170/210/250/290ms. Delays live on the OPEN state only, so closing is snappy (links fade out together, undelayed).
- Hamburger->X morph: already existed (unchanged).
- Reduced-motion: extended the `prefers-reduced-motion` block to zero the nav transitions/delays/transforms and force `.nav-list li { opacity:1 }` - drawer just appears/hides instantly.

## Verification (Playwright on this host, real DOM clicks + screenshots)
- Desktop (index + sidecoach): nav links read `["justify","sidecoach","beats","foundation","reference","github"]`; screenshots confirm no cheatsheet, lowercase github, no Yes&/Back-to-top on index.
- Mobile (390px, sidecoach): closed shows hamburger; clicking `.nav-toggle` -> aria-expanded true; the mid-open frame (150ms) captured the staggered cascade (justify in, sidecoach arriving, beats just starting); the settled frame shows all 6 links, opaque canvas, X icon, sidecoach current-page highlight. No page errors.

## Flags for Jonah (judgment calls / out of scope)
- Removed "Yes&" (yesandagency.com) and "Back to top" from the index HOME nav to match sidecoach. Easy to restore as home-only extras if you want them.
- Footers were NOT touched - they still say "GitHub" and have slightly varying link sets. Say the word to unify footers too.
- cheatsheet.html page is now unlinked (reachable only by direct URL). Did not delete it.

## Files touched
- marketing-site/{index,beats,justify,foundation,demo,sidecoach-demo,reference,sidecoach,cheatsheet}.html
- marketing-site/styles.css (mobile drawer reveal + stagger + reduced-motion)
