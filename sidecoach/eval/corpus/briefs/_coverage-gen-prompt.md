# Coverage-brief generation prompt (FIXED, auditable) - CODEX-authored, not architect

Per the lead A5-independence ruling (2026-06-23): the ~17 A5b COVERAGE briefs are the head-to-head INPUT,
so the Sidecoach architect must NOT author them (the #1 attack on the eval is "the author wrote briefs that
favor their tool"). They are authored by CODEX (independent model, no Sidecoach stake) to the FIXED prompt
below. The architect commits this prompt (auditable, zero tool-favorable steering); the lead reviews the
prompt + spot-checks the output for neutrality + coverage. Output flagged codexAuthored:true.

## Invocation (exact, reproducible)
codex exec --sandbox read-only --skip-git-repo-check "<the PROMPT block below, verbatim>"
Output -> eval/corpus/briefs/coverage-*.md + appended to briefs.json (kind=real-coverage, codexAuthored:true,
register, aestheticStyle, subjectiveStatus=pending-independent, provenance.authoredBy=codex + this prompt's git SHA).

## THE PROMPT (verbatim, no edits without re-committing + re-review)
---
You are authoring DESIGN BRIEFS for a blind head-to-head evaluation where two different design assistants
will each generate a design FROM your brief, and independent judges will compare the results. Your briefs
are the neutral INPUT. You have no stake in which assistant wins. Author briefs that are FAIR to any
competent design approach.

HARD RULES:
1. SOLUTION-AGNOSTIC: state only the PROBLEM - audience, goal, required content, constraints, success
   criteria. NEVER prescribe a visual solution, layout, color, type choice, motion, or any specific
   technique. A brief must not imply a single "right answer."
2. NEUTRAL / NO STEERING: name no tool, library, framework, or design system. Do not favor any aesthetic
   (do not push gradients, glassmorphism, brutalism, minimalism, accessibility-maximalism, or any idiom).
   Constraints must be the kind a real client gives (audience, brand tone in words, platform, a baseline
   like "must be responsive" / "meet common accessibility expectations") - never a stylistic prescription.
3. SELF-CONTAINED: each brief is generatable by any competent assistant with no external assets required
   (describe placeholder content in words).
4. TEMPLATE (every brief, exactly these fields): title; register; aestheticStyle; audience; goal (one
   sentence); requiredContent (bulleted); constraints (bulleted: audience/brand-tone-in-words/platform/
   baseline); successCriteria (bulleted, neutral - what a good result ACHIEVES, never HOW).

COVERAGE MATRIX (author exactly one brief per row; 17 rows):
  marketing/landing  x  {expressive-branded, minimal, corporate-trust}
  product            x  {minimal-utility, playful, data-dense}
  editorial          x  {classic-editorial, expressive, restrained}
  app-ui             x  {minimal-utility, corporate-dense, playful}
  forms              x  {minimal, multi-step-corporate}
  flex (your choice of register) x {warm/human, high-energy/youth, premium/luxury}

Vary audience, domain, and tone across rows so the set spans real-world breadth. Output each brief as a
fenced markdown block with the template fields, plus a one-line slug id. Author all 17. Output ONLY the briefs.
---

## Audit checklist (lead review of THIS prompt before Codex runs)
- [ ] No tool/library/framework/design-system names anywhere.
- [ ] No aesthetic the prompt pushes (balanced style range, not a11y-maximalist or idiom-favoring).
- [ ] Solution-agnostic enforced (problem-only template; success = achieves, not how).
- [ ] Coverage matrix spans 5 registers x a real style range.
- [ ] Reproducible (verbatim prompt + git SHA recorded with the output).
