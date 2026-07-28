---
name: Delegated installer write surface closed
description: Every write in justify/install.sh and lotus/install.sh now stages-then-renames, refuses symlinks out of the owned tree, and fails loudly; proven by a mutation-controlled harness with a pristine-tree negative control
type: project
relates_to: [session_2026-07-28_installer-safe-writes.md, decision_installer_bucket_browser.md]
author_human: Jonah
author_model: claude-opus-4.6
machine: wallace-deploy.local
source: session
verified: tests / codex-review
confidence: high
---

Commit 8d19b7cc replaced one `sed -i.bak ... && rm` line in each delegated installer. Codex's
round-8 review said the same hazard class covered the whole write surface of both files. It
did. This closes the rest of it.

## The write inventory, before and after

`justify/install.sh`

| write | before | after |
|---|---|---|
| `mkdir -p ~/.claude/justify` | unguarded | `refuse_repo_mkdir` BEFORE the mkdir, `refuse_repo_write` after |
| `cp -r server/ core/ adapters/ assets/ fonts/` | merges; a symlinked destination makes BSD cp fail ("Not a directory") and abort the run partway through the payload, identically on every re-run | `atomic_install_tree`: staged beside the destination, old tree moved aside, renamed in, old discarded. Stale files removed. Rollback plus an INT/TERM/HUP handler that restores and exits 130 |
| `cp package.json tsconfig*.json build.js` | `cp` truncates at open and follows a destination symlink | `atomic_install_file` (staged + renamed; a destination link is replaced, never followed) |
| `cp cli/*.sh` | same | same |
| npm install / node build.js / npx tsc | WARNING, then carried on | fatal, exit 4, manual commands still printed |
| build output paths | unguarded | `refuse_escaping_symlink` on dist and node_modules, plus a recursive scan of every link under dist/ |
| build artifacts | not checked | must exist AND resolve inside the install (`-f` follows a link, so existence alone proves nothing) |
| shims in a shared bin | `ln -sfn` over anything; verified with `[ -e ]`, which a directory satisfies | refuses a directory or a foreign regular file, replaces only links/nothing, verifies is-a-symlink + readlink target + resolves |
| temp-HOME shim guard | matched `/var/folders/*` and `$TMPDIR*` only | resolves the physical path and matches the `/private` spellings too |
| launchd plist | `open(dst,"w")` truncates and follows a link | staged + `os.replace`; failure stays a WARNING, documented as the one deliberate exception (placement only, nothing downstream reads it) |
| `~/.claude.json` | `json.dump(d, open(p,'w'))` | `register_mcp_server` |
| `mkdir -p ~/.claude/skills/justify` | unguarded | `refuse_repo_mkdir` before, `refuse_escaping_symlink` on the directory after |
| `cat > SKILL.md` heredoc | truncates at open, follows a link | `atomic_write_from_stdin`, which also refuses an empty write |
| `~/.local/bin`, `~/.claude/logs`, `~/Library/LaunchAgents` | raw `mkdir -p` | guarded |

`lotus/install.sh`: same helper block, same treatment. Its builds were `(...) || { echo WARNING; }`,
which returns the exit status of the ECHO, so the statement was 0 and `set -e` never saw the
failure at all. Its `~/.claude.json` python had `$NODE_BIN` and `$SERVER_JS` interpolated by the
SHELL into the program text, so a checkout path containing an apostrophe was a syntax error at
best. Both closed; paths now go through argv.

## The headline defect

    json.dump(d, open(p, 'w'), indent=2)

on `~/.claude.json`, in both installers. `open(p,'w')` truncates the user's entire Claude Code
configuration before a byte of the replacement is written, and the file object is never closed
explicitly, so the buffered write flushes during interpreter finalization where CPython PRINTS
the OSError and swallows it. Measured under `ulimit -f 1`: a 4013-byte config came back 512
bytes and **python exited 0**, with the installer's next line printing that the server was
registered. A destroyed config, a zero exit status, and a success message. That reproduction is
row B0 of the harness.

`register_mcp_server` resolves the path (so a user's symlink into their own dotfiles is
PRESERVED, not replaced - the opposite of the rule for installer-owned artifacts under
~/.claude/skills), stages beside the real file, fsyncs, renames, and reads it back. An
unparseable config is refused with exit 3 and NOT rewritten from scratch.

