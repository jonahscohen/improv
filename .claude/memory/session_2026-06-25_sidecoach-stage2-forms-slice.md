---
name: sidecoach-stage2-forms-slice
description: Stage 2 vertical slice BUILT - 5 strongest forms-a11y rules absorbed from ExtendedDomainValidator into the registry (owner static-a11y, markup evidence) reimplemented registry-quality + own test. Proves the absorb mechanism. tsc/generate/golden green; full suite confirming.
type: project
relates_to: [session_2026-06-25_sidecoach-extended-validator-triage.md, session_2026-06-24_sidecoach-stage2-codex-verdict.md]
---

Collaborator: Jonah Cohen (full autonomy). Building the merged Stage 2 (absorb + migrate) per the Codex decide-together triage. Vertical-slice-first approach to de-risk.

## SLICE BUILT (5 forms-a11y rules absorbed)
Reimplemented the 5 highest-signal FORMS rules registry-quality (NOT verbatim global-haystack, per Codex) reading ctx.markup with a hasFormMarkup applicability guard (N/A when no form controls):
- a11y.form-control-labelled (FORMS_016, blocker) - <label>/aria-label/aria-labelledby present.
- a11y.form-error-association (FORMS_018, major) - aria-invalid + aria-describedby when an error state is expressed.
- a11y.form-placeholder-not-label (FORMS_019, major) - placeholder not standing in for a label.
- a11y.form-input-type (FORMS_002, minor) - specific input types, not bare type=text everywhere.
- a11y.form-choice-label-target (FORMS_015, major) - checkbox/radio label association.
All: owner static-a11y (forms-a11y belongs in the a11y validator - no new validator/fixtures needed), findingClass a11y, evidenceRequirements ['markup'] (statically satisfiable), scope project, vocab 'extended-domain', aliases keep old FORMS_NNN resolvable.

## FILES
- product-rule-types.ts: +`'extended-domain'` SourceVocabulary.
- validators/checks/forms-checks.ts (NEW): 5 reimplemented checks (haystack from ctx.markup + html; hasFormMarkup guard).
- validators/checks/index.ts: spread FORMS_CHECKS.
- product-rule-registry.ts: +5 RAW_RULES (static-a11y forms section).
- validators.generated.ts: regenerated (static-a11y now owns 12).
- __tests__/product-rule-registry.test.ts: golden +5 rows, counts 36->41, static-a11y 7->12.
- __tests__/forms-checks.test.ts (NEW) + run-tests.ts registration: proves N/A guards + pass/fail per check.

## VERIFY
tsc clean; generate --check OK (registry valid, no drift); golden green; forms-checks.test green (direct run). Full `npm test` running to confirm no regression (the forms rules are N/A on non-form pages, so detection-preserving for existing static-a11y tests unless one has form markup with a real issue - watching for that).

## REGRESSION + FIX (dedicated forms validator)
First slice attempt put the 5 forms rules in the EXISTING static-a11y validator -> broke 2 suites: (1) validator-fixtures-e2e static-a11y/clean expected clean, got inconclusive (the forms rules are REQUIRED markup rules but static-a11y/clean is CSS-ONLY -> no markup -> inconclusive -> blocks); (2) product-validator-pipeline expected 'findings', got 'inconclusive' (the required forms rules with no markup in that unit context downgraded the status). Same root cause: I added REQUIRED markup rules to a validator exercised in markup-FREE contexts.
FIX = dedicated `forms` validator (the architecturally-correct choice anyway - one domain, one owner): moved the 5 rules to ownerValidatorId 'forms'; registered it in VALIDATOR_REGISTRATIONS + FIXTURE_MANIFEST (non-gating for now, lane behavior unchanged); created fixtures/forms/{clean=labelled form, findings=unlabelled input->blocker fail, inconclusive=.gitkeep/no markup}. static-a11y is untouched -> both failures resolved. Verified: validator-fixtures-e2e OK, product-validator-pipeline OK, golden OK (static-a11y back to 7, forms owns 5, RULES still 41), tsc clean. Full suite confirming.

