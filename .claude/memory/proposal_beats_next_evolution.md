---
name: Proposal - the next evolution of the beats system
description: Grounded vision + prioritized roadmap for beats - model-agnostic store, simpler cross-team collab, non-coding verticals, and maximizing corpus value. Proposal only, not ratified.
type: reference
relates_to: [reference_claude-mem-vs-beats-eval.md, reference_memory_index_over_budget.md]
---

Collaborator: Jonah Cohen. Drafted 2026-06-29 as a strategy/research proposal (design only, no implementation). Every claim below is grounded in the actual improv beats corpus as of this date.

# Where beats are today (measured, not assumed)

The corpus on 2026-06-29: **850 files, 5.2 MB, ~45,500 lines**, spanning ~2026-04-14 to 06-27 (about ten weeks). Type distribution by frontmatter:

| type | count | share |
|---|---|---|
| project (session_*) | 662 | 78% |
| decision | 82 | 10% |
| reference | 49 | 6% |
| feedback | 48 | 6% |
| user | 0 | 0% |

`relates_to` is populated in 737 files (the linking discipline is real and working). `superseded_by` in 76. 367 git commits touch `.claude/memory/`.

## What works (keep these, they are the moat)

- **Plain markdown + YAML frontmatter, git-committed.** Diffable, reviewable, model-readable by anything that reads text, durable, no infra. This is the right substrate; nothing below throws it away.
- **Typed, linked, intentional entries.** The decision-beat structure (Choice / Alternatives / Why / Revisit-when) and the relationship graph (relates_to / supersedes / superseded_by) produce genuine reasoning artifacts, not just logs. The claude-mem eval (reference_claude-mem-vs-beats-eval.md) called this the "lab notebook" advantage and it holds up.
- **Per-task write discipline + the link-check protocol.** The corpus is dense and current because writes are mandatory and frequent.

## Honest limits (each one is already biting, with evidence in the corpus)

1. **The load-everything index has hit its ceiling.** `reference_memory_index_over_budget.md` documents it directly: MEMORY.md exceeds the compactor's 23 KB budget from *standing entries alone*, so every write dumps all non-standing pointers to the archive and still cannot get under budget. Project/session pointers added to the live index do not survive. Continuity now depends on grepping raw files plus a handful of pinned "ACTIVE MISSION" decision anchors. **The startup model (read the index, read every file it points to) is no longer affordable at 850 files / 5.2 MB.** This is exactly the O(corpus) context tax the claude-mem eval predicted; it has arrived.

2. **No retrieval. It is all-or-nothing load.** There is no way to ask "the 8 beats relevant to X" - you load the haystack to find the needle. The claude-mem eval (2026-06-13) already recommended borrowing relevance-filtered retrieval and named `reflect` as a "manual approximation" of it. That recommendation was never adopted; the pain it predicted is now the over-budget reference above.

3. **The corpus's best mining tool is dormant.** `reflect` ran exactly 3 times (May 12, 19, 20); `last-reflect-timestamp` is frozen at May 19; zero reflections in the ~40 days and ~500 beats since, despite a nudge hook. The one reflection that did run (reflection_2026-05-20.md) caught a real, costly honesty-failure pattern. That value was generated once and then abandoned because reflect is expensive (5 agents + synthesis) and manual.

4. **78% of the corpus is episodic session logs; the high-value reasoning is a 16% minority.** decision + feedback beats are where the durable signal lives, but they are outnumbered ~4:1 by session beats and not separately retrievable.

5. **Provenance is unstructured free text.** "Collaborator: Jonah" appears in ~12 different spellings (with/without surname, with/without date, with/without period). There is no structured author-human, author-model, verification-status, or confidence field. A *different* model reading this corpus cannot tell what was verified vs speculative, who or what authored it, or how much to trust it.

6. **It is coding-session-centric by trigger, not by schema.** Every beat is about sidecoach / hooks / installer / improv. But the *schema* is already domain-neutral: a tool eval (reference_claude-mem-vs-beats-eval, reference_shadcn-improve-eval) is a research beat; an incident fix (session_*-fix) is an ops postmortem; a rejected approach is a decision beat. What is missing is a `domain` field and non-coding capture triggers, not a new model.

# Vision, by the four directions

## 1. Model-agnostic memory (any model can read, write, and TRUST it)

