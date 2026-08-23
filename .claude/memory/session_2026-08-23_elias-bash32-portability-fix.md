---
name: elias-detect-stop bash 3.2 portability fix
description: literal backticks in the ELIAS Stop hook's python heredoc imbalanced macOS /bin/bash 3.2's $(...) parser; rebuilt from chr(96) so it parses on a fresh team install
type: project
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: both-shells + 33/33 behavior suite
confidence: high
relates_to: [session_2026-08-22_justify-diff-capture.md]
---

Found during the QA-gate rung build (the qa-gate teammate flagged it as "elias-detect-stop.sh fails bash -n and is wired live in Stop"). Corrected characterization: it does NOT error on THIS machine - the shebang is `#!/usr/bin/env bash` and `env bash` resolves to homebrew bash 5.3 here, under which it parses fine. It fails only under macOS system `/bin/bash` (3.2.57), which is what a fresh team install (no homebrew bash) would run it under - so it was a latent PORTABILITY landmine, not a live error here.

Root cause: the hook's detection runs in a `python3 <<'PYEOF'` heredoc wrapped by `DETECT=$(...)`. Three python regexes carried literal backticks - PROMPT_ARTIFACT_RE and FENCE_OPEN_RE (triple-backtick fence patterns) and BACKTICK_RE (a single-backtick span matcher) - 9 literal backticks total, an ODD count. macOS bash 3.2's `$(...)` parser scans the whole substitution body tracking old-style backtick command substitution; an odd count leaves one "open", so it runs to EOF: "unexpected EOF while looking for matching backtick" at line 139, "unexpected end of file" at 297. The twins (concise-detect-stop, multiple-choice-detect-stop) pass 3.2 because their backtick counts stay balanced.

Fix: build every backtick from its codepoint - `_bt = chr(96)` - and concatenate (`_bt * 3` for a fence, `_bt + r"([^" + _bt + r"\n]{1,80})" + _bt` for the span). ZERO literal backticks now remain in the file, so 3.2's parser cannot miscount. Regex semantics are byte-identical. This is the exact idiom documented in surface-visual-gate.sh for the same class of bug.

Verified: `grep -c '\x60'` = 0 backticks; `/bin/bash -n` (3.2.57) OK (was FAIL); `bash -n` (5.3) OK; test-elias-detect-stop.sh 33/33 pass (behavior unchanged).

STILL OPEN (pre-existing, flagged by the teammates, NOT fixed here): test-component-browser.sh has 2 stale JUSTIFY assertions (hook-count drift) that fail on a clean HEAD - unrelated to this work, worth a separate cleanup so the repo baseline is green.

Files touched: claude/hooks/elias-detect-stop.sh.
