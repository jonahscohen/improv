---
name: oracle v4 competitive gap analysis + Justify fold recommendation
description: 4-agent comp analysis of oracle's v4 release. New gaps ranked; the 3 gaps we keep re-capturing (generative / visualizer-authorship / anti-sameness) shipped as ONE integrated pipeline; NEW defect-mining loop is their strongest durable capability; Live Mode is a new Justify-rival axis. Fold recommendation for Justify included. Codename ONLY - zero real identifiers persisted.
type: project
relates_to: [session_2026-07-16_four-product-gap-analysis.md, session_2026-06-23_sidecoach-oracle-gap-analysis.md, feedback_sidecoach_mission_beat_oracle.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: 4 parallel research agents (web + Apache-licensed repo clone read-only at /tmp/oracle-v4) + grounding in the 5 prior oracle beats; NOT every agent claim independently re-verified - treat marketing counts as soft
confidence: medium
---

Collaborator: Jonah. 2026-07-23. Jonah: the rival shipped v4; fan out agents for gap analysis, understand their live feature, see if it folds into Justify. NAME BLACKOUT (Jonah, hard rule): the rival's real product name, author handle, and domain must NEVER appear in any beat. Codename is "oracle" (the 2026-06-26 scrub convention - both tool name AND author handle scrubbed; enumerate ALL identifiers, not just the one word). This beat honors that; the real name was used only to search/fetch, never persisted.

Method: 4 named teammates (oracle-live / oracle-repo / oracle-site / oracle-gap), each a focused surface, reporting to the lead. I synthesized. Their own data-hygiene caveat: oracle's rule count (58/59/64/25) and "worlds" count (177/188) are inconsistent across their own pages - their marketing runs ahead of their docs, so treat exact counts as soft.

## What v4 is (repo + site)
- Two drops: v4.0.0 (redesign around "model creativity variance") + v4.0.1. LICENSE = **Apache 2.0** (confirmed in the cloned repo): permissive, code is legally BORROWABLE with attribution + NOTICE + "changed-file" notices, even into a proprietary product. Caveat: the v4 differentiator depends on a curated deck of ~188 hand-reviewed "worlds" that is HOSTED (their API / private catalog), NOT in the repo - the mechanism is reusable, the curated data is not ours to take.
- Distribution is their real moat: ~48k GH stars, native GitHub Copilot edit-hooks, ~7-10 harnesses (Claude Code plugin, Cursor, Codex, Gemini CLI, etc.), a Chrome extension, an npm CLI, fully free.
- 23 commands (verb set overlaps sidecoach heavily). `craft` removed. The PRODUCT.md "register" field was RETIRED (verified: grep 0 in their init template) and replaced by four per-SURFACE "modes" (Persuade / Operate / Read / Experience), inferred per surface not per product. They killed the register FOR CAUSE (bias mining showed category-to-aesthetic recipes CAUSED slop).

## RANKED NEW GAPS (v4 opened or materially widened)

1. **Provider-specific defect mining + skill-prose ablation** (genuinely NEW; their strongest DURABLE capability). They sample each target model's real output, publish the distribution (e.g. ~74% of one model's pages used cream/beige bg, ~76% extreme negative tracking, 90%+ sub-WCAG body text) and compile model-targeted counter-rules into the skill AT BUILD TIME; they ablation-test their OWN skill prose across providers x niches and delete lines that PRIME defects. A self-improving measurement loop, not marketing (specific n's/%s). We have the theater-purge CULTURE, zero mechanized version. Fits our existing eval-corpus + Codex substrate. Effort MED-HIGH. **If we borrow ONE thing, borrow this mechanism** - it is the piece the rest of the field cannot easily copy and it sits on rails we already own.

2. **Integrated generative authoring pipeline** (v4.0.0/4.0.1). Not one feature - a chained loop that ships our three long-open gaps AT ONCE: ~188 positive "worlds" DEALT AS CHALLENGERS -> direction ROLLED FROM OUTSIDE THE MODEL'S OWN RANKING (variance fix; they measured 30/35 identical concepts across 16 creativity runs) -> in-browser DECISION PAGE (with re-roll that excludes prior draws) -> RENDERED-BEFORE-BUILD (design-system board + first-surface mock + 3 comps) -> a 5-block build CONTRACT written into the artifact -> a FINISHING-REVIEW subagent that audits the render against the contract promise-by-promise. New idioms we lack entirely: outside-ranking roll (strictly better than our unbuilt "read a log, pick differently"), browser direction-decision, contract-then-verify-render. Effort HIGH but stageable: palette-construction recipe (LOW-MED) -> pre-render authorship (MED) -> outside-ranking roll (MED) -> browser decision (MED-HIGH).

3. **Live Mode vs Justify** (NEW competitive axis - our prior oracle work never compared Justify). See the fold section below. Their Live Mode is well past Justify; effort to reach parity MED-HIGH.

4. **Unified scanner productized across surfaces** (widens our old "one runnable scanner" goal). ONE registry feeds their CLI + browser extension + critique skill + evals + edit-hooks (incl. Copilot) identically; monorepo-aware; daily self-update. We still have this scattered across ~8 modules with no `detect` CLI (the fake one was removed). Our reimplement-and-own ruling still stands - do not vendor - but it is now a shipped product, not a plan. Effort MED (we own the registry; need the real CLI entry + hook wiring).

5. **Taste-frontier rule delta** (widens our taste gap with a count). Theirs ~59 deterministic rules vs our ~42 registry (only 5 of 27 anti-laws have scanners). Classes they have we likely lack: extreme-negative-tracking, thin-border-wide-shadow, repeating-stripe-gradients, oversized-h1, aphoristic-cadence, theater-slop-phrase, numbered-section-markers, cream-palette, sub-11px UI text, soft radial-glow halos, marquees, blinking cursors, decorative dot/grid fields, text-under-overlay, first-viewport-overflow, stock geometric hero art, image-hover-transform. CRUCIAL distinction: theirs is a STATIC engine (htmlparser2 + CSS cascade) on the CLI/hook path; ours is RENDERED Playwright. So this is a COVERAGE-COUNT gap, NOT an engine-truth gap. Cheapest wins: font-family read (the dead list was deleted but the vocabulary lives in fontshare-reference), extreme-tracking, oversized-h1. Effort LOW-MED per rule; our rendered engine can host them.

6. (Minor) surface-purpose modes replacing the register - low moat, low effort, but note they KILLED the register for cause; take the 4 modes, not the register.

## Live Mode -> Justify (the fold; license-cleared, Apache-2.0)

Their Live Mode is architecturally the SAME shape as Justify: an injected client-side script + a local HTTP helper (:8400), NOT a heavyweight browser driver. Flow: `/live` -> pick element -> annotate (command chips + freeform + comment pins + freehand strokes + VOICE) -> 3 real-code variants -> HMR hot-swap carousel -> accept-one writes to REAL source (CSS consolidated into the stylesheet). Plus INSERT mode (scaffold new elements), copy-edit-in-place (a subagent rewrites real source and repairs wired elements), and a durable session journal surviving HMR/refresh/CSP. Framework adapters: Vite/Next/Nuxt/SvelteKit/Astro/TanStack.

Justify today: HTTP-polling daemon (9223/9224) + injected core; user picks an element, types ONE prompt, queues, "Send All"; an operative Claude session polls, edits source directly, returns REAL unified diffs to a Changes panel (Mark Done/Revert/Reply/editor-jump). apply-first-then-review.

RECOMMENDED FOLDS (architecture-respecting):
- **Propose-then-accept gate** - add /propose + /accept: operative stages the diff instead of applying; Changes panel shows Accept/Reject; accept applies+commits. Inverts our apply-then-Revert into Live Mode's nothing-lands-until-you-pick. CLEANEST fit: purely additive HTTP routes, no framework coupling, reuses the diff panel. MED-HIGH. (Worth a quick user check that they want a pre-write gate vs today's proven Revert model.)
- **Scoped client-side N-variant preview** for the CSS/text/trivial-DOM class only, reusing Justify's existing ephemeral Manipulate/marker apply path; carousel pick -> operative writes the chosen diff. MED. Honest limit: structural/component variants can't preview faithfully without a real build (which is exactly why they lean on HMR) - those fall back to apply-then-review.
- **Command-chip annotation row** wired to SIDECOACH VERBS (not a parallel vocabulary). HIGH, cheap.

