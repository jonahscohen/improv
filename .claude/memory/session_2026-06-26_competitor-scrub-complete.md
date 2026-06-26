---
name: competitor-scrub-complete
description: Scrubbed ALL competitor identifiers (the comparator tool's name AND the plugin author's handle) from the tracked repo + working tree; replacement = "oracle"; dependency removed (plugin install, extracted skill, comparator path genericized). Self-analysis - I first missed the author handle by tunnel-visioning on the single word the user named. Now 0 everywhere.
type: feedback
relates_to: [session_2026-06-26_oracle-scrub.md, session_2026-06-26_PR-opened.md]
---

Collaborator: Jonah Cohen. 2026-06-26. Jonah wants ZERO mention of the competitor anywhere in our repo. Replacement = "oracle" (the codebase's generic word for the comparator).

## SELF-ANALYSIS (the miss, per protocol)
First pass scrubbed only the comparator tool's NAME (one word). I left the plugin AUTHOR's handle in place - my sed turned `<author>/<tool>` into `<author>/oracle`, so the author handle (equally a reference to the competitor) survived. Jonah caught it ("why would I want any mention of <author> in our repo").
- WHY: I tunnel-visioned on the literal word the user first said, instead of scrubbing the competitor's IDENTITY comprehensively (tool name + author handle + plugin slug are all the same competitor). I treated "scrub X" as "find-replace the string X" rather than "remove all references to the entity X is."
- FIX/RULE: when scrubbing a named entity, enumerate ALL of its identifiers (product name, org/author handle, repo slug, URL, install path) up front and drive every one to zero - then VERIFY each is 0, not just the one the user typed.
- SAME FAILURE MODE AGAIN (caught at the commit-verify gate, not shipped): the first scrub renamed file CONTENT but not file NAMES - 7 tracked beat FILENAMES still contained the tool name (git grep greps content, not paths, so it read 0 while ls-files did not). Renamed all 7 (git mv) + fixed the relates_to/index references. ADD to the rule: scrub BOTH content AND filenames/paths, and verify with `git ls-files | grep` in addition to `git grep`.

## WHAT WAS DONE (both identifiers now 0 everywhere)
- Tracked repo: tool-name 0, author-handle 0 (git grep verified). Working tree (incl untracked beats): 0/0.
- Comparator path genericized (dynamic plugins-cache finder, env-var first; no hardcoded name).
- Dependency removed: the plugin install block dropped from settings.json; the extracted competitor skill (legacy-design-skill) `git rm`'d (37 files; build+test stayed GREEN because loadAbsoluteBans is inlined in reference-loader + readReferenceFile fails-soft to baseline).
- Eval data KEY renamed competitor->oracle consistently across producers/consumers/JSON.
- Stale cruft removed: 2 abandoned agent worktrees under .claude/worktrees (gitignored, held old copies) via `git worktree remove --force`; the gitignored .scorecard-cache cleared (regenerable, had the old key).
- PR #1 title+body rewritten clean.
- Build+test GREEN (57 suites) post-scrub.

## KNOWN RESIDUAL / FOLLOW-UPS
- Removing the extracted skill leaves graceful-degrade dead pointers (verb-command-registry SKILL_REF + reference-loader loadExtracted('legacy-design-skill') return null+baseline at flow runtime - no crash). Excising those pointers is a follow-up if we want the corpus fully gone.
- Git COMMIT HISTORY (commit messages) still references the competitor (no history rewrite per Jonah). A filter-branch + force-push would clean that if desired.

## Files touched
- ~150 tracked files (code/eval/beats), claude/settings.json, claude/CLAUDE.md (separate fallback rule), PR #1; dependency + stale cruft removed.
</content>