## SELF-ANALYSIS (per protocol)
Why it broke: I assumed "forms-a11y belongs in static-a11y" and added required markup rules WITHOUT checking that static-a11y is exercised in CSS-only/markup-free contexts (its clean fixture is styles.css only; the pipeline test feeds no markup). A required rule whose evidence is absent returns inconclusive and blocks. Prevention: when adding a rule to an EXISTING validator, FIRST check that validator's fixtures + unit-test contexts actually supply the rule's evidence kind; if not, give the new rule its own validator with matching fixtures. A dedicated owner per domain also avoids this coupling and matches the convergence goal.

## SLICE COMPLETE + GREEN (2026-06-25)
**Full suite: 62 suites passed, zero real failures.** forms-checks test green. Both regression-suites (validator-fixtures-e2e, product-validator-pipeline) green. clean fixture VISUALLY verified (Playwright file:// screenshot, Read: renders a labelled Email input + wrapped "I agree" checkbox + Submit - every control labelled = correct clean fixture). Slice diff sent to codex-arch-review for the produce-and-verify gate (scratchpad/stage2-forms-slice.diff -> findings to stage2-forms-slice-findings.md). GATED on Codex's review before scaling the pattern (this slice IS the pattern for ~30 more absorbs - fold issues before replicating).

## CODEX SLICE REVIEW FOLDED (CONDITIONAL-PASS -> resolved)
Codex reviewed the slice diff: no P0, 2 P1 + 1 P2. Folded all:
- **P1 FORMS_002 severity downgrade:** I'd silently dropped legacy 'high'->major to 'medium'->minor. Fixed: sourceSeverity 'high' (provenance preserved) + severity 'minor' + severityOverrideReason ('input-type is a UX keyboard/validation hint, not a blocking a11y failure; advisory-not-gating by design'). Documented deliberate downgrade.
- **P1 stale dist/:** dist/ is git-tracked (1148 files) + the eval path imports it; it omitted the forms slice. Fixed: `npm run build` rebuilt dist - now has dist/validators/checks/forms-checks.js + the forms validator + rules.
- **P2 weak fixtures:** enriched fixtures/forms/findings to trip ALL 5 rules (was only 1).
**BUG CAUGHT during the fold (verify discipline):** checking the findings fixture PER-RULE (not just status) revealed only 2/5 rules failed - my fixture's HTML COMMENT contained the literal strings the checks search for ("<label", "aria-label", "placeholder"), so the raw-markup haystack matched them -> 3 false PASSES. Root robustness issue: the checks (like the legacy) matched raw markup INCLUDING comments. FIX = strip HTML comments (`/<!--[\s\S]*?-->/g`) from the haystack in forms-checks.ts before matching - a genuine registry-quality improvement over the legacy. Re-verified per-rule: clean=all pass/N/A, findings=ALL 5 FAIL, inconclusive=all inconclusive. This is exactly why per-rule verification beats status-only.

## BATCH 2 DONE: all 16 FORMS rules absorbed
Added the remaining 11 FORMS rules (001 autocomplete, 003 inputmode, 004 paste-block, 005 spellcheck, 007 idempotent-submit, 008 inline-errors, 009 focus-first-error, 011 no-pm-non-auth, 014 textarea-submit, 017 no-pre-disable, 020 autofocus) to the `forms` validator - reimplemented registry-quality on the shared comment-stripped haystack + N/A guards. Honest severities: strong markup checks major (paste/autocomplete/inline-errors), enhancements minor, weak keyword-proxies non-blocking (009 focus-first downgraded high->minor with override; 020 autofocus advisory). Per-rule probe confirmed all 16 fire correctly (NoPasswordManager is a fail-or-N/A anti-pattern detector by design, no pass branch). forms-checks.test now asserts all 16 (N/A + fail + pass). golden updated (RULES 41->52, forms 5->16, generated from registry to avoid typos). tsc/check/golden green, dist rebuilt. Full suite confirming.
Registry now 52 rules (36 Stage-1-era + 16 forms). The `forms` validator owns 16; ExtendedDomainValidator still has them (deletion after gesture+Tier-2+migration).

## OVER-FIRING CAUGHT + FIXED (batch 2 verify)
Full suite caught the new rules OVER-FIRING on the clean fixture (status findings, not clean): autocomplete + inline-errors (major) failed a simple clean form, plus spellcheck/idempotent minor noise. Root: the weak keyword-proxy rules fired even with no relevant context. FIX (more honest applicability):
- form-inline-errors: N/A unless the form expresses an error/validation concept (error/invalid/required/validate) - consistent with form-error-association; an error-free form is not failed for lacking error UI.
- form-idempotent-submit: N/A unless PROGRAMMATIC/async submission is signalled (onSubmit/handleSubmit/fetch/axios/useMutation) - a plain native form post does not need an in-flight guard, so static forms are not nagged.
- clean fixture made exemplary: email input gets autocomplete="email" + spellcheck="false" (+ form action) so autocomplete/spellcheck pass.
Re-verified per-fixture: clean=clean (0 fails), findings=findings (7 fails), inconclusive=inconclusive. forms-checks.test updated (idempotent needs async signal, inline-errors needs validation concept; +N/A cases). This is the weak-proxy noise concern surfacing concretely - the fix makes them advise only when relevant.

## CODEX BATCH-2 P1 FOLDED: JS/JSX comment stripping
Codex batch-2 review (file was truncated by a write interrupt; asked it to re-write) surfaced P1: my comment-strip only removed HTML `<!-- -->`, not JS/JSX `//` and `/* */` - so a `// add a <label>` comment in a .tsx (collected as markup) would still false-pass. FIXED: haystack now strips HTML comments + `/* */` block comments + `//` line comments (the line strip guarded by `(^|[^:])` so it does NOT eat `https://`). VERIFIED edges: a tsx `// TODO add <label>` -> control-labelled correctly FAILS; a label containing `https://x.com` -> still PASSES (URL survives). forms unit test green, 3 fixtures correct.

## CODEX BATCH-2 REVIEW FOLDED (verdict FAIL -> fixes applied)
Codex batch-2 verdict was FAIL until 2 issues fixed (rest P2). Folded:
- P1 JS/JSX comment strip: DONE (extended haystack, verified edges).
- P1 form-inline-errors over-fired on bare `required`: a native `<input required>` triggered a MAJOR inline-error failure. FIXED: guard now only fires on an actual error STATE (error/invalid), dropped required/validate. Native-required form -> N/A.
- P2 form-no-pre-disable-submit regex: dropped legit isDirty/isComplete gates (false positives), broadened to validity concepts with object-access (`disabled={!formState.isValid}`) + formvalid/cansubmit. Test locks: !isValid fail, !formState.isValid fail, !isDirty pass.
- P2 form-idempotent-submit async guard: dropped bare 'mutation' (matched mutationType), added 'mutateasync'.
Re-verified: forms unit test green (16, +new cases), 3 fixtures correct (clean/findings/inconclusive). Rebuilding dist + full suite.

## STRATEGIC DECIDE-TOGETHER PENDING (gesture/Tier-2 absorb-vs-retire + priority)
Read the 6 MOTION_GESTURE rules: all hasDragInteraction-guarded (harmless) but WEAK keyword-presence (h.includes('velocity'/'momentum'/'pointerid')), very niche. Raised to Codex: (A, my lean) absorb 6 gesture + cherry-pick only genuinely-strong Tier-2, RETIRE the rest as theater with honest display; vs (B) absorb all per its original list. Core question: is preserving weak keyword-proxies real capability or moved theater? And should priority pivot to MIGRATION + DELETION now that the substantive forms absorb is done? Awaiting Codex's full re-written findings + verdict.

## NEXT (decided once Codex verdict lands)
- Per the verdict: cherry-pick/absorb strong remaining rules OR pivot to migration. Then MIGRATE ~19 call sites to registry + DELETE ExtendedDomainValidator + honest display.
- ASSESS the ~27 Tier-2 candidates (CONTENT/TOUCH/IMGPERF/PERFX/DARKMODE/CHART/MOTION_HF/MOTION_PAIR/CHARSUB/COPY) - absorb the real ones.
- MIGRATE the ~19 call sites alias-by-alias (display-preserving per Codex: legacy reports for display until alias retired; never inject static results into ProductValidationResult). Honest display collapse for retired-theater domains.
- DELETE ExtendedDomainValidator once everything valuable is migrated.
- Send each chunk to Codex for review.
