---
name: consolidate
description: >
  Merge a redundant cluster of beats on one topic into ONE canonical beat,
  superseding (never deleting) the originals. Invoke this skill when the task involves: "/consolidate",
  "/consolidate <topic>", "consolidate the beats", "consolidate the <topic>
  beats", "merge these beats", "merge the <topic> memories", "collapse the
  <topic> cluster", and when a SessionStart consolidate-nudge flags an
  over-threshold cluster and the human says yes. Default scope is the current
  project's .claude/memory/.
---

# Consolidate - Merge a Beat Cluster into One Canonical Beat

A project accumulates many small dated beats on the same topic (e.g. 48
`session_*tilt*` beats). The index gets noisy and the signal gets buried. This
skill merges one topic cluster into a single canonical beat that carries forward
every durable fact and decision, then marks the originals as superseded so they
drop out of the live index over time.

## THE SAFETY LINCHPIN (read first, non-negotiable)

Consolidation **supersedes-and-archives**, it **NEVER deletes**.

- The canonical beat gets `supersedes: [originals...]`.
- Each original gets `superseded_by: <canonical>`.
- Every original file STAYS ON DISK, untouched except for the one frontmatter
  line. Any nuance the merge dropped is still grep-able forever.
- You NEVER run `rm`, `git rm`, delete, or truncate a beat file. Not once. If you
  ever feel the urge to delete an original, stop - that is the exact failure this
  design exists to prevent. The originals are the deep-detail backstop; the
  canonical is the recall-level truth.

The compactor (`claude/hooks/compact-memory.py`) does the rest mechanically:
once the originals carry `superseded_by` and the index points at the canonical
instead of them, the now-redundant dated pointers age out of the live `MEMORY.md`
into `MEMORY-archive.md` on their own. You do not edit the compactor.

## When to use

