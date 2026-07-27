---
name: ampersand self-heal shipped, installer data-file and skills coverage closed, and three coverage-audit defects fixed - one unit that grew twice
description: The thin-shim split, a shared zshrc_block_delete ending four classes of destructive range-delete against the user's real ~/.zshrc, the hook_data_files companion-deploy table, a retired hook stopped from shipping, and negatives built FROM every change. Three Codex passes, seventeen findings, all folded. Ten suites green including two written by another agent.
type: project
relates_to: [session_2026-07-27_ampersand-selfheal.md, session_2026-07-27_teammate-collision-ruling.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: ten suites green; every new assertion watched RED against a purpose-built mutant; three Codex reviews at reasoning-effort high; passes two and three returned no High findings; completion confirmed by two suites this session did not write going quiet
confidence: high
---

# ampersand self-heal + installer coverage closure (2026-07-27)

> **LEAD VERIFIED 2026-07-27, on a quiet tree with every other teammate shut down.**
> The acceptance gate was deliberately set to two suites this unit did not write, and it is
> met: `test-bin-parity.sh` exit 0 (18/0) and `test-settings-wire-parity.sh` exit 0 (18/0),
> both of which exited 1 before the work. Also re-run by the lead: hook-registry 52/0,
> ampersand-shim 122/0, hook-data-parity 35/0, multiple-choice-enforce 49/0, and
> `--negative-control` confirming assertions fail against pre-fix code.
>
> The single surviving `question-enforcement` reference in install.sh is the COMMENT at
> line 680 documenting the deliberate non-deployment; the hook remains on disk only because
> test-multiple-choice-enforce exercises it, and hook-registry-guard.sh exempts it by name
> at line 113 with the reason written out. That is the correct end state, not a miss.
>
> **A lead error corrected here:** I reported install.sh:1847 as still holding the
> destructive sed. That line number came from a fingerprint taken BEFORE the patch landed,
> and the teammate was right to push back - the unguarded range-deletes were already gone,
> and 1847 had become unrelated cmux code. Re-measure before asserting a defect is
> outstanding; a stale line number reads exactly like an unfixed bug.
>
> **The finding worth carrying past this repo:** twice in one unit, a guard written against
> data loss was itself unsound in precisely the way the code it replaced was unsound, and a
> different model caught it both times. The mutant is what settles it - delete the guard,
> and if the test still passes, the test was measuring nothing.

Collaborator: Jonah. The scope grew twice. Recorded in order, because the turns are the
lesson.

## Verification baseline (Team Rule 9)

| suite | before | after |
|---|---|---|
| test-hook-registry.sh | 52 passed, 0 failed | 52 passed, 0 failed |
| test-installer-manifest.sh | PASS | PASS |
| test-component-browser.sh | 139 passed, 0 failed | 139 passed, 0 failed |
| test-install-hook-deploy.sh | 26 passed, 0 failed | 26 passed, 0 failed |
| test-settings-deploy-parity.sh | ALL PARITY CHECKS PASSED | ALL PARITY CHECKS PASSED |
| test-ampersand-shim.sh | 74 passed | **124 passed, 0 failed** |
| test-hook-data-parity.sh | 24 passed | **35 passed, 0 failed** |
| test-multiple-choice-enforce.sh | 49/0 | 49 passed, 0 failed |
| test-bin-parity.sh | **exit 1** (real finding) | **18 passed, exit 0** |
| test-settings-wire-parity.sh | **exit 1** (real finding) | **18 passed, exit 0** |

`--audit`, `--audit-data`, `--audit-skills` all rc=0. `test-ampersand-shim.sh
--negative-control` fails 8 assertions against install.sh as of HEAD.

The last two rows are the completion signal that matters most: they were written by
another agent (`coverage`), they went red against the real repo on defects 4-6 below,
and they went quiet without being edited.

## How the scope grew

**Turn 1.** Dispatched against a brief describing HEAD `e42b9a57`, which the working
tree had already moved past. Three install.sh edits made before that surfaced took a
sibling suite from 74/0 to **73/1** - it builds its harness by extracting functions with
`awk '/^deactivate_ampersand\(\) \{/,/^\}/'`, so a helper hoisted to file scope is
invisible to the extract. All three were reverted and 74/0 restored before reporting.

**Turn 2.** The lead ruled the surface uncontended and assigned the whole of it, plus
the coverage-closure scope. Work resumed.

**Turn 3.** `coverage` stood down and handed over three more installer defects.

## What shipped

1. **The thin shim.** The `.zshrc` block locates the repo and hands off to
   `bin/ampersand`, so behaviour ships by `git pull`. All four reproduced failure classes
   verified in a sandbox: no ampersand at all, baked path missing, exec bit stripped,
   pull failure. Class (b) searches (`$IMPROV_DIR`, the write-time hint, six usual clone
   paths) then fails loudly with three named recovery routes, because the second machine
   is exactly where a single baked path is wrong.

2. **`zshrc_block_delete` - one primitive, every `.zshrc` delete site.** Addresses by
   VERIFIED LINE NUMBER and refuses malformed input. `sed -i.bak '/begin/,/end/d'`
   destroyed shell config four ways, and every site removed its `.bak` on the next line:
   no end marker (runs to EOF); two begins one end (spans both blocks, eating what is
   between); unanchored regex (a marker in a comment is a boundary); and a **symlinked
   `~/.zshrc`**, where `sed -i` refuses a non-regular file. That last one now resolves
   the link and edits the target, so those machines are actually repaired rather than
   only failing safely - a symlinked `.zshrc` is one of the most common dotfiles setups,
   and refusing to ever repair it just relocates the bug.

3. **Duplicate blocks converge.** `is_current_format` requires exactly one WELL-FORMED
   block carrying the shim marker. zsh runs whichever definition comes last, so a current
   block plus a stale one silently ran the stale launcher; and a block with a begin, the
   marker and no end used to report current, leaving a machine that looked healthy while
   being both unrepairable and un-uninstallable.

4. **Companion data files.** `hook_data_files()` + `install_hook_data` deploy
   `grounding-intent.json` and `consolidate-intent.json`, never deployed before. Both
   consumers guard on `[ -f "$INTENT_FILE" ] || exit 0`, so they installed, looked
   present, and did nothing, forever - the route-intent.json shape of 2026-07-26.

5. **Skills.** `consolidate` and `tilt-lab` deploy.

6. **`question-enforcement.sh` stopped shipping.** A Stop-shaped hook wired to no event,
   inert on every machine that ever installed the cluster. Superseded by
   `multiple-choice-detect-stop.sh` + `multiple-choice-inject-prompt.sh` (same creation
   day, wired twice each, the path CLAUDE.md documents). Dropped from the cluster list AND
   from `browser-tree.json` in one change so the guard cannot flag a half-registration;
   it stays on disk only because `test-multiple-choice-enforce.sh` exercises it, and the
   guard exempts it by name with that reason.

7. **`bin/transcribe` help text corrected** to `claude/transcribe.sh` - the installer
   promised a launcher the repo does not ship.

8. **`test-settings-deploy-parity.sh` matcher bounded on the right.** Unbounded, a wiring
   of `foo.sh.disabled` yielded `foo.sh`, so the suite confirmed the wrong file was
   deployed and said PASS.

9. **bin/ampersand** chmod +x, plus a loud warning when the launcher is absent.

## Third Codex pass (delta only) - no High, four folded

Run on the delta after the lead's verification, at their request. **No High findings.**

- **Medium, data loss the other two passes missed:** `sed -i.bak` names its backup
  `$ZSHRC.bak`, a path this code does not own. On success it DELETED whatever was there,
  so anyone keeping a hand-made `~/.zshrc.bak` had it destroyed by an install; on failure
  it could "restore" from that unrelated stale file. Also a >40-hop symlink chain fell
  through the resolver into `sed` on a symlink, and the awk plan (line numbers) was
  applied to a second, independent read of the file.
  All three are gone together: the primitive now snapshots the file to `$TMPDIR`, plans
  AND applies against that one snapshot, and writes back with `cat > "$ZSHRC"`, which
  follows a symlink, keeps the original inode and permissions, and creates no sibling
  backup at all. The link-resolution loop was deleted as unnecessary.
- **Medium:** the guard still accepted UI display strings as deploy evidence
  (`route-intent.json` is in installer UI text), so removing the real table entry could
  have left `--audit-data` green. It now looks only at deploy SITES - the
  `hook_data_files()` body and lines that actually copy or link - with bespoke owners
  checked against all non-comment code, honouring the same `hook_data_bespoke`
  declaration the parity suite uses.
- **Low:** the browser tree and installer UI both still said "4 question-discipline
  hooks" after one was retired. Corrected to 3.
- Codex explicitly confirmed the `bin/ampersand` call: it is run in place from the
  checkout by the shim, so it should ship through `git pull` and NOT be copied or
  symlinked anywhere. `chmod +x` is hygiene, not a runtime requirement.

Negative-controlled: restoring the old `sed -i.bak` primitive turns three assertions red,
including "a user's own ~/.zshrc.bak is never touched".

## Codex review - two passes, thirteen findings, all folded

Pass 1 (217s, effort high): 3 High, 4 Medium, 2 Low. Highest-value finding was that
**my own first guard was wrong in the same way the code it replaced was wrong** - it
proved "some end exists after some begin", which passes on an unclosed block followed by
a complete one. Also: two unguarded delete sites I had not touched
(`deactivate_voice_output`, `deactivate_cmux`); the duplicate-block freshness bug;
`install_hook_data` returning non-zero on a missing companion, which under `set -e`
aborted the installer mid-run; `$REPO_DIR` embedded unescaped in generated zsh; and a
parity check satisfiable by a filename in a COMMENT or in the `FILES[]` UI strings.

Pass 2 (215s, effort high) on the folded result: **no High findings.** Two Medium (the
symlink repair gap; `is_current_format` accepting a block with no end marker) and two
Low (the primitive's contract comment was wider than its behaviour; the guard's own
UNDEPLOYED check still accepted a comment as deploy evidence, so that mutation control
did not prove it could tell code from prose). All four folded, then re-verified.

## Negatives built FROM what changed

Every new assertion was watched RED first, against purpose-built mutants:

- naive unguarded range sed -> **6 red**, including "user config below survives"
- old "any block carries the marker" freshness check -> **3 red**, including "the
  surviving launcher works"
- table default arm returning non-empty -> **3 red**; a table arm pointing at the wrong
  companion -> **2 red**
- guards stripped from install.sh -> **7 red** of 11 launcher/guard rows
- regex boundary removed -> the matcher self-test goes red **and fails the suite**. It
  did not, at first: the assert lived inside a captured `$(...)` whose exit code is
  discarded, so it printed a traceback while the suite still exited 0. A check that
  cannot fail the suite is decorative; it was moved out and given its own exit path.
- half-registration (dropped from install.sh, left in the tree) -> `UNMANAGED: sb-half`,
  rc=1, proving the exact mistake item 6 could have made is caught
- `M8`/`M9` for the case `M1`-`M4` never covered: a hook with NO companion must stay
  GREEN, or the guard fires on nearly every hook and gets read as noise

## The concurrency question, answered

The lead asked whether this session's own sandbox heredocs wrote the contested files.
**They did not**, on two independent proofs:

1. `install.sh` was already reported modified by `git status` in this session's opening
   context, before a single tool call ran - so its modification predates every heredoc.
2. `test-ampersand-shim.sh` as it appeared at 06:28:15 contains **none** of this
   session's draft helper names (`new_sandbox`, `install_run`, `amp_state`, `zc`, `zq`)
   and **all** of another author's (`mkrepo`, `seed`, `newcase`, `run_ampersand`,
   `reached`). A heredoc cannot emit text its author never possessed. The draft this
   session actually wrote never landed: the `Write` failed because the file already
   existed.

