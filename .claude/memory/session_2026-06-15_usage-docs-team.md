---
name: Usage-docs team + sidecoach-driven reference redesign (kickoff)
description: Jonah confirmed the answer (reference = a usage guide for peers, plain-language-first, progressive) and said proceed; deploying a team for progressive how-to-use content, then redesigning via sidecoach grounded
type: project
relates_to: [session_2026-06-15_sidecoach-grounding-and-modes-drift.md, session_2026-06-15_reference-remediation.md]
---

Jonah confirmed "Correct and proceed" on the brief:
- THE ANSWER: the reference answers a peer's "how do I use this?" with "say what you
  want in plain language; it does the work, checks it, remembers it." Usage guide,
  NOT internals encyclopedia.
- DOCS (this team): per component, PROGRESSIVE usage - (1) the one move, (2) the
  everyday workflow w/ a real example, (3) going deeper. Plainspoken Improv voice,
  non-CLI audience, current (intent detection not modes), zero codenames, zero dotfiles.
- REDESIGN (after content): I drive it through sidecoach GROUNDED from marketing-site/
  (shape -> craft -> audit -> critique -> polish), restrained per PRODUCT.md (equal
  billing, scan-in-5s, no "gospel" bravado).

Team "reference-usage"; authors write /tmp/ref-usage/<area>.json
{component, chapters:[{id,title,group?,contentHtml}]}. Agents: justify, sidecoach,
beats, foundation-setup (install/voice/discord/cmux), foundation-stack (design peer
skills + what-runs-for-you).

BUILT + clean (5 authors all delivered): reference.html reassembled from /tmp/ref-usage
= 22 usage chapters (justify 5, sidecoach 5, beats 4, foundation 8 across Install /
Voice & Discord / cmux / The design stack / What runs for you). Verified clean:
0 dotfiles, 0 mode words, 0 flowX, 0 T-codes; HTML well-formed; HTTP 200; sidecoach
grounds (run from marketing-site/, no generic personas).
- Reframed hero+title+meta from encyclopedia to USAGE: title "how to use Improv" (was
  "the gospel..."), h1 "How to use Improv, tool by tool." (underline on "use"), lede
  about the one move / everyday workflow / details, "written so anyone on the team can
  follow, not just the people who live in a terminal" (PRODUCT.md non-CLI audience).
  0 "gospel" remain.
DONE: verified dark theme in browser (hero usage-framed, Justify + Foundation read as
a usage guide); all 5 authors shut down + team "reference-usage" TeamDeleted.
OPEN (awaiting Jonah's go): modes CODE deletion (modes.ts / sidecoach-modes.json /
list_modes / resolve_keyword) - docs+comments now say retired, dead files still
present pending careful removal. Light theme not re-screenshotted on this exact build
(same verified token system).

Collaborator: Jonah.
