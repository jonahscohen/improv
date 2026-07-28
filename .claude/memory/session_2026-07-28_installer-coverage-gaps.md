---
name: Six carried-over installer gaps closed
description: The skills gate now covers justify and lotus (the proposed one-liner would have broken it), the apply layer stops leaking temp logs, malformed brain blocks fail the run like memory already did, the multibyte glyphs stay with the reasoning written down, the skill retirement is closed in install.sh with a one-shot sweep that outlives the component key, and a hook that was deployed and dead stops shipping
type: project
relates_to: [session_2026-07-28_skill-deploy-verify.md, session_2026-07-28_skill-retirement.md, session_2026-07-26_orphan-improv-skill.md]
author_human: Jonah
author_model: claude-opus-4.6
machine: Mac
source: session
verified: tests / codex-review
confidence: high
---

Four gaps found and honestly reported earlier today, then left because each sat outside
the finding agent's ownership. All four closed against HEAD 363458ea. Nothing committed.

## 1. The end-of-install skills gate did not cover justify or lotus

**The reported fix was wrong, in both directions, and that is the finding.** The claim was
"one line each would fold them in" - append the names to `SKILLS_DEPLOYED`. Measured before
acting:

- `SKILLS_DEPLOYED+=` appears in exactly ONE place, inside `install_bundled_skill`. justify
  and lotus are installed by `bash "$REPO_DIR/<name>/install.sh"`, a CHILD PROCESS. A line
  appending to the array from inside those scripts writes to the child's copy and is
  discarded on exit. The append has to happen in the parent.
- Even done in the parent it misfires. `./install.sh --verify-skills justify` -> **exit 2**,
  "unknown skill 'justify' - no source at claude/skills/justify" (its SKILL.md is a heredoc
  inside justify/install.sh; there is no repo source to diff). That would record a component
  failure on every successful install. `./install.sh --verify-skills lotus` -> **exit 0**,
  "0 skill(s), 0 file(s) match their repo source" - lotus is on `VERIFY_SKILLS_EXEMPT`, so
  the named path prints an info line and checks nothing. One name breaks the installer, the
  other buys a green row that examined no bytes.

**What was built instead.** `verify_delegated_skill <justify|lotus>` in install.sh, plus a
`DELEGATED_SKILLS_DEPLOYED` array appended at the two parent dispatch sites and checked in
the end-of-run block beside the existing gate. Both skills get structural checks (missing,
dangling, not-a-regular-file, unreadable, empty, placeholder never substituted) AND a real
rendered byte compare: the source with its `__*_SRC__` placeholder replaced by the path its
installer bakes in. lotus's source is `claude/skills/lotus/SKILL.md`; justify's is the
`<< 'SKILLEOF'` heredoc extracted from justify/install.sh.

**Why: structural checks alone were not enough, and independent review caught it.** The
first version stopped at "the placeholder is gone", which only proves SOME path was baked
in. Codex: "A SKILL.md from an old checkout, or one with `__JUSTIFY_SRC__` replaced by a
nonexistent path, passes." Confirmed live - the justify SKILL.md installed on this machine
is from Jul 12, structurally perfect, and content-stale; the structural-only check called
it "installed and current".

**How: rendered with awk index/substr, not sed.** The baked value is a filesystem path and
can carry `|`, `&` or a backslash, all meaningful in a sed replacement - a path containing
`&` would substitute the match back in and report drift on a healthy machine. Piped into
`cmp` rather than staged in a temp file, and all three pipeline statuses are checked, so a
dead extraction cannot compare empty-against-empty and report clean.

**It found real drift on the first run.** Both delegated skills on this machine are stale
against their sources (lotus by a month). The lotus exemption had been hiding it, and the
rendered compare matched exactly on the PATH while flagging the CONTENT - which is the
evidence that the exemption was never necessary for this path.

## 2. apply_pending and update_apply leaked their mktemp logs on failure

Both removed the log on the success path and neither removed it on the failure path.
Reproduced first: the file named in the failure message still existed after the call, for
both functions. It read as deliberate because the message named the file - but the message
prints the tail inline, so the named file was never what the caller was reading.

**How:** removed on the failure path too (after the tail, so nothing shown is lost), message
reworded to stop naming a file that is gone, and the path templated from `${TMPDIR:-/tmp}`
in the house style (`install_bundled_skill` already does this). The template is load-bearing
for the test, not cosmetic: a bare `mktemp` ignores TMPDIR on macOS and lands in the
per-user Darwin dir, so a sandboxed file count would have been measuring the wrong
directory. Also guarded the mktemp itself - errexit is disabled inside these
status-tested functions, so an unchecked failure fell through to `>""` and reported a full
disk as a broken component. apply_pending gains exit **4** (nothing attempted);
update_apply reuses **3** (the pull already happened, so the machine is in the state 3
describes).

