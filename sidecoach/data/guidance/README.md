# guidance - the GUIDANCE tier (advisory), populated ONLY by the gated promote path

Approved candidates land here, one per store family:

- `design-laws/` - candidates promoted toward the design-laws corpus
- `craft-corpus/` - candidates promoted toward the craft teaching corpus
- `design-judgment-rules/` - candidates promoted toward the design-judgment reference

These are the GUIDANCE tier, NOT the enforced `product-rule-registry`. A promoted rule
ADVISES; flipping a guidance rule into a build-blocking detector is Phase 3 and requires a
second, measured human sign-off (held-out precision), out of scope here.

Every file here MUST have a matching entry in `../promotion-ledger.jsonl`. A file with no
ledger entry is an un-blessed rule and is flagged by
`bin/sidecoach-taste-promote.js audit`. The only writer of this directory is
`sidecoach-taste-promote.js promote`, which consumes a single-use, TTY-minted consent
token. Nothing else may add a rule here.
