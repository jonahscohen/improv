---
name: A real credential fragment was committed in 7cb49c97 and is now purged; two of the lead's claims were false in opposite directions
description: adversary found four characters of a live API key committed inside the very test written to prove tails do not leak. Fixture replaced with a synthetic tail, dist rebuilt, redaction test still passes. Also corrects the lead's "image generation is reachable by nothing" claim, which was an importer grep against a subprocess spawn.
type: project
relates_to: [session_2026-07-29_both-units-verified-and-committed.md, session_2026-07-29_adversary_real-key-tail-committed.md, session_2026-07-29_adversary_skill-text-misstates-the-wiring.md]
supersedes: session_2026-07-29_both-units-verified-and-committed.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: fragment confirmed against the live keychain entry by boolean test; purged from src and dist; grep proven to fire on a planted positive before its zero was believed; redaction test re-run and passing; flow D spawn site read directly
confidence: high
---

# Two false claims, one of them a committed secret (2026-07-29)

Commit stamp at authoring: 56251cb7.

## FALSE CLAIM 1, and it is a security finding

I wrote, absolutely: **"No key fragment survives on disk."** That was wrong, and the fragment
was in the commit I made an hour earlier.

`pSZg` - four characters of the live `improv-openai-image-api-key` - was committed in
`7cb49c97` at four locations, two of them tracked in HEAD:

    sidecoach/src/__tests__/image-generation.test.ts:329,333
    sidecoach/dist/__tests__/image-generation.test.js:262,265   (dist is TRACKED)

Confirmed real by comparing the keychain entry's tail to the fixture with a boolean test; no
key material was printed. And because the stored key is a 128-character truncation of a
164-character key, `pSZg` is not even the tail of the real credential - it is a MID-KEY
fragment, characters 125 to 128 of an active secret.

### Why my sweep missed it

I classified `sk-proj-********************pSZg` as a fixture **on its shape** - masked, sitting
in a test file - without ever asking whether the unmasked part was real. A sweep that reasons
about a hit's LOCATION instead of its CONTENT cannot tell a synthetic fixture from a pasted one.

### The irony that makes it the ranked finding

That fixture exists to test `redactSecrets`, the function written after the FIRST tail leak.
My own beat's sentence was "a mask that preserves a tail preserves a tail." The regression test
for a leak was written by pasting the leak in.

### Fix applied

Fixture tail replaced with a synthetic `Qx7T`, plus a comment in the test explaining why it must
stay synthetic and instructing nobody to copy a provider's masked echo verbatim again. `tsc -p .`
rebuilt so the tracked `dist/` copy is clean too. Fragment count in `src/` and `dist/`: **0**,
and the grep was proven to fire on a planted positive before that zero was believed. Redaction
test re-run: passing.

**Still outstanding and Jonah's call:** the fragment remains in the object store from `7cb49c97`
forward. Deleting the lines does not undo it. Rotating `improv-openai-image-api-key` moots the
history entirely and costs nothing, because that key is already unusable.

## FALSE CLAIM 2, wrong in the opposite direction

I told Jonah, and put on the scoreboard, that image generation is **"imported by nothing,
reachable by nothing, 0 invokers."** Also wrong.

`src/flow-handler-design-references.ts:110` does this:

    const bin = path.resolve(__dirname, '..', 'bin', 'sidecoach-image.js');

Flow D does not IMPORT the module, it SPAWNS the CLI. My tripwire was
`grep -rln "image-generation\|generateImage" src/flow-handler*.ts`, an importer grep, which
cannot see a subprocess spawn. adversary demonstrated the flow producing a verified concept
sketch from `/sidecoach craft a pricing page` in a clean workdir, opened the PNG, and confirmed
a real render.

**The honest row is "reachable by one flow, discoverable by nobody."** The two dimensions split
and I collapsed them. This matters because the fix that follows is different: name the tool in
the skill surface, rather than build an invoker that already exists.

### The sixth wrong instrument in two days

An importer grep aimed at a subsystem that uses subprocess spawning. Same shape as the other
five: it matched what I expected the code to look like rather than what the code does. It also
failed in the direction that feels rigorous, which is the hardest direction to catch, because a
falsely harsh number about our own work reads as honesty.

## A third finding from the same pass, not yet fixed

`claude/skills/sidecoach/SKILL.md` does not merely omit the image tool, it **states the
opposite of the truth** at two lines: it says six CLIs ship when there are seven, and it says
every tool but `sidecoach-drift` is invoked by hand and never auto-run by a flow. A model
reading that concludes no flow will ever produce a plate for it. The durable fix is not editing
two lines: the count and the flow-wired set are both derivable from `bin/sidecoach.js`, so a
test can assert the skill text agrees with `sidecoach list`.

## Team state

All seven teammates hit the account usage limit at 07:51 UTC, resetting 4:10am America/New_York.
`adversary` completed its claim-attack pass first and produced four beats. The scoreboard-attack
brief was delivered to it but not executed.

## Files touched

- `sidecoach/src/__tests__/image-generation.test.ts` (synthetic tail plus the do-not-repeat comment)
- `sidecoach/dist/__tests__/image-generation.test.js` (rebuilt)
