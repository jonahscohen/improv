---
name: ELIAS mode design decisions (default-off, composition, artifact-shape enforcement)
description: Why ELIAS defaults OFF via an enable marker, how it composes with concise (precedence + volume relaxation + cross-gate deferral), and why phase-1 enforcement keys on artifact SHAPE not a jargon wordlist.
type: decision
relates_to: [session_2026-08-05_elias-mode.md, session_2026-07-26_concise-stop-gate.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Three resolved decisions behind ELIAS mode (docs/superpowers/plans/2026-08-05-elias-mode.md, D1/D2/D5). Each had real alternatives; the reasoning is needed if anyone proposes revisiting.

## D1. Default OFF, gated by an ENABLE marker (~/.claude/.elias-enabled)

PRESENT means ON, ABSENT means OFF (the mandate emits nothing). This is the exact inverse of concise, which uses a DISABLE marker so it is on by default.

**Alternatives considered:**
- Default-ON with a project-level opt-out: rejected because the marker is per-machine not per-project, so a developer would have to turn it off on every machine, and a project-root opt-out file would be carried by git to teammates who did not ask for it.
- Default-ON like concise: rejected because concise is a universal preference (nobody wants padding) while ELIAS is a per-conversation AUDIENCE choice. Injecting stakeholder framing into a normal engineering session actively degrades the work: it strips the paths, commands, and identifiers a developer session runs on.

**Why this one:** ELIAS is opt-in audience shaping, precedent is the voice system (installed but silent until ~/.claude/.voice-enabled exists). The worst possible defect is a mandate that injects while OFF, so the marker test is `[ -f ]` (present = on) and it is the first assertion in test-elias-mandate.sh (case 1). Copying concise's `[ ! -f ]` without inverting produces exactly that bug while every other test still passes.

**Revisit when:** a real need emerges for per-project or per-conversation ELIAS state (out of scope, phase 2+).

## D2. Orthogonal to concise; both may be on; ELIAS wins ties

Concise governs LENGTH, ELIAS governs AUDIENCE; they compose. Four mechanisms: (a) rule-by-rule composition (every concise rule holds, three adjustments only); (b) volume-gate relaxation (concise 300-word cap rises to ELIAS_WORD_CAP default 400 when ELIAS on, but an explicitly-set CONCISE_WORD_CAP always wins so operator tuning is never overridden); (c) cross-gate deferral (each Stop gate checks the other's burst flag and stays silent if the other claimed the burst, so exactly one block lands); (d) precedence: ELIAS wins, because a response written for the wrong audience is wrong while one that is thirty words long is merely unpolished.

**Alternatives considered:**
- One mode suppresses the other: rejected, they govern different axes (length vs audience) and both are legitimately wanted together.
- No cross-gate coordination: rejected, a single response could be blocked twice with contradictory instructions ("cut it" vs "rewrite it for the reader") and the retry could ping-pong.
- Concise wins ties: rejected, audience correctness outranks length.

**Why this one:** deferral is symmetric because hook execution ORDER is not guaranteed; whichever gate the runtime runs first owns the burst. Edit B (the deferral) is placed AFTER concise's clean-stop re-arm and BEFORE its Layer 2, so a clean response still clears concise's own flag even while ELIAS holds a block (test-concise-detect-stop.sh case E catches a mis-placement). The 400 cap is a reasoned starting position, not a measurement (concise's cap came from 232 measured responses; ELIAS has no corpus yet).

**Revisit when:** a measured corpus of ELIAS-on responses exists (then tune ELIAS_WORD_CAP from data, phase 2). Codex 2026-08-05 flagged that the two peer burst flags are not atomic ACROSS the two hooks if Stop hooks run in parallel (a single doubled block on the first burst, self-healing on retry). Under sequential same-event execution (observed; live test yields exactly one block in both orderings) this does not occur. A robust cross-hook fix would need a shared claim file, which conflicts with D6 (no shared mechanism). **Jonah decided 2026-08-05: ACCEPT as a known-edge rather than break D6** - the failure is benign, self-healing on retry, and narrow (both modes on + reply violates both gates + first burst only). The shared-atomic-claim fix is staged as phase 2, to be built only if a doubled first-burst block is observed in practice.

## D5. Phase-1 enforcement keys on artifact SHAPE, not a jargon wordlist

elias-detect-stop.sh blocks once when a stakeholder reply still carries a fenced code block, a filesystem path, a shell command line, or two-or-more code-shaped backtick identifiers. The jargon wordlist is explicitly deferred to phase 2.

**Alternatives considered:**
- A curated technical-term wordlist ("idempotent", "middleware", "race condition"): rejected as the wrong first build. It fires HARDEST on the exact behavior ruleset rule 4 ASKS for (name an unavoidable term once, define it in the same breath), so it would punish compliance. This repo already has the scar (session_2026-07-26_visual-gate-narrowed.md: four false-fire classes from classifying too broadly).
- No Stop gate at all in phase 1: rejected, artifact shape is mechanically checkable now with near-zero ambiguity, in the same family as concise's list-count and opener-lexicon detections.

**Why this one:** artifact shape is structural, countable, and narrow; prose that is merely technical in flavour passes untouched. One deliberate inversion vs concise: concise SKIPS a predominantly-code response; ELIAS must NOT, because under ELIAS a wall of unrequested code IS the violation. The legitimate "user wanted code" case is handled one level up at the PROMPT (TECH_REQUEST_RE / PROMPT_ARTIFACT_RE), which is higher precision. Accepted tolerances (Codex 2026-08-05, all plan-mandated): bare .env / Dockerfile and single backtick idents pass; command lines ending in sentence punctuation are excluded (R5, to avoid false-firing on prose sentences that open with a tool-shaped word); the prompt-override lexicon over-skips on topic words like "technical"/"api" (the safe direction, a missed block not a false one).

**Revisit when:** a real corpus of ELIAS-on responses is measured (the prerequisite for the wordlist, not the detector). Do not build the wordlist before the measurement.
