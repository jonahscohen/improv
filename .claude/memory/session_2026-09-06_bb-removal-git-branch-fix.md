---
name: bb removal git-branch fix - stranded on feat, redone clean on main
description: Corrected the git-branch mess - the bb removal was committed to feat/bb-cmux-parity and never reached origin/main; redid a clean spawn-split removal directly on main and pushed. Includes self-analysis of the inaccurate "pushed to main" reports.
type: project
relates_to: [session_2026-09-06_bb-removal-integration.md, session_2026-09-05_icon-cascade-integration.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: git diff --cached reviewed (18 files/3136 del, all bb) + 0 lingering non-beat refs + origin/main bb-free after push
confidence: high
---

Jonah chose "Redo removal on main, push clean" after I surfaced that my prior "committed + pushed" report was wrong.

WHAT WAS WRONG (topology, mapped read-only before touching anything):
- The bb-removal commit 5e5a475d landed on branch feat/bb-cmux-parity, NOT main. I was on feat the whole time and never checked `git branch` before committing/pushing.
- `git push origin main` had pushed the LOCAL main ref (993148e7 = bb spawn-split release work), which MOVED origin/main from cfa303d4 -> 993148e7. That push added bb spawn-split TO origin/main - the opposite of removal.
- feat/bb-cmux-parity is strictly AHEAD of main (merge-base = main itself; 0 commits on main absent from feat). Feat adds browser/race/pane-spawn-guard plugins main never had, then removes all bb in 5e5a475d. So cherry-picking 5e5a475d onto main would try to delete files that don't exist on main -> redo-on-main was the correct path, not cherry-pick.
- CONFIRMED SAFE / nothing stranded: all session RULES/fidelity/icon commits (89bc1355, 15d17542, f6c74e67, 3697b1ff, 3f4741db, 336d8b66, cfa303d4) ARE ancestors of origin/main. Only the bb removal was missing. The icon cascade was never at risk.

THE FIX (done directly, not delegated - it is the delicate push-to-origin-main I botched once, and my hard rule is to personally eyeball `git diff --cached` before any commit/push to main):
- main's ENTIRE non-beat bb footprint (verified by `git grep` across all of main): bb-plugin-spawn-split/, docs/spawn-split-release/, docs/superpowers/plans/2026-09-05-spawn-split.md, docs/superpowers/specs/2026-09-05-spawn-split-plugin-design.md. NO wiring on main referenced spawn-split (cluster-wirings.json / settings.json = 0 matches; browser-tree.json / install.sh / plugin.json / marketplace.json do not exist on main - those were feat-only for the browser/race plugins).
- `git rm -r` the 4 footprint targets. Staged diff reviewed: 18 files, 3136 deletions, all bb; 0 beats touched, AGENTS.md untouched.
- 9 spawn-split BEATS on main KEPT (historical record; never rm .claude/memory).
- Committed on main (5598ef07), pushed origin main clean (993148e7..5598ef07). Verified origin/main == the commit I made == 5598ef07; content sweep (excluding beats) empty; 9 spawn-split beats kept. No bb branches on the remote.
- LOCAL CLEANUP (Jonah chose "Delete all local bb + worktrees"): deleted all 12 bb/* thread branches + feat/bb-cmux-parity (git branch -D). Removed the 4 stale agent worktrees (they backed no live process, unlocked, pointed at old non-bb commit d17c49e0 = artifact-announce-stop hook) + git worktree prune + deleted their 4 worktree-agent-* branches. FINAL: 0 bb branches, 0 worktree branches, only the main worktree remains. Nothing bb on origin.

SELF-ANALYSIS (mandatory - the reporting failure):
- Why it happened: I ran `git commit` then `git push origin main` without ever running `git branch --show-current`. I ASSUMED HEAD was on main because that is where I usually work, and the session-start gitStatus snapshot said "main" (a stale snapshot - I had since been moved onto feat/bb-cmux-parity, likely by the worktree/teammate setup for the bb work).
- How it went wrong: `git push origin main` does not push HEAD; it pushes the local `main` ref regardless of where HEAD is. So committing on feat + `push origin main` silently pushed a DIFFERENT commit than the one I had just made, and the push output ("cfa303d4..993148e7 main -> main") named a tip that was not my commit - the signal I initially glossed.
- The catch: I noticed the pushed tip (993148e7) != my commit (5e5a475d) and stopped to diagnose instead of trusting the "pushed" line. That catch is the correct instinct; the miss was not running it BEFORE reporting done.
- Durable lesson (reinforces the earlier `git diff --cached` lesson): before ANY commit/push, run `git branch --show-current` AND `git status -sb`; after a push, confirm `git rev-parse origin/<branch>` equals the commit you just made, not just that the push "succeeded". A green push line is not proof the intended commit landed.

FILES: bb-plugin-spawn-split/ (removed), docs/spawn-split-release/ (removed), docs/superpowers/plans+specs spawn-split docs (removed), this beat + MEMORY.md.
