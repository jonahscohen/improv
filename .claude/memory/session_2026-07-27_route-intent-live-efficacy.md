---
name: route-intent live efficacy - the router was green and dead; measured 0% recall on real traffic and fixed it
description: Drove the deployed hook with 627 genuine prompts mined from real transcripts. On its target population it fired 0.37% of the time, every fire wrong (0% recall, 0% precision), while firing 8.1% on agent dispatch briefs where it must be silent. Four structural defects found and fixed; two Codex review passes folded (10 findings). Recall 0 -> 22.2% at 100% sample precision, brief false positives 7 -> 0, suite 49/2 -> 91/0.
type: project
relates_to: [session_2026-07-27_agent-routing-minor-followups.md, session_2026-07-26_agent-routing-task7-codex-fix.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: 627-prompt live-hook corpus run, 120-prompt hand-labelled sample, 27 adversarial negatives, two Codex review passes (codex-cli 0.142.5), route-intent 91/0, hook-registry 52/0
confidence: high
---

# Is the agent router actually working? It was not.

> **LEAD VERIFIED 2026-07-27.** Not taken on trust. Re-ran `test-route-intent.sh` 91
> passed / 0 failed and `test-hook-registry.sh` 52 passed / 0 failed, then drove the
> DEPLOYED hook at `~/.claude/hooks/route-intent.sh` with real JSON payloads, each under
> its own `ROUTE_INTENT_COOLDOWN_FILE`:
>
> | probe | result |
> |---|---|
> | `i need you to redesign the gui version of the installer` | routes (opus_executor) |
> | `do we need to refactor this parser module before the release, or is that unnecessary` | silent |
> | `what does this actually do` | silent |
>
> The middle probe is the exact deliberation shape whose false positive forced the MINOR 1
> revert earlier the same day, so the landed opener form is confirmed to have fixed the
> defect rather than merely relocating it.
>
> **The finding that generalises beyond this hook:** three prior sessions of green suites,
> mutation proofs and cross-model review all passed while the classifier routed nothing,
> because every one of them verified against phrasings its own authors invented. Mutation
> testing proves an assertion is not vacuous; it says nothing about whether the input
> distribution resembles reality. For any classifier, the first test must be real inputs.
> This applies to every detector in this repo, not just route-intent.

Collaborator: Jonah. The question was whether the routing hook built earlier that
day FIRES CORRECTLY on real traffic, not whether its suite is green. Those turned
out to be very different questions.

## Verdict

The hook was wired, deployed, fast, and green - and functionally dead. On the
population it exists to serve it fired on 2 of 541 genuine prompts, and **both
were wrong**. Measured recall and precision were both **0.0%**.

Worse, the signal was inverted: it fired on **8.1% of agent dispatch briefs**
(7 of 86), where silence is the only correct answer, versus **0.37% of genuine
lead-session prompts**. It was 22x more likely to speak where it must not.

## Method

- Mined 386 transcripts under `~/.claude/projects/**`, excluding hook injections,
  system reminders, tool results, slash expansions and teammate envelopes:
  **788 unique human prompts, 627 routing-eligible** (>= 40 chars).
- Split the corpus into the router's TARGET population (541 genuine lead-session
  prompts) and 86 agent dispatch briefs. That split matters: a brief is a prompt
  whose recipient is already the delegate, so a nudge to re-delegate is noise by
  construction, and mixing the two hides an inverted signal inside a flat rate.
- Hand-labelled a random sample of 120 genuine prompts (seed 20260727) against
  explicit rules. 104 target prompts after removing briefs; **27 should route**
  (26%), 77 should not. The base rate strongly favours silence, which is the
  central constraint on any widening here.
- Drove the **live deployed hook** for every measurement, each probe with
  `ROUTE_INTENT_COOLDOWN=0` and a unique `ROUTE_INTENT_COOLDOWN_FILE`.

### Two harness traps hit and caught

1. **The cooldown trap, exactly as the prior beat warned.** My first probe script
   put the env vars on the payload generator upstream of the pipe instead of on
   the hook, so the hook ran on the DEFAULT cooldown file: probe 1 fired, wrote
   real cooldown state, and silenced probes 2-5. It read as a mass regression.
   Attaching env to the left of a pipe does not reach the right of it.
