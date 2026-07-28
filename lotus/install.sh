#!/bin/bash
set -euo pipefail

# Lotus installer - official Improv component.
# Lotus is a Figma plugin + MCP bridge (stdio MCP for Claude Code, WebSocket on
# 9527 for the plugin running inside Figma). Unlike justify, the app is large and
# is built IN PLACE in the repo (like tilt-lab) rather than copied to ~/.claude.
# "Installing" means: npm-install + build both halves, register the MCP server in
# ~/.claude.json (NOT settings.json - this Claude Code build does not read MCP
# defs from settings.json), and install the /lotus skill with the repo path baked
# in. Invoked by the top-level install.sh when `lotus` is picked.
#
# Exit codes - one per failure class, so a caller can tell what went wrong without
# scraping stdout. The top-level install.sh runs this under its own `set -e`, so any
# non-zero here stops that run rather than printing "[ok] Lotus installed" over it.
#   0  installed and verified
#   1  a prerequisite is missing (node, npm)
#   3  a destination resolves inside this checkout - would write into tracked source
#   4  a build did not produce an artifact this installer goes on to advertise
#   5  the ~/.claude.json MCP registration failed
#   6  the skill could not be installed

CLAUDE_DIR="${HOME}/.claude"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # = <repo>/lotus

echo "Installing Lotus..."

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is required. Install it first."
  exit 1
fi
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is required. Install it first."
  exit 1
fi

# The physical root of this checkout, resolved once. refuse_repo_write below compares
# every destination against it so no write can land in the installer's own source.
REPO_PHYS="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd -P)" || {
  echo "ERROR: could not resolve the repository root above $SCRIPT_DIR" >&2
  exit 1
}

# ============================================================================
# BEGIN improv shared safe-write helpers
#
# This block is BYTE-IDENTICAL in justify/install.sh and lotus/install.sh.
# test-delegated-installer-writes.sh extracts both copies and fails if they drift.
#
# WHY DUPLICATED INSTEAD OF SOURCED. Both delegated installers are standalone: each
# runs directly out of a checkout with nothing else present, each declares its own
# `set -euo pipefail`, and neither can reach the top-level installer's safe_cp /
# is_repo_symlink helpers, because install.sh is a 6600-line interactive installer
# that RUNS the whole install when sourced. These are the same primitives with the
# same contracts, reimplemented for that constraint rather than a third pattern
# invented alongside them. The sentinels exist so the drift check and the harness
# can both find the block.
#
# THE HAZARD CLASS these close, in one sentence each:
#   - a write that FOLLOWS a symlink lands somewhere the installer does not own,
#     including inside this checkout's own tracked source;
#   - a write that TRUNCATES OR DELETES the destination before the replacement is
#     proven leaves the user with nothing when the second half fails;
#   - a failure that is SWALLOWED reports a successful install over a broken one.
# ============================================================================

