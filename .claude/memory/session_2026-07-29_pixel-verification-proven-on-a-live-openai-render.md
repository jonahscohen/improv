---
name: Pixel verification proven end to end on a live OpenAI render - all four checks executed and one failed honestly
description: The last open image row is closed. gpt-image-2 returns PNG, so the four pixel checks EXECUTE rather than returning unverified. Contrast failed at 3.68:1 worst against a 4.5:1 requirement while mean was 9.57:1, so worst-mode caught a legibility defect that mean-mode would have shipped. Cost 0.0064 USD usage-derived.
type: project
relates_to: [session_2026-07-29_getpass-truncates-keys-at-128.md, session_2026-07-29_both-units-verified-and-committed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: one live generation on gpt-image-2, full verification chain output read raw, the produced PNG opened and described, cost taken from the provider's own usage data
confidence: high
---

# The differentiator works on our own default path now (2026-07-29)

Commit stamp at authoring: f3a932e4.

## What was open

Pixel-level output verification is sidecoach's single strongest advantage over LOCALPROJECTX,
and it did NOT apply to the provider we defaulted to. Gemini returns JPEG for a PNG request,
this repo decodes PNG only, so all four pixel checks returned `unverified` on our default path.
The board scored it a LOSS and that was correct.

## What closed it, and it needed no new code

`gpt-image-2` returns PNG. With a working OpenAI credential the checks simply run. One live
generation, raw output:

    [pass] bytes-nonzero          2261142 bytes
    [pass] format-matches         bytes are png
    [pass] dimensions-match       1024x1024
    [pass] pixels-decodable       decoded 1024x1024, color type 2
    [pass] rendered-not-blank     17937 colors, stddev 0.1105, edges 0.6527
    [fail] contrast-at-placement  worst 3.68:1 < 4.5:1 over 124800 px (mean 9.57:1)
    [pass] provenance-matches     no offline synthetic marker present

    verdict=failed
    provider: openai  model: gpt-image-2  cost: 0.0064 USD (usage-derived)
    NOT VERIFIED: the asset was written but its verdict is failed. Do not treat it as checked.

**No `unverified` anywhere. `unverifiedReasons: []`.** The checks executed against decoded pixels.

## The failure is the valuable part

I asked for a wall whose upper-left quadrant was plain so headline text could sit there, then
declared `#111111` ink over region `40,40,520,240`. The image delivers that: I opened it and it
is a photographic concrete wall, flat overcast light, grain visible, staining in the lower third,
upper-left unbroken.

And near-black text there would still fail WCAG AA, because somewhere in that 520x240 region the
concrete is dark enough to drop to **3.68:1**.

**Mean contrast was 9.57:1.** A tool measuring the mean would have passed this asset and shipped
a legibility defect. `--contrast-mode worst` as the default is therefore the correct call, and
this render is the evidence for it rather than an argument about it.

## Two guards that fired correctly on the way

1. **Unpriced refusal.** The first attempt aborted: "no published per-image price for
   openai/gpt-image-2 at this resolution and no --assume-cost-usd was given; refusing to spend an
   unknown amount." Spend governance ahead of the call, not audited after.
2. **The keyguard hook blocked ME.** A compound command of mine read `openai-tts-api-key` merely
   to measure its length, and the guard committed an hour earlier denied it and told me to drop
   `-w`. That is the guard working in production against its own author.

## Operational facts worth keeping

- The CLI reads the credential from `SIDECOACH_OPENAI_API_KEY` / `OPENAI_API_KEY`, **not** from
  the Keychain. Export it; do not assume the keychain entry is enough.
- The keychain item's account is `sidecoach`. A service-only lookup is ambiguous. See
  [[session_2026-07-29_getpass-truncates-keys-at-128]].

## Still open

Make OpenAI the default provider and record Gemini as the header-level-only fallback. The
three-value verdict must stay exactly as it is: Gemini output must still return `unverified`
when pixels cannot be read. Do not delete the honest path because the default no longer needs it.

`imageflight` was alive but idle for 20 minutes across four heartbeats and three unanswered
messages, having produced no writes, so the lead did this generation directly.

## Files touched

- none (verification only; asset at /tmp/oai-verify/wall.png, deliberately outside the repo)
