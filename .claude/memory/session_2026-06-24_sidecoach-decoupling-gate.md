---
name: sidecoach-decoupling-gate
description: Lead gate of the render-decoupling probe + scanner-SHIP + subjective-frontier plan (Stage 1)
type: decision
relates_to: [session_2026-06-23_sidecoach-stage0-lead-verification.md, session_2026-06-23_sidecoach-reference-integration-plan.md]
---

Collaborator: Jonah Cohen.

Lead gate of the architect's Stage-1 milestone surface (commit cccea748 "render-decoupling probe + result + scanner SHIP").

## Decoupling probe (eval/decoupling-probe.mjs) - read the logic myself
The probe re-renders 20 objective-defect held-out pages the product's OWN way TWICE and compares:
- HERMETIC: analyzeHtmlOnBrowser default (scripts stripped, 1280x800)
- PERTURBED: { stripScripts:false, viewport 1366x768 } (scripts ON, different viewport), abort-external still ON
Reported by architect: recall 0.815 (22/27) BOTH arms; per-page detections identical 20/20; 0 class flips => "render-ROBUST."

## My ruling on it
ACCEPT as a check that PASSED and COULD have failed (had it DROPPED, that would have been damning coupling evidence). But CORRECT the strength framing:
- The perturbation is WEAK on THIS corpus: pages are self-contained static captures, and the objective defects (contrast pairs, heading order, broken-image src) are largely viewport-invariant and script-invariant. So "scripts ON + viewport change" barely bites => 0 flips is CONSISTENT WITH robustness, not STRONG proof of it. It is corroborating, not dispositive.
- The architect's own caveat is the right one and is the dispositive gap: abort-external stayed ON both arms, so the EXTERNAL-RESOURCE render dimension (real pages with external CSS/fonts) is UNTESTED = the deferred S5b. That is where a real page's render diverges most from hermetic.
- Engine coupling (both arms are Chromium; product + referee both read getComputedStyle) is UNTESTABLE here and is a NON-ISSUE BY DESIGN: Chromium's computed color IS the legitimate ground truth for rendered appearance; the independence that matters (product spec-math is SEPARATELY IMPLEMENTED from referee spec-math) is already proven by the import-guard test, not by this probe.

Net: the eval-objective achievement (working, render-robust-to-script+viewport, spec-correct a11y scanner) is GENUINE; the OBJECTIVE claim still may not be finalized until S5b (real-page external-resource render + decoupling). Layers: (1) import-coupling = ruled out by import-guard [SOLID]; (2) render-state coupling = this probe, partial/weak-on-corpus, honestly scoped; (3) engine coupling = non-issue by design.

## Asked the architect to confirm before I bank it
- perturbed-render errors count (line 56 perturbErrors) MUST be 0, else empty-set pages fake "no flip."
- Did ANY page actually render DIFFERENTLY between the two arms? If literally nothing changed, the probe is near-vacuous and we say so plainly rather than bank it as "STRONG."

## Scanner SHIP
KNOWN_ROLES == WAI-ARIA 1.2 82 non-abstract roles; no remaining BLOCKER/HIGH across broken-image(currentSrc), heading(role-token+aria-level), contrast(compositing/indeterminate), justified(block-of-text), 2 visibility predicates; calibration 31/31; batch-2 = 10+5+1 Codex findings folded across 3 passes. Accept as SHIP for the OBJECTIVE axis, claim still gated on S5b.

