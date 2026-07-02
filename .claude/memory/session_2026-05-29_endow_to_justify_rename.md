---
name: endow + improv -> justify rename (full unification)
description: Renamed the microadjustment tool to "justify" once and for all - unified the leftover improv AND endow names across live code/config/marketing/assets/build; historical beats/docs left untouched
type: project
relates_to: [decision_improv_renamed_to_endow.md, session_2026-05-26_improv_to_offers_rename.md]
supersedes: decision_improv_renamed_to_endow.md
---

Collaborator: Jonah. 2026-05-29. "Changing endow's name to justify once and for all." Scope (AskUserQuestion): FULL unification - rename BOTH lingering improv AND endow refs in live code to justify. Solo (not a team): completeness-critical mechanical sweep where the wedge-prone teams add risk without helping; grep-verified.

## Name history
improv -> offers -> endow -> justify. Prior renames were INCOMPLETE (1123 improv remnants survived into the endow era: dist still improv-*.js, .improv dotfile, global var Improv) and SLOPPY (the English verb "offers" had been blind-renamed to "endow" in prose). This pass cleans all of it.

## Scope
IN: justify/ (was endow/) source tree, public bundle, marketing-site, fonts, install.sh, deploy.sh, claude/settings.json, claude/CLAUDE.md, claude/RULES.md, claude/hooks/{bash-guard,validation-guard,test-validation-guards}.sh, task-list SKILL.md, sidecoach src refs (ENDOW_AVAILABLE/SOCKET_PATH, flow-n-endow test, dogfood-runner), .mcp namespace.
OUT (historical, untouched on purpose): .claude/memory/ + claude/memory/ beats, justify/.claude/memory/ beats, docs/superpowers/ plans+specs, .backups/. Renaming names inside dated records would falsify history.

## Method + collision handling
Python script (/tmp/rename-justify.py), dry-run then --apply: 68 files, 768 replacements.
- endow -> justify (case-aware x3). No English collision: the only "endow*" hits were the tool's own EndowSans font, not English words.
- improv -> justify with a collision GUARD: improv(?![ei]) so improve/improvement/improving/improvise (83 in-scope occurrences) are NOT mangled, while improv-core / __improv__ / .improv / improvReact ARE. Proven on test cases.
- Built bundles (public/endow-core.js minified, dist/improv-*.js stale) EXCLUDED from sed and REBUILT from source instead (deploy.sh's own rule: never hand-patch the bundle).

## Prose-corruption fix (the trap blind rename creates)
A prior rename had turned the English verb "offers" -> "endow" in CLAUDE.md ("the wrapper offers [s]..." had become "the wrapper endow..."). My pass carried it to "justify". RESTORED both Discord-launcher lines to "the wrapper offers". Confirmed CLAUDE.md + RULES.md have zero remaining prose-corruption after the fix.

## File/dir renames + rebuilds
git: endow/ -> justify/; 5 fonts endow{sans,mono,serif} -> justify{sans,mono,serif}.woff2; marketing-site/endow.html -> justify.html; .improv -> .justify; sidecoach task10-flow-n-endow.test.ts -> ...-justify...; deleted stale public/endow-core.js + dist improv-*. Rebuilt: justify tool (esbuild -> justify/dist/justify-{core,react,vue,svelte}.js, global var now Justify not Improv) and sidecoach (tsc). Regenerated public/justify-core.js from the fresh build.

## Verification
- 0 endow/improv content occurrences in scope (excl historical/CSS/improve-family). 0 endow/improv FILENAMES in scope.
- sidecoach tsc: only the pre-existing benchmark wart; validator-integration + phase-f + task10-flow-n-justify tests PASS.
- justify tool rebuilt clean; public bundle global = Justify.
- marketing justify.html serves HTTP 200, title "justify - microadjustment toolbar", 0 endow on page, loads styles.css + nav.js (intact, static page - no core bundle embedded), nav links across all 6 marketing pages point to justify.html.

## Open remainders (flagged to Jonah, not silently done)
1. MARKETING COPY: justify.html has 2-3 phrases that punned on "endow" (give/bestow) and now read awkwardly: "the exact property you want to justify it with", "Then start justifying", "visual / justify". A branding/voice call - needs an editorial choice, not a mechanical fix.
2. LIVE INSTALL: ~/.claude/improv (stale runtime dir from the improv era) is separate from the repo. The repo install.sh now installs "justify"; the user can re-run install.sh and remove the stale ~/.claude/improv. Not touched (live state, not repo).

## Files
- 68 files text-renamed; endow/ tree -> justify/; fonts/page/.improv/test renamed; dist rebuilt (justify + sidecoach); public bundle regenerated.
