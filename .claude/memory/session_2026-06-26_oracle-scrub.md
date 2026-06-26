---
name: oracle-scrub
description: Jonah - scrub ALL mention of "oracle" from code, beats, and the PR, and REMOVE the oracle dependency. Replacement = "oracle". PR description already cleaned (0 mentions). A scrub teammate is doing the 150-file code/beats rename + dependency removal; lead gates + commits. No history rewrite.
type: decision
relates_to: [session_2026-06-26_PR-opened.md, session_2026-06-26_MISSION-COMPLETE-stage5-6.md, feedback_sidecoach_mission_beat_oracle.md]
---

Collaborator: Jonah Cohen. 2026-06-26.

## DECISION (AskUserQuestion): "Remove the dependency too"
Jonah wants ZERO mention of oracle anywhere in our code + beats, AND the oracle dependency removed. Replacement term = "oracle" (the codebase's existing generic word for the comparator). NOT a git-history rewrite (current tree + PR clean is enough).
**Alternatives considered:** textual-rename-only-keep-dependency (rejected - the dependency still names it via settings.json `repo: oracle` + the extracted skill); full-removal + history rewrite (not chosen - destructive force-push). **Why this one:** fully de-names the current tree + removes the dependency without a destructive history rewrite. **Revisit when:** if the PR's commit-message history mentioning oracle becomes a concern, do a filter-branch rewrite + force-push.

## SCOPE (1281 occurrences, ~150 tracked files; .scorecard-cache gitignored = skip)
- oracle is the third-party plugin oracle, installed + run as the eval COMPARATOR/oracle.
- FUNCTIONAL LANDMINES (handled with care, not blind sed): (1) oracle-comparator.mjs CACHE_DEFAULT hardcodes the oracle install path -> genericize to a dynamic plugins-cache finder. (2) claude/settings.json installs the plugin (`oracle@oracle: false` + the `oracle` marketplace block oracle) -> remove. (3) reference/_extracted/legacy-design-skill/ IS the extracted oracle skill -> remove IF build+test stay green (loadAbsoluteBans is INLINED in reference-loader.ts, so the dir is likely not read at runtime), else rename its content. (4) the eval `oracle` data KEY -> rename consistently to `oracle` across producers/consumers/JSON.
- DONE: PR #1 title+body cleaned (gh pr edit; grep oracle == 0 in title+body).

## EXECUTION
scrub teammate dispatched with the precise spec (genericize path, remove settings plugin, remove-or-rename legacy-design-skill, case-aware sed everywhere else, rebuild dist, verify build+test green + `git grep -ic oracle`==0). Lead gates + commits + pushes (the PR net-diff updates). No commit by the teammate.

## Files touched
- claude/settings.json PR description (done); code/beats scrub in flight by the scrub teammate.

## EXECUTION COMPLETE (scrub teammate, Jonah's machine, 2026-06-26)
All six steps done on sidecoach-phase2-reimplement. NOT committed (lead gates+commits).

1. FUNCTIONAL PATH: oracle-comparator.mjs CACHE_DEFAULT hardcode replaced with
   `findCachedOracleDetect()` - dynamically walks
   `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<skill>/scripts/detect.mjs`
   and returns the first existing match (or null) via a `safeDirs()` helper (added
   `readdirSync` to the node:fs import). resolveOraclePath() keeps SIDECOACH_ORACLE_DETECT
   first, then the finder. The functional code names no tool, so the later sed only renamed
   its prose comments. node probe -> resolves a real detect.mjs path, no throw.
2. SETTINGS.JSON: removed enabledPlugins[...@...] line + the oracle marketplace block via
   python json load/dump; JSON re-validated; live ~/.claude/settings.json untouched.
3. EXTRACTED SKILL legacy-design-skill: PATH TAKEN = REMOVED (git rm -r, 37 files).
   build+test stayed GREEN so removal is safe and kept. Safe because
   reference-loader.readReferenceFile() try/catches a missing file -> stderr warn + null +
   baseline fallback (graceful degrade, no crash). FLAG: verb-command-registry SKILL_REF and
   loadExtracted('legacy-design-skill',...) now return null+baseline at flow runtime
   (behavioral degradation of that taste corpus, not a crash) - follow-up if Jonah wants
   those pointers excised too.
4. CASE-AWARE RENAME (3 sed passes, case-correct) over all 162 tracked text files EXCLUDING
   sidecoach/dist; covered beats, eval code+corpus JSONs (incl. the data object KEY -> renamed
   consistently across producers+consumers so they stay in sync), README/selection-method.md,
   external _extracted docs, MEMORY.md, and the tracked settings backup. No key collision
   pre-existed. All corpus JSONs re-validated.
5. REBUILD: npm run build regenerated dist clean.

VERIFY (all pass): npm test 64 suites green (exit 0); `git grep -ic` across whole repo = 0;
node -c scorecard-score.mjs PARSE OK; oracle key count in scorecard.json = 49; git status
--short = 232 (37 del + 186 mod + 9 pre-existing untracked).

LEAD GATING FLAGS: (a) the tracked settings backup had its entries sed-renamed (now point at
a nonexistent oracle/oracle plugin) - harmless backup, lead may prefer to delete/strip it;
(b) this scrub-topic beat + the lead decision beat are UNTRACKED and contain the term by
necessity (a record of the removal) - decide whether to commit/rename so the committed tree
stays at zero; (c) the one piece of new logic (findCachedOracleDetect) is ready for the
lead's Codex gate (sed renames + deletion are mechanical/exempt).
</content>
