---
name: security add-generic-password's interactive -w prompt truncates at 128 characters, silently destroying every OpenAI key pasted into it
description: Three consecutive OpenAI keys arrived in the keychain at exactly 128 chars and all three 401'd. BSD getpass() caps at _PASSWORD_LEN 128. Proved by round-tripping a 200-char dummy through non-interactive -w, which stored intact. Also records that the lead's own suggested -a "$USER" created a duplicate item that masked the real one.
type: reference
relates_to: [session_2026-07-29_real-key-fragment-purged-and-two-false-claims.md, session_2026-07-29_voice-credential-keyguard.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: 200-char dummy stored via non-interactive -w and read back at 200; three separate real keys each measured at exactly 128; masked tails compared to distinguish a stale read from a fresh truncation
confidence: high
---

# The interactive keychain prompt eats long keys (2026-07-29)

Commit stamp at authoring: 7fb20800.

## Symptom

Jonah pasted three different OpenAI keys across two hours. Every one landed at **exactly 128
characters** and every one returned `HTTP 401 invalid_api_key` with OpenAI echoing back a
well-formed but unrecognised key. A complete `sk-proj-` key is longer than 128.

Three different keys arriving at one identical length is a mechanism, not three bad pastes.

## Proof it is the PROMPT and not the keychain

    D=$(python3 -c "print('sk-proj-' + 'A'*192)")     # 200 chars, no secret
    security add-generic-password -U -s improv-trunc-probe -a probe -w "$D"
    security find-generic-password -s improv-trunc-probe -a probe -w | wc -c
    # 200 - round-trips intact

Storage is fine. The ceiling is in `security ... -w` WITHOUT a value, which prompts via BSD
`getpass()`, where `_PASSWORD_LEN` is 128. It truncates and reports nothing.

**So `-w` with no argument must never be used for an API key.** Use `-w "$(pbpaste)"`: the shell
history records the literal text `"$(pbpaste)"` rather than the secret, and the only exposure is
a brief window in the `security` process arguments.

## The second, self-inflicted half

I told Jonah to use `-a "$USER"`. The existing item's account is **`sidecoach`**, which is what
the code reads. So `-U` did not update it - it created a SECOND item under account `spare3`, and
`security find-generic-password -s <service> -w` returns whichever it finds first, which was the
old dead key.

That is why the first two probes reported the key as byte-identical to the dead one: I was
reading a different item than the one being written. Distinguishing them needed the masked tail
OpenAI echoes back (`pSZg` for the dead item, `Ebog` for the new one), not the length.

Duplicate deleted. Always pass `-a sidecoach` for this service, and check
`security dump-keychain | grep -c '"svce"<blob>="<service>"'` before concluding a write failed.

## The general lesson, which is the eighth instrument all over again

A length check and an auth probe both said "same dead key" and both were technically true of the
item I read, while being false about the system. The instrument was not broken; its SCOPE was
wrong, because a service-only lookup is ambiguous when two items share a service name. Ambiguity
in the read is the same failure class as `grep -r` skipping symlinks: the command answered a
narrower question than the one being asked.

## Files touched

- none (keychain hygiene and this record)
