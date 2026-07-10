---
name: Retired-names scrub + tactical-polish rename - full de-naming across code, docs, beats, installer
description: Two-phase execution of Jonah's retired-names directive - phase 1 scrubbed the shorthand and sidecoach's old name; phase 2 (after Jonah corrected my narrow reading) renamed the polish skill itself to tactical-polish, vendored it, cut the upstream npx pull, and scrubbed every form of the old name from all surfaces; content-guard enforces all of it
type: project
relates_to: [feedback_retired_names_banned.md]
---

Collaborator: Jonah. 2026-07-03.

## Phase 1 (initial, too-narrow reading)
Scrubbed the four-letter shorthand from 4 beats + the 4 extracted reference docs, and sidecoach's pre-rename name from 7 live skill files (including broken old-name /commands now routed to /sidecoach teach|document|audit|critique|polish, a stale "npx <oldname> detect" rewritten to the rendered detection engine, and dead brand.md/typography.md file references described generically). Added the first content-guard rule. Codex reviewed clean; its non-string file_path note folded via str().

## SELF-ANALYSIS - the interpretation miss
I read "not mentioned at all" as banning only the shorthand, kept the full name as canonical, and thereby EXPANDED the full name into beats and docs during the phase-1 scrub. Jonah corrected: "But you just wrote them into beats anyway." Why it went wrong: the orchestrator half of the directive mapped cleanly to rename-residue cleanup, and I pattern-matched the other half to the same shape instead of asking the one binary question up front. The failure mode: choosing the low-risk reading of an ambiguous directive and proceeding, instead of naming the interpretations and asking (the team rule exists precisely for this). Cost: a wasted wrong-direction pass over ~50 files.

