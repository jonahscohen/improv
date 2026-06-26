---
name: buzzword-v2-labels-ready
description: Codex labeling of the 27 new diverse dev pages COMPLETE (27 labeled, 0 failed). Labels are sane (track the expected register pattern). Combined 48-page dev set now has ~31 marketing-buzzword present / ~17 DIVERSE negatives (vs v1's 5 same-register). Handed to buzzword for v2 calibration.
type: project
relates_to: [session_2026-06-25_buzzword-v2-labeling.md, session_2026-06-25_buzzword-rebuild-mandate.md, session_2026-06-25_sidecoach-buzzword-v2-rebuild.md]
---

Collaborator: Jonah Cohen. 2026-06-25.

## LABELING DONE (lead-held, author!=labeler)
dev-subjective-label.mjs --all --resume: labeled 27 | skipped 21 | failed 0. The recurring rmcp-transport ERRORs were ALL non-fatal (every page got its 22-class verdict). dev-subjective-labels.json now 48 pages, labeledBy=codex.

## LEAD QUALITY-GATE ON THE LABELS (sane, register pattern holds)
marketing-buzzword on the 27 NEW pages: PRESENT=15, absent=12.
- marketing 7/8 present (monday absent), mkt-ai 3/3 present, mkt-crypto 2/2 present = buzzword registers correctly skew PRESENT.
- editorial 0/3, docs 0/3, gov-data 0/2 = concrete registers correctly ABSENT.
- mixed (plausible): accenture(enterprise) absent; dashboard flowbite absent/coreui present; product ghost+tailscale present/onepassword absent.
Combined 48-page dev: ~31 present / ~17 negatives, and the negatives are now DIVERSE (editorial/docs/gov/dashboard/product) - the exact gap that made v1 overfit (v1 had only 5 same-register SaaS negatives). Clears the >=15-diverse-negatives precision-dev bar.

## NEXT
Hand to buzzword: run eval/buzzword-calibrate.mjs over the labeled 48-page set, pick the v2 operating point (graded density threshold + scope variant) for r>=0.5 / p>0.4 on the diverse negatives, FREEZE on principle+dev (no frozen-90 knowledge). Then lead: Codex review of v2 + ONE final frozen-90 measure (last clean shot).

## Files touched
- eval/corpus/dev-subjective-labels.json (27 new pages labeled; lead-run, codex-produced)
</content>