## 3. Malformed BRAIN/LOCAL exited 0 while malformed MEMORY exited 1 - DECIDED, levelled UP

Measured on identical fixtures at 363458ea: `--only brain` -> exit 0, `--only memory` ->
exit 1. Same cause (a user-broken marker pair), same suppression, same warning, same remedy.

**Not deliberate.** Three pieces of evidence: (a) two OTHER failure classes in the same
brain section already recorded (payload carrying a reserved marker, un-materialisable repo
symlink), so the section was internally inconsistent; (b) the memory section's own comment
claims it was "the last one still doing it" and was wrong about three sites; (c) the suite
comment declined to pin the number, calling it "a live contract" - an author declining an
unresolved question, not recording a decision.

**Levelled UP, not down.** A refused delete suppresses the append, so the block was not
refreshed and the component did not fully apply - exactly what the ledger reports.
Downgrading memory would have made them agree by deleting the only machine-readable signal
that anything went wrong. Nothing aborts either way: `record_component_failure` warns and
returns 0, so every other component still installs. Three sites changed (canonical brain,
legacy rules, local overrides) and the suite row that pinned exit 0 was rewritten.

## 4. The multibyte bullet - LEFT, with the reasoning written down

**The reported location was wrong.** install.sh:3055 is pure ASCII (a comment about
`ensure_real_settings`). The real glyphs are the three status glyphs in `_br_glyph`, the
update row's arrow and check, and the box-drawing frame in the final panel - 483 non-ASCII
bytes, all load-bearing UI, and the whole file decodes as valid UTF-8.

**The abort does not reproduce.** System awk (20200816, the macOS default), per-character
`substr` walk and `split($0, a, "")` walk over the whole installer: both complete, both
count 367442 characters, identical with LC_ALL unset under en_US.UTF-8 and with LC_ALL=C.
The fix belongs in the analysing tool (set LC_ALL=C for determinism), not in the product.
Reasoning recorded at the `_br_glyph` site so the next person finds it instead of
re-opening the question.

## Verification

Bar applied throughout: every failing case built and watched fail FIRST, every assertion
mutation-controlled with its anchor proven present, whole harness run against a pristine
`git archive HEAD` checkout to confirm the rows that should fail there DO, sandboxed HOME
and TMPDIR everywhere, `git status` checked at the end.

| suite | fixed tree | pristine HEAD |
|---|---|---|
| test-userfile-safe-edit.sh | 74 pass, 0 fail | 69 pass, **5 fail** |
| test-zshrc-safe-edit.sh | 48 pass, 0 fail | unchanged |
| test-delegated-installer-writes.sh | 106 pass, 0 fail | 83 pass, **23 fail** |
| test-installer-tempfile-hygiene.sh (NEW) | 14 pass, 0 fail | **exit 2** (mutation anchor absent) |

Sibling hook suites re-run against HEAD-plus-only-my-two-product-files: test-component-browser
139/0, test-apply-pending, test-check-updates, test-apply-plan all pass.
`test-component-browser.sh` fails in the live working tree and passes in that isolated tree -
the failure is a concurrent agent's skill retirement (design-build, design-references removed
while still listed in browser-tree.json), not this unit. `test-install-deactivate-status.sh`
fails identically on pristine and pristine-plus-mine, so also not this unit.

**Codex, deterministic wrapper, four passes, every one exit 0:**
1. product diff -> 1 finding: verify_delegated_skill reported clean for justify on structural
   checks alone. Folded (the heredoc render above).
2. product diff re-review -> no findings.
3. test diff -> 5 findings: two tempfile success rows vacuous if the child never ran; the
   well-formed local control tested append-when-absent rather than refresh; the symmetry row
   anchored on the word "malformed", which both the old and new shapes print; I14 checked
   only the generic ledger header. All folded (marker file the child writes, a real
   well-formed local block, the "NOT refreshing it" refusal phrase plus a separate
   direction-pinning row, an explicit `- justify:` grep).
4. test diff -> 2 findings: no e2e or mutation coverage for the LOTUS dispatch append
   (deleting it left the suite green); the malformed-local row never proved the append was
   suppressed. Folded (I18/I19/I20, and a marker-count assertion rather than a file-size one,
   since the well-formed brain block in that fixture legitimately changes the file).
