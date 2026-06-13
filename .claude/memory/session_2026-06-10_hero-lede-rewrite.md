---
name: Hero lede rewrite - bigger, shorter, names Claude Code (Justify)
description: rewrote the hero lede to say what Improv is + mention Claude Code, and bumped its size
type: project
relates_to: [session_2026-06-10_hero-wordmark-shrink.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (prompt-1, .hero__lede <p>): "make text bigger, make sentence shorter, tell audience what improv actually is - you dont even mention claude".

Grounded in PRODUCT.md: voice plainspoken/specific/restrained; "tools for working with Claude Code"; justify/sidecoach/beats get equal billing = craft/design/memory; avoid SaaS-marketing + "we use AI" lines.

Changes:
- Copy: "Small, focused tools that fit into the loop you already have. No platform, no SaaS, no demos to request. Clone the repo, run the installer, keep what you use." -> "A toolkit for Claude Code. Small, focused tools for design, craft, and memory - clone the repo, keep what you use." (shorter; names Claude Code; says what it is; design/craft/memory = sidecoach/justify/beats; keeps clone-and-keep ethos).
- Size: `.hero__lede` font-size var(--size-xl) (1.5rem) -> var(--size-2xl) (2rem).

Status: DONE + verified + justify-done(prompt-1) sent. Visual (Chrome desktop): lede clearly bigger (2 tight lines vs old 3-line block), "A toolkit for Claude Code" front-and-center, legible, no clipping/collision.

Files: marketing-site/index.html (lede copy), styles.css (.hero__lede font-size). Working tree on main, uncommitted.
