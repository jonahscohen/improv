#!/usr/bin/env bash
# test-bin-parity.sh
#
# INVARIANT: the repo-root bin/ directory and install.sh must agree, in BOTH
# directions.
#
#   A. disk -> installer   every file in bin/ is named by install.sh at a real
#                          deploy site. A launcher that ships in the repo but is
#                          never deployed cannot be invoked on any other machine.
#   B. installer -> disk   every "$REPO_DIR/bin/<name>" install.sh names exists on
#                          disk. A dangling deploy reference makes `chmod +x` fail,
#                          and install.sh runs under `set -e`, so the whole install
#                          aborts partway through.
#   C. deploy verb         a bin file that appears ONLY in prose (a DESCS/FILES
#                          help string) is NOT deployed. install.sh's own help text
#                          then advertises a launcher no machine has. This is the
#                          same overpromise Codex caught on agent-routing in
#                          2026-07-26: the FILES text said route-intent.json shipped
#                          and the code shipped only route-intent.sh.
#
# WHY THIS EXISTS: hook-registry-guard.sh sweeps exactly one class - claude/hooks/*.sh.
# bin/* had NO automated disk-vs-installer reconciliation of any kind. The measured
# 2026-07-27 coverage audit found bin/ was the only shipped class with zero coverage
# in either direction.
#
# WHY BOTH DIRECTIONS: this mirrors hook-registry-guard's _is_managed, which was made
# two-sided after the sidecoach 2-vs-6 lie. One direction alone is a half-check that
# passes while the other half is broken.
#
# The audit re-derives its answer from the DISK and from install.sh's own text on
# every run - it is not an allowlist of known-good filenames. Proven by the fixture
# section below, which plants each defect class and asserts the audit goes red, then
# registers it properly and asserts it goes green again.
#
# EXIT CODES
#   0  bin/ and install.sh agree (and every self-test passed)
#   1  parity failure - a real gap in THIS repo
#   2  self-test failure - the audit itself is broken, findings are not trustworthy
#   3  cannot tell - bin/ or install.sh missing (never silently "clean")
set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

pass=0
fail=0
ok()  { echo "PASS $1"; pass=$((pass + 1)); }
bad() { echo "FAIL $1"; fail=$((fail + 1)); }

# ------------------------------------------------------------------
# EXCLUSIONS
# ------------------------------------------------------------------
# Files in bin/ that are deliberately NOT deployed by install.sh. Each entry must
# state WHY, because an exemption with no reason is just a place to hide an
# unregistered launcher (hook-registry-guard's _is_excluded makes the same argument).
#
# Check D below asserts every excluded name still EXISTS on disk, so a stale entry
# left behind after a rename or delete is itself a failure rather than dead text
# that quietly widens the exemption.
#
# Currently empty: every file in bin/ is expected to be deployed.
BIN_EXCLUDED=""

