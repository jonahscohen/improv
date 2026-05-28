---
name: improv renamed to endow (2026-05-26)
description: The tool previously known as "improv" was renamed to "endow" on 2026-05-26. There was a brief "offers" intermediate naming earlier the same day that was superseded within minutes; final name is endow. All future references use "endow".
type: decision
---

**Choice made:** On 2026-05-26, the visual micro-adjustment tool previously called "improv" was renamed to "endow" throughout the codebase. Source identifiers, marketing-site URL, MCP server name, Skill name, global namespace - all switched in one coordinated rename. No backwards-compatibility shims.

**Naming history (within this single day):**
1. "improv" - original name (theatrical-improv vocabulary, but generic)
2. "offers" - intermediate; chosen to stay in improv glossary ("offer" = what an actor presents). Lived for ~30 minutes in code before superseded.
3. "endow" - final. Improv term meaning to assign attributes/properties to a scene partner or object. Direct semantic fit for the tool: you endow a UI element with new styles via direct manipulation. Picked over heighten/riff/beat for being most canonically improv-pedagogy and least tech-overloaded.

**Alternatives considered (final pass):**
- "heighten" (rejected: implies always-bigger; tool also used to quiet/distill)
- "riff" (rejected: too general, less canonically improv)
- "beat" (rejected: heavy tech-namespace collision with audio/timing libs)

**Why this one:** The user wanted a name that stays in the improv glossary, fits the tool's direct-manipulation essence, and reads cleanly as a CLI verb. "endow start", "endow stop", "endow status" all read naturally. The improv-pedagogy meaning ("endow this chair with the property of being a throne") maps directly to the tool ("endow this button with `font-weight: 700`").

**Public surface impact (same as the abandoned offers rename, just with the final name):**
- Marketing-site `/improv.html` -> `/endow.html` (old URL 404s; "/offers.html" also 404s since it was never deployed)
- MCP server name `improv` -> `endow` in settings.json
- Global namespace `window.__improv` -> `window.__endow`
- All ImprovCore/ImprovSans/ImprovMono/improv-* identifiers -> Endow/endow forms
- Misspelled `improveBaseUrl`, `improveAvailable` etc. -> endowBaseUrl/endowAvailable

**Revisit when:** N/A - permanent rename. Both "improv" and the intermediate "offers" names are retired.

**Cross-reference for future sessions:** when reading any memory file dated 2026-05-26 or earlier, mentally substitute "improv" -> "endow". When reading any memory file that mentions "offers" as a tool name (only this same day's files), mentally substitute "offers" -> "endow". The endow/ directory is the source. The endow.html page is the marketing-site entry. The MCP server is `endow`. window.__endow is the global.

**What was NOT renamed:**
- The English word "improve" / "improvement" / "improved" / "improving" in prose and unrelated identifiers
- The English word "offer" / "offers" / "offered" / "offering" in prose (the bulk replace was lexically precise enough to avoid corrupting these)
- Sidecoach's verb commands
- Backup directory `.backups/improv-dist-20260518-080711` retains timestamped name
- Historical memory files dated before 2026-05-26 retain "improv" verbatim