Every heredoc target was `$SB` (a `mktemp -d`), `/tmp/mutrepo`, or `/tmp/*`; the only
writes to the repo were deliberate tool calls. What remains unexplained is whose writes
those were, and files under this session's ownership continued changing coherently
(07:39-07:41) long after the lead's sweep. Left as a known unknown, flagged rather than
guessed at.

## Self-analysis

**Turn 1.** I checked file CONTENT and never its mtime. `git status` flagged install.sh
modified in my first tool call and I read it as leftover rather than as a live writer.
Content answers "what does this say"; only a repeated mtime answers "is anyone writing
this now".

**Turn 2.** I hoisted a helper without checking who consumed the function I was
changing, and a sibling harness went red. The fix was to make the harness follow the code
and assert what it sourced, not to contort the code around the harness.

**The finding that should outlive this session:** twice, a guard I wrote against data
loss was itself unsound in the same way as the code it replaced, and both times a
different model caught it. A destructive operation deserves a stricter proof than the
intuition that produced it. The proof of that proof is the mutant: if the guard is
removed and the test still passes, the test was measuring nothing.

**Process note.** A single apostrophe in a COMMENT inside a quoted heredoc nested in
`$( ... )` breaks bash's command-substitution lexer and surfaces as "unexpected EOF while
looking for matching `)`" pointing at the heredoc's opening line. The comment there now
says so.