5. final pass -> no findings.

**Self-analysis.** One real error while writing this: `local comp="$1" ... h="$e2esym/$comp"`
in one statement aborts under `set -u` on bash 3.2, because an earlier initializer in the
same `local` is not visible to a later one. It surfaced as an anchor row failing rather than
as a symmetry row silently passing - which is the whole point of anchoring first, and is why
the row was written that way before the result was believed.

## Files touched

- `install.sh` - verify_delegated_skill (new), DELEGATED_SKILLS_DEPLOYED + two dispatch-site
  appends, end-of-run delegated verify block, three warn -> record_component_failure in the
  brain section, multibyte-glyph rationale at _br_glyph
- `claude/hooks/browser-lib.sh` - apply_pending and update_apply: templated mktemp, mktemp
  guard, failure-path cleanup, reworded messages, exit-code docs
- `test-userfile-safe-edit.sh` - malformed-brain row rewritten to the new contract, plus
  legacy-rules, local-overrides (own staged repo carrying CLAUDE.local.md, a path dead on
  this checkout), and brain-vs-memory symmetry rows
- `test-delegated-installer-writes.sh` - section I, 22 rows: unit coverage of
  verify_delegated_skill and e2e plus mutation coverage of both dispatch sites
- `test-installer-tempfile-hygiene.sh` - NEW, 14 rows. A new file rather than edits to
  claude/hooks/test-apply-pending.sh, which covers the same functions but is owned by a
  concurrent agent this session

---

# Items 5 and 6, handed over after the first four

## 5. The install.sh half of the skill retirement

design-build and design-references were deleted from the repo by a sibling (Jonah's ruling,
0 invocations each in two months), leaving install.sh half-registered. Closed all of it:
DESIGN_SKILL_KEYS plus five index-parallel arrays 11 -> 9 in lockstep, the header comment,
both skills-bundle strings, both status cases, both deactivate dispatch lines, the bundle
loop, and the a la carte blocks. Bucketing now returns `MISSING: []`, component-browser 139/0.

**A lockstep check caught what a careful edit missed.** PICKS was still 11 after the other
five arrays were 9. The arrays are positionally coupled, so that alone would have mismatched
every key from `curate` onward to the wrong title. Counting all six and printing the
key-to-title pairing found it immediately; reading the diff had not.

### Judgment call 1 - the catalog seeding

Moved to `curate`, which owns the catalog now. **Why:** the seeding lived in two
byte-identical heredocs, one of them inside the design-references a la carte block. Deleting
that block would have left `--only curate` on a fresh machine installing a skill whose
recall mode reads a `_vocab/categories.txt` nothing ever creates. **How:** one
`seed_design_reference_catalog` function called from the skills bundle and from a new curate
block, replacing both copies.

### Judgment call 2 - the one-shot cleanup

**Why it was needed:** the two `rm -rf` lines were the only code anywhere that could remove
these directories from an installed machine, and they were reachable only through the
component keys being deleted in the same breath. The prune cannot reach them - it walks
direct children of ~/.claude/skills and considers only symlinks whose target is gone, and
both are real directories on a copy-mode machine. Delete key and line together and every
installed machine keeps both skills forever. That is the `improv` orphan
(session_2026-07-26_orphan-improv-skill.md) about to happen twice more.

**How:** `remove_retired_skills`, a declared `RETIRED_SKILLS` list swept on every run that
reaches the apply phase, gated on ownership rather than on a component key. **Ownership is
proven, not assumed** - the same bar the prune sets, reached by a different oracle. The
prune must INFER retirement from git history because a dangling link is all it has. This
infers nothing: the list is declared, and the state file records that this installer
installed the component. A directory with no `active` record is someone else's, is left
alone, and is reported. That is why it needs no git oracle and still works from a tarball
where the prune correctly refuses. The state key is dropped afterwards, so it is one-shot.

## 6. multiple-choice-enforce.sh was deployed and dead

Verified all three claims before acting: shipped by the question-discipline cluster arm,
present in no wirings file, exec'd by no hook. Its allowlist exemption claimed it was
"invoked by multiple-choice-detect-stop.sh"; detect-stop carries a byte-identical INLINE
copy of the detection block, with its own comment saying to keep the two copies identical,
and execs nothing. The exemption justified a caller that does not call it.

Same disposition as question-enforcement.sh earlier today: it stops being DEPLOYED, stays in
the repo because test-multiple-choice-enforce.sh exercises it, and is exempted by name in
hook-registry-guard.sh with the reason written out. Removed from browser-tree.json in all
three places and corrected two stale hook counts.