**Principle: markdown stays the human-authored source of truth; everything else is derived and regenerable.** Do not migrate beats into an opaque DB (that was claude-mem's tradeoff, and it loses the git-shared, reviewable property that is the entire reason beats exist). Instead, add layers around the markdown.

- **A derived, typed beat-store.** A deterministic compiler reads frontmatter + body and emits `beats.jsonl` + a SQLite/FTS index (and a vector index). The markdown is "source"; the store is "compiled." The store is a **build artifact, never hand-edited and never the merge surface** (this directly retires the over-budget index pathology, because the live index stops being a committed, hand-maintained file).
- **Embeddings + relevance retrieval.** A local vector index (sqlite-vec or chroma-style) over beat bodies, regenerated on commit. Retrieval returns the relevant N beats, not the whole corpus. This is the missing read path and the answer to limit #1 and #2.
- **A provider-neutral MCP surface.** `beats.search(query)`, `beats.get(id)`, `beats.related(id)`, `beats.timeline(range)`, `beats.write(beat)`. Codex, Gemini, any MCP client reads and writes the *same* store. Today beats are "markdown Claude reads"; this makes them "memory any agent reads and writes through one contract."
- **Structured provenance = trust.** Promote provenance into frontmatter: `author_human`, `author_model`, `verified` (and how: tests / browser / codex-review), `confidence`. Trust becomes a *filter*: "verified decisions authored by a named human" vs "speculative session note from an unverified model." This is what makes a corpus safe for a model that did not write it to act on.
- **Publish the format as a tiny spec.** A `BEATS-SPEC.md` + JSON Schema turns the current convention into a portable standard any provider can target. The substrate is already portable; formalizing it makes "model-agnostic" a guarantee, not a happy accident.

## 2. Simpler cross-team collaboration

The merge friction is real and *already visible in the corpus*: MEMORY-archive.md contains the same Stage-2 pointers duplicated 3+ times, an artifact of multiple sessions racing to mutate one shared index file.

- **Append-only, immutable beats; derived index.** The single mutable, hand-edited, committed file (MEMORY.md) is the conflict surface. If beats are immutable (one file per beat, keyed by ULID/content-hash) and the index is *regenerated* rather than hand-edited, index merge conflicts disappear entirely. Two agents never edit the same line because no one edits the index. **This is the highest-leverage collaboration fix and it falls straight out of direction 1.**
- **Attribution and presence for free.** The structured `author_human` / `author_model` fields give "who/what touched this topic" (`beats who <topic>`, a blame view) with no extra machinery.
- **Conflict resolution by supersession, not text merge.** Two agents writing "the same" beat produce two immutable beats; a dedup pass links them with `supersedes` rather than producing a textual conflict. The relationship graph already does this job manually; automate it.
- **Optional thin sync service (ambitious tier).** A small beats-sync service (a Cloudflare Worker + D1/R2, or a shared remote with a git merge driver) accepts writes from multiple humans + agents and serves the retrieval API, scoped by project/team for access control. Because beats are immutable append-only, this needs no CRDT - the only mutable thing (the index) is regenerated server-side.

## 3. Integration beyond coding / other verticals

The schema generalizes; only the triggers are coding-specific. Add one field and per-vertical capture.

- **A `domain` frontmatter field:** code, design, writing, ops, research, support, pm. The existing type taxonomy (decision / feedback / reference / project / user) is already domain-neutral.
- **What a beat looks like per vertical (all of these shapes already exist in the corpus, unlabeled):**
  - **Designer:** a decision beat = chosen direction + rejected alternatives + the reference. *Trigger:* sidecoach flow completion (audit / critique / polish already mark these moments) writes a design beat automatically.
  - **PM:** a feedback beat = stakeholder rejected scope Y; a decision beat = roadmap pivot + why. *Trigger:* ClickUp task state transitions (the ClickUp MCP is installed), PR merges, meeting-note ingestion.
  - **Writer:** a decision beat = chosen headline/voice + rejected framings. *Trigger:* a "voice decision resolved" moment.
  - **Ops/support:** a reference beat = symptom + delta + fix. This is *literally* the Debugging Protocol output, and the corpus is already full of these (the `*-fix` session beats). *Trigger:* incident resolution.
  - **Research:** a reference beat = source evaluated, hypothesis killed, verdict. The tool-eval beats (claude-mem, shadcn) are already exactly this. *Trigger:* an eval/finding concluded.
- **The insight:** generalizing beats to other verticals is mostly a `domain` field plus per-domain capture skills, *not* a schema redesign. The corpus proves the reasoning shapes are universal.

## 4. Maximizing the corpus potential

Each idea below is tied to a value the corpus already demonstrated once and then under-exploited.

- **Continuous reflection as a scheduled routine.** Reflect is dormant because it is manual and expensive. Wire the existing skill to a scheduled cloud routine (weekly/biweekly) that runs unattended and posts the synthesis. Zero new architecture; the May 20 reflection proves the output is worth it.
- **Write-time contradiction + supersession check.** When a new decision beat is written, a retrieval pass finds prior beats on the same topic and flags contradictions / supersession candidates inline. The corpus shows real reversals (the audit-panel staged-vs-final-report reversal; the tiny-text pivots) that a write-time check would have linked automatically. This semi-automates the link-check protocol that is currently a manual judgment call.
- **Decision archaeology as a standing job.** Decision beats carry "Revisit when" clauses. A scheduled job evaluates those conditions against newer beats and surfaces stale decisions. (reflect's Agent 5 does this manually; make it standing.)
- **Generated onboarding digests.** "START HERE for <topic>" is already an ad-hoc convention in the index. Formalize it as a generated artifact: `beats onboard <topic>` synthesizes a primer from the relevant beats on demand.
- **Mined reusable playbooks.** Recurring decision shapes (the Codex review gate, produce-and-verify, debugging-protocol postmortems) can be mined into reusable playbook beats - the corpus's own patterns turned into templates.
- **Semantic search** is the same retrieval index from direction 1, exposed as a read tool. It is the single missing capability that everything else leans on.

# Prioritized roadmap (leverage x effort)

**High leverage / low effort (do first):**
1. **Derived retrieval index + `beats` CLI.** Compile frontmatter + bodies into SQLite/FTS (+ optional vectors); commands `beats search`, `beats related`, `beats timeline`. The index becomes a regenerated build artifact, not a committed hand-edited file. *This one move touches three of the four directions:* it retires the over-budget index pathology (limit #1), adds the missing read path (limit #2), and removes the merge-conflict surface (direction 2).
2. **Provenance + domain frontmatter fields** (`author_human`, `author_model`, `verified`, `confidence`, `domain`) plus a JSON-Schema validation hook. Cheap; unlocks trust (dir 1), attribution (dir 2), and verticals (dir 3) at once.
3. **Re-activate reflect as a scheduled routine.** No new code, just schedule the existing skill.

**Medium leverage / medium effort:**
4. Write-time contradiction/supersession check (semi-automate the link-check).
5. MCP beats surface (Codex / Gemini / any agent read+write through one contract).
6. Per-vertical capture skills (design beats from sidecoach completion; ops beats from the Debugging Protocol; research beats from evals).

**Ambitious / high effort:**
7. Beats sync service (multi-human/agent, presence, access scoping) on a Worker + D1/R2 or a git merge driver.
8. Published provider-neutral `BEATS-SPEC.md` + JSON Schema as a portable standard.

# The one or two prototype-worthy first steps

- **Prototype A (do this first): the `beats` retrieval index/CLI.** Additive (markdown stays source of truth), fixes a *currently broken* thing (the index), and is the foundation every other direction builds on. Build it as: a compile step that reads all frontmatter+bodies into SQLite+FTS5 (mirroring claude-mem's storage choice, which the eval already vetted) plus a small embedding index; `beats search <query>` returns top-N relevant beats; the live MEMORY.md index stops being hand-maintained and becomes `beats index --render` output. Success check: a cold session can answer "what did we decide about X" by retrieving 5-10 beats instead of loading 850 files.

- **Prototype B (cheap, parallel): the provenance + domain frontmatter extension** with a schema validator hook. Five new optional fields and a lint. It is the smallest change that simultaneously makes the corpus trustworthy to other models, attributable across a team, and extensible to non-coding verticals.

Together A and B convert beats from "markdown Claude reads at startup" into "a typed, retrievable, trustable, provider-neutral memory any agent or human can query" - without giving up the git-shared markdown that makes beats worth keeping.

## Files touched
- .claude/memory/proposal_beats_next_evolution.md (this proposal)
- .claude/memory/MEMORY.md (index pointer)
