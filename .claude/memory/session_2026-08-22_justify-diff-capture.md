---
name: Justify diff capture never wired (panel showed only filenames)
description: Review panel's GitHub-style diff overview + line-by-line diff render exists but 0/107 entries had diff data; justify-done now auto-captures the git diff
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: in-progress
confidence: high
relates_to: [session_2026-08-22_changes-panel-blank-crash.md]
---

Symptom (Jonah, 2026-08-22): a Review entry ("Made the unread message dots yellow") shows only "Files changed: <file>" in the list and only "<file> / Open With" in detail - no GitHub-style diff overview, no in-file line-by-line diff. Asked whether the diff feature still exists.

Findings (grounded in code + data before touching the app):
- The RENDER halves exist: `_renderFileDiffs` (detail line-by-line) at changes-panel.ts and the list-view +/- overview (listAdds/listDels). Detail reads `entry.diffs`.
- The PARSE half exists: cli/justify-done.sh `parse_git_diff` turns a raw `git diff` into per-file hunks and sends them as `diffs`.
- The CAPTURE half was NEVER wired: 0 of 107 persisted entries in ~/.claude/justify/responses.json have any diff (78 filename-only, 24 CSS-property changes, 5 empty, 0 diffs). justify-done reads `JUSTIFY_DIFF` from the env, but nothing ever set it - the worker (cli/justify-worker.sh) never captures a git diff and its agent instructions mention JUSTIFY_CHANGES but not JUSTIFY_DIFF. `JUSTIFY_DIFF` first appeared in commit a4db217d (same commit that added render+parse), so the feature shipped with its capture half disconnected.

Why the worker can't do it: justify-done is called BY THE AGENT during its run; the worker only sees the tree after the agent already reported. So the diff must be captured at report time, inside justify-done.

Fix (cli/justify-done.sh): when JUSTIFY_DIFF is unset, auto-run `git diff HEAD -- <files>` (fallback `git diff -- <files>`) anchored to `git rev-parse --show-toplevel`, scoped to exactly the reported files. At report time the agent's edits are still uncommitted and cwd is inside the project, so that IS this task's change set; scoping to the files keeps other pending edits out. Also added a "Diff: N files (+A / -R)." line to the executive report card when diffs are present - a user-visible signal AND an offline-testable proxy for the payload diffs.

Tests: cli/test-justify-done.sh 24/24 pass. Case 6c (throwaway git repo, committed file, uncommitted edit -> card shows "Diff: 1 file (+1 / -1)") and Case 6d (unchanged file -> no Diff line). A bash gotcha surfaced during this: `while read` drops the final unterminated line, so a single-file $FILES yielded an empty list and the capture silently no-op'd; fixed with `|| [ -n "$_f" ]`.

BLOCKER for ethos/web specifically (found while verifying live). The auto-capture is correct for a NORMAL repo (real history + uncommitted edits => `git diff HEAD -- files` IS the task's edit). But ethos/web has ONE commit ("Initial commit from Create Next App") and the ENTIRE app is uncommitted on top of it - every app file reads as a brand-new add (git diff HEAD -- chats.module.css = +2124 lines, the whole file, not the task's few-line tweak). AND the daemon runs mode=OWNER (an attached justify-warden session processes prompts, not the headless worker), so there is no per-task shell bracket to snapshot before/after. So in THIS project a clean per-task diff cannot be produced automatically by a git diff at report time.

Correct general fix needs a per-task before/after bracket: snapshot the working tree with `git stash create` (a commit object, no working-tree mutation) BEFORE the agent edits, export it, and have justify-done diff `<base>..now -- files`. That isolates the edit even over a giant uncommitted baseline - but it must be wired into whatever processes the prompt (worker or owner), which is a design choice pending Jonah's call (per-task commit vs bracket vs agent-passes-diff). Surfaced as an AskUserQuestion.

DECISION (Jonah, AskUserQuestion): "snapshot before each change" - the tool guarantees the diff, not the agent.

FINAL ARCHITECTURE (built + deployed, needs daemon restart to activate):
- Baseline captured at prompt CREATION (mcp-tools push_prompt -> ws.captureCurrentDiffBase(), which runs `git stash create` on the armed projectRoot, fallback HEAD - a commit object, no working-tree mutation). This is the earliest pre-edit point AND the one point every processing path shares (owner GET/claim, MCP get_prompts, headless dispatcher), so the baseline is always present. Stored as prompt.diffBase.
- Diff computed at report time in emitResponse: when input carries no diffs, `git diff <diffBase> -- <files>` on projectRoot, parsed by new server/parse-git-diff.ts (TS twin of the justify-done python parser) into the panel's FileDiff shape, set on the response. Scoped to reported files.
- Render side (_renderFileDiffs detail + list +/- overview) UNCHANGED and confirmed by code to consume this exact shape.

Codex review (folded, re-verified 341 vitest + 24 shell green, server tsc clean):
- P1a: justify-done's own `git diff HEAD` auto-capture REMOVED - it produced whole-file diffs in a dirty repo and, since an explicit diffs array wins, would OVERRIDE the correct daemon diff. JUSTIFY_DIFF is now an explicit override only.
- P1b: baseline capture MOVED from GET /prompts (which the MCP-owner never hits) to prompt creation, so the owner flow actually gets a baseline. Serve-path capture reverted.
- P2b: parser now names DELETION diffs from the `--- a/path` side (both TS and python) instead of dropping them.
- P2c: normalizeEntry drops diff elements lacking a string `file` (detail view does file.split) - a malformed explicit diffs array can't throw in _renderFileDiffs.
- P2a (accepted limitation): untracked NEW files show filename-only - `git stash create` + `git diff` omit untracked. Editing existing files (the common tweak) works.

KNOWN LIMIT: batch isolation - if several prompts are created together and edited sequentially, a later prompt's diff (scoped to its files) can include an earlier prompt's edit to a shared file. Single-prompt is exact.

Render NOT yet seen live with real data: the live daemon is armed + actively processing (owner mode), which clobbers any synthetic responses.json entry, and the fix needs a daemon restart to activate. Verify visually after `justify-serve --restart` + one real task.

Files touched: justify/server/parse-git-diff.ts (new), justify/server/ws-server.ts, justify/server/mcp-tools.ts, justify/cli/justify-done.sh, justify/cli/test-justify-done.sh, justify/core/normalize-entry.ts, justify/__tests__/server/parse-git-diff.test.ts (new), justify/__tests__/server/respond-parity.test.ts, justify/__tests__/core/normalize-entry.test.ts. Deployed to ~/.claude/justify.
