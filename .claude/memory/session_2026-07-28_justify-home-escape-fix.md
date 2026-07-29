---
name: The justify installer's $HOME escape, closed
description: justify/install.sh planted CLI shims into the real /opt/homebrew/bin while running under a redirected HOME, and reported success because its verification loop was phrased in terms of the same redirected HOME. Replaced the temp-root guard with a HOME-identity check against the account database. Also folded the offline-reinstall and sidecoach-ledger findings, and reworked the dependency-currency test from mtime to a content stamp after a row proved mtime could never fire.
type: project
relates_to: [session_2026-07-28_install-rehearsal.md, session_2026-07-28_delegated-installer-writes.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: escape reproduced RED against pristine HEAD (8 shims into a fixture shared bin, exit 0) then GREEN; 16-row suite + 8 mutations all caught + 15-row offline suite, every row behavioural; delegated-writes 106/0 on BOTH the fixed tree and pristine HEAD; live /opt/homebrew/bin shims verified 10/10 correct after every run; one Codex adversarial review, 9 findings, all folded
confidence: high
---

Collaborator: Jonah. 2026-07-28. Authored against HEAD 8ae761a4.

# The defect

`justify/install.sh` chose its shim directory as the first WRITABLE of `/usr/local/bin`,
`/opt/homebrew/bin`, `$HOME/.local/bin`. The first two belong to the real user whatever
`$HOME` says, so a run with `$HOME` redirected planted eight symlinks into the real
machine's shared bin pointing at scripts inside the sandbox.

**And it reported success.** The verification loop compares each link against
`"$JUSTIFY_DIR/$target"`, and `$JUSTIFY_DIR` is derived from the same redirected `$HOME`, so
the links it had just mis-planted were exactly the links it expected. Self-consistency was
the false green. This is the session's defining defect shape, sitting in the one place that
breaks a user's shell rather than a test.

Found by falling into it: the 2026-07-28 install rehearsal used a durable sandbox HOME and
repointed all eight live shims. Restored in that session, and this unit closes the hole.

The pre-existing guard refused only when `$HOME` resolved under a TEMP root. That was the
right subject in 2026-07-16 (a reaped `/var/folders` tree) and the wrong PREDICATE: it asked
"is HOME temporary" when the question is "is HOME this user's". Any durable sandbox path
walked through. It also could not be complied with - its advice was "set BIN_DIR inside the
temp tree" while the selection above it unconditionally reset `BIN_DIR=""` before probing.

# The fix

**`justify_choose_bin_dir <shared-bin>...`** - a shared bin may be used ONLY when `$HOME` is
this account's home directory per the account database (`dscl`, then `getent`, then python's
`pwd`), compared physically on both sides. Anything else, INCLUDING a home that cannot be
determined, falls back to `$HOME/.local/bin`, which belongs to whoever the run is pretending
to be. This strictly subsumes the temp-root check, so that check is deleted rather than kept
alongside - a temp HOME is never the passwd home.

**Fall back rather than refuse.** The old guard exited 1, which fails every sandboxed
rehearsal - and rehearsing this installer in a sandbox is the correct thing to do, which is
how the defect was found. Redirecting makes a sandboxed install both correct AND useful.

**The candidate list is a PARAMETER**, not a literal and not an environment override. The
suite drives it with fixture directories without the production path growing a seam a caller
could aim at a bin of their choosing.

**`justify_bin_dir_is_permitted`** re-checks the invariant against what is actually on disk,
so a future edit to the selection cannot reintroduce the escape without a row going red.

**Repointing an existing link is now ANNOUNCED.** The ownership policy is unchanged and
deliberately so - a `justify-*` symlink in a bin dir is this installer's artifact, including
the stale and dangling ones, and repairing those is the point. What changed is that eight
links were previously rewritten without a word, so the run's output was indistinguishable
from one that changed nothing.

# The two routed findings

**Offline re-install (finding 0 of the rehearsal).** `justify` and `lotus` rebuilt
unconditionally with `|| exit 4`, routed into the parent's ledger, so an offline re-install of
an already-complete machine printed "did NOT fully apply every component" and exited 1 having
changed nothing. `justify` also called `npx -y tsc`, which FETCHES a compiler already sitting
in `node_modules`. Now: `npm install` is skipped when the dependencies are current, and the
local `tsc` is preferred over npx.

