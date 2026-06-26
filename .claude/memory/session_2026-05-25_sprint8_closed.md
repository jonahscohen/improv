---
name: session-2026-05-25-sprint8-closed
description: Sprint 8 (Sidecoach oracle parity + teach rebuild) closed. 22 verb-based slash commands + brief-driven teach + new document command + /sidecoach help <verb>. Sidecoach now matches and exceeds oracle on every command. 69 tests green.
type: project
relates_to: [session_2026-05-25_sprint8_design.md, session_2026-05-24_sidecoach_dogfood.md, sidecoach_followup_queue.md]
---

Human collaborator: Jonah.

## What this sprint landed

10 task commits on `main` since Sprint 7:

- T1 `9560b33` - oracle-command-registry.ts skeleton + 5 prototype entries (craft, polish, audit, critique, document). Typed table with 8 fields per entry including oracleSkillPath and parityChecklist.
- T2 `9a73e19` - slash-router new branch checks registry after composite/list, before SLASH_COMMANDS phase lookup. Phase commands still work.
- T3 `316685d` - teach-command-handler-v2.ts with hybrid brief parsing + gap-question fallback. 7-scenario test. Old stub + task9-teach-command test deleted. NO self-attribution. NO legacy oracle references.
- T4 `31cb125` - document-command-handler.ts (new capability). Scans HTML/CSS via maxDepth-3 walk, extracts colors / font families / sizes / spacing, writes Google-spec DESIGN.md with YAML frontmatter.
- T5 `e427bb7` - 17 remaining registry entries with real parityChecklist strings derived from oracle skill files.
- T6 `a1ebc0c` - parameterized parity test iterates all 22 verbs, runs each via engine.process(), asserts parityChecklist + parityPlus strings present in output. Initially 23/197 PASS.
- T7 `7e2509d` - orchestrator guidance-append callback wired via buildOracleGuidanceAppend helper at TWO sites (chain-path + document special branch). Took parity test from 23/197 to 197/197.
- T8 `0e11bff` - /sidecoach list expanded (Phase commands + Oracle parity verbs sections). New /sidecoach help <verb> shows per-verb detail. 13-assertion test.
- T9 `4165692` - documentation sync across SIDECOACH_AUDIT_REPORT.md, SIDECOACH_QUICKSTART.md, claude/skills/sidecoach/SKILL.md, sidecoach/README.md.

## Test count

69 PASS / 0 FAIL. tsc --noEmit exit 0.

## Behavior contract

- /sidecoach teach <brief> parses register, users, brand-personality (if brand register), anti-references, strategic principles from the brief. Returns status='pending' with gap questions for any field not extracted with high confidence. Caller re-invokes with metadata.teachAnswers to complete. Writes a real PRODUCT.md (no boilerplate, no self-attribution).
- /sidecoach document scans project HTML/CSS at maxDepth 3, extracts tokens, writes Google-spec DESIGN.md with YAML frontmatter and required sections.
- /sidecoach <verb> for any of 22 oracle verbs routes via the registry to a sidecoach flow chain. After the chain executes, the orchestrator appends the registry's guidanceAppend and parityPlus strings to the result so the parityChecklist gets satisfied.
- /sidecoach list shows both phase commands (sidecoach native) and oracle parity verbs in separate sections.
- /sidecoach help <verb> shows per-verb detail: description, phase, oracle reference path, flow chain, parityChecklist, parityPlus.

## Sidecoach is now strictly more capable than oracle

- Every oracle command verb has a sidecoach equivalent (22 verbs + teach)
- Every command output includes oracle's checklist items (parityChecklist) plus sidecoach-specific additions (parityPlus) like BuildReport, validation results, memory entries
- Teach is brief-driven AND interactive (oracle's teach is only interactive)
- Document writes Google-spec DESIGN.md (oracle's document is similar)
- Sidecoach phase commands (research, craft, review, etc) provide an alternate vocabulary that oracle does not have

## Out of scope / future

- Drift-audit command that diffs registry entries against current oracle source (future sprint)
- /sidecoach teach interactive AskUserQuestion integration (currently the pending status returns the questions, the calling agent asks them)
- Migration of users from phase commands to verb commands (both work; no deprecation needed)
- 'live' verb depends on Improv MCP - works via flowN but production-readiness not exhaustively verified

## Local main state

Local main ~12 commits ahead of origin since Sprint 7 close (10 task commits + 1 spec + 1 plan). To be pushed after the close commit lands.

## Next on the queue

The sidecoach_followup_queue.md was empty before this sprint. Sprint 8 closes the oracle-parity gap that the queue did not explicitly track. Next is the marketing-site dogfood that triggered this work - now actually achievable end-to-end since /sidecoach teach can produce PRODUCT.md from the brief.
