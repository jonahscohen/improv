---
name: spawn-split SDD execution kickoff
description: Building the spawn-split bb plugin via subagent-driven development on branch spawn-split-plugin
type: project
relates_to: [decision_2026-09-05_spawn-split-plugin.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

Executing the approved spawn-split plan (docs/superpowers/plans/2026-09-05-spawn-split.md) via superpowers:subagent-driven-development. Jonah - collaborator.

- Branch `spawn-split-plugin` off main (cfa303d4). SDD ledger at .superpowers/sdd/2026-09-05-spawn-split/progress.md (git-ignored).
- Preflight rulings: build on the branch in the current checkout (sandbox blocks sibling worktree dirs); scaffold dir is `bb-plugin-spawn-split/` not `spawn-split/` (actual `bb plugin new` output); `bb plugin types` syncs SDK decls to node_modules (read .d.ts for the 4 contracts); Tasks 1-4 autonomous, Task 5 live install+browser pauses for user (mutates their running bb).
- 5 tasks: scaffold+pin-contracts, env resolver, spawn_split tool, frontend overlay opener, live verify.

Task 1 outcome (DONE_WITH_CONCERNS) drove a design pivot, all recorded as ledger rulings:
- Real pane primitive is BACKEND `bb.sdk.threads.open({ threadId, split })` (not paneAction, which only does pane-state ops). Spec pre-authorized backend-direct, so adopted.
- Plugin is now HEADLESS: frontend app.tsx removed, bb.app dropped. Task 4 (frontend overlay) ELIMINATED. Going headless also clears the bash-guard browser-verification commit gate that blocked the scaffold commit (no .tsx = no rendered surface).
- Corrected env literals from CONTRACTS.md: worktree = {type:"host", workspace:{type:"managed-worktree", baseBranch:{kind:"default"}}}; shared = {type:"reuse", environmentId}.
- Plan is now 4 tasks (T1 scaffold-headless, T2 env resolver, T3 spawn_split=spawn+open-split, T5 live verify). Plan doc superseded by ledger rulings; ledger is authoritative.

Task 1 COMPLETE: headless plugin committed 5cdbe6aa (server-only build green, no .tsx so commit gate cleared, better-sqlite3 removed). 2 deferred minors (stale package-lock better-sqlite3 entries; stray example-todos skill + ListTodo icon) folded into Task 3 cleanup.

Confirmed SDK contracts (CONTRACTS.md): spawn env worktree={type:host,workspace:{managed-worktree,baseBranch:{kind:default}}}, shared={type:reuse,environmentId}; pane open = bb.sdk.threads.open({threadId, split:"down|left|replace|right|top", file:null}) - backend-callable.

All 3 code tasks done: T1 scaffold 5cdbe6aa, T2 env resolver 7247f8f8 (3/3 tests), T3 spawn_split tool efe5bd81 (11/11 tests, task review PASS+Approved). Confirmed SDK field providerId (not provider); ctx={threadId,projectId,signal}; return {content,isError}.

Final whole-branch review (opus): NEEDS-FIXES 3 + test gap. Fix wave dispatched (FIX_BASE efe5bd81):
1. open-failure double-count (spawned.push before open -> isError false when pane never opened). 
2. leftover todo scaffold ships live bb.realtime.publish + rpcContract + todo CLI = headless violation + cruft (remove entirely).
3. ctx.signal never honored (keeps spawning after abort); + threads.get(shared) outside try/catch.
Security clean (count bounded 1-8, ctx-trusted ids, shared reuses only caller env).

Fix wave e4597c22 (14/14 tests): fixed open-failure double-count (push after open; open-fail -> failed w/ thread id), removed all todo scaffold (no realtime.publish), honor ctx.signal abort, threads.get(shared) in try/catch. Scoped re-review: ALL ADDRESSED, no new breakage.

CODE MERGE-READY. Branch spawn-split-plugin commits: 5cdbe6aa (scaffold headless), 7247f8f8 (env resolver), efe5bd81 (spawn_split tool), e4597c22 (harden). The plugin `bb-plugin-spawn-split` is headless backend-only: agent tool spawn_split { prompt, title?, provider?, model?, env(worktree|shared, default worktree), count(1-8), split(down|left|replace|right|top, default right) } -> threads.spawn(parent=caller, providerId) + threads.open({threadId, split, file:null}) per child; bounded output; isError only when zero opened.

Task 5 live verify (user greenlit install + CLI verify; branch left for review, no merge/PR): plugin installs+loads clean (logs "loaded"); tester agent on claude-code DID invoke spawn_split; bounded error output + isError worked. LIVE BUG the type-check missed: worktree spawn -> "HTTP 400: hostId is required unless workspace.type is personal". managed-worktree needs an explicit hostId (CONTRACTS.md wrongly had it optional). This is the classic type-valid != runtime-valid false-positive the live gate catches.

Fix wave 2 (running): resolveEnvironment gains hostId; runSpawnSplit resolves hostId = caller env host (environments.get) else primary connected host (hosts.list), inside bounded try/catch; env=shared unaffected. SpawnSplitBb mock surface extended; tests + CONTRACTS.md updated. Provider note: default spawn resolves to Codex (not ready here) and --service-tier fast failed at startup; use --provider claude-code for testers.

Fix wave 2 (commit 53a30f6a, 17/17 tests): worktree hostId resolved via caller env host (environments.get) else primary connected host (hosts.list; host entries use id + status:"connected"). LIVE RE-VERIFIED: env=worktree -> fresh isolated worktree child (printed 42); env=shared -> child reused caller env exactly (printed 7). Scoped re-review: ALL ADDRESSED.

DONE. Branch spawn-split-plugin (5 commits: 5cdbe6aa scaffold, 7247f8f8 env resolver, efe5bd81 tool, e4597c22 harden, 53a30f6a hostId) is complete + live-verified. Plugin installed+running in Jonah's bb (spawn-split@0.1.0). Branch left UNMERGED for review per Jonah's choice (no PR, github MCP was down anyway). Workspace/ledger/reports kept for review.

Deferred minors (non-blocking, left for Jonah): (1) host resolution runs before abort check = 1-3 wasted calls on already-aborted worktree spawn; (2) caught errors not logged via bb.log.error; (3) dead defensive branch in a test helper.

Usage: from any bb agent thread, call tool spawn_split { prompt, env:"worktree"|"shared", count:1-8, split:"down|left|replace|right|top", title?, provider?, model? }. Live demo done: spawned a hello agent into a split, it greeted Jonah, closed it.

SUBMISSION PHASE (user wants it official = bb-community): decisions locked - dedicated public repo jonahscohen/bb-plugin-spawn-split, MIT license, category agents-and-providers, source range ^0.1.0 tags vX.Y.Z. BLOCKER: gh auth token invalid -> cannot create repo/push/tag/PR this session; user must run `gh auth login`. Marketplace contracts read (get-bb/marketplace). Release polish DONE (commit b659a15d, 18/18 tests): bb.log.error, early-abort, dead-branch removed, MIT LICENSE, README+PLUGIN_OVERVIEW rewritten, metadata. Submission bundle STAGED at docs/spawn-split-release/ (entries/spawn-split.json validated, icons/spawn-split.svg = verbatim Lucide columns-2, overview/spawn-split.md, RELEASE_RUNBOOK.md 2-phase).

HANDOFF STATE: blocked only on gh auth (invalid). User chose: I execute the release + marketplace PR, approving each mutation. NEXT: user runs `gh auth login -h github.com`, then says "go"; I re-check gh auth status, then run Phase 1 (create public repo jonahscohen/bb-plugin-spawn-split from a source-only copy of bb-plugin-spawn-split/, tag v0.1.0, verify install) and Phase 2 (fork get-bb/marketplace, add staged entry+icon+overview, node scripts/build.mjs, PR), showing exact account/repo/commit/tag/PR + getting explicit yes before EACH release mutation. Inclusion is BB's decision. Do NOT attempt gh operations until user confirms re-auth.

EXECUTION (user re-authed gh + said go): gh auth valid only OUTSIDE sandbox (sandbox blocks keychain + proxy TLS x509 -26276), so all gh/git-push run with dangerouslyDisableSandbox. PHASE 1 DONE: public repo https://github.com/jonahscohen/bb-plugin-spawn-split (PUBLIC, main), tag v0.1.0 pushed (source-only export via git archive HEAD:bb-plugin-spawn-split, 12 files). Plugin now installed+running from git source (removed local-path install first). PHASE 2 in progress: forked get-bb/marketplace to jonahscohen, branch add-spawn-split, added entries/spawn-split.json (added required "overview" field ->./overview/spawn-split.md; category agents-and-providers; source git ^0.1.0) + icons/spawn-split.svg (Lucide columns-2) + overview/spawn-split.md. Validator (node scripts/build.mjs) requires the entry committed (first-addition date from git history) and an entry.overview reference. Next: commit in fork, re-run build.mjs, push branch, then PAUSE for explicit yes before gh pr create (the outward act). Entry now includes required overview field. Committing corrected entry on branch add-spawn-split in the fork ($TMPDIR/marketplace).

SUBMISSION COMPLETE:
- Phase 1: public repo https://github.com/jonahscohen/bb-plugin-spawn-split, tag v0.1.0; plugin now installed+running in Jonah's bb from that git source (git:...@^0.1.0).
- Phase 2: marketplace PR OPEN -> https://github.com/get-bb/marketplace/pull/201 (jonahscohen:add-spawn-split -> get-bb/marketplace:main; entry+icon+overview; build.mjs validated 123 entries). Awaiting BB maintainer review; inclusion is BB's decision.
Sandbox note: all gh/git-push required dangerouslyDisableSandbox (sandbox blocks keychain + proxy TLS). Beats hook re-arms after every file-writing bash, so a fresh beat is needed immediately before each git commit.
Optional follow-up: add screenshots/spawn-split/*.png (two live split panes) to strengthen the PR review; can amend the same PR.

SCREENSHOT DEMO (user asked): launcher child thr_hfyzkvq9cg called spawn_split -> grandchild agent thr_ypr94vrrdy opened in split pane, wrote a haiku ("Threads run in parallel, / minds working side by side, one / quiet task, many hands."). Real, via CLI. Screenshot tooling constraint: no cmux, no claude-in-chrome MCP, Pencil app not installed; only raw Google Chrome.app. bb UI is a plain SPA at 127.0.0.1:38886 (HTTP 200). SCREENSHOT CAPTURED via headless Google Chrome (--headless=new --screenshot) against the bb SPA at 127.0.0.1:38886 (local, no auth wall; renders the real authenticated UI with a temp --user-data-dir). Thread route = /projects/<projectId>/threads/<threadId> (found via --dump-dom sidebar hrefs; /thread/<id> falls back to home). Captured launcher thread (shows the spawn_split tool row "Spawned 1 split(s)" + spawned agent finished + haiku inline) and the spawned-agent thread (haiku). Files in the non-sandbox TMPDIR (/var/folders/.../T/shot-launcher.png, shot-agent.png). NOTE: sandbox TMPDIR (/tmp/claude-502) != non-sandbox TMPDIR (/var/folders) - do not pass files between them.
Caveat: screenshots show personal sidebar context (project "improv", machine "Yes-JCohen", thread titles) - flagged before publishing to the public marketplace PR #201. User chose: recapture cleaner then attach. Recaptured launcher at --force-device-scale-factor=2 (3360x2100) and sips-cropped (--cropOffset) to 2079x970 = conversation pane only (no sidebar/footer). Marketplace validator requires screenshot width >=1200px (first crop at 1039 failed). Attaching screenshots/spawn-split/spawn-split-demo.png to fork entry (screenshots field) + committing/pushing to update PR #201. DONE: commit 655c84b pushed; PR #201 confirmed via API to contain 4 files (entries/spawn-split.json, icons/spawn-split.svg, overview/spawn-split.md, screenshots/spawn-split/spawn-split-demo.png), 2 commits, state OPEN, validator green (123 entries). Full arc complete: plugin built+tested+live-verified, published to public repo + tag v0.1.0, submitted to bb-community PR #201 with a clean demo screenshot. Demo threads thr_hfyzkvq9cg (launcher) + thr_ypr94vrrdy (haiku agent) archived per user.

HOUSEKEEPING (user chose: archive demo threads + commit session docs + merge branch to main): demo threads archived. Committing this session's docs (docs/superpowers/specs + plans, docs/spawn-split-release/) + beats (.claude/memory/*) to spawn-split-plugin, then fast-forward merge to improv main (main was ancestor at cfa303d4). NOT committing pre-existing untracked AGENTS.md (not this session's work). Plugin also lives standalone at github.com/jonahscohen/bb-plugin-spawn-split; the in-repo bb-plugin-spawn-split/ copy stays on main as the source of record too.