**sidecoach build failure (finding 4).** Was a `warn`, so a broken or offline build printed
one yellow line and the run still reached "Installation complete." with exit 0 - in the one
component whose entire value is the built artifact. Now routed through
`record_component_failure`.

# The mtime rule that could never fire

`deps_current` was first written as an mtime comparison: skip when `node_modules` is newer
than the manifest. A row went red and exposed that this is DEAD CODE for justify, because
`justify/install.sh` COPIES its `package.json` into `$JUSTIFY_DIR` on every run - the manifest
is always newer, so the skip could never once fire for the component that needed it most.

Replaced with a CONTENT fingerprint of the manifest and any lockfile, recorded inside
`node_modules/.improv-deps-stamp` after a successful install and compared on the next run.
Immune to the installer rewriting its own manifest, and it answers the question that actually
matters: were these dependencies installed FROM THIS manifest.

**The one-time cost, stated plainly:** a machine whose `node_modules` predates the stamp has
no stamp, so the FIRST run after this change still performs a real `npm install` and needs the
network. Every run after that is offline-capable. Guessing instead would mean assuming an
unstamped tree matches a manifest nobody recorded - which is the presence-only check that was
rejected. Row 1c pins this.

# Codex adversarial review - 9 findings, all real, all folded

`codex exec --sandbox read-only` on the diff. It found nine defects and judged three of my
five claims not fully supported. All nine are folded:

1. **The fallback could still escape through a symlink.** `HOME=/Users/a/sandbox` with
   `$HOME/.local/bin -> /opt/homebrew/bin` passes every LEXICAL containment test, because the
   path still begins with `"$HOME/"`, while the writes land in the shared bin. Fixed with
   `justify_path_is_within`, which resolves both sides; the fallback now REFUSES rather than
   redirecting, because at that point the run has no location left it can prove is its own.
   This was the same class of hole as the original defect, reintroduced by my own fix.
2. **The account probes accepted output from a FAILED lookup.** A `dscl` that prints a
   plausible record and exits 1 was believed, and since it runs inside an `if`, errexit does
   not intervene. Every probe now checks its exit status AND that the result looks like an
   absolute path.
3. **`HOME` unset died at line 15 with `HOME: unbound variable`**, before any of the ownership
   logic could report anything; `HOME=""` silently made every path absolute-from-root
   (`/.claude`, `/.local/bin`). Both now refused by name, along with a relative HOME.
4. **`$JUSTIFY_TSC` word-split.** A home containing a space turned the resolved compiler path
   into two nonexistent arguments. Now an array.
5. **`node_modules` presence treated as dependency completeness** - the finding that led to
   the stamp rework above.
6. **The suite's live-shim safety net only restored what existed at snapshot time**, so a shim
   name a row INTRODUCED was left behind as real damage while the suite called itself clean.
   It now also deletes introduced `justify-*` symlinks, and only those.
7. **The end-to-end rows passed if the installer aborted before the shim stage.** A missing
   node, a failed build, the space-in-home bug above - each leaves the shared bin untouched for
   reasons that have nothing to do with shim selection. Rows 5 and 6 now require evidence the
   run REACHED the shim stage.
8. **The mutation harness scored any non-zero suite exit as a catch.** On a machine with no
   justify shims, row 6b fails environmentally and every mutant would have been credited. Each
   mutant now names the row that must be among the failures - and on its first run that gate
   caught one of MY miscounts: m2 mutates the probe, which rows 1-4 deliberately stub out, so
   its true victim is row 4g and not row 2. It had been scored a catch it never made.
9. **Four offline-suite rows were grep-only** - a comment mentioning `node_modules/.bin/tsc`
   satisfied one, an unreachable branch satisfied two more. All four are now behavioural: the
   npx row reads the fake npx's absence from a successful run's log, the lotus rows run
   `lotus/install.sh` under the offline npm, and the sidecoach row drives `install.sh` with a
   build that fails and asserts the non-zero exit plus the ledger line.

