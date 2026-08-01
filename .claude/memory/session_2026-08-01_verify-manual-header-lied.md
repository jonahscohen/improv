---
name: verify-manual.sh's header claimed it clears the verification flag on any user message, which it has never done
description: The comment said "clears on any user message if they interrupted to manually verify". The code has a closed case list of exact phrases that must be the whole message. Anyone reading the header would badly overestimate how easily the verification gate releases.
type: project
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: bash -n clean; both an exact phrase and an ordinary message driven through the hook
confidence: high
---

# A comment that overstated how loose a safety gate was (2026-08-01)

Found by the `descriptions` teammate while reading hooks to write installer copy, and flagged on
its way out as "stale comment, unowned, not fixed by me".

    # Also clears on any user message if they interrupted to manually verify.

The code has never done that. It is a closed `case` list - `verified`, `looks good`, `it works`,
`lgtm`, `all good`, `bypass verification` - and the phrase has to be the WHOLE message, so even
one of those words mid-sentence does not clear it.

**Why this one matters more than an ordinary stale comment.** This hook releases the gate that
holds a commit until work has been proven. A reader who believed the header would think the gate
effectively releases itself on the next thing the user types, and would reason about every
verification decision downstream from that false premise. A comment that makes a safety gate look
weaker than it is invites people to route around a control that was actually holding.

Corrected to describe the closed list, with the date the claim was removed, so the next reader
sees that the discrepancy was noticed rather than never examined.

Worth noting the installer description for this same hook, written in the same session, was
already ACCURATE: "the phrase must be your whole message". Writing user-facing copy from the
source is what surfaced the source's own lie.

## Files touched

- `claude/hooks/verify-manual.sh` (header comment only, no behaviour change)
