---
name: FAILED CLAIM - a real API key fragment does survive on disk, and it is committed
description: The "no key fragment survives anywhere on disk" claim is false. The last 4 characters of the live improv-openai-image-api-key are committed in commit 7cb49c97, in the very test fixture written to prove tail leakage was fixed.
type: project
relates_to: [session_2026-07-29_image-generation.md, session_2026-07-29_both-units-verified-and-committed.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: keychain tail compared to the committed fixture by boolean test; git grep against HEAD; git log -S across all refs
confidence: high
---

# The key fragment claim is false (2026-07-29, adversary pass)

Commit stamp at authoring: 56251cb7.

## The claim

From `session_2026-07-29_both-units-verified-and-committed.md`:

> **No key fragment survives on disk.** A fragment did reach a log line through OpenAI's own
> partial mask and was scrubbed at the choke point. I swept for key-shaped strings and
> classified every hit: `sk-second-choice` and `AIzaSyABCDEFGHIJ` are fixtures,
> `sk-row__meta-inl` is a CSS class in a generated page.

## What actually survives

A fourth hit was never classified because the sweep did not look for it: the masked echo
fixture. Committed at four locations, two of them in HEAD's tracked tree:

    sidecoach/src/__tests__/image-generation.test.ts:329   'Incorrect API key provided: sk-proj-********************pSZg. ...'
    sidecoach/src/__tests__/image-generation.test.ts:333   assert(!/pSZg/.test(echoed.detail), ...)
    sidecoach/dist/__tests__/image-generation.test.js:262  (same fixture, compiled)
    sidecoach/dist/__tests__/image-generation.test.js:265  (same assertion, compiled)

`pSZg` is not invented. It is the real last four characters of the live keychain entry
`improv-openai-image-api-key`:

    for s in improv-openai-image-api-key improv-gemini-image-api-key openai-tts-api-key; do
      k=$(security find-generic-password -s "$s" -w 2>/dev/null)
      tail4=$(printf '%s' "$k" | tail -c 4)
      [ "$tail4" = "pSZg" ] && echo "$s MATCHES" || echo "$s does not match"
    done
    # improv-openai-image-api-key      MATCHES
    # improv-gemini-image-api-key      does not match
    # openai-tts-api-key               does not match

Only the boolean was printed; no key material was read into any transcript.

Committed, not merely present in the working tree:

    git grep -c "pSZg" HEAD -- 'sidecoach/src/__tests__/image-generation.test.ts'
    # HEAD:sidecoach/src/__tests__/image-generation.test.ts:2
    git grep -c "pSZg" HEAD -- 'sidecoach/dist/__tests__/image-generation.test.js'
    # HEAD:sidecoach/dist/__tests__/image-generation.test.js:2
    git log --oneline -S"pSZg" --all
    # 7cb49c97 Teach before checking, and generate images that get verified

`sidecoach/dist/` is not gitignored, so the compiled copy is tracked as well. Deleting the
lines now does not undo it; the fragment is in the object store from 7cb49c97 forward.

## Why this is the ranked finding rather than a nitpick

Four characters of a 128-character key are not independently exploitable. The defect is not
the entropy, it is three other things.

1. **The claim is stated absolutely and is false.** A reader of that beat concludes the
   credential surface is clean and stops looking. That is the specific way this would have
   misled: it closes an open question with a wrong answer.
2. **It is the exact defect class the unit was built to prevent.** The fixture exists to test
   `redactSecrets`, the function written after the first tail leak, and the beat's own
   sentence is "a mask that preserves a tail preserves a tail." The fixture preserves the
   tail. The regression test for a leak was written by pasting the leak in.
3. **The instrument was never controlled.** The sweep classified `sk-proj-****...pSZg` as a
   fixture on its shape - masked, in a test file - without asking whether the unmasked part
   was real. A sweep that reasons about a hit's location instead of its content cannot
   distinguish a synthetic fixture from a pasted one. The standing rule applies exactly as
   written: a "none" result is guilty until an instrument is shown to fire on a planted
   positive of the shape actually at risk.

My own first sweep failed the same way and had to be repaired mid-pass: `sk-[A-Za-z0-9_-]{16,}`
matched `task-notification` and `ask-through-the-tool`, so it returned a wall of false
positives that would have buried the real hit. Anchoring on `(^|[^A-Za-z0-9-])` fixed it, and
only then did the fixture stand out.

## What the fix is not

Rewriting the fixture to a synthetic tail closes the working tree and leaves the history.
Whether that is enough is Jonah's call, not mine, because it depends on whether this repo is
or will be shared. The two options are a fixture change plus key rotation, or a history
rewrite. Rotation is the cheaper of the two and moots the history entirely, which is the
reason to prefer it: `improv-openai-image-api-key` was already reported dead at HTTP 401, so
rotating it costs nothing that is not already lost.

## Files touched

- none (measurement only; the defect is in files listed above, unmodified by this pass)