# Verification

| Check | Result |
|---|---|
| Escape reproduced against pristine HEAD | 8 shims into a fixture shared bin, install **exit 0** |
| Same suite against the fix | 16 rows, 0 failed, 0 skipped |
| Mutation control | 8 mutants, 8 caught, 0 survived, 0 harness failures |
| Offline re-install suite | 15 rows, 0 failed, every row behavioural |
| `test-delegated-installer-writes.sh` on the fix | 106 / 0 |
| Same suite on pristine HEAD (its own control) | 106 / 0 |
| `test-installer-skill-retirement.sh` | 25 / 0 |
| `claude/hooks/test-install-skill-deploy.sh` | 52 / 0 |
| End-to-end `--only sidecoach,lotus,justify,tilt-lab`, redirected HOME | exit 0, 8 shims into the sandbox, live shared bin byte-identical, 3 stamps written |
| Live `/opt/homebrew/bin` after every run | 10 of 10 shims correct, no strays |
| Repo dirtied by the install | no - clone's `git status` count matches the real repo |

**The pristine-HEAD control was the hard part of the test work.** Making
`test-delegated-installer-writes.sh` pass on the fix initially broke it on HEAD, because F0
grepped for the temp-root guard's `/private` spelling and F2b required the abort. Both now
assert the PROPERTY (no shim in a shared bin) and accept either mechanism. Three mutation
anchors also moved with the indentation, and re-indenting them for the new tree broke the
control - so `mutate` grew a `ws` flag that makes an anchor match any run of whitespace,
keeping the exact-count check as the guard against the looser pattern.

# Self-analysis

Two failures worth recording.

**I reintroduced the exact defect class I was fixing.** My first fix tested containment with a
lexical prefix (`case "$bd" in "$HOME"/*)`), which a symlinked `$HOME/.local/bin` defeats -
structurally identical to the original bug, where a path that LOOKED like the run's own was
someone else's. I had just written three paragraphs about resolving paths physically before
comparing them, in the same function, and then compared lexically twenty lines later. Codex
found it. The lesson is not "resolve paths" - I knew that - it is that the guard I write for
the primary path needs applying to the FALLBACK path in the same breath, because the fallback
is the branch nobody rehearses.

**My first reproduction was vacuous and passed.** Row 5 went GREEN against pristine HEAD
because I put the sandbox HOME under `mktemp -d`; the old temp-root guard fired exactly as
designed, the installer exited 1 before reaching the shim block, and I nearly recorded "the
escape does not reproduce". The defect lives precisely in the gap the temp guard does not
cover, so reproducing it REQUIRES a durable path. Same failure mode as the vacuous safe-edit
control in `session_2026-07-28_install-rehearsal.md` one unit earlier: I picked the input the
code already handled and read the resulting green as information.

# Files touched

- `justify/install.sh` - HOME validated before anything derives from it; the temp-root shim
  guard replaced by `justify_real_home` / `justify_home_is_real` / `justify_path_is_within` /
  `justify_choose_bin_dir` / `justify_bin_dir_is_permitted` in a marked region; repoint
  announced; `deps_current` / `deps_record` / `deps_fingerprint`; `npm install` gated; tsc
  resolved locally through an array
- `lotus/install.sh` - the same `deps_*` helpers, both builds gated, both stamped
- `install.sh` - `deps_current` / `deps_record` in the library region; sidecoach's build
  failure routed through `record_component_failure`; its `npm install` gated
- `test-justify-shim-home-escape.sh` - new, 16 rows
- `mutation-check-justify-shim-home.sh` - new, 8 mutants with named expected victims
- `test-installer-offline-reinstall.sh` - new, 15 rows
- `test-delegated-installer-writes.sh` - F0 and F2b re-aimed at the property, `mutate` grew a
  whitespace-tolerant anchor mode

# Not done

`install.sh`'s tilt-lab block still tests `node_modules` PRESENCE rather than currency, and is
now the only remaining site using the weaker rule. Left alone because tilt-lab is not a
delegated installer and its failure is a `warn` rather than a ledger entry, so it cannot fail a
run; folding it in would be a one-line change to a component this unit did not otherwise touch.