## Two bugs the work found in code nobody was reviewing

1. **The temp-HOME shim guard had a `/private` blind spot.** On macOS /var is a symlink into
   /private, so a $HOME spelled with its physical path arrived as `/private/var/folders/...`
   and matched neither `/var/folders/*` nor `"$TMPDIR"*`. Reproduced live: the harness planted
   eight shims in /opt/homebrew/bin pointing into a temp tree, twice, and both times they had
   to be restored by hand. `hook_deploy_mode` in the top-level installer already knew about
   this and listed the /private variants; this guard did not.
2. **`local a="$1" b="$a"` dies under `set -u`.** Bash expands every word of a `local` call
   before any of the names exist, so `$a` is read in the CALLER's scope. Caught by the harness
   on the first end-to-end run of `refuse_repo_mkdir`.

## Evidence

`test-delegated-installer-writes.sh`, 81 rows, all green. Its shape is the point:

- **HAZARD-DEMO rows run the OLD idiom verbatim and assert the damage HAPPENS.** If the fixture
  stops reaching the hazard, the demo row fails and the FIXED row beside it is known to prove
  nothing.
- **Every assertion is mutation-controlled** (G1-G16): break the product code the assertion
  guards, confirm the row goes RED, and confirm the mutation's anchor EXISTS at the expected
  count first. Three mutations initially reported "not load-bearing" because a DIFFERENT guard
  was catching the fixture; each was re-cut to disable both so the row isolates what it names.
- **Negative control:** against a pristine `git archive HEAD` checkout, 52 rows FAIL and 16
  pass. Against the fixed tree, 81 pass and 0 fail.
- **The suite cannot damage the machine.** Every justify run is gated on a verified shim guard,
  and all sixteen shared-bin shim entries are snapshotted at start and compared at the end.

## Self-analysis

Three failures worth naming, because each failed in the confident direction.

**The harness damaged the live machine twice.** The first time, only the two rows whose fixtures
were designed to reach the shim stage were gated. The second time, the negative control ran the
suite against pristine HEAD - where there is no build gate at all, so the FIRST justify row
marched straight to the shims. The failure mode: I gated the rows I could see reaching the
hazard instead of the rows that COULD reach it, and "regressed code" did not include "older
code" in my head. The gate now covers every justify run.

**Two rows passed for the wrong reason and I nearly kept them.** F1b asserted `~/.claude.json`
was absent after a failed build - but a sandboxed justify run never reaches the registration
anyway, so the row was green no matter what the gate did. D6 waited on an inverted condition
and passed once by luck. Both were caught by re-running and reading the hints, not by writing
them correctly. The lesson that generalizes: an assertion satisfied for a reason other than the
one it names is the same failure as the code it is meant to catch.

**I claimed a hazard I had not measured.** The first write-up said `cp -r` FOLLOWS a symlinked
destination directory. On macOS it does not - it fails with "Not a directory". The claim came
from the brief and from GNU habits, not from a run. Corrected in the comment and in the row,
which now asserts the measured behaviour.

## Codex review

Four wrapper invocations, all exit 0 (real verdicts). Round 1 on justify: six findings, all
folded. Round 2 on justify: four more (nested dist links, the interrupt window, shim collision
with a user's file, unguarded mkdir sites) - folded. Round 3 on lotus: three, including that
the fatal-build and symlink-guard fixes had been applied to justify and NOT to lotus - folded.
Round 4 on the harness itself: six, including two rows that could pass without reaching their
hazard and a shim snapshot that watched one of eight names - folded.

## Coordination note for the lead

Making the delegated builds fatal means `install.sh` line 6070/6080 (`bash
"$REPO_DIR/justify/install.sh"` / lotus) will now abort the WHOLE run under its `set -e` when a
build fails, where it previously printed "[ok] Justify installed" over a broken install. The
honest fix is to route both through the existing failure ledger rather than a bare `bash`:

    if picked justify; then
      info "Installing Justify..."
      if bash "$REPO_DIR/justify/install.sh"; then
        ok "Justify installed"
      else
        record_component_failure justify "justify/install.sh exited $? - see above."
      fi
    fi

Not applied here: `install.sh` is owned by two sibling agents this session.

## Files touched

- `justify/install.sh`
- `lotus/install.sh`
- `test-delegated-installer-writes.sh` (new)