# ------------------------------------------------------------------
# The audit. Takes a repo dir so the fixture section can point it at a synthetic
# repo; the real run points it at this checkout.
# ------------------------------------------------------------------
_audit() {
  local repo="$1"
  [ -d "$repo/bin" ] || { echo "CANNOT-TELL no bin/ directory in $repo"; return 3; }
  [ -f "$repo/install.sh" ] || { echo "CANNOT-TELL no install.sh in $repo"; return 3; }
  REPO="$repo" EXCLUDED="$BIN_EXCLUDED" python3 - <<'PY'
import os, re, sys

repo = os.environ["REPO"]
excluded = set(os.environ.get("EXCLUDED", "").split())
bindir = os.path.join(repo, "bin")

try:
    src = open(os.path.join(repo, "install.sh"), encoding="utf-8", errors="replace").read()
except OSError as e:
    print(f"CANNOT-TELL install.sh unreadable ({e})")
    sys.exit(3)

try:
    on_disk = sorted(f for f in os.listdir(bindir)
                     if os.path.isfile(os.path.join(bindir, f)) and not f.startswith("."))
except OSError as e:
    print(f"CANNOT-TELL bin/ unreadable ({e})")
    sys.exit(3)

# A repo-root reference: rooted at the checkout, not at ~/.local/bin, /usr/bin,
# sidecoach/bin or /bin/bash. Calibrated against every bin/ mention in install.sh.
# $repo is the variable the ampersand .zshrc shim uses for the same directory.
# The optional quote covers the "$REPO_DIR"/bin/x spelling, and \./bin/x covers a
# relative reference from the repo root; both were missed by the first cut.
ROOT_REF = re.compile(
    r'(?:(?:\$REPO_DIR|\$\{REPO_DIR\}|\$repo|\$\{repo\})"?|(?<![\w."/-])\.)'
    r'/bin/([A-Za-z0-9_.-]+)')
# A bare mention with no path prefix at all - prose in a DESCS/FILES string.
# The lookbehind excludes "-" so "my-bin/foo" in prose is not read as repo-root bin.
BARE_REF = re.compile(r'(?<![\w/-])bin/([A-Za-z0-9_.-]+)')

# A bin file counts as REGISTERED when install.sh USES it, in either of the two
# ways this repo actually ships launchers:
#
#   DEPLOY     copied or symlinked out to ~/.claude or ~/.local/bin
#              (bin/claude-teams-launcher.sh, bin/tilt-lab-launcher.sh)
#   RUN-IN-PLACE  invoked from the checkout itself, never copied anywhere
#              (bin/ampersand: the ~/.zshrc shim execs "$repo/bin/ampersand" so
#              that changing it ships by `git pull` instead of needing another
#              .zshrc migration on every machine)
#
# Modelling only DEPLOY would flag every run-in-place launcher forever, and a check
# that is permanently red on correct code is a check people learn to ignore. What is
# NOT acceptable is a bin file install.sh merely DESCRIBES, which is what the
# PROSE-ONLY finding below is for.
#
# `chmod +x`, `[ -f ... ]` and `[ -x ... ]` are DELIBERATELY NOT in these lists.
# Each one names a path without ever placing it anywhere or running it, so accepting
# them as registration would green-light the exact silent gap this check exists to
# find: install.sh chmods a launcher and then never deploys it. Rows 13 and 14 below
# hold that line.
DEPLOY_VERBS = ("make_symlink", "link_or_copy", "link_or_copy_data", "safe_cp",
                "ln -s", "ln -sf", "install -m", "cp ")
INVOKE_VERBS = ("/bin/bash", "bash \"", "exec ", "source ")
# Direction A asks "does the installer SHIP this file", so chmod does not qualify.
REGISTER_VERBS = DEPLOY_VERBS + INVOKE_VERBS
# Direction B asks a different question: "would this line BREAK if the file were
# missing". `chmod +x` on a missing path exits non-zero and install.sh runs under
# `set -e`, so it belongs here even though it ships nothing. Keeping the two sets
# separate is what lets chmod-only be a finding in one direction and a genuine
# install-breaker in the other. A test operator inside `if [ ... ]` never aborts,
# so test operators are in neither set.
ACT_VERBS = REGISTER_VERBS + ("chmod +x",)

lines = src.splitlines()
findings = []

# --- A + C: every file on disk is deployed, not merely mentioned ---------------
def _lines_naming(name):
    """Lines mentioning bin/<name>, in any spelling ROOT_REF or BARE_REF accepts.

    Built from the same two patterns used everywhere else in this audit. The first
    cut hardcoded a THIRD, narrower copy of the root pattern here, so the quoted
    ("$REPO_DIR"/bin/x) and relative (./bin/x) spellings were recognised by the
    dangling check and invisible to the registration check - a file could be
    genuinely deployed and still reported UNREGISTERED. One source of truth for the
    pattern is the fix.
    """
    root = re.compile(
        r'(?:(?:\$REPO_DIR|\$\{REPO_DIR\}|\$repo|\$\{repo\})"?|(?<![\w."/-])\.)'
        r'/bin/' + re.escape(name) + r'(?![\w.-])')
    bare = re.compile(r'(?<![\w/-])bin/' + re.escape(name) + r'(?![\w.-])')
    return [ln for ln in lines if root.search(ln) or bare.search(ln)]


for name in on_disk:
    if name in excluded:
        continue
    hits = _lines_naming(name)
    if not hits:
        findings.append(("UNREGISTERED-BIN", name,
                         "on disk in bin/ but install.sh never names it - "
                         "it ships in the repo and reaches no other machine"))
        continue
    if not any(v in ln for ln in hits for v in REGISTER_VERBS):
        findings.append(("PROSE-ONLY-BIN", name,
                         "install.sh mentions it but never on a line that deploys or "
                         "invokes it - advertised in help text, not installed"))

# --- B: every deploy reference resolves to a real file ------------------------
# A repo-root path is only DANGLING when it sits on a line that actually acts on it.
# The same path inside a comment ("# the old installer used $REPO_DIR/bin/gone.sh")
# breaks nothing at runtime, so it is reported as stale prose instead. Grading every
# full-path mention as runtime-breaking is how a check earns a reputation for crying
# wolf, and a check people override is worth nothing.
for ln in lines:
    for m in ROOT_REF.finditer(ln):
        name = m.group(1).rstrip(".,;:)")
        if not name or os.path.isfile(os.path.join(bindir, name)):
            continue
        if any(v in ln for v in ACT_VERBS):
            findings.append(("DANGLING-DEPLOY-REF", name,
                             "install.sh acts on bin/" + name +
                             " but no such file exists - install.sh runs under "
                             "`set -e`, so this aborts the install partway through"))
        else:
            findings.append(("STALE-BIN-PROSE", name,
                             "a comment or string names bin/" + name +
                             " but no such file exists - harmless at runtime, "
                             "misleading to the next reader"))

# --- B2: prose references that do not resolve (doc drift, not runtime-breaking) -
for m in BARE_REF.finditer(src):
    # Prose ends in punctuation ("...ships bin/ampersand."). The character class has
    # to allow dots so real names like tilt-lab-launcher.sh survive, so strip
    # sentence punctuation back off here. Without this, every launcher named at the
    # end of a sentence is reported as a separate, nonexistent "<name>." file.
    name = m.group(1).rstrip(".,;:)")
    if not name:
        continue
    if name in on_disk:
        continue
    if os.path.isfile(os.path.join(bindir, name)):
        continue
    findings.append(("STALE-BIN-PROSE", name,
                     "install.sh help text names bin/" + name +
                     " but no such file exists - the installer's own description "
                     "promises a launcher it does not ship"))

# --- D: no stale exclusions ---------------------------------------------------
for name in sorted(excluded):
    if name not in on_disk:
        findings.append(("STALE-EXCLUSION", name,
                         "excluded from this check but no longer exists in bin/ - "
                         "remove the entry so the exemption cannot widen silently"))

seen = set()
for cls, name, why in findings:
    if (cls, name) in seen:
        continue
    seen.add((cls, name))
    print(f"{cls} {name}: {why}")

sys.exit(1 if seen else 0)
PY
}