DO NOT FOLD:
- Framework HMR hot-swap (temp components + per-framework adapters). It is the flashy part but would forfeit Justify's single biggest edge: FRAMEWORK-AGNOSTICISM (it runs on WordPress/static/Astro where there is NO HMR). Justify's reload-after-edit is already faithful, just slower.
- "Comps before code" image generation (wrong product mode + provider image-gen dependency).
- The full 23-command taxonomy inside Justify (sidecoach's territory; borrow the vocabulary, not the surface).

## STILL AHEAD / KEEP (do not adopt their versions)
- Rendered Playwright engine on the CI/hook path (computed styles, rendered WCAG over a walked tree). Their CI/hook path is STATIC; they render only in the browser extension. Real (narrow) render-truth lead - do NOT switch to static-only to chase their speed.
- Fail-closed honesty (audit returns inconclusive not clean; BAN_SCANNERS makes a false-pass inexpressible). A static scanner silently skips hidden/sr-only.
- INDEPENDENCE discipline (held-out corpus, author != labeler, independent-MODEL subjective labeling, cross-model Codex gate). Their evals are now REAL and heavy (reported ~$2,600 / 200 concepts / ablation) - the "do they even measure" edge is GONE; our remaining edge is that their evals are SINGLE-VENDOR self-eval and ours are independent. Lean on independence.
- Beats memory (cross-session/cross-machine). They have snapshot persistence + ignore.md, not a memory corpus.
- Token-drift governance, browser-evidence hermeticity, icon-source provenance.
- DO NOT ADOPT: 59 rules as 59 hand-maintained rules (adopt the ~17 CLASSES, not the count - "more capable AND simpler"); the register (killed for cause); a vendored world-deck (IP + reimplement-and-own - build our own generative substrate if we build one).

## META (matters most)
This is the FIFTH borrow list. The prior four never drained; named-vibe-variants.md captured ~14 of these exact gaps on 2026-05-25, unwired. The three gaps we keep re-capturing (generative / visualizer-authorship / anti-sameness) are the SAME three v4 just shipped as ONE integrated pipeline - the gap is COMPOUNDING while we spend cycles on honesty defects. The risk is not missing the gap; it is capturing it a fifth time and shelving it. If we act on one thing: the defect-mining MECHANISM (#1) - durable, self-improving, and it fits our existing eval + Codex substrate better than the generative UI does.

## Provenance / caveats
- All intel is teammate-fetched (4 agents) + my grounding. I did NOT independently re-verify every claim; exact rule/world counts are soft (their own pages disagree). The load-bearing strategic findings (defect-mining loop, integrated generative pipeline, Live Mode parity gap, Apache-2.0 borrowability) are corroborated across 2+ agents.
- A read-only Apache-2.0 clone was left at /tmp/oracle-v4 (outside our tree, never committed) for a future fold spike.
- 4 teammates torn down after reporting.

## Files touched
- this beat + MEMORY.md index. No code changed - analysis only.
