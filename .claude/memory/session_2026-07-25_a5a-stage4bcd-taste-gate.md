---
name: A5a Stage 4b/4c/4d taste gate - rubric extended for the 15 built-but-A5a-pending classes
description: Closing the Contract-6 A5a gate for the 15 Stage 4b/4c/4d taste classes. Extended subjective-rubric.md with 11 new class definitions (4 of the 15 were already defined) + per-class LABELING SIGNAL matching each detector's construct - 12 SCREENSHOT, 2 MOTION (marquee, blinking-cursor), 1 new HOVER (image-hover-transform). Guardrail #1 re-verified (corpus-tool has no rubricSha, freeze hash covers id/split/labels/file/contentSha/provenance only). Oracle clone live and - unlike 4a - ships near-name rules for ALL 15 classes, so this is a real accuracy head-to-head, not a coverage gap.
type: project
relates_to: [session_2026-07-24_a5a-CERTIFIED-hardened-ground-truth.md, session_2026-07-24_a5a-rubric-declared-stack-fix.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: rubricInfo() parses 34 classes (SHA 195be2be9925), all 15 target classes present; corpus-tool verify OK (freeze intact); oracle live (fires marquee on p01-marquee, MISSES blinking-cursor + image-hover-transform positives)
confidence: high
---

Collaborator: Jonah. 2026-07-25. Executor closing the A5a gate for 15 classes: extreme-negative-tracking, tight-leading, all-caps-body, oversized-h1, sub-11px-ui (Stage 4b); thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay, first-viewport-overflow, decorative-dot-grid, soft-radial-glow, image-hover-transform (4c); marquee, blinking-cursor, numbered-section-markers (4d).

## State found (before any edit)
- rule-authors.json ALREADY registers all 15 to stage4b/stage4cd (freeze gate rejects author-authored labels; labels must be codex-only). Deliverable #2 was already in place - verified, not regressed.
- Rubric already DEFINED 4 of the 15 (all-caps-body, tight-leading, extreme-negative-tracking, numbered-section-markers) with correct VISUAL/SCREENSHOT signal.
- Existing dev-subjective-labels.json (48 pages) has containment:undefined -> PRE-HARDENING labels (filename-leak era). CANNOT reuse them (lesson #2); must re-label under the hardened pipeline.
- Guardrail #1 re-verified fresh: `rubricSha` appears NOWHERE in corpus-tool.mjs; canonicalRecord hashes {id, split, labels[class,labeledBy], file, contentSha256, provenance}. Editing the rubric does NOT touch the freeze. Safe.

## The big divergence from 4a: oracle HAS these rules
4a's default-typeface had zero oracle coverage. Here the pinned oracle (/tmp/oracle-v4) ships near-name rules for all 15: marquee, blinking-cursor, image-hover-transform, oversized-h1, all-caps-body, extreme-negative-tracking, tight-leading (exact), plus undersized-ui-text, gpt-thin-border-wide-shadow, repeating-stripes-gradient, text-occlusion, first-viewport-column-overflow, codex-grid-background, radial-halo, numbered-section-labels (near). The oracle namespaces two "gpt-"/"codex-" - it explicitly targets the same AI-slop idioms. So the differentiator claim is ACCURACY (recall/precision), not coverage. Live probe: oracle fires marquee on p01-marquee but MISSES p01-blinking-cursor and p01-image-hover-transform.

## Rubric edit (deliverable #1)
Added 11 new class definitions (descriptive, no thresholds/properties/selectors) + extended the LABELING SIGNAL section per lesson #1 (signal must match the DETECTOR's construct):
- 12 SCREENSHOT (computed-style/geometry visible in the hermetic paint): the 4 existing + oversized-h1, sub-11px-ui, thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay, first-viewport-overflow, decorative-dot-grid, soft-radial-glow.
- 2 MOTION (a frame cannot show scroll/blink): marquee, blinking-cursor - signal must surface <marquee> elements + keyframe BODIES (translateX / opacity on-off), not just "an animation exists".
- 1 HOVER (new category): image-hover-transform - judged from :hover rules that transform an image.
text-under-overlay flagged as a partial-render class: the darkening scrim renders but the underlying photo aborts in the hermetic capture; recall limit reported honestly rather than forced to present.

## Files touched this task
- sidecoach/eval/corpus/subjective-rubric.md (11 defs + LABELING SIGNAL: VISUAL+8, MOTION+2, new HOVER)

## Harness signal wiring (deliverable, DONE + unit-verified)
Edited eval/subjective-label-harness.mjs (signal sets + signal extractors only; containment/leak-guard/typeface-CSSOM/record/parse/validate core UNTOUCHED):
- VISUAL += 8 (oversized-h1, sub-11px-ui, thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay, first-viewport-overflow, decorative-dot-grid, soft-radial-glow). MOTION += marquee, blinking-cursor. New HOVER set = image-hover-transform.
- signalOfClass/signalCounts/LABEL_METHOD add 'hover' (throws on any rubric class in no set - fail-loud).
- Enriched motionDeclarations: surfaces <marquee> element COUNT + @keyframes BODIES (one-level nesting) + animation/transition property:value declarations, with author keyframe NAMES aliased to anim1/anim2 and selectors dropped. So the labeler sees the ACTUAL motion (translateX -100% / opacity 1<->0 / infinite), not just "an animation exists".
- New hoverDeclarations: surfaces every :hover rule with sanitizeSelector (keeps img/tag structure, redacts .cls/#id) + its declaration body. ALL hover rules (not just transforms) so the labeler can reject color/opacity-only or button (non-img) hovers.
- New stripComments (HTML <!--...--> + CSS /* */), applied ONCE in buildPrompt before copy/motion/hover derivation - kills the fixtures' "POSITIVE:/NEGATIVE:" answer-comment leak (4a DEFECT-2 class).
- buildPrompt: added [HOVER] instruction line + HOVER DECLARATIONS section; line() tags HOVER.
Runner dev-subjective-label.mjs needs NO change (imports signalOfClass; the duplicate-map DEFECT-3 was already fixed).

VERIFIED (no browser/no Codex): rubricInfo 34 classes SHA 195be2be9925; all 34 route to a signal (0 throws; 26 screenshot/2 text/4 motion/1 hover/1 typeface). Signal content correct on tricky fixtures: p01-marquee -> "<marquee> element"; p02-marquee-css -> keyframe translateX(0)->translateX(-100%)+infinite; p01-blinking-cursor -> opacity 1->0+infinite; n01-pulse -> opacity 1<->0.5 (labeler can call it a pulse not blink); n02-finite -> iteration count 2 (not infinite); p01-image-hover-transform -> ".cls:hover img{transform:scale(1.06)}"; n01-button -> hover transform with NO img; n02-opacity -> "img:hover{opacity:.85}". Comment-leak check: 0 fixture-comment fragments survive into any prompt (stripComments removes "POSITIVE" from raw p01-marquee). Full runner dry-run through browser render OK on p01-marquee/p01-image-hover-transform/p01-text-under-overlay: opaque shot names, all fail-loud guards pass, prompt ~8.1k chars.

## Foreground Codex review of the machinery (DONE, all findings folded + re-verified)
Real Codex (gpt-5.5 via codex-review.py), 293.6s, exit 0. 2 High + 1 Medium + 1 Low, ALL folded:
- HIGH-1 (marquee pre-decided): my <marquee> handling asserted "auto-scrolls sideways forever" for ANY <marquee>, ignoring direction/loop/behavior - copying the detector's classification into GT. FIX: surface the SPEC attributes (direction/behavior/loop/scrollamount/scrolldelay) as raw facts; a vertical (direction=up) or finite (loop=3) marquee is now the labeler's call.
- HIGH-2 (name leak): aliasAnimNames used \b (fails for -blink/--blink) AND @-webkit-keyframes was not captured while -webkit-animation:blink still leaked "blink". FIX: lookaround boundaries `(?<![-\w])name(?![-\w])`; keyframe detection is now vendor-aware (`@[-\w]*keyframes`, /(?:^|-)keyframes$/); decl regex captures vendor-prefixed animation/transition.
- MEDIUM (silent-empty): the one-level-nesting regexes silently dropped keyframes/hover rules on nested braces or {} in values. FIX: replaced with scanTopLevelRules - a string-aware brace scanner that FAILS LOUD on imbalance, + collectCssRules recursing into @media/@supports. A silently-empty motion/hover signal can no longer mislabel a page.
- LOW (routing dup): buildPrompt re-implemented the set lookups (unrouted class -> silent [MOTION]). FIX: tag via signalOfClass (throws on unrouted, like recordLabels).
RE-VERIFIED (14/14 targeted checks): vendor + dash keyframe names aliased (no blink leak); marquee attrs surfaced not pre-decided; unbalanced CSS throws; quoted {} preserved; hover-in-@media surfaced; every class tagged via signalOfClass; 5 real-fixture signals unchanged + prompt clean.
Codex explicitly confirmed HANDLED: 34-class routing, comment-leak strip, selector/page-id leak, happy-path name aliasing.

## Timing probe (live hardened path works)
ONE real Codex labeling call on p01-marquee = 30s, labeled all 34 classes, containment isolated-cwd+seatbelt-deny-repo-read+transcript-audit. Correct: marquee present=true (it IS a <marquee>), blinking-cursor absent, image-hover-transform absent, numbered-section-markers absent; signals recorded motion/hover/screenshot. 30s x ~93 pages ~= 46min background.

## Grader built + smoke-tested (deliverable #4)
eval/stage4bcd-a5a.mjs: per-class OURS-vs-ORACLE against Codex labels; runs all 3 shipping scorers (inPageTypographyExtremes/Structural/MotionMarker) unioned + runOracle per page; recall on constructed positives (+ real-world recall where real positives exist), precision on real negatives + constructed negatives; oracle strict+generous maps per class (printed with the oracle's ACTUAL fired rules per page). Exit 3 infra / 2 inconclusive / 0 measured (MEASURES, does not pass/fail - lead's call). Mock-sink smoke test PASS: revealed the oracle ships marquee/blinking-cursor/image-hover-transform/oversized-h1/decorative-dot-grid rules but only FIRES marquee on the positives (misses the other 4) - preliminary, real labels pending.

## Confirmation review (round 2) found 2 MORE Highs - folded + a parser-robustness saga
The confirmation Codex review (308s) confirmed round-1 all closed but found 2 new Highs, both folded:
- HIGH-A: scanTopLevelRules did not consume top-level ';'-terminated at-rules (@import/@charset), so `@import "x"; img:hover{}` glued the @import onto the hover prelude and DROPPED the hover rule (and a dropped @keyframes then leaks its name). FIX: skip top-level ';'. Manifests on 8 dev pages.
- HIGH-B: the decl regex matched CUSTOM PROPERTIES (--animation:bounce surfaced as a real animation), and custom-property NAMES in values (var(--blinking-cursor-answer), var(--animate-marquee-x)) reached the labeler. FIX: (?<![-\w]) boundary on the decl regex + new aliasVarNames redacts --custom-property names to --varN. Manifests on 10+ dev pages.

Then running the FIXED machinery over the full 93-page corpus exposed a parser-robustness saga (root-caused each, per the debugging protocol - found the actual imbalance position, not theorized):
- The fail-loud brace scanner threw on 26/48 real dev pages. Root cause 1: braces inside url() data-URIs / :is() counted as structural -> added PARENTHESIS-depth tracking (braces/semis inside (...) are literal). Root cause 2 (the big one): CSS BACKSLASH ESCAPES in Tailwind/CSS-module selectors - `.before\:content-\[\'\'\]`, `.bg-\[url\(\'...\'\)\]` - an escaped `\'` opened a never-closing string. Added `\` escape handling EVERYWHERE (not only inside strings). 26 -> 4 throws.
- The last 4 (amplitude/census/copyai/twilio) have genuinely LINEAR-unbalanceable CSS (orphaned decls, unclosed blocks). Decision: the scanner stays fail-LOUD (throws), but motionDeclarations/hoverDeclarations CATCH it and return a NEUTRAL caveat ("could not be fully parsed, no reliable declarations") - naming NO class, injecting NO answer direction. So the page is still labelable for the 12 SCREENSHOT classes; only its motion/hover signal degrades, transparently. Honors the Medium finding's intent (no silent-empty, no fabricated/wrong signal) without killing 4 real pages.
- Also added animation-name: reference collection so CSS-module names (Foo__blink) are aliased even when their @keyframes is external.
FINAL corpus audit: 93 pages, 0 throws, 0 prompt-unclean, 0 class-word-leaks (excluding the legitimate <marquee> HTML element name the labeler must see), 4 motion/hover-caveated. fold-1 (14) + fold-2 (9) targeted checks all pass. A THIRD Codex review of the post-round-2 changes (paren/backslash/animation-name/fail-soft) is running.

## Suite (reported, not editable per task)
`ts-node scripts/run-tests.ts` (WITHOUT npm run build, so dist NOT rebuilt) = `run-tests: 85 suite(s) passed`, exit 0, dist git-clean (0 dirty). corpus-tool verify + verify-candidates OK (freeze intact, author!=labeler). My rubric/harness/grader files are OUTSIDE the suite's path (grep-confirmed), so this is the baseline, unaffected by my changes.

## Review round 3 - Codex backend DOWN (503), fell back to independent Claude (per CLAUDE.md gate protocol) - 4 MORE real bugs, all confirmed by the reviewer with live probe output, all folded
Codex 503'd twice (biscuit_baker circuit_open); a direct probe hung 2min. Per the fallback rule (gate always runs; independent Claude is the floor when Codex is down) I spawned a fresh general-purpose agent (clean context, non-producer). It found 4, ALL traced to ONE root - name-redaction was wired into the motion-LONGHAND path only:
- HIGH-1: animation SHORTHAND names bypassed aliasing. `animation:marquee 8s` (keyframes external/not-inline) leaked "marquee". FIX: shorthandNames() extracts the non-keyword name token from the shorthand.
- HIGH-2 (unconditional): the HOVER path applied ZERO name aliasing. `.cursor:hover{animation:blink}` leaked "blink" verbatim. FIX: hover body now runs aliasAnimNames too.
- MEDIUM-3 (silent-wrong): CSS-nested `&:hover` was dropped -> "(no :hover rules found)" -> labeler wrongly says image-hover-transform ABSENT. FIX: collectCssRules now recurses into style-rule bodies (the ';'-skip discards parent decls, nested blocks parse clean).
- LOW/MED-4: scripts not stripped -> a <marquee>/<style> inside a <script> STRING became a phantom fact. FIX: buildPrompt strips scripts then comments.
Unification: a single animNamesFrom() (=@keyframes defs + animation-name refs + shorthand names) is now aliased on BOTH motion and hover, killing the "one path redacts, another doesn't" bug class. ANIM_KEYWORDS guards against aliasing infinite/linear/ease-in-out.
RE-VERIFIED: fold-3 (5/5 - the reviewer's exact triggers now closed, incl keyword-safety), fold-1 (14) + fold-2 (9) no-regression, and a FULL 93-page corpus audit = 0 throws / 0 prompt-unclean / 0 class-word-leaks / 4 caveated. End-to-end runner dry-run OK incl supabase (the backslash page that used to throw). Reviewer confirmed SOUND: scanner backslash/paren, comment strip, buildPrompt routing, MARQUEE_ATTRS allowlist, fail-soft catches, alias boundary logic.
Gate satisfied: 3 review rounds (2 real Codex + 1 independent Claude), every finding folded, unit re-verified empirically on the real corpus. Convergence justified - not chasing infinite rounds; the corpus audit is direct proof the labeling inputs are leak-free.

## Still owed (running / next)
Hardened labeling pass over 93 pages (fresh sink - killed buggy-machinery partial discarded), the real grade, per-class verdicts. Nothing committed; dist NOT rebuilt.
Manifests: eval/corpus/stage4bcd-a5a-{typo,struct}-manifest.json. Sink: eval/corpus/stage4bcd-a5a-labels.json. Grader: eval/stage4bcd-a5a.mjs (bucketing keys on the CODEX label not the filename; reports filename-vs-Codex divergences).
