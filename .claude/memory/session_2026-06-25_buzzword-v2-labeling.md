---
name: buzzword-v2-labeling
description: Lead-held Codex labeling pass launched on buzzword's 27 new diverse dev pages (author!=labeler). Uses dev-subjective-label.mjs --all --resume (one bounded codex vision call/page, labeledBy=codex, all 22 classes from the screenshot). Then buzzword calibrates v2 against the labels.
type: project
relates_to: [session_2026-06-25_buzzword-rebuild-mandate.md, session_2026-06-25_sidecoach-buzzword-v2-rebuild.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## LEAD LABELING (author != labeler discipline)
buzzword captured 27 new diverse dev pages (HTML only, no labels) + a v2 redesign (holistic graded buzzword-density over content text, testimonial-excluded, vacuity-tiered taxonomy). It registered register-separation evidence on the 48-page corpus (docs 0.00/editorial 0.27 LOW vs marketing-ai 3.39/dashboard 2.43/marketing 2.20 HIGH) - the generalization signal v1 lacked. dev-corpus-disjoint.test GREEN (48 pages, zero overlap with frozen-90).
- LEAD runs the labeling (not buzzword): `node eval/dev-subjective-label.mjs --all --resume --timeout-ms 120000` (bg bayqnuu7n). Renders each page at 1280x800 hermetic detector-parity, one `codex exec -i <screenshot>` vision call/page (BOUNDED per-page timeout per the 2h-hang lesson; --resume retries failures), records all 22 classes labeledBy=codex. --resume skips the 21 already-labeled -> only the 27 new get labeled.
- author!=labeler holds: codex labels; rule-authors.json registers marketing-buzzword to sidecoach-architect; I RUN the harness but codex PRODUCES the labels.

## INTEGRITY
The dev corpus is for CALIBRATION; the CLAIM rides the frozen-90 (buzzword never touches it). Even if site-selection slightly biases dev labels, the frozen-90 is the independent test. The v1 frozen result (r0.125/p0.25 + the specific FP/missed pages) must NOT leak into v2 calibration.

## NEXT
Labels land -> buzzword calibrates v2 threshold on the LABELED diverse set (r>=0.5/p>0.4, >=15 diverse negatives) -> freeze -> lead Codex review + ONE final frozen-90 measure (the last clean shot).

## Files touched
- eval/corpus/dev-subjective-labels.json (appended by the codex labeling pass; running)
</content>