2. **A no-op mutation reporting as a result.** The first candidate variants were
   built by string-replacing the identifier slot, but I wrote the slot with the
   JSON-SOURCE double backslash rather than the DECODED single backslash, so
   every replace silently matched nothing. Two fixes measured "no change" when
   they had never been applied. Same failure mode the fixwave beat recorded.
   Fixed by asserting each variant differs from base and failing loudly.

A python mirror of the classifier was used for fast A/B, and validated against
the live hook on all 627 prompts (**0 disagreements**) before and after every
change. A mirror that drifts produces confident numbers about a program that
does not exist.

## The four defects

**A. Deictic objects.** `what does this actually do` matched the narrow-lookup
tier. A dispatched subagent receives none of the conversation, so a deictic
referent is unroutable BY CONSTRUCTION - not a lookup, a non-request.

**B. The identifier slot bridged clauses.** `[a-z0-9_.\- ]{2,40}` admits space
and dot without limit. Observed on real traffic: `a stale orphan from a rename
- i.e. this skill was renamed to something else` matched the `rename X to`
pattern, the slot having swallowed an entire unrelated clause. Replaced with at
most four whitespace-separated tokens, every quantifier bounded.

**C. Dispatch briefs routed.** 7 of 9 fires were briefs, matching numbered
sub-steps inside them (`1. first map the routing landscape`, `do: 1. find all 7
pages`). Exempted by brief HEAD.

**D. Register mismatch - the whole recall failure.** The lexicon encoded a formal
command register (`find all X`, `rename X to Y`, `where is X defined`) that Jonah
does not use. His real register is `need you to...`, `i need a breakdown of...`,
`modify X to...`, `run an analysis on...`, `build me a...`. Six patterns added,
each one measured against the full corpus before landing; two candidates
(`report the ...`, `turn X into ...`) were **discarded** because the first scored
1 correct against 1 wrong and the second scored zero hits on real traffic.

## Results

| metric | before | after |
|---|---|---|
| recall (120-prompt hand-labelled sample) | 0.0% (0/27) | **22.2% (6/27)**, all exact-tier |
| precision (same sample) | 0.0% (0/1) | **100% (6/6)** |
| genuine-prompt fires (541) | 2, both wrong | 9, 8 correct (**88.9%**) |
| dispatch-brief fires (86) | 7 (8.1%) | **0** |
| route-intent suite | 49 passed / 2 failed | **91 passed / 0 failed** |
| hook-registry suite | 52 / 0 | 52 / 0 |

Recall is 22.2%, not 90%. That is deliberate. With 74% of real traffic correctly
non-routing, a widening that buys recall at the cost of false positives makes the
hook worse than silence; every pattern landed here has zero measured false
positives on 627 real prompts.

## Cross-model review - two passes, 10 findings, all folded

`codex-cli 0.142.5` via the deterministic wrapper (the `codex:codex-rescue` agent
can silently downgrade to same-model, per the 2026-06-30 precedent).

**Pass 1 (5 findings):** openers reachable after a bare conjunction
(`and need to scan project folders`); `[.;!?\n]\s*` letting a dotted slug forge a
boundary (`v2.build me a dashboard`); the deictic lookahead binding only the
slot's FIRST token (`where is the flag for that configured`); brief exemptions
over-broad enough to silence real requests; and weak reported-speech negatives.

**Pass 2 on the folded diff (5 more):** `i need`/`i want` sitting in the breakdown
CORE phrase where no boundary rule reaches them; `\bthen`/`\bnow` after a dot
bypassing the whitespace fix; bare `i`/`we` acting as an opener and turning
declaratives into commands (`i scan project folders every friday`); the brief
exemption still swallowing `You are right, rename parser to lexer ... do not
commit`; and refactor/redesign never receiving the opener shape at all.

Every finding was folded and the whole unit re-verified, not just the flagged
line. Codex's exact break strings are now assertions in the suite.

## The MINOR-1 design call, resolved on evidence