## Files touched

- `install.sh` - `zshrc_block_delete` (symlink-resolving, line-number addressed, exact
  contract documented); every `.zshrc` delete routed through it; `is_current_format`
  one-well-formed-block; `install_hook_data` `set -e` safety + warn; shim path escaping;
  bin/ampersand presence warn + chmod; `question-enforcement.sh` dropped from the
  cluster; `bin/transcribe` text corrected; the unreachable legacy branch commented as
  defensive-only with the reason it cannot fire.
- `claude/hooks/hook-registry-guard.sh` - `question-enforcement` exemption with reason;
  UNDEPLOYED DATA now ignores comment bodies.
- `claude/hooks/test-ampersand-shim.sh` - `A_unclosed` fixture; `part4` (launcher
  contract + destructive-delete guard); duplicate-block convergence; `part6`
  (`is_current_format` unit-tested against eight hand-built shapes); symlink case
  strengthened to assert actual repair.
- `claude/hooks/test-hook-data-parity.sh` - SECTION 1b (the table executed, not parsed);
  registry-derived expectations; scoped UNDEPLOYED + new UNTABLED row; `M8`/`M9`;
  fixtures now deploy with real code so the controls cannot be satisfied by prose.
- `claude/hooks/test-settings-deploy-parity.sh` - bounded matcher + a self-test whose
  exit code actually counts.
- `claude/hooks/browser-tree.json` - `hook_data_bespoke` for sidecoach;
  `question-enforcement` removed from all three places.
- `bin/ampersand` - mode 644 -> 755.
- `.claude/memory/MEMORY.md` - pointer.

Not done, deliberately: no commit. `claude/hooks/agent-teams-guard.sh` untouched
(`panespawn` owns it). `test-bin-parity.sh` and `test-settings-wire-parity.sh` untouched
(`coverage` wrote them; they are the independent completion signal).
