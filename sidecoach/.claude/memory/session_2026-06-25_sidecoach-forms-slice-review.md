---
name: Stage-2 forms-slice adversarial review
description: Adversarial implementation review of the 5-rule forms-a11y vertical slice; 3 findings folded; P2 fixture push surfaced real HTML-comment bug
type: project
relates_to: [session_2026-06-24_sidecoach-S5-integration-gap-and-plan.md, session_2026-06-24_sidecoach-convergence-resume.md]
---

## What happened

Codex reviewed the forms-a11y vertical slice diff (stage2-forms-slice.diff). Previous Codex session got stuck trying to write findings via apply_patch (blocked for out-of-project paths). Fresh task spawned with explicit shell-heredoc write instruction; succeeded in 4m14s.

## Findings and resolutions

### P1: FORMS_002 severity downgrade (high->minor)
- Legacy: `severity: high` -> canonical `major`
- New registry: `sourceSeverity: medium` / canonical `minor`
- Resolution: documented as deliberate override. Added `sourceSeverity: 'high'` (legacy provenance) + `severity: 'minor'` + `severityOverrideReason` ("input-type is UX keyboard/validation hint, not blocking a11y failure; advisory-not-gating by design"). Jonah judged minor correct.

### P1: Stale dist/ artifacts
- `dist/validators/checks/forms-checks.js` missing; dist had no forms validator
- Resolution: rebuilt via `npm run build`; dist now current

### P2: Weak fixture coverage (surfaced real bug)
- findings fixture failed only 1/5 rules; other 4 not-applicable
- Fixing: enriched fixtures/forms/findings to trip all 5 rules
- BUT: per-rule check showed only 2/5 actually failing - HTML comments in fixture contained literal strings ("<label", "aria-label", "placeholder"), causing false passes in raw-markup haystack checks
- Root fix: strip HTML comments (`/<!--[\s\S]*?-->/g`) from haystack before matching
- This is a registry-quality improvement over the legacy behavior (legacy had same bug)
- Post-fix: clean=all pass/N/A, findings=all 5 fail, inconclusive=all inconclusive

## Outcome

All 3 findings folded. 62 suites green. HTML comment-strip fix compounds across the entire absorb.

## Next chunks incoming

- 11 remaining forms rules (001,003,004,005,007,008,009,011,014,017,020)
- 6 MOTION_GESTURE rules (markup/component evidence, hasDragInteraction guard)
- ~27 Tier-2 assessment
- Call-site migration + ExtendedDomainValidator deletion

Each chunk will apply the comment-strip + per-rule-fixture lessons throughout.

## Files touched

- /private/tmp/.../scratchpad/stage2-forms-slice-findings.md (written by Codex GPT-5.4)
- sidecoach/src/validators/checks/forms-checks.ts (comment strip fix)
- sidecoach/fixtures/forms/findings/index.html (enriched)
- sidecoach/fixtures/forms/inconclusive/ (real fixture)
- sidecoach/src/product-rule-registry.ts (FORMS_002 severity doc)
- sidecoach/dist/ (rebuilt)