# ==================================================================
# SECTION 1 - negative controls against a synthetic repo
# ==================================================================
# The real repo is not used here. These rows prove the audit RESPONDS TO DATA:
# it must go red on each defect class and green again once the defect is fixed.
# A suite that only ever runs against a clean tree cannot tell you whether it
# would notice a dirty one.

FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT

_mkfixture() {
  rm -rf "$FIX/repo"
  mkdir -p "$FIX/repo/bin"
  printf '#!/bin/sh\necho launcher\n' > "$FIX/repo/bin/demo-launcher.sh"
  chmod +x "$FIX/repo/bin/demo-launcher.sh"
  cat > "$FIX/repo/install.sh" <<'EOS'
#!/usr/bin/env bash
# synthetic installer
set -e
chmod +x "$REPO_DIR/bin/demo-launcher.sh"
make_symlink "$REPO_DIR/bin/demo-launcher.sh" "$CLAUDE_DIR/demo-launcher.sh"
EOS
}

# Row 1: a correctly registered fixture is SILENT. A check that fires on
# everything gets ignored, so this row matters as much as the red ones.
_mkfixture
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "clean fixture: audit is silent, exit 0"
else
  bad "clean fixture should be silent and exit 0 (rc=$rc, out=$out)"
fi

# Row 2: a bin file nobody deploys.
_mkfixture
printf '#!/bin/sh\necho orphan\n' > "$FIX/repo/bin/orphan-tool.sh"
chmod +x "$FIX/repo/bin/orphan-tool.sh"
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "UNREGISTERED-BIN orphan-tool.sh"; then
  ok "unregistered bin file: exit 1 and names it"
