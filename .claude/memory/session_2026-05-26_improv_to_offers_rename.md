---
name: improv -> offers full rename executed
description: Coordinated rename across 118 files - source identifiers, font filenames, marketing-site URL, MCP namespace, global window namespace, file paths, directory paths. Historical docs preserved.
type: project
relates_to: [decision_improv_renamed_to_offers.md]
superseded_by: decision_improv_renamed_to_endow.md
---

Executed the improv -> offers rename per the decision memory. Text replacement pass 1 (118 files) caught the bulk; pass 2 (54 files) cleaned up embedded PascalCase (`detectImprovUrl`, `isImprovElement`), the misspelled `improvePort` var, and font filenames (`improvsans`/`improvserif`/`improvmono`).

**Text replacement patterns applied:**
- Pass 1: case-aware `(?<![a-zA-Z0-9])improv(?![a-z])` family + specific misspelled-var renames
- Pass 2: `Improv(?=[A-Z])` for embedded PascalCase, `improvsans/serif/mono` for font filenames, `improvePort` cleanup

**File and directory renames:**
- `improv/` directory -> `offers/` (top-level source dir)
- `marketing-site/improv.html` -> `marketing-site/offers.html`
- `public/improv-core.js` -> `public/offers-core.js`
- `improv/fonts/improvsans-400.woff2` -> `offers/fonts/offerssans-400.woff2` (+ 4 more font files)
- `sidecoach/src/__tests__/task10-flow-n-improv.test.ts` -> `task10-flow-n-offers.test.ts`

**Build artifacts NOT touched** (will regenerate on next build):
- `offers/dist/*.js` files (still named improv-*.js until rebuild)
- `sidecoach/dist/__tests__/task10-flow-n-improv.test.*`

**Excluded from rename (historical/external):**
- All `.claude/memory/` files (except the new rename-marker decision file)
- `docs/superpowers/plans/*` and `docs/superpowers/specs/*`
- `sidecoach/reference/_extracted/` external references
- `SIDECOACH_AUDIT_REPORT.md`, `sidecoach/PHASES_1_TO_4_COMPLETE.md` (audit/milestone snapshots)
- `.backups/` directory

**Preserved English words verified intact:**
- "improve", "improvement", "improvements", "improved", "improving" - all preserved correctly via `(?![a-z])` negative lookahead
- "improvise", "improvising", "improves" - same

**Remaining verification needed:**
- Open marketing-site /offers.html in browser, confirm page loads with renamed copy, theme toggle works
- Check `claude/settings.json` mcpServers - needs improv -> offers update if not caught by text pass
- Check `install.sh` references improv-vs-offers paths correctly
- Check `claude/hooks/*.sh` references still resolve

Pending after verification: rebuild offers/ (next time it's used) to regenerate dist/ artifacts with new filenames.

**SECOND RENAME 2026-05-26 (offers -> endow):** Same day, user requested second rename within improv glossary. Picked "endow" (improv term meaning to assign attributes to a scene partner/object). Mirror execution: bulk text replace, file/dir renames, settings.json + install.sh updated.

**Bug found and fixed during second rename:** The `^\./docs/superpowers/` exclusion filter in the bulk grep command did not work because `grep -rl . ...` outputs paths as `docs/superpowers/...` (no `./` prefix). All historical docs got rewritten in BOTH renames. Recovery: `git checkout HEAD -- docs/superpowers/ SIDECOACH_AUDIT_REPORT.md sidecoach/PHASES_1_TO_4_COMPLETE.md sidecoach/reference/_extracted/` restored them to pre-rename state. Memory/ was correctly excluded via `--exclude-dir=memory` (a real grep flag, not a pipe filter).

**Three English-prose false positives** corrupted by `offers(?![a-z])` matching English "offers" the verb. Manually fixed:
- install.sh:82 (Discord component description: "offers the interactive onboarding walkthrough")
- test-site-1/documentation.html:667 ("When Sidecoach offers reference artifacts")
- reference/index.html:826 ("Cold (no bot): offers setup walkthrough")

**Final canonical name: endow.** All source identifiers, paths, font filenames, marketing-site URL, MCP server name, global namespace, Skill name = endow.

**Lesson for future bulk renames:** grep -rl exclusion filters must match the actual output format. Test the filter on a sample path BEFORE running the destructive command. Also: when renaming a word that has English-language usage (like "offers" the verb), use a tighter regex that requires context only the tool name appears in (e.g., "/offers" or "offers/" path separators, code-identifier contexts).