The reverted MINOR-1 widening is now **landed**, in the corrected shape. It is
safe here only because the openers sit inside an optional prefix group behind a
real clause boundary, never as members of the boundary alternation - which was
the original defect. All 11 must-be-silent probes from that beat stay silent, all
3 must-keep-working imperatives still route, and `need to refactor the parser
module` / `i want you to redesign the settings page` now route. It also earned a
genuine new fire on real traffic: `i need you to redesign the gui version of the
installer...` -> opus-executor.

`lets` and `time to` were **not** added. They appear nowhere in 627 real prompts,
and adding unmeasured tokens is the improvisation this tier exists to avoid.

**Why:** the opener tokens are VERB PHRASES, not clause markers like
and/then/now. Behind only `\b` they anchor nothing. The rule is now recorded as
`_meta.opener_group_rule` so a future editor sees the constraint.
**How:** `(?:(?:^|[.;!?]\s+|\n\s*)OPENER|(?:^|\s)(?:and|then|now|also|next)\s+SOFTENER)` -
openers only after string start or real sentence punctuation; after a bare
conjunction, softeners alone.

## Self-analysis

The failure this session diagnosed is not a coding error, it is a measurement
error baked into the previous sessions: **every prior pass verified the router
against phrasings its own authors invented.** A suite written by the same mind
that wrote the patterns tests that the patterns match what that mind imagines a
prompt looks like. It cannot detect that the imagined register is wrong. Three
sessions of green suites, mutation proofs and cross-model review all passed while
the thing routed nothing, because none of them ever fed it a real prompt.

The generalisable rule: **for any classifier, the first test must be a sample of
real inputs, not authored ones.** Mutation testing proves an assertion is not
vacuous; it says nothing about whether the assertion's input distribution
resembles reality.

Also worth carrying: the corpus had to be SPLIT before the numbers meant
anything. A single 1.4% fire rate across all 627 prompts looked merely
conservative. Only after separating genuine prompts from dispatch briefs did the
inverted signal - 0.37% where it should speak, 8.1% where it must not - become
visible.

## Deliberately left alone

- **One residual false positive** (1 of 9 corpus fires): a four-question
  deliberation whose first clause is a valid narrow lookup (`what does the Update
  Available option do...will it actually sync? Will it...`). The obvious guard
  (exempt prompts with 3+ question marks) was measured and **rejected**: it kills
  that 1 false positive but costs 2 legitimate Explore routes. A per-tier guard
  (a `max_prompt_chars` or per-tier exempt on quick_answer) would fix it properly
  but is a hook code change and a design call, not an execution detail.
- **Deictics inside dotted/dashed tokens** (`where is flag.that configured`)
  bypass the per-token guard. Flagged by Codex, accepted: `flag.that` is a
  plausible real identifier and blocking it risks worse.
- **Recall beyond 22.2%.** The remaining 21 misses in the sample are mostly
  under-specified UI feedback and product-judgment prompts that a lead should
  own. Chasing them means firing into the 74% that should stay silent.
- **install.sh and agent-teams-guard.sh** - owned by other teammates this
  session, untouched. No installer change is required by this work: the lexicon
  was already deployed through the table-driven `hook_data_files()` path, and no
  new file was added.

## Note on the starting baseline

The suite was **49 passed / 2 failed** at session start, not the expected 51/0.
Both failures were stale literal-string greps (`installer deploys
route-intent.json`, `deactivate_cluster removes the lexicon`) left by another
teammate's concurrent refactor of install.sh, which moved that string into a
`hook_data_files()` table. Proven benign by lifting the real `install_hook_data`
out of install.sh and running it against a scratch HOME - it correctly deployed
`route-intent.json`. That teammate landed the corrected assertions during this
session and they now pass.

## Files touched

- `claude/hooks/route-intent.json` - four defect fixes, six new patterns, the
  opener-group rule, and five new `_meta` entries recording the constraints
- `claude/hooks/test-route-intent.sh` - 42 new assertions: real-traffic
  regressions, adversarial negatives built from the widening's OWN tokens, and
  both Codex passes' exact break strings