else
  bad "unregistered bin file should exit 1 and name it (rc=$rc, out=$out)"
fi

# Row 3: same file, now genuinely deployed -> green again. This is the row that
# proves the audit reads install.sh rather than pattern-matching the filename.
cat >> "$FIX/repo/install.sh" <<'EOS'
link_or_copy "$REPO_DIR/bin/orphan-tool.sh" "$CLAUDE_DIR/orphan-tool.sh"
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "same file once deployed: goes green (responds to data, not to the name)"
else
  bad "registering the file should clear the finding (rc=$rc, out=$out)"
fi

# Row 4: mentioned in help text but never deployed - the 2-vs-6 lie shape.
_mkfixture
printf '#!/bin/sh\necho talker\n' > "$FIX/repo/bin/talked-about.sh"
chmod +x "$FIX/repo/bin/talked-about.sh"
cat >> "$FIX/repo/install.sh" <<'EOS'
DESCS+=("Ships bin/talked-about.sh for you.")
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "PROSE-ONLY-BIN talked-about.sh"; then
  ok "mentioned-but-not-deployed: caught as PROSE-ONLY-BIN"
else
  bad "prose-only mention should be caught (rc=$rc, out=$out)"
fi

# Row 5: install.sh deploys a file that does not exist.
_mkfixture
cat >> "$FIX/repo/install.sh" <<'EOS'
chmod +x "$REPO_DIR/bin/vanished.sh"
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "DANGLING-DEPLOY-REF vanished.sh"; then
  ok "dangling deploy reference: caught as DANGLING-DEPLOY-REF"
else
  bad "dangling deploy reference should be caught (rc=$rc, out=$out)"
fi

# Row 6: help text promising a launcher that is not in the repo.
_mkfixture
cat >> "$FIX/repo/install.sh" <<'EOS'
DESCS+=("and symlinks bin/ghosttool to ~/.claude/ghosttool.")
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "STALE-BIN-PROSE ghosttool"; then
  ok "help text naming a nonexistent launcher: caught as STALE-BIN-PROSE"
else
  bad "stale prose reference should be caught (rc=$rc, out=$out)"
fi

# Row 7: paths that only LOOK like repo-root bin must not be swept in.
_mkfixture
cat >> "$FIX/repo/install.sh" <<'EOS'
ln -sf "$REPO_DIR/sidecoach/bin/sidecoach.js" "$HOME/.local/bin/sidecoach"
/bin/bash ./install.sh
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "sidecoach/bin, ~/.local/bin and /bin/bash are not repo-root bin refs"
else
  bad "non-repo bin paths must not be treated as bin/ members (rc=$rc, out=$out)"
fi

# Row 8: a stale exclusion cannot be used to hide a deleted file.
_mkfixture
out="$(BIN_EXCLUDED="never-existed.sh" _audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "STALE-EXCLUSION never-existed.sh"; then
  ok "stale exclusion entry is itself a failure"
else
  bad "stale exclusion should be caught (rc=$rc, out=$out)"
fi