**The exemption was removed, not replaced.** test-settings-wire-parity.sh goes green because
the hook no longer ships and therefore needs no unwired-by-design licence - not because a
second exemption was added on top of the false one. A sibling had just reworked that check to
verify each declared reacher against comment-stripped source, which is what made the false
claim visible after months.

**Not fixed here:** whether two byte-identical copies of a detection block is itself the
defect. It probably is, but deduplicating a live Stop-hook detection block is its own unit
with its own risk.

## The failing row the lead asked about - `deleted hook stops blocking (rc=2)`

**GENUINELY PRE-EXISTING AT HEAD, not a sibling artifact.** The suite reads the live
`$HOME/.claude` for that row, so a pristine-vs-live comparison cannot separate the causes -
both runs share the same machine state. Decided with a fresh sandboxed HOME against both
trees: pristine HEAD 75 passed / 1 failed with that row failing; working tree 82 passed / 0.
A second row, `stop blocks only once`, failed only with the contaminated HOME and is
therefore live-state noise.

Root cause: the row is mis-scoped. The stop hook re-audits and blocks on a real, unrelated
finding - `sidecoach` and `voice-output` present in claude/skills/ but not enumerated by
install.sh's hand-written skill list. The deleted fixture DID stop blocking; the audit found
something else. The row asserts a global rc where it means to assert that one name cleared.
Now green in the working tree through a sibling's skills packaging, not through this unit.

## Verification

| suite | fixed tree | pristine HEAD |
|---|---|---|
| test-installer-skill-retirement.sh (NEW) | 25 pass, 0 fail | 14 pass, **11 fail** |
| test-userfile-safe-edit.sh | 74 pass, 0 fail | 69 pass, 5 fail |
| test-delegated-installer-writes.sh | 106 pass, 0 fail | 83 pass, 23 fail |
| test-installer-tempfile-hygiene.sh | 14 pass, 0 fail | exit 2 |
| test-zshrc-safe-edit.sh | 48 pass, 0 fail | unchanged |

Sibling suites all green: component-browser 139/0, hook-registry 94/0, settings-wire-parity,
hook-data-parity 35/0, apply-pending, apply-plan, check-updates, install-deactivate-status 15/0.

**The REPO_DIR trap, designed around rather than survived.** install.sh recomputes REPO_DIR
from its own script location, so an env override does nothing and every comparison silently
runs against the real repo - the third independent instance today. This suite never overrides
REPO_DIR; it drives a staged copy so the path the installer derives IS the sandbox, and every
negative scenario carries a positive control in the SAME run so a fixture that quietly did
nothing cannot read as a clean result.

**Codex, four more passes, wrapper exit 0 every time, 10 findings folded:**
1. provenance too loose (any non-empty state authorized deletion, so a stale `inactive` key
   would have deleted a directory the user rebuilt); state_get could abort the installer under
   errexit; state_forget truncated the state file in place; the seeding heredoc write was
   unchecked; browser-tree.json still exposed the dead hook.
2. a partial seed was mistaken for a finished one and never retried; both state_forget calls
   were still bare under errexit; two stale hook counts.
3. `mv` could publish INTO a directory sitting at the vocabulary path, reporting success while
   the vocabulary stayed missing and leaking a temp file per run; the sweep's "unconditional"
   claim was false for an interactive browser session the user quits.
4. one finding DECLINED with reasoning: validating an existing vocabulary's content would
   destroy the customization the file exists to hold - its own header says adding a category
   is a user decision through /curate, so a vocabulary differing from the default is the
   normal state of a used machine. `-f` following a symlink is deliberate for the same reason:
   that file is the user's, unlike the skills tree the installer owns. Reasoning written into
   the function so it is not re-raised, and pinned by a row.

The quit-without-applying exception is deliberate rather than a hole: "open the installer,
look around, quit" must leave the machine as it was, and a retirement sweep that fired anyway
would make quitting the one action that silently deletes directories.

## Files touched (items 5 and 6)

- `install.sh` - the retirement across 11 sites, seed_design_reference_catalog, state_forget,
  remove_retired_skills, the question-discipline cluster arm
- `claude/hooks/hook-registry-guard.sh` - multiple-choice-enforce exempted by name
- `claude/hooks/browser-tree.json` - dead hook removed from three places, two counts corrected
- `claude/hooks/test-settings-wire-parity.sh` - the false allowlist entry REMOVED (stricter,
  not weaker)
- `test-installer-skill-retirement.sh` - NEW, 25 rows
