---
name: U11 dependency-map correction to post-Wave-2 reality
description: Corrected the :4832 dependency-map page (index.html + serve.py) to the final post-Wave-1+U12 state - resolved findings, test-site-1 removed, cmux/settings.json reclassified live
type: project
relates_to: [reference_component_dependency_map.md, session_2026-07-14_parallel-dispatch-plan.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: browser
confidence: high
---

Wave-2 Unit 11 (executor, worktree /Users/spare3/Documents/Github/improv-wt/u11,
branch w2-u11 based on the post-U12 commit 2e72da44). Owned ONLY
`docs/dependency-map/index.html` and `docs/dependency-map/serve.py`. Corrected the
dependency-map page to the FINAL post-Wave-2 reality after re-verifying each fact
against the worktree (plan is a hypothesis, code is truth).

## Changes (each re-verified against the worktree, not the plan)
- `.justify` now references `/public/justify-core.js` (verified in .justify); finding 2 marked resolved, justify node debt cleared.
- `public/justify-core.js(.map)` now UNTRACKED (git ls-files empty); finding 3 resolved, public kid updated, stale "legacy" flag dropped.
- `reference/serve.py` defaults to 4831 (verified line 12); finding 9 resolved, reference node debt cleared, serve.py's own stale 4830 note fixed (item 7).
- `dogfood-teach-step1.ts` now fail-loud (throws; mkdirSync gone, verified); finding 11 updated to "partly resolved", sidecoach node debt updated.
- `test-site-1` REMOVED entirely (U12 retired it; gone from disk): node, islands entry, and edges deleted.
- `cmux/settings.json` reclassified from dead island to a LIVE supportive kid of cmux, with real edges verified in install.sh (2304 symlink, 899 active-detect, 1231 deactivate) and marked "disposition pending U8".
- Islands section removed (zero islands remain); dead island CSS, legend key, class label, ISLANDS array, and render loop pruned.
- Masthead: 16 -> 14 components, "11 open findings" -> "11 findings, 5 resolved", added "Updated 2026-07-15 (post Wave 2)" stamp.

## Decisions / judgment calls (flagged for the lead)
- **Findings 1 and 8 also marked resolved, beyond the enumerated 7 items.** Why: both verified now-false in the worktree (install.sh:468 = `$REPO_DIR/shaders`; sidecoach-sessionstart.sh has zero /Users/spare3). The page is titled "Honest findings" and its verify bar is "no now-false finding remains" - leaving them red would be incoherent next to the resolved 2/3/9. Finding 4's "install can never clean it" softened to reflect U1's new prune_broken_skill_symlinks (deploy-state orphan claim left, unverifiable from a worktree). These three finding edits are isolated to the FINDINGS array + node debt; trivially revertible if the lead wanted them handled elsewhere.
- **Component count 16 -> 14 (not 15).** cmux/settings.json became a supportive kid of cmux; the page does not count supportive kids (public, bin, beats/bench, beats/mcp-server, sidecoach/mcp-server) as top-level components, so it drops from the headline like they do. test-site-1 deleted is the other -1.
- **cmux/settings.json placed as a supportive kid of cmux**, not a top-level node: it is a config artifact of cmux, and "supportive" is the only class that fits a child-of-parent (no top-level foundation/tool/leaf/standalone slot fits a config file). Kids render via the parent card + detail panel, matching public/bin.

## Harness bug flagged (U7b territory)
The bash-guard memory-dirty commit gate BLOCKED the U11 commit even though the owned
files are outside .claude/memory - the exact false-positive Unit 7b targets. Also the
memory-nudge "install"-substring + bare-grep write-token fired "BASH WROTE FILES" on
my read-only greps (they named install.sh / used grep). This beat write is what clears
the gate. MEMORY.md was deliberately NOT edited here - the dispatch plan makes the
index a lead-serialized chokepoint; the lead recompiles at integration.

## Verification
- Served the worktree copy on 5177 (4832 taken by the main repo; 4899 collided with a
  pre-existing scratchpad server serving the wrong dir - a real port-collision caught
  by curl size mismatch, then a verified-free port picked). HTTP 200, 46127 bytes.
- Rendered in the Browser pane: no console errors; 14 nodes render; masthead/legend/tiers correct; no islands section; cmux carries a cmux/settings.json child.
- Clicked the cmux/settings.json child -> detail panel shows class SUPPORTIVE, "found LIVE by U1", evidence install.sh:2304/899/1231, debt "Disposition pending U8". Clicked justify -> debt "None. This component is clean." Escape closes the panel.
- Greps: no `/public/improv-core.js`, no `test-site-1`, no reference-context `4830` (only marketing-site's own :4830 remains, which is correct). serve.py parses.

## Lead accuracy fixes (round 2, 2026-07-15)
Lead Codex gate accepted the islands removal, cmux/settings.json reclassification, and the finding 1/8/4 edits, and asked for two accuracy tightenings (accuracy is the page's whole point):
- public/justify-core.js: "untracked" overstated it - in a fresh clone the file does NOT exist (gitignored generated build artifact; U2's git-rm-cached kept it only where built). Reworded the public kid desc+evidence and finding 3 to "no longer tracked - a gitignored generated build artifact, present only where built and absent from a fresh clone."
- Two evidence refs still cited marketing-site/index.html (justify :28, tilt-lab :623); marketing-site moved to ~/Documents/Github/improv-site. Repointed both to "improv-site/index.html:NN (was marketing-site/index.html:NN)", matching the marketing-site node's existing pattern.
Re-rendered on 5311: no console errors; confirmed finding 3, the public panel, and the justify/tilt-lab evidence refs read correctly.

## Files
- docs/dependency-map/index.html
- docs/dependency-map/serve.py