## Subjective/taste frontier plan - gate stance (see beat body for the 5 conditions)
Plan is rigorous (dev-corpus-first, held-out-90-as-milestone-only, reuse existing engines). My gate conditions:
1. dev-corpus disjointness MECHANICALLY enforced (URL/content-hash), not "asserted".
2. author!=labeler preserved: Codex labels dev corpus BEFORE architect tunes; rule-author freeze applies.
3. precision is a FIRST-CLASS gate, not afterthought - a taste detector that fires on everything fakes recall.
4. dev corpus sampled RULE-AGNOSTICALLY before rules written (no page-fit).
5. FULL 22-class -> engine mapping required up front, so no class is silently dropped AND the "no new engine" simplicity claim is verified against ALL 22 (esp. MOTION classes layout-transition/bounce-easing, which may need a motion-declaration signal the rendered engine doesn't give).

## 22-class engine map - GATE RULING (condition 5 deliverable)
Architect delivered the full map: RENDERED engine 18 (13 idiom + 5 typographic, ~5 already exist in sidecoach, ~13 to build), TEXT engine 2 (marketing-buzzword, aphoristic-cadence), NEW SIGNAL 2 MOTION (layout-transition, bounce-easing). 18+2+2=22, no class dropped.

MOTION disclosure ACCEPTED as honest + correct: the objective render ZEROES animations/transitions for determinism, so a zeroed computed transition-duration is 0 and structurally CANNOT see motion. The 2 motion classes need a new SIGNAL = reading raw CSS transition/animation DECLARATIONS (transition-property/timing-function, animation-name + @keyframes easing) from stylesheets/CSS-text, NOT the zeroed computed style. "No new ENGINE" holds; this is a new SIGNAL, no new dependency. Approved WITH constraint: keep it a tight contained CSS-declaration reader, validated by its own calibration fixtures (bouncy page -> present, fade-only -> absent), not a sprawling CSS parser.

TWO CONDITIONS I ADDED (beyond the original 5):
6. RENDER-BASIS PARITY (the subjective-axis analog of decoupling/S5b): the Codex labeler judges taste from the RENDERED SCREENSHOT (per subjective-rubric.md), while the detector reads COMPUTED-STYLE from a hermetic render. Those two MUST come from the SAME self-contained capture / same render settings - else we measure render-divergence (label says cream from screenshot, detector reads different color from a divergent render) as if it were detection error. Same self-contained HTML feeds both the screenshot and the computed-style read.
7. NO GRANDFATHERING: the ~5 already-existing sidecoach taste detectors (frozen at oracle 3.1.1, never synced per the gap analysis = likely stale) get the SAME treatment as the 13 new - calibration fixtures + dev-corpus recall + per-class precision. Name which 5 exist so the baseline is explicit; do not pass them through unverified.

Map APPROVED. ST1 nod is CONDITIONAL: the map clears, but ST1 detectors still wait for the dev corpus to be BUILT + Codex-LABELED first (condition 2 ordering) - map-clearance != ST1-start.

## ST0 condition-1 (disjointness) - VERIFIED PASS (commit aae67d9f)
Dev corpus = 22 self-contained SaaS/AI landing-page captures (linear, framer, supabase, clerk, retool, loom, posthog...). I read dev-corpus-disjoint.test.mjs (fail-closed, exit 1 on any overlap; checks content-sha + provenance host vs the frozen candidates.json), ran it (PASS: 22 dev pages, 0 overlap), and verified NON-VACUITY myself: eval-90 has 43 distinct provenance hosts (gov.uk/python.org/github.com/news.ycombinator.com...), dev has 22 (linear.app/framer.com/...), intersection = 0. The two sets are disjoint by character (general web vs SaaS landing), not passing for a vacuous reason. Condition 1 GENUINELY satisfied. Soft note: test SKIPs (exit 0) if dev-manifest.json is missing - acceptable since it's committed+present, but a stricter fail-closed would error on missing inputs. NEXT GATE: after Codex-labeling, the per-class COVERAGE map - classes with 0 dev instances can't be developed against the dev corpus (only measurable on the un-tunable held-out 90), so I need non-trivial multi-class coverage before ST1; the SaaS-only sample may under-represent editorial classes (italic-serif-display, numbered-section-markers, all-caps-body, nested-cards). Reframe locked: decoupling corroborating-not-dispositive, "capability gain + PARITY never beat" on objective until S5b, scanner SHIP objective-axis-only.

Files: eval/decoupling-probe.mjs (read), independent re-run launched (b8ng1iiq0).