## Phase 2 (Jonah's ruling via AskUserQuestion: rename to tactical-polish)
- SKILL RENAMED + VENDORED: the polish skill now lives in-repo at claude/skills/tactical-polish/ (5 files, all name forms scrubbed, emdashes converted). Live install at ~/.claude/skills/tactical-polish/ (the old live path was a symlink into ~/.agents/skills/ - both the link and the upstream stash removed so nothing resurrects the old name). Harness confirmed the skill registers as tactical-polish.
- INSTALLER: install.sh no longer pulls the skill from the author's upstream registry via npx - it copies the vendored files like every other bundled skill. Component key renamed (tactical-polish), menus/paths/status/uninstall updated; uninstall also purges a legacy-named dir for old installs. bash -n clean.
- SIDECOACH CODE: reference/_extracted dir renamed to tactical-polish (git mv) + 5 src-file strings (flowJ description, trigger pattern, taste-validator hover-lift message, loader docstring, flow-handler comments) + test fixtures updated in parity (2 mcp-server transcripts, 1 migration-harness golden). npm run build green (codegen no drift) + ALL 65 test suites pass.
- DOCS: claude/CLAUDE.md QA-gate step 4 now invokes /tactical-polish; README, the sidecoach audit report, reference/index.html, 8 repo skill files, 6 live peer skill files - all scrubbed.
- BEATS: 42 files updated corpus-wide; 4 beat files renamed via git mv (2026-04-25 skill-wiring, 2026-05-25 absorption, both 2026-06-24 gap beats) with every inbound wiki-link and prose reference fixed; MEMORY.md + archive pointers updated.
- NOT touched: sidecoach/eval/corpus/*.html (coincidental base64 substrings in frozen captures, not mentions).

## Enforcement (content-guard, repo + live same file)
Markdown-scoped rule blocks, word-bounded case-insensitive: the four-letter shorthand, the old full hyphenated name, the compact old filename token, and the orchestrator's pre-rename name. Verified by synthetic hook JSON on all block/pass/scope/regression cases.

## Closure (extended tail + gates)
- The sweep kept finding tails beyond the first inventory: docs/superpowers plans+specs (7 files), the whole sidecoach reference library cross-references (17 files under sidecoach/reference/ incl. the other external extractions), nested project beats dirs (sidecoach/.claude/memory, reference/.claude/memory), marketing-site + reference DESIGN.md, one Title-Case variant the first replace missed, and three old .backups settings snapshots. Final global sweep = ZERO hits across repo + ~/.claude + ~/.agents, with exactly two documented functional exclusions: content-guard's own ban regex and install.sh's legacy-purge/status/deactivate lines (all .sh, handling old installs).
- Codex review of the code diff (install.sh, guard, 4 sidecoach src): 2 findings, both folded - a-la-carte status/deactivate now also detect+purge the legacy-named dir, and the a-la-carte DIRS entry points at the specific vendored dir. bash -n green after folds.
- Beats index recompiled and fresh (875 beats); benchmark scorer 45/48 exit 0 (unchanged).
- Anomaly, observed once: the first guard-verification pipeline emitted "claude.exe: cannot execute binary file" and ate that invocation's output (making the full-name case falsely print pass). Re-run isolated: correctly BLOCKED. Not reproduced across dozens of subsequent Bash calls; watch for recurrence.

## Greppability pass (Jonah: "if someone grepped the repo, its right there")
- The enforcement itself was re-introducing the banned strings. Fixed both carriers:
  - content-guard: the ban pattern is now a base64-encoded blob decoded at runtime, with a comment explaining the encoding is deliberate (the words must not be greppable anywhere, including the guard). Deny messages still name the matched word at runtime - runtime output is not repo content.
  - install.sh legacy handling (purge/status/deactivate): the old dir name is never spelled out - a `*interfaces*` glob (unique among skill dirs, matches dir or symlink) detects and removes legacy installs. compgen -G used for status (bash builtin; install.sh is bash - verified under real bash, the interactive probe shell here is zsh where compgen does not exist).
- Final sweep with NO code exclusions: zero hits across repo + ~/.claude + ~/.agents (only frozen corpus base64 coincidences, built dist, and git history remain excluded/extant).
- Honest caveats flagged to Jonah: git HISTORY still contains the names in old commits (a history rewrite is destructive and not recommended for a multi-machine repo); case-insensitive substring greps hit coincidental base64 in frozen corpus captures.

## INCIDENT during this pass - I broke the guard (Hook Error Protocol applied)
- My guard edit added a comment containing an apostrophe. The guard python lives inside a bash SINGLE-QUOTED string, so the apostrophe terminated it: the guard threw IndentationError on every PreToolUse and BLOCKED ALL Write/Edit tool calls machine-wide until repaired via Bash (which the guard does not gate).
- Root cause chain: bash single-quote wrapping makes apostrophes fatal; an earlier symptom existed and was missed - the deny message had been silently losing its inner quotes (bash quote-pairing consumed them) which was visible in test output and I did not investigate the discrepancy. Lesson: output not matching source byte-for-byte is a signal, not cosmetics.
- Durable fix: apostrophe-free rewrite + a loud NO-APOSTROPHES warning comment inside the guard itself. All seven behavior cases re-verified after repair (4 banned forms blocked, canonical + code-scope pass, legacy-model regression intact), live=repo confirmed by diff.

Files touched: install.sh; claude/skills/tactical-polish/* (new, vendored); claude/hooks/content-guard.sh; sidecoach/src/{flows,taste-validator,reference-loader,flow-handlers-tier3-tier4}.ts; sidecoach/reference/_extracted/tactical-polish/* (renamed dir); sidecoach mcp-server transcripts + migration golden; sidecoach dist (rebuilt); reference/index.html; README.md; SIDECOACH_AUDIT_REPORT.md; claude/CLAUDE.md; claude/skills/* (8); ~/.claude/skills/* (7 peers + tactical-polish new, old symlink + ~/.agents stash removed); .claude/memory/* (42 edited, 4 renamed) + MEMORY.md + MEMORY-archive.md.
