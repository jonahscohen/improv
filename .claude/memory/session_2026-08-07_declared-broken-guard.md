---
name: declared-broken-guard Stop hook (H2 from the declared-broken field report)
description: Built the H2 behavioral Stop gate - blocks once when a finished response declares a user-named capability dead without any diagnostic effort that turn. Hook + 29-case falsification suite, all green, shellcheck-clean, Codex-reviewed. NOT wired (lead owns installer wiring).
type: project
relates_to: [session_2026-08-07_tool-declared-broken-direct-order-failure.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests (29/29), shellcheck, codex-review
confidence: high
---

Collaborator: Jonah. Built as a teammate unit under the lead in the improv dotfiles repo.

## What was built
Two files, nothing else touched (installer wiring is the lead's job):
- `claude/hooks/declared-broken-guard.sh` - the Stop hook.
- `claude/hooks/test-declared-broken-guard.sh` - 29-case falsification suite (all green).

This is H2 from the field beat (`session_2026-08-07_tool-declared-broken-direct-order-failure.md`). It does NOT prevent the specific team-file bug (that is H1, the auto-heal, owned separately) - it curbs the general class: declaring a user-named tool dead on first resistance instead of diagnosing it.

## How it works
Structure mirrors `concise-detect-stop.sh` / `elias-detect-stop.sh` exactly (same anti-loop layers, same fail-open trap, same session-keyed once-per-burst flag, same Python-detect / bash-decide split).

BLOCK when BOTH hold:
1. The finished response asserts a capability is dead (lexicon below), graded on PROSE only (a broken-looking line inside a fenced code block does not count).
2. The current turn (everything after the last GENUINE user prompt - a tool_result echo does not reset the boundary) shows NO diagnostic effort: no Bash/BashOutput/Read/Grep/Glob/LS/NotebookRead tool_use, no obvious MCP inspection tool (read_console/read_network/read_page/get_page_text), and no varied retry (>=2 attempts at one tool with DIFFERING inputs; two identical attempts do not count - that is the field failure exactly).

## Trigger lexicon (tight, anchored)
Generic "broken / dead / down / unavailable / not working" forms are anchored to a CAPABILITY subject (spawn/spawning, agent(s), subagent, teammate, the tool/this tool/that tool, the command, the capability, the feature, the mcp/mcp, the browser/server/skill/hook/api/endpoint) so "the old approach is broken" (subject = approach) never matches. Session/action-scoped forms stand alone: `not working this session`, `unavailable this session`, `unavailable right now/currently`, `broken this session`, `can't|cannot spawn|use|run|invoke|launch|start|reach|call|access`, `unable to <same verbs>`, `capability is broken`, `had to do|handle|complete|finish it/this/the X myself|manually|by hand`, `had to work around`.

## Carve-outs (all PASS, no block)
1. User's own words called it broken/unavailable (scans last 2 genuine prompts; looser pattern on purpose - erring toward "the user flagged it" is the safe direction for a pass).
2. External outage evidence cited (status page, githubstatus, major_outage, "status shows outage", "service is down", etc.) - the GitHub-Actions-outage case from the field session was a LEGIT declared-broken.
3. No capability-dead assertion -> nothing to enforce.
4. Recovery: the response also says it was fixed / now works / back up / up and running / after the fix -> a diagnosis that succeeded, pass.
Plus a diagnostic tool call or varied retry this turn -> pass (that is the whole point).

## Key design decisions
- **Diagnostic effort = ANY Bash call (or inspection tool, or varied retry), not "Bash aimed at the failing tool."** Why: distinguishing "diagnostic Bash" from "task-work Bash" is a semantic judgment this repo has scars from (visual-gate over-classification, 2026-07-26). The field beat's own H2 and the lead's spec both define it as "at least one Bash call." How: shape check over the turn's tool_use names + a differing-input retry check. FLAGGED to lead: this means the field scenario's OWN manual task-work (which used Bash) would PASS this gate. H1 is the real fix for that exact bug; H2 catches the "declared broken and did nothing / stopped" shape, which is the more common rationalization. This is the honest limit the field beat already names.
- **Cross-gate deferral is one-directional.** concise/elias mutually defer; this new gate defers to BOTH (checks their flags) but they do not check its flag. So it must be wired AFTER concise/elias in the Stop array for the deferral to be effective. FLAGGED to lead for wiring order.
- **Lexicon inlined, not a sibling .txt** - grounding cluster deploys .sh only.

## Verification
- `bash claude/hooks/test-declared-broken-guard.sh` -> 29 passed, 0 failed, exit 0.
- `shellcheck declared-broken-guard.sh` -> clean. Test file emits only SC2015 info (the `A && ok || bad` idiom), identical to the canonical concise/elias test baseline (51 of the same in test-concise-detect-stop.sh).
- `bash -n` clean; executable bit set on both.
- Codex cross-model review (codex-cli 0.142.5) run against both files; findings folded (see below / to be appended).

## Files
- claude/hooks/declared-broken-guard.sh (new)
- claude/hooks/test-declared-broken-guard.sh (new)
- this beat