# Row 9: a RUN-IN-PLACE launcher is registered, not a finding. bin/ampersand is
# invoked from the checkout by the ~/.zshrc shim and deliberately never deployed.
# Before this row existed the audit reported it as PROSE-ONLY, which was the audit
# being wrong about reality rather than reality being wrong.
_mkfixture
printf '#!/bin/sh\necho inplace\n' > "$FIX/repo/bin/inplace-tool"
chmod +x "$FIX/repo/bin/inplace-tool"
cat >> "$FIX/repo/install.sh" <<'EOS'
if [ -f "$repo/bin/inplace-tool" ]; then
  /bin/bash "$repo/bin/inplace-tool" "$@"
fi
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "run-in-place launcher counts as registered (invoked, never copied)"
else
  bad "invoked-in-place launcher should not be a finding (rc=$rc, out=$out)"
fi

# Row 10: a run-in-place launcher that is ONLY described is still a finding. This is
# the row that stops Row 9's carve-out from swallowing the defect it sits next to.
_mkfixture
printf '#!/bin/sh\necho ghost\n' > "$FIX/repo/bin/described-only"
chmod +x "$FIX/repo/bin/described-only"
cat >> "$FIX/repo/install.sh" <<'EOS'
FILES+=("Runs bin/described-only from the repo.")
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "PROSE-ONLY-BIN described-only"; then
  ok "described-but-never-invoked is still caught (carve-out does not leak)"
else
  bad "described-only launcher should still be a finding (rc=$rc, out=$out)"
fi

# Row 11: a launcher named at the END OF A SENTENCE must not become a phantom
# "<name>." finding. The name character class has to allow dots (tilt-lab-launcher.sh),
# so sentence punctuation gets swept in unless it is stripped back off.
_mkfixture
cat >> "$FIX/repo/install.sh" <<'EOS'
DESCS+=("Re-run the installer with bin/demo-launcher.sh.")
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 0 ] && ! printf '%s' "$out" | grep -q 'demo-launcher.sh\.'; then
  ok "trailing sentence punctuation does not invent a phantom bin file"
else
  bad "trailing punctuation should be stripped (rc=$rc, out=$out)"
fi

# Row 12: chmod +x ALONE is not registration. It marks a file executable and leaves
# it in the repo. Accepting it would green-light the precise gap this check hunts.
_mkfixture
printf '#!/bin/sh\necho chmodonly\n' > "$FIX/repo/bin/chmod-only.sh"
chmod +x "$FIX/repo/bin/chmod-only.sh"
cat >> "$FIX/repo/install.sh" <<'EOS'
chmod +x "$REPO_DIR/bin/chmod-only.sh"
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "PROSE-ONLY-BIN chmod-only.sh"; then
  ok "chmod +x alone does not count as deploying a launcher"
else
  bad "chmod-only should still be a finding (rc=$rc, out=$out)"
fi

# Row 13: an existence test alone is not registration either.
_mkfixture
printf '#!/bin/sh\necho probed\n' > "$FIX/repo/bin/probed-only.sh"
chmod +x "$FIX/repo/bin/probed-only.sh"
cat >> "$FIX/repo/install.sh" <<'EOS'
if [ -f "$REPO_DIR/bin/probed-only.sh" ]; then :; fi
if [ -x "$REPO_DIR/bin/probed-only.sh" ]; then :; fi
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -q "PROSE-ONLY-BIN probed-only.sh"; then
  ok "an existence check alone does not count as deploying a launcher"
else
  bad "existence-check-only should still be a finding (rc=$rc, out=$out)"
fi

# Row 14: a repo-root path inside a COMMENT is stale prose, not a dangling deploy.
# Runtime is unaffected, so calling it runtime-breaking would be crying wolf.
_mkfixture
cat >> "$FIX/repo/install.sh" <<'EOS'
# the old installer used to ship $REPO_DIR/bin/removed-tool.sh here
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 1 ] \
   && printf '%s' "$out" | grep -q "STALE-BIN-PROSE removed-tool.sh" \
   && ! printf '%s' "$out" | grep -q "DANGLING-DEPLOY-REF removed-tool.sh"; then
  ok "a commented-out repo path is stale prose, not a dangling deploy"
else
  bad "commented path should be prose, not dangling (rc=$rc, out=$out)"
