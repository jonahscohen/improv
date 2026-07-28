---
name: capability evidence inventory - what is actually proven to work, graded by evidence not by green tests
description: Inventoried 51 shipped capabilities and graded each by strength of evidence. 14 PROVEN LIVE, 24 SUITE-ONLY, 6 CLAIMED ONLY, 7 KNOWN DEAD/DEGRADED. New real-input measurement across 413 transcripts, 501,424 records - 12 of 18 shipped skills have never been invoked through the Skill tool, and on design-eligible real prompts the design-skill layer engaged in 12.5% of sessions. Ranked the capabilities most likely to be secretly dead. Codex methodology review folded (18 findings).
type: project
relates_to: [session_2026-07-27_route-intent-live-efficacy.md, reflection_2026-05-20.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: real-input corpus run over 413 live transcripts (501,424 records, 1,057 genuine human prompts after a four-stage brief/injection split); live probes of install.sh --manifest/--dry-run, statusline, ampersand, beats.py, codex-cli 0.142.5; observed hook fires counted across distinct real transcripts; Codex (gpt-5, reasoning-effort high) adversarial review of the methodology, 18 findings, all folded
confidence: medium
---

# Of everything we built, what is actually proven to work?

Collaborator: Jonah. This is the corpus-scale version of the question
`session_2026-07-27_route-intent-live-efficacy.md` asked about one hook. That beat
found a classifier that was wired, deployed, fast, and carrying a 91-assertion green
suite while having 0% recall on 627 real prompts, and drew the generalisable rule:
**for any classifier, the first test must be real inputs, not authored ones.** This
inventory tests that thesis against everything else the repo ships.

## Reading rule: the tier grades EVIDENCE, not results

PROVEN LIVE does not mean "good". It means "we know what it does because real inputs
were put through it." A capability can be PROVEN LIVE and mediocre - route-intent is
PROVEN LIVE at 22.2% recall. Where a measured result is weak, the row says so in a
separate column. Conflating the two is how "green suite" became a synonym for
"works", and this beat exists because of that conflation.

## The honest answer

**Yes, a real amount of it works - and it is not the part the beats corpus talks
about most.**

The things that are genuinely proven are the ones a human drives directly and would
notice breaking within seconds: the installer, the statusline, justify, teammate
spawning, the Codex review wrapper, the tilt-lab render harness. They are proven
because real inputs went through them, not because they have tests.

The unproven surface is concentrated in the **automatic** layers - the detectors,
nudges, lexicons and skills that are supposed to fire on their own without anyone
asking. Route-intent was not an outlier; it was the first member of that class anyone
measured. This is a strong tendency in the table, not a law: some automatic hooks do
have observed real fires (figma-fidelity-stop, content-guard), and some human-facing
tools are only lightly probed.

The worst result I measured is new: **12 of the 18 skills this repo ships have never
been invoked through the Skill tool across 413 real transcripts.**

## Tier counts (51 capabilities)

| tier | count | share |
|---|---|---|
| PROVEN LIVE | 14 | 27% |
| SUITE-ONLY | 24 | 47% |
| CLAIMED ONLY | 6 | 12% |
| KNOWN DEAD or DEGRADED | 7 | 14% |

SUITE-ONLY is the largest bucket, as predicted. Green tests there are not worthless -
they constrain intended behaviour under authored cases - but they carry no
information about whether the real input distribution ever reaches the code.

## Measurement 1: the skill layer on real traffic

Nobody had ever measured whether the shipped skills actually fire.

**Corpus.** 413 transcripts under `~/.claude/projects/**`, 501,424 records. Every
`Skill` tool call parsed from assistant `tool_use` blocks: **76 total**. The raw
string count of `"name":"Skill"` across the corpus is also exactly 76, so the parse is
complete *for explicit Skill-tool invocations*.

**Scope limit, stated up front (Codex finding).** This measures invocation through
the Skill tool. It does not measure skill *influence* - content can reach a session
by other paths: pasted into a dispatch brief, injected at startup, loaded by a hook,
or simply followed from memory. The correct claim is "never invoked through the Skill
tool in this corpus", not "never used". `reflection_2026-05-20.md` records exactly
that path for tactical-polish: applied "because I'd read it recently, **not via
auto-trigger**."

**The corpus had to be split before the numbers meant anything** - the same lesson
the route-intent beat recorded. My first pass counted 1,143 "design-eligible human
turns" and the sample was mostly teammate envelopes. Four successive splits removed
harness injections, hook feedback, task notifications and dispatch briefs (a brief is
a prompt whose recipient is already the delegate). What survives is **1,057 genuine
human prompts**.

**Eligibility is defined by the repo's own lexicon, not by phrasings I invented.**
I implemented `claude/hooks/sidecoach-intent.json`'s own `_meta.fire_rule` and
`_meta.exempt_rule` directly. That defends against route-intent's specific error
(invented phrasings). It does **not** prove the lexicon is a valid eligibility
detector - the 44% precision below shows the denominator is noisy.

| metric | value |
|---|---|
| genuine human prompts | 1,057 |
| turns matching the repo's own design fire rule | 77 (7.28%) |
| of which genuinely design work (hand-labelled, n=25, seed 20260728) | ~44% -> **~34 real design prompts** |
| sessions containing >= 1 matching turn | 48 |
| ...where ANY design skill was invoked | **6 (12.5%)** |
| shipped skills with ZERO Skill-tool invocations | **12 of 18** |

Per-skill, session-level, across all 413 transcripts:

| skill | sessions invoked |
|---|---|
| sidecoach | 6 |
| justify | 5 |
| icon-source | 1 |
| task-list | 1 |
| component-gallery-reference, consolidate, curate, design-build, design-references, design-team, fontshare-reference, lotus, motion-reference, reflect, social-media, tactical-polish, tilt-lab, visual-effects, voice-output | **0** |

**Unit caveat (Codex finding).** Session-level credit is generous for recall - a
skill invoked anywhere in a session counts for every matching turn in it - but it is
not clean causal attribution either: the invocation need not relate to the matching
turn. So "6" is 6 sessions containing both, not 6 correct engagements. Read the 12.5%
as an upper bound on engagement, not a recall figure.

**Survivorship caveat (Codex finding).** `~/.claude/projects/**` is the transcript
store on this machine. It may exclude deleted sessions, other machines, older
formats, and any context where these skills were not installed. "Across 413
transcripts" is not "across all real use."

**Independent corroboration.** `reflection_2026-05-20.md` measured the same layer by
a completely different method - two real UI builds - and concluded "two skills out of
nine pipeline steps actually fire as the README documents... the skills that ship
BEHAVIORAL INSTRUCTIONS never fire reliably... the QA triad NEVER FIRED - I
substituted a reasoning pass and claimed the triad ran." Two independent
measurements, different methods, same conclusion. That finding was recorded and the
repo kept shipping skills in the same shape.

## Measurement 2: lexicon base rates on real prompts

The cheap diagnostic that would have caught route-intent before three sessions of
green suites. Against the 1,057 genuine prompts:

| lexicon | matches | note |
|---|---|---|
| `sidecoach-intent.json` | 77 (7.28%) | fires, but ~half the sample are misfires (`Run an independent Codex review...`, `Review this change for security vulnerabilities...` both match via `review` + a target noun) |
| `grounding-intent.json` | 33 (3.12%) | sample dominated by misfires: a Codex review brief, a pasted HTML-lint report, a persona prompt, injected Chrome-MCP system text |

I did **not** compute a rate for `route-intent.json` here - a naive OR of its 39
patterns ignores boundary, opener and exemption logic and over-fires badly (`okay now
try` matched). The live-hook number from the 2026-07-27 beat (9 fires / 541 genuine
prompts) is the correct one; this does not supersede it.

## Measurement 3: agent-routing tiers in real use

`quick-answer` and `sonnet-impl` landed 2026-07-26, so all-time counts mislead.
Dispatches **since** they landed:

| tier | dispatches | share |
|---|---|---|
| general-purpose | 52 | 56.5% |
| opus-executor | 13 | 14.1% |
| Explore | 11 | 12.0% |
| claude | 5 | 5.4% |
| codex:codex-rescue | 4 | 4.3% |
| quick-answer | 3 | 3.3% |
| sonnet-impl | 2 | 2.2% |
| **total** | **92** | |

Cheap tiers are **live but marginal at 5.5% combined** against 56.5% for the most
expensive default. Not dead - a cost-control layer that exists and is barely used,
over a two-day window. Small n; re-measure in a week.

## Measurement 4: hooks observed firing on real work

Counting the blocking-feedback marker `[~/.claude/hooks/<name>.sh]`, with a
distinct-transcript count so one runaway session cannot inflate it:

| hook | fires | distinct transcripts |
|---|---|---|
| figma-fidelity-stop.sh | 856 | 16 |
| content-guard.sh | 8 | 2 |
| memory-nudge.sh | 6 | 4 |
| verify-before-done.sh | 5 | 3 |

This sees only hooks emitting that bracketed blocking format, so it is a floor, not a
census - the wired-hook census belongs to `hooks-live`. Two readings: figma-fidelity-
stop is unambiguously *firing* on real work (which is not the same as firing
*correctly*), and **~53 fires per session across 16 sessions is the shape of a gate
that blocks, gets re-attempted, and blocks again.**

## The roster

Scope note: sidecoach's detection engine, the wired-hook census, and `beats.py
search` are assigned to `sidecoach-live`, `hooks-live` and `beats-search`. They are
excluded from these counts.

### PROVEN LIVE (14) - real inputs went through it

| capability | real-input evidence | measured result |
|---|---|---|
| route-intent / agent-routing hook | 627 real mined prompts through the live deployed hook | **partial**: recall 0% -> 22.2%, 100% sample precision, brief FPs 7 -> 0. A 22% capability, honestly measured. |
| justify (daemon + browser round trip) | Real browser-submitted prompts served end to end; a real 5-prompt queue drain; live-daemon integration covering consent refusal, killed worker, unattended apply | works on the observed paths |
| statusline | Ran this session against a real payload: `dir improv  branch main +3 -2 / model Opus`, git counts matching the actual dirty tree; plus one real captured payload in-beat | works; 48ms |
| installer non-mutating paths (`--manifest`, `--dry-run`) | Ran both this session: manifest emits valid JSON, 43 entries; dry-run resolves and touches nothing | works |
| installer mutating apply path | Controlled real-install off-list matrix (baseline + all-off) under a throwaway HOME; `apply_plan` regression with negative control | works on the tested matrix |
| bucket browser (TUI) | Real-terminal screenshots at 80x24 via computer-use; pty render captures at 4 widths; drove the real `./install.sh --browser` under a pty | works; 2 HIGH bugs found and fixed by that process |
| GUI installer | Real mouse clicks against a 127.0.0.1 server with `HOME=/tmp`: stage -> apply -> live log `[exit 0]` -> `SKILL.md` 195 lines on disk; uninstall verified; real HOME untouched | works |
| ampersand launcher + self-heal | Reproduced against six historical `.zshrc` block forms mined from real `git log -S` history plus the live machine's real block | works; 4 real defect classes found and fixed |
| figma-fidelity-stop gate (**firing only**) | 856 real blocking fires across 16 distinct real transcripts | **fires**; correctness NOT established - see the SUITE-ONLY row for its precision |
| cmux teammate spawn plumbing | Live PreToolUse payload dumps from 3 real spawns, validated against a 465-call transcript corpus; shim instrumented during a real spawn | works; pane-vs-in-process fallback documented |
| tilt-lab verify harness | Real Chromium, real pointer input (`drivePointer`), pixel-decode paint checks per effect | 121/121, with the earlier asset-fallback lie explicitly closed |
| codex-review.py | Real Codex verdicts with wall-clock evidence (exit 0, 274.6s); 8 real verdicts in one hardening session; `codex-cli 0.142.5` probed present this session | works; distinct exit codes per failure class |
| transcribe | One real Discord voice OGG transcribed to correct text end to end | works; **n=1** |
| agent-tier routing | 92 real dispatches since the tiers landed | **marginal**: cheap tiers 5.5% combined vs 56.5% general-purpose |

`transcribe` and `statusline` are now graded on the same bar (Codex flagged that I
had applied two): one real input observed end to end promotes to PROVEN LIVE, with
n=1 stated on the row. Neither is proven robust.

### SUITE-ONLY (24) - green tests, no real-input evidence

| capability | what exists |
|---|---|
| grounding-gate + `grounding-intent.json` | 7 hooks, installer component, suite. Zero real-traffic measurement. Base-rate probe: 3.12% of real prompts, sample mostly misfires. |
| consolidate-nudge + `consolidate-intent.json` | Threshold + stopword clustering classifier over the beats corpus. Zero real-traffic measurement; the skill it nudges toward has 0 invocations. |
| sidecoach-keyword intent nudge (hook side) | Suite green. Its *downstream* is now measured here (7.28% match, ~50% precision, 12.5% follow-through); the hook's own live fire rate is not. |
| figma fidelity gate PRECISION | The gate demonstrably fires (above). Whether those 856 fires were correct is untested; no real tamper or real false-positive audit exists. |
| figma fidelity ledger (level 2) | 40/0 on authored tamper cases (marker delete, forge resolve, chain break). No real tamper attempt. |
| clickup write-guard | 33-line denylist. 59 real ClickUp MCP calls sit in the corpus and not one was ever replayed against it. |
| visualizer-guard | 21 authored cases (13 deny / 8 allow) plus one real regression case - the original broken widget's exact patterns. Closest to promotable in this tier. |
| api-drift detector + stop + ack | String-signal detector over tool results. Suite green; target register authored, never sampled from real tool output. |
| bash-guard | Large suite. 0 observed fires in real transcripts - it denies silently, so absence is not proof of death, but nothing confirms life either. |
| content-guard | Suite green; 8 real fires across 2 transcripts - weak live corroboration, not a precision measurement. |
| verify-before-done family | Suites at 168 assertions with negative controls; 5 real fires across 3 transcripts. |
| validation-guard | 70/70 parity with bash-guard. |
| hook-registry guard | 52/0. Structural, not behavioural. |
| destructive-ops-guard, second-fix-gate, plan-consistency-lint, push-ahead-check | Suites green; no real-input evidence. |
| concise / multiple-choice / question-enforcement family | Suites green; behavioural effect on real sessions never measured. |
| chrome tab-group hygiene (track / clear / stop) | Suite green; real leftover-group rate never measured. |
| screenshot-open-mandate + clear | Suite green. |
| surface-visual-gate, task-loop-mandate | Suites green. |
| justify-* hooks (queue mandate, drain, watch guard, source guard, standing-by) | Suites green; one was found on 2026-07-17 to be **absent from live settings entirely** - "the hook never runs -> it cannot do anything." |
| codex-rescue-guard, fable-orchestrator-guard, model-router-guard, agent-teams-guard, cmux-close-guard | Suites green (cmux-close-guard 127/0). |
| memory-approve / memory-compact / beats-staleness / beats-rebuild | Suites green. |
| `beats.py compile` + `verify` | CLI runs (probed `--help`); provenance lint is WARN-only by design. |
| agent-team orchestration quality | Distinct from spawn plumbing above. 508 dispatches and 1,111 SendMessage calls prove usage, not correctness. No measurement of relay success, teardown, or result quality - and the corpus records a no-relay failure recurring 4x across 3 teammates. |
| statusline robustness | 18 replayed payload fixtures, all authored except one. The happy path is PROVEN LIVE; edge behaviour is not. |

### CLAIMED ONLY (6) - a beat asserts it, no runnable check

| capability | status |
|---|---|
| `tts-generate` (Discord voice replies) | No beat describes building, testing or running it. 1 real Bash invocation corpus-wide. |
| social-media skill | Spec-only. No build or verification beat. 0 invocations. |
| design-team skill | Spec-only + one narrative usage record in a tilt-lab beat. 0 Skill-tool invocations. |
| visual-effects skill | Spec-only. 0 invocations. |
| curate skill | 0 invocations; the catalog it writes to holds 1 entry. |
| discord onboarding walkthrough (`discord-onboard.sh`) | Documented 3-state flow and a `--repair` path; no runnable check; last recorded state was a stale pairing record with no Keychain token. |

### KNOWN DEAD or DEGRADED (7)

| capability | evidence it does not work, or works only in fallback |
|---|---|
| **The design-skill layer as an automatic system** | 12 of 18 shipped skills: zero Skill-tool invocations in 413 real transcripts. <=12.5% engagement on design-eligible sessions. Independently corroborated by `reflection_2026-05-20.md` (2 of 9 pipeline steps fired on two real builds; "the QA triad NEVER FIRED"). |
| voice-output | Installed in `mcpServers`, but `~/.claude/.voice-enabled` is **absent**, so voice is muted: 1 real MCP call in the entire corpus. The user-visible capability is **effectively unavailable by default**, not merely idle. `reflection_2026-05-19.md` already flagged it consumed more attention than the transport layer. |
| lotus | **0 real `mcp__lotus__*` tool calls** in 413 transcripts. Recorded disconnects across three restarts; ships a permanent `forwardToOwner` proxy fallback; its own beat admits "everything up to the Figma click is verified" - the full path was never closed without a human clicking Connect. |
| codex-rescue agent | Records a **silent same-model downgrade** when its codex call does not return in time - a cross-model gate quietly losing its different-model property with no error surfaced. No-relay recurred 4x across 3 teammates. `codex-review.py` is the working path; the agent is not. |
| `sidecoach/bundles/*.json` | Dead snapshots with no runtime reader - literal bundle enrichment has zero runtime effect. |
| justify MCP annotation tools (`justify_get_annotations`, `justify_get_layout`) | Beat records them as "possibly dead since the modes that feed them are unreachable". |
| discord startup prompts under cmux app launch | cmux app-launched sessions exec the bare `claude` binary and never source `~/.zshrc`, so the wrapper hosting the Teams/Remote-Control/Discord prompts never runs. Fix lives in cmux launch config, not here. |

## RANKED: most likely to be secretly dead

Ranked by (a) how much the corpus claims for it, (b) dependence on a classifier,
lexicon, threshold or external service that can silently degrade, and (c) how
invisible the failure would be to Jonah. Route-intent scored maximum on all three and
was in fact dead - that is the calibration. **These are ordinal judgements, not
computed scores**; the criteria are stated so the ordering can be argued with.

**1. grounding-gate + `grounding-intent.json`.** Same architecture as route-intent: a
JSON lexicon driving a co-occurrence rule, cooldown-gated, advisory output. Matched
3.12% of real prompts and my hand-read of that sample found most matches are
misfires. A gate that never arms is *perfectly* invisible - identical to a gate with
nothing to catch. **Measure this next.**

**2. clickup write-guard.** Promoted above the nudges on blast radius (Codex
finding): it is the only entry in this ranking whose failure writes to a live client
system. Pure denylist, never replayed against the 59 real ClickUp MCP calls already
in the corpus. A renamed or newly-added ClickUp write tool passes silently, and the
failure surfaces as an unintended write, not an error.

**3. bash-guard.** Added on Codex's finding. Large suite, high blast radius (it is
the guard on force-push, `rm` against `.claude/memory`, and attribution lines), and
**zero observed fires in 413 real transcripts.** It denies silently, so absence is
not proof of death - which is exactly the property that makes silent death
undetectable. Its life should be confirmed with one deliberate real trigger.

**4. api-drift detector.** A string-signal classifier (`deprecated`, `removed`,
`InputValidationError`) over tool results, with an authored target register never
sampled from real tool output. If the strings real API failures emit have drifted,
the detector is silent and the Stop gate never arms - and catching drift is the
entire point. Ranked on architecture rather than measurement: I did not compute a
base rate for it, and should have.

**5. `justify-*` hooks.** Added on Codex's finding. This is stronger than suspicion:
the corpus already records one of them absent from live settings entirely on
2026-07-17 ("the hook never runs -> it cannot do anything"). Wiring presence for the
whole family should be re-confirmed, not assumed.

**6. consolidate-nudge + `consolidate-intent.json`.** Threshold classifier
(`config.threshold`, `min_token_len`) clustering the beats corpus. Until 2026-07-27
the lexicon was not shipped by the installer at all and the hook fell back to
hardcoded defaults - a documented silent fallback. The skill it exists to nudge
toward has **0 invocations in 413 transcripts**. A nudge that never fires is
indistinguishable from a tidy corpus.

**7. visualizer-guard.** A pattern list versus real widget markup. One real
regression case behind it, which is why it is not higher. If token syntax drifts, it
silently allows the exact dark-mode a11y failure it was built for.

**8. hud.sh.** 33-assertion suite, no recorded run for its actual purpose since
2026-05-28, and since re-keyed as a *detection artifact* for the config component. If
the monitoring capability broke, nothing would notice - its remaining job is to exist.

**Excluded from the ranking, deliberately.** The `sidecoach-keyword` nudge is no
longer a pure SUITE-ONLY candidate - its downstream is measured in this beat, so it
does not belong on a list of unmeasured suspects. The **figma-fidelity gate** is also
excluded: 856 real fires prove it is not dead. Its risk is the inverse - unmeasured
precision and a ~53-fires-per-session pattern that looks like loop-blocking, and
over-firing is what gets a gate switched off. That is a separate measurement, not a
death watch.

## Self-analysis

I nearly published a badly wrong number. My first design-skill measurement said
"1,143 eligible turns, 2.5% engagement". The eligible set was mostly teammate
envelopes, task notifications, hook feedback and dispatch briefs. It took four
successive splits to get to 77. **The failure mode was mine and it was the same one
this whole inventory is about**: I checked whether my regex ran, not whether its
input distribution was real, and I only caught it because I printed samples of what
matched. Printing the matches is the cheapest possible defense and should be the
default in any classifier work here.

I also almost graded the cheap agent tiers as dead against a 508-dispatch denominator
before noticing they had shipped 48 hours earlier. Generosity and harshness are both
measurement errors; the fix in both directions is the correct denominator.

Codex caught me grading generously in five specific places, and it was right in all
five: I had let "it fires" stand in for "it works" (figma-fidelity-stop), let usage
counts stand in for correctness (cmux teams, justify), let non-mutating installer
paths imply the installer works, and applied two different bars to n=1 evidence
(promoting statusline while demoting transcribe on the same shape of proof). Each of
those is the same underlying error as the one I was hired to find, committed by the
auditor. The tiers above are the corrected version.

**A methodological trap worth reusing: `grep -c` over transcript JSONL counts
mentions, not invocations.** A raw grep for `mcp__lotus__` returns 29,722 hits across
the corpus - tool listings, system prompts, ToolSearch results - while parsing actual
`tool_use` blocks returns **zero**. Anyone measuring usage from transcripts must
parse the blocks. The grep number would have graded a dead integration as the most-
used capability in the repo.

## Deliberately left alone

- **Hook-by-hook live measurement.** Owned by `hooks-live`. My 4-hook observed-fire
  table is a floor derived from one output format, not a census.
- **Sidecoach's detectors and `beats.py search`.** Owned by their teammates.
- **Turn-level skill attribution.** I credited session-level, which is generous by
  construction; a turn-level number would be lower and I did not want the finding to
  rest on the harsher rule.
- **Whether the 12 never-invoked skills SHOULD fire.** That is a product call for
  Jonah. Some (social-media, design-team) may simply have had no occasion in this
  corpus. The measurement says they have not fired; it does not say they are wrong to
  exist.
- **A base rate for `api-drift-detector`.** Ranked on architecture without one. That
  is the weakest link in the ranking and the cheapest thing to fix next.

## Files touched

- `.claude/memory/session_2026-07-28_capability-evidence-inventory.md` (this beat)
- `.claude/memory/MEMORY.md` (one index line)

No repo code, tests, hooks or installer files were modified. All probes were
read-only or against `--dry-run` / `--manifest` / `--help` paths; the scan scripts
live in `/tmp` and write nothing outside stdout.
