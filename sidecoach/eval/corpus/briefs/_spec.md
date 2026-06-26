# Contract-6 A5 BRIEFS spec (generative head-to-head) - PRE-REGISTERED

A5b grades the two tools' DESIGN OUTPUT on neutral briefs (blind, paired, independent judges + human
adjudication; CI lower bound > 0). This file defines what a brief is and how briefs are sourced/authored,
frozen before the briefs carry any claim. Collaborator: Jonah Cohen.

## Target (power-locked)
- N >= 20 floor; target 20-30. Final N set by the pre-registered power analysis from pilot/judge variance.
- Spread across the 5 registers (landing/marketing, dashboard/app-ui, product, forms, editorial).

## Two kinds of brief (kept in SEPARATE buckets in briefs.json)
1. REAL (kind=real): real public design briefs / specs / RFPs / design-system component specs / design-
   challenge prompts, sourced RULE-AGNOSTICALLY (by category/source, never by what favors a tool), with
   provenance (source URL, capture-UTC, license/ToS). These carry the headline A5 claim.
2. CALIBRATION (kind=calibration): architect-authored to the FIXED NEUTRAL TEMPLATE below, one per
   calibration TYPE. Purpose: validate the JUDGING - if blind judges cannot even call the cases where a
   strength clearly dominates, the judging methodology is broken. THREE types:
     - a11y-dominant   (hypothesis: the a11y-rigorous tool's output should score higher)
     - taste-dominant  (hypothesis: the taste-deeper tool's output should score higher)
     - balanced        (hypothesis: comparable; a genuine tie)
   ARCHITECT-CONFLICT (lead-flagged): the architect authors these, which is a bias risk. Mitigations:
     (a) authored to the IDENTICAL neutral template (only the design CHALLENGE differs, never tool-favoring
         language); (b) the a-priori expected winner is a HYPOTHESIS recorded as `expectedWinnerHypothesis`,
         NOT a label - the independent Codex pass sets the actual label; (c) flagged `architectAuthored:true`
         for extra scrutiny at the joint review; (d) calibration briefs are EXCLUDED from the headline A5
         claim (they validate judges, they do not score the tools against each other for the claim).

## Fixed neutral template (every brief, real + calibration, conforms)
- title, register, audience, goal (one sentence), required content (bulleted), constraints (brand/tech/
  a11y baseline), success criteria (neutral - what a good result achieves, NOT how). No tool names, no
  language pointing at either tool's idioms.

## DIVERSITY + SOLUTION-AGNOSTIC (lead A5-validity ruling 2026-06-23)
A5 is the TASTE differentiator eval, so the brief set must exercise the aesthetic/taste RANGE, not a
single plain style:
- DIVERSIFY across REGISTERS (marketing/landing, product, editorial, app-ui, forms) AND aesthetic STYLES
  (expressive/branded, minimal, editorial, playful, corporate), from VARIED sources - match the page-corpus
  spread. No single source may dominate.
- SOLUTION-AGNOSTIC: a brief states a PROBLEM ("design X for audience Y with goals Z"), never reverse-
  engineered from a specific existing solution. Briefs abstracted from a design-system pattern carry that
  system's implied "right answer" (e.g. the GOV.UK style) and BIAS the generative head-to-head -> avoid.
- CAP single-source/plain: GOV.UK-derived briefs capped at a SMALL share (currently 3, flagged
  aestheticStyle=plain/government + caveat); the rest must come from other registers/styles/sources.
- Calibration's 3 types (a11y-dominant / taste-dominant / balanced) must span that diversity too.

## Integrity
- Real briefs: rule-agnostic source selection recorded as selection-slot, same discipline as page captures.
- Calibration briefs: architectAuthored:true + expectedWinnerHypothesis + flagged; label set by the
  independent pass only (architect registered so the freeze gate rejects architect labels on briefs too).
- subjectiveStatus=pending-independent on all briefs until the lead-run Codex pass + joint review.