fi

# Row 15: prose about some OTHER directory ending in "bin" is not our bin/.
_mkfixture
cat >> "$FIX/repo/install.sh" <<'EOS'
DESCS+=("Unrelated: my-bin/other-thing and vendor/bin/thing are not ours.")
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok "my-bin/ and vendor/bin/ prose is not mistaken for repo-root bin/"
else
  bad "non-root bin-like prose must be ignored (rc=$rc, out=$out)"
fi

# Row 16: the quoted and relative repo-root spellings are both recognised as deploys.
_mkfixture
printf '#!/bin/sh\n' > "$FIX/repo/bin/quoted-form.sh"; chmod +x "$FIX/repo/bin/quoted-form.sh"
printf '#!/bin/sh\n' > "$FIX/repo/bin/relative-form.sh"; chmod +x "$FIX/repo/bin/relative-form.sh"
cat >> "$FIX/repo/install.sh" <<'EOS'
make_symlink "$REPO_DIR"/bin/quoted-form.sh "$CLAUDE_DIR/quoted-form.sh"
link_or_copy ./bin/relative-form.sh "$CLAUDE_DIR/relative-form.sh"
EOS
out="$(_audit "$FIX/repo")"; rc=$?
if [ "$rc" = 0 ] && [ -z "$out" ]; then
  ok 'both "$REPO_DIR"/bin/x and ./bin/x count as repo-root deploys'
else
  bad "quoted and relative repo-root spellings must be recognised (rc=$rc, out=$out)"
fi

# Row 17: cannot-tell is distinct from clean. A missing install.sh must never read
# as "bin/ is fine" - same lesson as hook-registry-guard's exit 3.
rm -rf "$FIX/norepo"; mkdir -p "$FIX/norepo/bin"
out="$(_audit "$FIX/norepo")"; rc=$?
if [ "$rc" = 3 ] && printf '%s' "$out" | grep -q "CANNOT-TELL"; then
  ok "missing install.sh reports cannot-tell (exit 3), not clean"
else
  bad "missing install.sh should be exit 3 (rc=$rc, out=$out)"
fi

if [ "$fail" != 0 ]; then
  echo ""
  echo "== $pass passed, $fail failed =="
  echo "SELF-TEST FAILED - the audit is broken, so its verdict on the real repo"
  echo "cannot be trusted. Fix the audit before reading the section below."
  exit 2
fi

# ==================================================================
# SECTION 2 - the real repo
# ==================================================================
echo ""
echo "--- bin/ parity for $REPO_DIR ---"
real_out="$(_audit "$REPO_DIR")"
real_rc=$?

if [ "$real_rc" = 3 ]; then
  echo "$real_out"
  echo "== $pass passed, $fail failed =="
  echo "CANNOT TELL - not a shape this check understands."
  exit 3
fi

if [ "$real_rc" = 0 ]; then
  ok "bin/ and install.sh agree in both directions"
  echo ""
  echo "== $pass passed, $fail failed =="
  echo "ALL BIN PARITY CHECKS PASSED"
  exit 0
fi

echo "$real_out"
echo ""
echo "== $pass passed, $fail failed (self-test), real repo: SEE FINDINGS ABOVE =="
cat <<'EOF'
BIN PARITY FAILURE. Each class and what to do about it:

  UNREGISTERED-BIN     Deploy it from install.sh (chmod +x + make_symlink, the way
                       bin/claude-teams-launcher.sh is handled), or add it to
                       BIN_EXCLUDED in this file WITH a reason.
  PROSE-ONLY-BIN       install.sh advertises it but never deploys it. Add the real
                       deploy line, or correct the help text.
  DANGLING-DEPLOY-REF  install.sh deploys a file that does not exist. This aborts a
                       real install under `set -e`. Restore the file or drop the line.
  STALE-BIN-PROSE      Help text promises a launcher the repo does not ship. Fix the
                       text or add the file.
  STALE-EXCLUSION      Remove the dead BIN_EXCLUDED entry.
EOF
exit 1