# phys_of <path> - print the physical filesystem location <path> names.
#
# Neither `realpath` nor `readlink -f` is on the macOS base system this installs on,
# so this resolves by hand: follow a symlinked final component to its target, then
# resolve the parent with `cd -P`. It works when the last component does not exist
# yet, which is the normal case for a file that is about to be written.
#
# Returns non-zero if the parent directory does not exist or a link loop is hit. A
# caller that cannot tell where its write will land must not perform the write.
phys_of() {
  local p="$1" target dir base hops=0
  while [ -L "$p" ]; do
    hops=$((hops + 1))
    if [ "$hops" -gt 40 ]; then
      echo "ERROR: symlink loop while resolving $1" >&2
      return 1
    fi
    target="$(readlink "$p")" || return 1
    case "$target" in
      /*) p="$target" ;;
      *)  p="$(dirname "$p")/$target" ;;
    esac
  done
  if [ -d "$p" ]; then
    (cd "$p" 2>/dev/null && pwd -P) || return 1
    return 0
  fi
  dir="$(dirname "$p")"
  base="$(basename "$p")"
  dir="$(cd "$dir" 2>/dev/null && pwd -P)" || return 1
  case "$dir" in
    /) printf '/%s\n' "$base" ;;
    *) printf '%s/%s\n' "$dir" "$base" ;;
  esac
}

# refuse_repo_write <path> <label>
#
# Refuse a write whose RESOLVED destination is inside this checkout.
#
# The shape being blocked: someone symlinks ~/.claude/justify or
# ~/.claude/skills/<name> back at the repo so they can edit the installed copy live.
# Every write below then lands in tracked source - the installer bakes an absolute
# path into the repo's own SKILL.md, destroying the placeholder that the NEXT install
# needs, or copies a directory onto itself. The top-level installer spent a session
# closing exactly this cycle (commit 8d19b7cc, twelve sites); it reaches these two
# scripts through the same door.
#
# Checked against the RESOLVED path, not the spelled one, because the whole point is
# that the spelled path looks innocent.
_refuse_if_in_repo() {
  local phys="$1" path="$2" label="$3"
  if [ "$phys" = "$REPO_PHYS" ]; then
    echo "ERROR: $label: $path resolves to this checkout ($REPO_PHYS)." >&2
    echo "       Refusing to write into the installer's own source." >&2
    return 1
  fi
  case "$phys" in
    "$REPO_PHYS"/*)
      echo "ERROR: $label: $path resolves to $phys, inside this checkout." >&2
      echo "       Refusing to write into the installer's own source." >&2
      return 1
      ;;
  esac
  return 0
}

refuse_repo_write() {
  local path="$1" label="$2" phys
  phys="$(phys_of "$path")" || {
    echo "ERROR: $label: cannot resolve where $path would be written" >&2
    return 1
  }
  _refuse_if_in_repo "$phys" "$path" "$label"
}

# refuse_repo_mkdir <directory> <label>
#
# The same check, for a directory that does not exist yet - and it has to run BEFORE the
# `mkdir -p`, not after. Flagged by independent review: if ~/.claude is a symlink into
# the checkout, `mkdir -p "$JUSTIFY_DIR"` CREATES <repo>/.../justify and only then does a
# post-hoc guard get to refuse. The directory it just made is already litter in tracked
# source, and on a repo where that path is ignored it is invisible litter.
#
# phys_of cannot answer for a path whose parent does not exist, so this walks up to the
# nearest ancestor that DOES exist, resolves that, and re-appends the segments still to
# be created. Those segments cannot be symlinks - they do not exist yet - so the join is
# the real destination.
refuse_repo_mkdir() {
  # Two `local` statements, not one: bash expands every word of a `local` builtin call
  # BEFORE any of the names exist, so `local dir="$1" probe="$dir"` reads $dir in the
  # CALLER's scope and dies under `set -u` with "dir: unbound variable". Caught by the
  # harness on the first end-to-end run of this helper.
  local dir="$1" label="$2"
  local probe="$dir" rest="" phys guard=0
  while [ ! -d "$probe" ]; do
    guard=$((guard + 1))
    if [ "$guard" -gt 64 ]; then
      echo "ERROR: $label: could not find an existing ancestor of $dir" >&2
      return 1
    fi
    rest="$(basename "$probe")${rest:+/$rest}"
    probe="$(dirname "$probe")"
    case "$probe" in
      /|.) break ;;
    esac
  done
  if [ ! -d "$probe" ]; then
    echo "ERROR: $label: could not find an existing ancestor of $dir" >&2
    return 1
  fi
  phys="$(cd "$probe" 2>/dev/null && pwd -P)" || {
    echo "ERROR: $label: cannot resolve $probe" >&2
    return 1
  }
  [ -n "$rest" ] && phys="${phys%/}/$rest"
  _refuse_if_in_repo "$phys" "$dir" "$label"
}

# refuse_escaping_symlink <path> <root> <label>
#
# Refuse a path that is a symlink resolving OUTSIDE the tree the installer owns.
#
# For the paths a BUILD writes to - $JUSTIFY_DIR/dist, $JUSTIFY_DIR/node_modules - the
# containment guard on the install root is not enough, because it says nothing about a
# link one level down. `npm install` and the build steps write wherever those names point,
# so a link at either sends build output to a directory this installer does not own.
# Flagged by independent review. Refusing rather than deleting: node_modules can be
# deliberately linked, and silently removing a developer's link is its own surprise.
refuse_escaping_symlink() {
  local path="$1" root="$2" label="$3" phys root_phys
  [ -L "$path" ] || return 0
  phys="$(phys_of "$path")" || {
    echo "ERROR: $label: $path is a symlink that does not resolve" >&2
    return 1
  }
  root_phys="$(cd "$root" 2>/dev/null && pwd -P)" || root_phys="$root"
  case "$phys" in
    "$root_phys"|"$root_phys"/*) return 0 ;;
  esac
  echo "ERROR: $label: $path is a symlink to $phys, outside $root_phys." >&2
  echo "       Refusing to run a build that would write through it." >&2
  return 1
}

# atomic_install_file <source> <destination>
#
# Put an installer-owned file in place. PROVE THE SOURCE COPIES BEFORE THE
# DESTINATION CHANGES AT ALL.
#
# What plain `cp src dst` does instead: opens the destination with O_TRUNC and
# follows it if it is a symlink. So a half-read source leaves the old destination
# destroyed, and a symlinked destination sends the write to a file this installer
# never owned. Staging beside the destination and renaming has neither property -
# `mv` REPLACES a symlink rather than writing through it, and the destination only
# ever changes at the instant a complete replacement exists.
#
# A destination symlink is replaced, not preserved, and that is correct HERE: these
# destinations are installer-owned artifacts under ~/.claude, not user documents.
# The opposite rule governs ~/.claude.json below, where the user's link is theirs.
atomic_install_file() {
  local src="$1" dst="$2" dst_dir dst_base tmp
  if [ ! -f "$src" ] || [ ! -r "$src" ]; then
    echo "ERROR: install source is not a readable regular file: $src" >&2
    return 1
  fi
  dst_dir="$(dirname "$dst")"
  dst_base="$(basename "$dst")"
  if [ ! -d "$dst_dir" ]; then
    echo "ERROR: destination directory does not exist: $dst_dir" >&2
    return 1
  fi
  # `-d` with no `-L` exemption, deliberately: `mv tmp <symlink-to-dir>` moves the temp
  # file INSIDE that directory and returns 0, leaving the requested destination
  # untouched while this function reports success. Refuse both shapes.
  if [ -d "$dst" ]; then
    echo "ERROR: destination is a directory (or a symlink to one): $dst" >&2
    return 1
  fi
  tmp="$(mktemp "$dst_dir/.${dst_base}.XXXXXX")" || {
    echo "ERROR: could not create a temp file beside $dst" >&2
    return 1
  }
  if ! cp "$src" "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: could not copy $src to a staged file beside $dst" >&2
    return 1
  fi
  if ! mv -f "$tmp" "$dst"; then
    rm -f "$tmp"
    echo "ERROR: could not move the staged copy into place at $dst" >&2
    return 1
  fi
  return 0
}

# atomic_write_from_stdin <destination>
#
# The heredoc counterpart of atomic_install_file, with the same contract. `cat > dst`
# truncates first and follows a symlinked destination; this stages beside it and
# renames. An EMPTY staged file is refused: a heredoc that produced nothing means the
# script was mangled, and installing a zero-byte SKILL.md over a good one is the
# quietest possible way to break the thing being installed.
atomic_write_from_stdin() {
  local dst="$1" dst_dir dst_base tmp
  dst_dir="$(dirname "$dst")"
  dst_base="$(basename "$dst")"
  if [ ! -d "$dst_dir" ]; then
    echo "ERROR: destination directory does not exist: $dst_dir" >&2
    return 1
  fi
  if [ -d "$dst" ]; then
    echo "ERROR: destination is a directory (or a symlink to one): $dst" >&2
    return 1
  fi
  tmp="$(mktemp "$dst_dir/.${dst_base}.XXXXXX")" || {
    echo "ERROR: could not create a temp file beside $dst" >&2
    return 1
  }
  if ! cat > "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: could not write the staged content for $dst" >&2
    return 1
  fi
  if [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    echo "ERROR: refusing to install an empty $dst" >&2
    return 1
  fi
  if ! mv -f "$tmp" "$dst"; then
    rm -f "$tmp"
    echo "ERROR: could not move the staged content into place at $dst" >&2
    return 1
  fi
  return 0
}

# replace_placeholder_atomically <file> <placeholder> <replacement>
#
# Bake a path into an installed SKILL.md. Replaces `sed -i.bak "s|...|...|g" FILE &&
# rm -f FILE.bak`, which carried two defects that the top-level installer spent a
# session removing from its own call sites while these delegated installers went on
# running them under ~/.claude/skills:
#
#   1. `sed -i.bak` writes FILE.bak - a path this installer does not own - and then
#      the `rm -f` deletes it. A user's own SKILL.md.bak was destroyed silently. sed
#      writes that backup whether or not anything matched, so even a no-op
#      substitution took it.
#   2. `sed ... && rm` SWALLOWS the failure. If sed cannot write the file the `&&`
#      short circuits, the `rm` is skipped, and the whole statement exits 0 - so
#      `set -e` never fires and the installer reports success having left the
#      placeholder literal in the installed skill, pointing at a path that does not
#      exist.
#
# This writes a temp file BESIDE the destination and renames it over, so the
# destination is never truncated by a failed run, and it verifies the placeholder is
# actually gone before the rename. Every failure path returns non-zero and prints why.
replace_placeholder_atomically() {
  local file="$1" placeholder="$2" replacement="$3"
  local dir base tmp
  if [ ! -f "$file" ]; then
    echo "ERROR: skill file is missing: $file" >&2
    return 1
  fi
  if ! grep -Fq "$placeholder" "$file"; then
    echo "ERROR: $file does not contain $placeholder - refusing to install a skill whose source path was never baked in." >&2
    return 1
  fi
  dir="$(dirname "$file")"
  base="$(basename "$file")"
  tmp="$(mktemp "$dir/.${base}.XXXXXX")" || {
    echo "ERROR: could not create a temp file beside $file" >&2
    return 1
  }
  # perl, not sed -i: no in-place edit, no .bak, and the pattern and replacement are
  # passed through the environment so a path containing regex or delimiter characters
  # cannot be interpreted as syntax.
  if ! PLACEHOLDER="$placeholder" REPLACEMENT="$replacement" \
      perl -pe 'BEGIN { $p = $ENV{PLACEHOLDER}; $r = $ENV{REPLACEMENT}; } s/\Q$p\E/$r/g' \
      "$file" > "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: substitution failed for $file" >&2
    return 1
  fi
  if grep -Fq "$placeholder" "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: $placeholder survived the substitution in $file" >&2
    return 1
  fi
  if ! mv -f "$tmp" "$file"; then
    rm -f "$tmp"
    echo "ERROR: could not move the rewritten skill into place at $file" >&2
    return 1
  fi
  return 0
}

# register_mcp_server <json-path> <server-name> <command> [arg...]
#
# Merge one entry into the mcpServers map of ~/.claude.json.
#
# ~/.claude.json IS A USER-OWNED FILE and it is the highest-value one either of these
# installers touches: it holds the user's entire Claude Code configuration, every
# other MCP server they have registered, and their per-project history. It gets the
# care ~/.zshrc and ~/.claude/CLAUDE.md get, not the care an installer artifact gets.
#
# WHAT THIS REPLACES, and why it was not survivable:
#
#     json.dump(d, open(p, 'w'), indent=2)
#
# `open(p, 'w')` TRUNCATES the user's config at open, before one byte of the
# replacement is written. Any write error after that point - a full disk, a quota, an
# interrupt - leaves the file destroyed. And the file object is never closed
# explicitly, so the buffered write is flushed during interpreter finalization, where
# CPython PRINTS the OSError and swallows it. Measured on this machine:
#
#     $ (ulimit -f 1; python3 -c "import json; d=json.load(open('big.json')); \
#          d['new']='y'; json.dump(d, open('big.json','w'), indent=2)")
#     Exception ignored while finalizing file ...  OSError: [Errno 27] File too large
#     python exit=0
#     -rw-r--r--  1 spare3  wheel  512 big.json      # was 4013 bytes
#
# A destroyed config, a zero exit status, and the installer's next line printing that
# the server was registered. Nothing downstream could tell.
#
# This resolves the path, stages a complete replacement beside the real file, fsyncs
# it, renames it over, and reads it back to confirm the entry landed. Every failure
# class returns a distinct non-zero code and says the file was not modified.
register_mcp_server() {
  local json_path="$1" server_name="$2" server_command="$3"
  shift 3
  if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 is required to register the $server_name MCP server in $json_path" >&2
    return 1
  fi
  # Paths go through argv, NOT through shell interpolation into the program text. A
  # checkout path containing a quote used to make this python either a syntax error or
  # an injection point, depending on the quote.
  python3 - "$json_path" "$server_name" "$server_command" "$@" <<'PYREGISTER'
import json
import os
import sys
import tempfile

# Exit codes, one per failure class:
#   2  the destination is not a usable regular file
#   3  the existing file is not a JSON object          - NOT MODIFIED
#   4  the replacement could not be staged             - NOT MODIFIED
#   5  the staged replacement could not be renamed in  - NOT MODIFIED
#   6  the write landed but reading it back did not show the registration
path, name, command = sys.argv[1], sys.argv[2], sys.argv[3]
args = list(sys.argv[4:])

# RESOLVE THE LINK, DO NOT REPLACE IT. If the user has symlinked ~/.claude.json into
# dotfiles they manage, that link is their wiring. Renaming a staged file over the
# LINK PATH would delete the link and leave a regular file, silently detaching the
# config from the repo they keep it in - which is why this renames over the resolved
# target instead. That is the opposite of the rule for ~/.claude/skills artifacts
# above, where the link is the installer's to replace. Different files, different
# contracts.
target = os.path.realpath(path)
parent = os.path.dirname(target) or "."
if not os.path.isdir(parent):
    sys.stderr.write("ERROR: %s: the directory %s does not exist\n" % (path, parent))
    sys.exit(2)
if os.path.exists(target) and not os.path.isfile(target):
    sys.stderr.write("ERROR: %s resolves to %s, which is not a regular file\n" % (path, target))
    sys.exit(2)

data = {}
mode = None
if os.path.exists(target):
    mode = os.stat(target).st_mode & 0o7777
    try:
        with open(target, "r", encoding="utf-8") as fh:
            raw = fh.read()
    except OSError as exc:
        sys.stderr.write("ERROR: could not read %s: %s\n" % (target, exc))
        sys.exit(2)
    if raw.strip():
        try:
            data = json.loads(raw)
        except ValueError as exc:
            # NEVER fall back to {} here. Rewriting an unparseable config from scratch
            # would throw away everything the user has, to install one MCP server.
            sys.stderr.write("ERROR: %s is not parseable JSON (%s)\n" % (target, exc))
            sys.stderr.write("       It has NOT been modified. Fix or move it, then re-run.\n")
            sys.exit(3)
    if not isinstance(data, dict):
        sys.stderr.write("ERROR: %s has no JSON object at the top level\n" % target)
        sys.stderr.write("       It has NOT been modified.\n")
        sys.exit(3)

servers = data.setdefault("mcpServers", {})
if not isinstance(servers, dict):
    sys.stderr.write("ERROR: %s has an mcpServers key that is not an object\n" % target)
    sys.stderr.write("       It has NOT been modified.\n")
    sys.exit(3)

entry = {"type": "stdio", "command": command, "args": args}
servers[name] = entry
payload = json.dumps(data, indent=2) + "\n"

fd = None
tmp = None
try:
    fd, tmp = tempfile.mkstemp(prefix=".%s." % os.path.basename(target), dir=parent)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fd = None
        fh.write(payload)
        fh.flush()
        os.fsync(fh.fileno())
except OSError as exc:
    if fd is not None:
        os.close(fd)
    if tmp is not None and os.path.exists(tmp):
        os.unlink(tmp)
    sys.stderr.write("ERROR: could not stage a replacement for %s: %s\n" % (target, exc))
    sys.stderr.write("       %s has NOT been modified.\n" % target)
    sys.exit(4)

try:
    # mkstemp makes the staged file 0600. Carry the config's own mode across so a
    # rename never silently changes who can read it.
    os.chmod(tmp, mode if mode is not None else 0o600)
    os.replace(tmp, target)
except OSError as exc:
    if os.path.exists(tmp):
        os.unlink(tmp)
    sys.stderr.write("ERROR: could not move the staged file into place at %s: %s\n" % (target, exc))
    sys.stderr.write("       %s has NOT been modified.\n" % target)
    sys.exit(5)

# Read it back. A rename that reported success over a file that does not hold the
# registration is the silent half-install this whole helper exists to prevent.
try:
    with open(target, "r", encoding="utf-8") as fh:
        written = json.load(fh)
except (OSError, ValueError) as exc:
    sys.stderr.write("ERROR: %s could not be read back after the write: %s\n" % (target, exc))
    sys.exit(6)
if not isinstance(written, dict) or written.get("mcpServers", {}).get(name) != entry:
    sys.stderr.write("ERROR: %s does not hold the %s registration after the write\n" % (target, name))
    sys.exit(6)
sys.stdout.write("MCP server '%s' registered in %s\n" % (name, path))
PYREGISTER
}
# ============================================================================
# END improv shared safe-write helpers
# ============================================================================

# Absolute node path baked into the MCP registration so Claude Code's spawn does
# not depend on its PATH (a documented failure mode for this server).
NODE_BIN="$(command -v node)"

# Lotus builds IN PLACE, so its build outputs live under <repo>/lotus and a containment
# check against the checkout would refuse the intended destination. The check that DOES
# apply is that they stay inside <repo>/lotus: a symlink at any of them sends webpack or
# tsc output somewhere else entirely. Flagged by independent review.
for build_target in node_modules dist dist/code.js dist/ui.html \
                    mcp-server/node_modules mcp-server/dist mcp-server/dist/server.js; do
  refuse_escaping_symlink "$SCRIPT_DIR/$build_target" "$SCRIPT_DIR" "lotus build output" || exit 3
done

# And every link NESTED in either dist tree. Naming the advertised artifacts is not enough:
# webpack writes more than code.js and ui.html, and tsc emits bridge.js, tools.js and a
# .d.ts / .map for each of them under mcp-server/dist. A link at any of those is opened and
# truncated by the build long before the artifact check looks at anything. Third review
# pass. node_modules keeps the top-level check only - it is npm's tree, npm rewrites it
# wholesale, and walking tens of thousands of files to police it would cost more than it
# buys.
nested_escapes=0
while IFS= read -r link; do
  [ -n "$link" ] || continue
  refuse_escaping_symlink "$link" "$SCRIPT_DIR" "lotus build output" || nested_escapes=$((nested_escapes + 1))
done <<NESTED
$(find "$SCRIPT_DIR/dist" "$SCRIPT_DIR/mcp-server/dist" -type l 2>/dev/null)
NESTED
if [ "$nested_escapes" -gt 0 ]; then
  echo "ERROR: $nested_escapes symlink(s) under the lotus build output point outside $SCRIPT_DIR." >&2
  echo "       Refusing to run a build that would write through them." >&2
  exit 3
fi

# --- Build the Figma plugin (webpack -> dist/code.js) -----------------------
#
# FATAL, not a warning. It warned and carried on, and the run went on to register an MCP
# server pointing at an entrypoint the build had not produced, tell the user to import a
# manifest naming bundles that did not exist, print "Lotus installed successfully" and
# exit 0. Worse, `(...) || { echo ...; }` takes the exit status of the ECHO, so the whole
# statement returned 0 and `set -e` never saw a failure at all. Both flagged by
# independent review; the manual commands are kept because that was the useful half.
echo "Building Lotus plugin (webpack)..."
(cd "$SCRIPT_DIR" && npm install --silent && npm run build) || {
  echo "ERROR: the plugin build failed. Run manually: cd $SCRIPT_DIR && npm install && npm run build" >&2
  exit 4
}

# --- Build the MCP server (tsc -> mcp-server/dist/server.js) -----------------
echo "Building Lotus MCP server (tsc)..."
(cd "$SCRIPT_DIR/mcp-server" && npm install --silent && npm run build) || {
  echo "ERROR: the mcp-server build failed. Run manually: cd $SCRIPT_DIR/mcp-server && npm install && npm run build" >&2
  exit 4
}

SERVER_JS="$SCRIPT_DIR/mcp-server/dist/server.js"

# And then falsify the builds anyway: a build tool that exits 0 without writing its output
# is the other half of the same failure, and this is the last point before the MCP
# registration where either half can be caught. These three paths are exactly the ones the
# success block at the bottom advertises.
build_missing=0
for artifact in "$SCRIPT_DIR/dist/code.js" "$SCRIPT_DIR/dist/ui.html" "$SERVER_JS"; do
  if [ ! -f "$artifact" ]; then
    echo "ERROR: the build exited 0 but did not produce $artifact" >&2
    build_missing=$((build_missing + 1))
  # `-f` follows a link, so an artifact that IS a link elsewhere passes it. Check where
  # the file actually lives, not just that the name resolves to something.
  elif ! refuse_escaping_symlink "$artifact" "$SCRIPT_DIR" "lotus build artifact"; then
    build_missing=$((build_missing + 1))
  fi
done
if [ "$build_missing" -gt 0 ]; then
  echo "ERROR: $build_missing Lotus build artifact(s) are missing - see the build WARNINGs above." >&2
  echo "       Refusing to register an MCP server whose entrypoint does not exist." >&2
  echo "       Fix the build (cd $SCRIPT_DIR && npm install && npm run build), then re-run." >&2
  exit 4
fi

# --- Register MCP server in ~/.claude.json ----------------------------------
# See register_mcp_server for what the previous `json.dump(d, open(p, 'w'))` did to this
# file when a write failed. The paths also used to be interpolated by the SHELL into the
# python source, so a checkout path containing a quote was a syntax error at best; they
# now go through argv.
refuse_repo_write "$HOME/.claude.json" "MCP registration" || exit 3
register_mcp_server "$HOME/.claude.json" lotus "$NODE_BIN" "$SERVER_JS" || {
  echo "ERROR: could not register the lotus MCP server in ~/.claude.json (see above)." >&2
  exit 5
}

# --- Install the /lotus skill (repo path baked in) --------------------------
SKILL_SRC="$SCRIPT_DIR/../claude/skills/lotus/SKILL.md"
SKILL_DIR="${CLAUDE_DIR}/skills/lotus"
# BEFORE the mkdir: a containment check that runs after the directory has been created in
# tracked source is a report, not a guard. Flagged by independent review.
refuse_repo_mkdir "$SKILL_DIR" "lotus skill" || exit 3
mkdir -p "$SKILL_DIR"
# The DIRECTORY, not just the file. A symlink at SKILL.md is replaced rather than followed,
# but a symlink at the containing lotus/ directory sends the write - and the absolute path
# this installer bakes into it - somewhere outside the skills tree entirely. Flagged by
# independent review. Refused rather than replaced: a directory link is something a person
# put there on purpose, and silently deleting it is its own surprise.
refuse_escaping_symlink "$SKILL_DIR" "${CLAUDE_DIR}/skills" "lotus skill dir" || exit 3
# REFUSE A DESTINATION THAT RESOLVES BACK INTO THIS CHECKOUT. If ~/.claude/skills/lotus
# is symlinked at <repo>/claude/skills/lotus, the copy below is the source onto itself
# and the placeholder rewrite then bakes an absolute path into TRACKED SOURCE, destroying
# the __LOTUS_SRC__ marker the next install needs. That is the payload-source cycle the
# top-level installer closed in twelve places at 8d19b7cc, reaching this script by a door
# it did not cover.
refuse_repo_write "$SKILL_DIR/SKILL.md" "lotus skill" || exit 3
# atomic_install_file, not `cp`: `cp` truncates the destination at open and follows a
# symlink parked there, writing a file outside the directory this installer owns - and
# the placeholder rewrite on the next line cannot help with that, because by then the
# write through the link has already happened. The staged-then-renamed copy replaces a
# link rather than following it, which also removes the need for the `[ -L ]` pre-delete
# that used to stand here: one rename covers the regular-file, symlink and nothing-there
# cases identically.
atomic_install_file "$SKILL_SRC" "$SKILL_DIR/SKILL.md" || exit 6
replace_placeholder_atomically "$SKILL_DIR/SKILL.md" "__LOTUS_SRC__" "$SCRIPT_DIR" || exit 6

echo "Lotus installed successfully."
echo "  Plugin build: $SCRIPT_DIR/dist/code.js"
echo "  MCP server:   $SERVER_JS"
echo "  Skill:        $SKILL_DIR/SKILL.md"
echo "  Manifest (import into Figma): $SCRIPT_DIR/manifest.json"
echo "  NOTE: restart Claude Code once for the lotus MCP tools to load, then run /lotus."
