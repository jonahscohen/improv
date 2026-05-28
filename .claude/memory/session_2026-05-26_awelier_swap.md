---
name: MADE Awelier serif swap on marketing-site
description: Replacing Source Serif 4 with MADE Awelier (local self-hosted OTFs) across marketing-site - Jonah switched from Bricolage plan after a pause. Weights Light/Regular/Bold copied to assets/fonts/. CSS variable + Google Fonts URL updates pending.
type: project
---

Jonah paused the Bricolage swap mid-question, then asked whether MADE Awelier was installed. Confirmed yes (3 OTFs in `~/Library/Fonts/`). He then said "Let's use those for all serifs on the site." Scope clarified: self-host the local OTFs.

**Scope of swap:**
- 5 HTML files (index, sidecoach, reference, improv, memory) load Source Serif 4 via Google Fonts URL
- styles.css line 33 defines `--font-display` with serif stack
- Weights used with `--font-display` in CSS: 400, 600, 700. MADE Awelier OTFs cover 300/400/700; semibold (600) will be browser-rounded to Bold (700).

**Steps:**
1. Created `marketing-site/assets/fonts/` and copied Light/Regular/Bold OTFs from `~/Library/Fonts/` (DONE)
2. Added 3 @font-face blocks in styles.css for weights 300/400/700 (DONE)
3. Updated `--font-display` from `'Source Serif 4'` stack to `'MADE Awelier', 'Iowan Old Style', Charter, Cambria, Georgia, serif` (DONE)
4. Removed `Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&` from all 5 HTML files (index, sidecoach, reference, improv, memory) Google Fonts URLs (DONE)
5. Verified visually via Chrome MCP at http://localhost:8765/ - light mode (index), dark mode (index), dark mode (sidecoach). MADE Awelier rendering correctly on all --font-display headings; Hanken Grotesk body intact; JetBrains Mono code intact; red accent underlines functional; theme toggle works. DONE.

**Verification findings:**
- Hero "A toolkit for working with Claude Code." renders in chunky display serif (MADE Awelier Bold). Distinct from previous Source Serif 4 - heavier, more architectural.
- Body paragraph remains Hanken Grotesk (humanist sans). No accidental serif inheritance.
- Mono code (`curl -fsSL...` + COPY) remains JetBrains Mono.
- sidecoach.html hero "A design orchestrator that refuses to skip the work." also renders in MADE Awelier with red accent underline intact.
- "Claude Code" kerning at hero size looks slightly tight (chunky display serif characteristic, not a regression).
- Layout, theme toggle, dark/light contrast all intact.

**Hook note:** Fix-gate fired on the second styles.css edit, but this is one coherent task (font swap across multiple files), not iterative bug-fixing. Silenced via `touch ~/.claude/.suppress-fix-gate` per the hook's own carve-out.

**License note:** MADE Awelier is commercial (MADE foundry). Self-hosting on a public site requires a webfont license. Jonah should confirm license permits this before pushing publicly. Local dev use is fine; production deploy is the gating concern.

**Note on hook false positive:** Earlier this turn, the multiple-choice violation hook flagged a previous response, but the matched lines it cited ("IB CDN 504s persist", "preprocess_paragraph() line 122") were not from any response in this conversation - they referenced IntelligenceBank and Drupal preprocess functions. The actual previous response was a factual yes/no answer with a bulleted file list, not options for the user to pick. Flagged plainly to Jonah per the hook's own carve-out instructions.
