---
name: Marketing-site stats recount (prompt-4) - applied independently
description: Traced all 6 marketing-site stats to repo sources; corrected Validators 218->30 (fiction->traceable) and Enforcement hooks 49->51; the other four verified unchanged
type: project
relates_to: [session_2026-06-15_justify-marketing-queue.md]
---

Jonah: "Make the changes to stats independently" + "recount validators/components
properly." Did the full trace and applied. Every stat now maps to a real source:

- Design flows = 26 (sidecoach/src/flows.ts, 26 flow ids) - UNCHANGED.
- Validators = 30 (was 218). 218 had NO provenance: never committed
  (git log -S"218" on index.html = empty), matches no single source. The real,
  doubly-confirmed count: sidecoach/src/validators/checks/ exports exactly 30 check
  functions (a11y 3 + anti-pattern 6 + polish 19 + theming 2 = 30), AND
  product-rule-registry.ts registers exactly 30 ruleIds with the SAME category
  breakdown (a11y 3 + anti-pattern 6 + polish 19 + theming 2). Two independent
  sources agree on 30. 218 was fiction; 30 is the canonical "design and code checks
  run automatically" count. CHANGED 218 -> 30.
- Enforcement hooks = 51 (was 49). claude/hooks/*.sh = 51 raw hook files (+2 since
  the stat was last set). CHANGED 49 -> 51.
- Skills = 17 (claude/skills/*/SKILL.md, 17) - UNCHANGED.
- Installable components = 27 (install.sh KEYS array): 14 base
  (brain config memory skills statusline cmux nvm ampersand discord voice-input
  voice-output reflect sidecoach task-list) + 11 design skills + tilt-lab + lotus
  = 27. The 3 --personal keys (ghostty shaders justify) are deliberately hidden
  (not in TUI/--help/--only) so they're correctly excluded. UNCHANGED.
- Design verbs = 22 (claude/hooks/sidecoach-verbs.json, 22 verbs) - UNCHANGED.

DECISION on Validators (high-impact, public hero number): Jonah said do it
independently, so I applied the defensible reproducible figure (30) rather than
leave an unverifiable 218 standing - per the "is it real or fluff" reality-check
ethos. If 218 was meant as a broad system-wide aggregate (e.g. hooks 51 + rules 30
+ taste/typography validators + design.md lint + tests), that set is undefined and
unreproducible; flagged to Jonah so he can pick a broader framing if he wants one.

Files: marketing-site/index.html (.stats: Validators 218->30, hooks 49->51).
Verification + justify Validating-stage flow: pending in same session.
Collaborator: Jonah.