- The human ran `/consolidate` or `/consolidate <topic>`.
- The SessionStart `consolidate-nudge` flagged a cluster ("`tilt` has 48
  entries") and the human said yes.
- The human asked to merge/collapse a redundant set of beats on one topic.

Do NOT use this for: a topic with only a handful of beats (nothing to gain),
standing rules (see below), or merging unrelated beats just because a token
collides.

## Step 1 - Pick the topic

- If the human gave a topic (`/consolidate tilt`), use it.
- If not, read the current project's `.claude/memory/MEMORY.md` index plus the
  filenames in the directory, count per-topic clusters the same way the detector
  does (filename token frequency), and pick the LARGEST consolidatable cluster.
  State which topic you picked and why before proceeding.

Scope is the current project's `.claude/memory/` unless the human says otherwise.

## Step 2 - Gather the cluster (and EXCLUDE standing beats)

Find every candidate beat for the topic:

1. List `.claude/memory/*.md`.
2. **HARD-EXCLUDE standing beats by frontmatter `type`, NOT by filename.** Read
   each candidate's frontmatter and keep ONLY beats with `type: project`. Drop any
   beat whose `type` is `decision`, `feedback`, `reference`, or `user` - those are
   long-lived standing reasoning/rules and must stay individually visible forever.
   This filter is filename-agnostic ON PURPOSE. THE TRAP that makes this the crux
   of no-data-loss: standing beats are frequently saved with a `session_*`
   FILENAME but a standing TYPE. Excluding by filename prefix alone (the way
   `compact-memory.py`'s STANDING tuple does) would miss them and destroy durable
   reasoning. Concrete, real examples from the `tilt` cluster - all `session_*`
   filenames, all MUST be excluded:
   - `session_2026-05-29_tilt-lab-design-direction.md` (type: decision)
   - `session_2026-05-29_tilt-lab-pointer-contract-gap.md` (type: decision)
   - `session_2026-05-29_tilt-lab-recon-synthesis.md` (type: decision)
   - `session_2026-05-29_tilt-lab-slider-accent.md` (type: decision)
   - `session_2026-05-29_tilt-lab-asset-gap-FAILURE.md` (type: feedback)
   - `session_2026-05-29_tilt-lab-recon-team.md` (type: feedback)
   - plus `feedback_tilt_lab_fidelity_mandate.md` (type: feedback, also a
     standing filename).
   None of those 7 may ever be superseded or swept in. CLAUDE.md is explicit that
   decision beats are long-lived; never consolidate them.
3. From the remaining `type: project` beats, keep those whose filename token or
   frontmatter `name`/`description` clearly matches the topic.
4. **Skip anything already superseded.** Drop any file that already has
   `superseded_by` set in its frontmatter (it is already handled - see Step 6
   idempotence).
5. Never include `MEMORY.md` or `MEMORY-archive.md`.

The consolidatable cluster is the intersection: `type: project` AND topic match
AND not already superseded. For `tilt` that is 42 project beats, not the 49
tilt-token files on disk.

## Step 3 - Surface the cluster and get explicit confirmation (GATE)

Topic-token matching is imprecise, and over-matching wrongly hides unrelated
beats from the live index. So before writing anything:

- List EVERY matched beat (filename + one-line description) for the human.
- **Bias to under-match.** When a beat is only loosely related, LEAVE IT OUT and
  say so. A left-out beat stays a normal, visible beat - no harm. A wrongly-
  included beat gets hidden behind a canonical that does not really cover it -
  real harm. Under-inclusion is always the safer error.
- Ask the human to confirm the membership list (plain yes/no is fine; this is a
  binary). Do not write a single `superseded_by` until they confirm.

If the human prunes the list, honor it exactly.

## Step 4 - Read every beat in the confirmed cluster

Read the FULL body of each confirmed beat. Do not synthesize from the index
descriptions alone. You are about to fold these into one beat; you must know what
each one actually says. Track, as you read:

- Every durable FACT (what is true / what was built / where it lives).
- Every DECISION (what was chosen over what, and why).
- Every `relates_to` link on any original (you carry the relevant ones forward).
- Files-touched lists worth preserving at recall level.

## Step 5 - Write the canonical beat

Create `session_YYYY-MM-DD_<topic>-consolidated.md` (today's date) in
`.claude/memory/`. If a canonical for this topic already exists, see Step 6
instead of making a second one.

Frontmatter:

```yaml
---
name: <Topic> - consolidated
description: <lede-first one-line, <=200 chars, what this canonical covers>
type: project
supersedes: [original_1.md, original_2.md, ...]   # EVERY confirmed original
relates_to: [<carried-forward links, deduped, only genuinely relevant ones>]
---
```

- `supersedes` lists every confirmed original (filenames only, no paths).
- `description` stays <= 200 chars and leads with the point (the compactor and
  the index both reward a terse lede).
- Carry forward `relates_to` links from the originals so the graph is not
  orphaned. Dedupe; drop links that point at originals being superseded in THIS
  merge (they would be self-referential); keep links to OUTSIDE beats. Keep it to
  the few that genuinely matter (the format rule is 0-2, more than 3 is over-
  linking).

Body - comprehensive but skimmable, NOT a verbatim concatenation of N bodies:

- Open with a one-paragraph lede: what this topic is and the current state of
  truth.
- Then section by sub-topic (`## ...`). Under each, capture every durable fact
  and decision at recall level - enough that a future session rarely needs to
  open an original, but structured, not dumped. Use "Why:" / "How:" for
  decisions, per the beat format.
- Record the collaborator name (from git `user.name`) and that this is a
  consolidation of N originals, naming the date range covered.
- End with a "Superseded originals" list (the filenames) noting they remain on
  disk and grep-able for deep detail.

## Step 6 - Idempotence

- If NO canonical exists yet: write a new one as in Step 5.
- If a `*-<topic>-consolidated.md` canonical ALREADY exists: do not make a second
  one and do not re-consolidate the canonical into itself. Merge only the NEW
  (not-yet-superseded) originals into the existing canonical - append/extend its
  body and add the new filenames to its `supersedes` list. If there are no new
  originals, no-op and say so.
- Because Step 2 already drops anything with `superseded_by` set, re-running
  `/consolidate <topic>` after a completed merge is a safe no-op.

## Step 7 - Mark each original superseded (no deletion)

For EACH confirmed original, add one frontmatter line:

```yaml
superseded_by: session_YYYY-MM-DD_<topic>-consolidated.md
```

- Edit ONLY the frontmatter. Leave the rest of the file exactly as it was.
- Do not delete, move, rename, or truncate the file.
- Keep both ends in sync: the canonical's `supersedes` list and each original's
  `superseded_by` must agree.

## Step 8 - Update the MEMORY.md index

- REMOVE the index pointer lines for the superseded originals.
- ADD one pointer line for the canonical:
  `- [<Topic> - consolidated](session_YYYY-MM-DD_<topic>-consolidated.md): <lede>`
- Do not touch standing-rule pointers or unrelated entries.
- You do not need to hand-archive the removed pointers. The compactor moves aged
  dated pointers into `MEMORY-archive.md` on its own; your job is just to make
  the live index point at the canonical instead of the cluster.

## Step 9 - Verify (count conservation + no data loss)

Before reporting done, confirm ALL of:

1. **Count conservation:** number of confirmed originals == number of entries in
   the canonical's `supersedes` list == number of originals now carrying
   `superseded_by`. These three counts must be equal. If not, fix before
   reporting.
2. **No deletion:** every original still exists on disk. Verify with a file
   listing - the cluster's file count must be unchanged (originals + 1 new
   canonical).
3. **No standing beat touched:** confirm no beat with `type: decision`,
   `feedback`, `reference`, or `user` was edited, superseded, or removed -
   checked by frontmatter type, not filename, so `session_*` files carrying a
   standing type are covered. For `tilt`, the 7 standing beats listed in Step 2
   must be byte-identical afterward (no `superseded_by` added).
4. **Index points at the canonical:** `MEMORY.md` has the canonical pointer and
   no longer lists the superseded originals.
5. **Both ends agree:** spot-check that each `superseded_by` names the canonical
   and the canonical's `supersedes` names that original.

A quick grep makes 1-3 mechanical, e.g.:

```bash
grep -lc "superseded_by:" .claude/memory/session_*<topic>*.md | wc -l   # == cluster size
ls .claude/memory/*<topic>*.md | wc -l                                  # unchanged + 1
```

## Step 10 - Report

Tell the human: topic, how many originals were merged, the canonical filename,
that every original is preserved on disk (superseded, not deleted), and the
count-conservation result. If voice is active, a one-line spoken summary.

## What this skill is NOT

- Not a deleter. It never removes a beat.
- Not autonomous. It runs only when a human invokes it or confirms a nudge.
- Not for standing rules. Beats with `type: decision`/`feedback`/`reference`/
  `user` are never consolidated - even when their filename starts with
  `session_`. Selection is by frontmatter type, never by filename.
- Not the compactor. `compact-memory.py` handles index size by date; this handles
  topic redundancy by superseding. They compose; neither edits the other.
