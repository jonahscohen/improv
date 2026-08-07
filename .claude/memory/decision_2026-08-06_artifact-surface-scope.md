---
name: Artifact-open scope boundary (what counts as "show me" vs internal)
description: Why the artifact-open mandate fires only on user-facing deliverables (images/pdf/html/docs) with a hard exclusion list, and is default-ON with hard Stop enforcement
type: decision
relates_to: [session_2026-08-06_artifact-open-mandate-built.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Choice made: the artifact-open mandate fires on a NARROW set of user-facing deliverable types, gated by a HARD exclusion list, default-ON, with hard Stop-block enforcement.

**In scope:** images/visual (.png .jpg .jpeg .gif .webp .avif .svg .pdf), viewable pages (.html .htm), deliverable documents (.md .txt .csv .rtf .docx).
**Hard-excluded (what keeps it quiet):** any `.claude/` path segment (never a beat/memory/settings file), temp/scratch (`/tmp`, `/private/tmp`, `/var/folders`, `*/scratchpad/*`), node_modules/.git/dist/build, internal repo docs (docs/superpowers/plans/, TASKS.md, MEMORY*.md, CLAUDE.md, README.md, CHANGELOG/PRODUCT/DESIGN.md, lockfiles), and source/config extensions (.sh .js .ts .json .css .yaml etc - a stylesheet or config is not a "document to show").

**Alternatives considered:**
- Fire on ALL Write output (any new file): rejected. It would fire on every beat, plan, source file, and config edit - exactly the noise the repo's over-broad-detector scars (visual-gate-narrowed, the concise wordlist refusal) warn against. A noisy mandate gets disabled and then protects nothing.
- Visual-only (images/pdf/html, exclude documents): rejected. Jonah explicitly named "a document" as a thing he loses in random dirs; the hard exclusion list already keeps internal .md out, so including deliverable docs is safe.
- Default-OFF / opt-in (like ELIAS/voice): rejected. Jonah wants this STANDING ("no more", "you show me what you make"), so default-ON via a DISABLE marker (concise polarity) is correct - active on every machine that installs it, until explicitly muted.
- Soft nudge instead of a Stop block: rejected. "Mandates" and "no more" are unambiguous - hard enforcement. The Stop gate blocks until every pending artifact is shown.

**Why this one:** it directly solves Jonah's pain (self-created deliverables abandoned in random directories he has to dig up) while the exclusion list + require-exists + per-session keying keep it from firing on the internal machinery Claude writes constantly. Modeled on the proven screenshot-open-mandate/clear pattern in the same cluster, so it inherits that hook's hard-won correctness (per-session flags, APPEND-not-overwrite, require-exists to prevent an unsatisfiable mandate).

**Revisit when:** the hook fires on something Jonah considers internal (widen the exclusion list) or misses a deliverable class he wanted shown (add the extension). Both are one-line edits near the top of the mandate hook. If a new artifact type (e.g. a generated video or a .zip export) becomes common, add it to the in-scope set.

---

## UPDATE 2026-08-07 - "balanced" refinement after Codex review (Jonah)

The v1 build was Write|Artifact-only and hard-excluded all temp locations. Codex showed this missed Jonah's primary case: CLI-generated images (Bash) and artifacts staged in the scratchpad/temp. Jonah chose **balanced + keep Word documents**. The scope is now split by HOW the user sees the artifact:

- **VISUALS** (images/pdf/pages): harvested from Write AND **Bash** (command + output scan, require-exists, skip read-only CONSUMER_RE verbs), and caught even in /tmp, /var/folders, and scratchpad - because generated images land there and are exactly the "random directory" pain.
- **DOCUMENTS** (.md .txt .csv .rtf .doc .docx): Write-tool-ONLY and keep the temp/scratch exclusion (an intermediate doc in scratch is usually not a deliverable). `.doc`/`.docx` added per Jonah.
- Discharge now requires a SUCCESSFUL surface, and an `open`/`xdg-open`/`start` Bash arm discharges a document (a .docx) that Read cannot render inline.

**Alternatives (this round):** Conservative (as-built, Write-only) rejected - misses the image case. Aggressive (any tool, any type, anywhere but hard-internal) rejected - too noisy, would lean on the disable toggle. Balanced is the middle: high coverage for visuals (where noise is low because require-exists + CONSUMER_RE filter), conservative for documents (where scratch is usually intermediate).

**Revisit when:** Bash visual-harvest false-fires in practice (tighten CONSUMER_RE or the output-path regex), or Jonah wants documents caught from Bash/temp too (relax the doc/temp split).
