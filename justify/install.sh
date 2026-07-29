#!/bin/bash
set -euo pipefail

# Exit codes - one per failure class, so a caller can tell what went wrong without
# scraping stdout. The top-level install.sh runs this under its own `set -e`, so any
# non-zero here stops that run rather than printing "[ok] Justify installed" over it.
#   0  installed and verified
#   1  a prerequisite is missing (node, npm), or a shim could not be planted
#   2  a payload file or directory could not be installed
#   3  a destination resolves inside this checkout - would write into tracked source
#   4  the build did not produce an artifact this installer goes on to advertise
#   5  the ~/.claude.json MCP registration failed
#   6  the skill could not be installed

# $HOME IS VALIDATED BEFORE ANYTHING IS DERIVED FROM IT. Under `set -u` an unset HOME aborted
# here with a bare "HOME: unbound variable" from line one, before any of the ownership logic
# below could report anything useful; and an EMPTY HOME is worse than unset, because it
# silently makes every path absolute-from-root - /.claude, /.local/bin - so a run would try to
# install into the filesystem root and, on a permissive box, succeed. A relative HOME has the
# same shape of problem one directory down. None of those is a "pretend user" this installer
# can safely write for, so all three are refused by name. Flagged by independent review.
if [ -z "${HOME:-}" ]; then
  echo "ERROR: HOME is unset or empty - refusing to install." >&2
  echo "       Every path this installer writes is derived from HOME; with no HOME they would" >&2
  echo "       resolve against the filesystem root. Re-run with HOME set." >&2
  exit 1
fi
case "$HOME" in
  /*) ;;
  *)
    echo "ERROR: HOME is not an absolute path ($HOME) - refusing to install." >&2
    exit 1
    ;;
esac

CLAUDE_DIR="${HOME}/.claude"
JUSTIFY_DIR="${CLAUDE_DIR}/justify"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing Justify..."

# Check for Node.js
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

# atomic_install_tree <source-dir> <destination-dir>
#
# The directory counterpart of atomic_install_file, and the only helper here that
# lotus does not need, which is why it sits outside the shared block.
#
# `cp -r src dst/` fails two ways here, both measured on this machine rather than assumed:
#
#   1. A SYMLINK AT THE DESTINATION STOPS THE INSTALL DEAD. With a link at dst/<name>
#      pointing at a directory, BSD cp returns "Not a directory"; with a link at a FILE
#      inside an existing dst/<name>, it returns "Permission denied". Either one is a
#      non-zero exit under `set -euo pipefail`, so the installer aborts partway through
#      the payload with some trees copied and others not, and it aborts identically on
#      every re-run because nothing ever removes the link. (GNU cp resolves the same
#      shape by following the link and writing through it instead. Which of those two
#      you get is not a property to build on.)
#   2. IT MERGES. A source file deleted upstream lingers in the install forever, and the
#      build step that runs next compiles it back into dist/.
#
# This stages the whole tree beside the destination and only then swaps it in.
#
# THE OLD TREE IS MOVED ASIDE, NOT DELETED, AND ONLY DISCARDED ONCE THE NEW ONE IS IN
# PLACE. The first version of this helper ran `rm -rf "$dst"` and then `mv`, which
# independent review called correctly: between those two lines the user has no installed
# tree at all, and anything that stops the second line - an interrupt, a permissions
# change, a full disk - leaves them with nothing. Two renames instead, with a rollback
# rename if the swap-in fails. `mv` on a symlink moves the LINK and never touches what it
# points at, so a link parked at the destination is carried aside and discarded with the
# rest, its target untouched.
# The interrupt handler for atomic_install_tree, as a named function rather than shell text
# generated inside a trap string: the generated form needed three levels of quoting to
# interpolate two paths, which is its own defect waiting to happen. Third review pass.
_ait_dst=""; _ait_stash=""; _ait_tmp=""
_atomic_install_tree_interrupted() {
  trap - INT TERM HUP
  if [ -n "$_ait_dst" ] && [ ! -e "$_ait_dst" ] && [ -d "$_ait_stash/prev" ]; then
    if mv "$_ait_stash/prev" "$_ait_dst" 2>/dev/null; then
      echo "interrupted - the previous $_ait_dst has been put back" >&2
    else
      echo "interrupted - the previous $_ait_dst is at $_ait_stash/prev" >&2
    fi
  fi
  [ -n "$_ait_tmp" ] && rm -rf "$_ait_tmp"
  [ -n "$_ait_stash" ] && rm -rf "$_ait_stash"
  exit 130
}

atomic_install_tree() {
  local src="$1" dst="$2" dst_parent dst_base tmp stash=""
  if [ ! -d "$src" ]; then
    echo "ERROR: install source is not a directory: $src" >&2
    return 1
  fi
  dst_parent="$(dirname "$dst")"
  dst_base="$(basename "$dst")"
  if [ ! -d "$dst_parent" ]; then
    echo "ERROR: destination directory does not exist: $dst_parent" >&2
    return 1
  fi
  tmp="$(mktemp -d "$dst_parent/.${dst_base}.new.XXXXXX")" || {
    echo "ERROR: could not create a temp directory beside $dst" >&2
    return 1
  }
  if ! cp -R "$src/." "$tmp/"; then
    rm -rf "$tmp"
    echo "ERROR: could not copy $src to a staged directory beside $dst" >&2
    return 1
  fi
  if [ -e "$dst" ] || [ -L "$dst" ]; then
    stash="$(mktemp -d "$dst_parent/.${dst_base}.old.XXXXXX")" || {
      rm -rf "$tmp"
      echo "ERROR: could not create a holding directory beside $dst" >&2
      return 1
    }
    if ! mv "$dst" "$stash/prev"; then
      rm -rf "$tmp" "$stash"
      echo "ERROR: could not move the previous $dst aside" >&2
      return 1
    fi
    # BETWEEN THE TWO RENAMES THE DESTINATION DOES NOT EXIST. It is two syscalls wide, but
    # a ctrl-C landing in it would leave the user with no installed tree and the old one
    # parked under a dotted temp name they would never think to look for. Second review
    # pass flagged exactly that. The trap closes the interruptible half; SIGKILL and power
    # loss are not closable from a shell, which is why the message names the stash path
    # instead of pretending otherwise.
    #
    # THE HANDLER EXITS. Third review pass caught the version that only restored: after an
    # INT handler returns, the shell RESUMES, `mv "$tmp" "$dst"` then moves the staged tree
    # INSIDE the directory it just put back, and the function returns 0 - a successful
    # install report over the old tree with a dotted directory buried in it. An interrupt
    # is not something to recover from and carry on past.
    _ait_dst="$dst"; _ait_stash="$stash"; _ait_tmp="$tmp"
    trap '_atomic_install_tree_interrupted' INT TERM HUP
  fi
  if ! mv "$tmp" "$dst"; then
    echo "ERROR: could not move the staged directory into place at $dst" >&2
    if [ -n "$stash" ]; then
      if mv "$stash/prev" "$dst"; then
        echo "       the previous $dst has been put back" >&2
      else
        echo "       AND the previous $dst could not be restored - it is at $stash/prev" >&2
        rm -rf "$tmp"
        trap - INT TERM HUP
        return 1
      fi
      rm -rf "$stash"
    fi
    rm -rf "$tmp"
    trap - INT TERM HUP
    return 1
  fi
  trap - INT TERM HUP
  _ait_dst=""; _ait_stash=""; _ait_tmp=""
  if [ -n "$stash" ]; then
    # Named, not swallowed. It only ever leaves a dotted directory behind, but a message
    # nobody prints is how a directory nobody expected becomes permanent. Third review pass.
    rm -rf "$stash" || echo "WARNING: could not remove the holding directory $stash" >&2
  fi
  return 0
}

# Everything below writes under $JUSTIFY_DIR. Check BEFORE the mkdir that it does not
# resolve back into this checkout - a symlinked ~/.claude/justify pointing at
# <repo>/justify would turn every copy below into a copy of the source onto itself, and
# a check that ran AFTER the mkdir would already have created a directory in tracked
# source before refusing. Both spellings are checked: the not-yet-created form here, and
# the created form once it exists.
refuse_repo_mkdir "$JUSTIFY_DIR" "justify install root" || exit 3
mkdir -p "$JUSTIFY_DIR"
refuse_repo_write "$JUSTIFY_DIR" "justify install root" || exit 3

# Copy all source files preserving structure
atomic_install_tree "$SCRIPT_DIR/server" "$JUSTIFY_DIR/server" || exit 2
atomic_install_tree "$SCRIPT_DIR/core" "$JUSTIFY_DIR/core" || exit 2
atomic_install_tree "$SCRIPT_DIR/adapters" "$JUSTIFY_DIR/adapters" || exit 2
# assets/ holds the Claudebar sprite sheets (build.js copies spark-*.svg into
# dist/, served at /spark-<name>.svg). fonts/ is served by the daemon from the
# install root at /fonts/<name>. Without these the status icon 404s (blank) and
# the toolbar font silently falls back to system-ui.
atomic_install_tree "$SCRIPT_DIR/assets" "$JUSTIFY_DIR/assets" || exit 2
# `if`, not `[ -d ] && cp`: as an AND-list this is exempt from `set -e` when the test
# is false (verified: `set -e; [ -d /nope ] && echo x; echo alive` prints alive and
# exits 0), so the exemption is doing load-bearing work in a one-line idiom where it
# is invisible. Spelled out, the optional case is optional on purpose rather than by
# accident of shell semantics.
if [ -d "$SCRIPT_DIR/fonts" ]; then
  atomic_install_tree "$SCRIPT_DIR/fonts" "$JUSTIFY_DIR/fonts" || exit 2
fi
for payload in package.json tsconfig.json tsconfig.server.json tsconfig.core.json build.js; do
  atomic_install_file "$SCRIPT_DIR/$payload" "$JUSTIFY_DIR/$payload" || exit 2
done

# The build writes to $JUSTIFY_DIR/node_modules and $JUSTIFY_DIR/dist. Containment on the
# install ROOT says nothing about a link one level down, and npm and tsc will happily
# write through one. Flagged by independent review.
for build_target in node_modules dist; do
  refuse_escaping_symlink "$JUSTIFY_DIR/$build_target" "$JUSTIFY_DIR" "justify build output" || exit 3
  refuse_repo_write "$JUSTIFY_DIR/$build_target" "justify build output" || exit 3
done

# AND EVERY LINK NESTED INSIDE dist/, not just dist/ itself. The second review pass caught
# that a guard on the top two names leaves dist/server and dist/justify-core.js open: tsc
# writes dist/server, esbuild writes the bundle, and a link at either sends the output
# somewhere this installer does not own - after which the `-f` artifact check below FOLLOWS
# that link and reports the build fine.
#
# The scan is limited to dist/ deliberately. dist/ is a handful of files this installer's
# own build produces, so a symlink in it is always someone else's doing. node_modules is
# tens of thousands of files that npm rewrites wholesale on every install and legitimately
# fills with its own relative .bin links; walking it would cost seconds to police a tree
# whose owner is npm, so it keeps the top-level check only.
if [ -d "$JUSTIFY_DIR/dist" ]; then
  nested_escapes=0
  while IFS= read -r link; do
    [ -n "$link" ] || continue
    refuse_escaping_symlink "$link" "$JUSTIFY_DIR" "justify build output" || nested_escapes=$((nested_escapes + 1))
  done <<NESTED
$(find "$JUSTIFY_DIR/dist" -type l 2>/dev/null)
NESTED
  if [ "$nested_escapes" -gt 0 ]; then
    echo "ERROR: $nested_escapes symlink(s) under $JUSTIFY_DIR/dist point outside the install." >&2
    echo "       Refusing to run a build that would write through them." >&2
    exit 3
  fi
fi

# THE BUILD IS FATAL IF IT FAILS. It used to warn and carry on, and the run went on to
# register an MCP server whose entrypoint the build had not produced, print "Justify
# installed successfully", and exit 0 - a session with no justify_* tools and nothing
# anywhere saying why.
#
# The first repair here checked only that the artifacts EXIST, which independent review
# correctly rejected: on a re-install, yesterday's dist/ satisfies that check while
# today's build failed, so the same false success survives in a narrower window. A step
# whose output this installer requires does not get to fail quietly. The manual commands
# are still printed, because that is the useful half of the old warning.
# deps_current <dir> / deps_record <dir>: were the installed dependencies installed FROM THIS
# manifest?
#
# WHY NOT "does node_modules exist". A presence-only test skips the install on a checkout that
# ADDED or BUMPED a dependency; the build can then exit 0 against stale versions with every
# artifact check passing, so the component is reported installed and is quietly wrong. Flagged
# by independent review.
#
# WHY NOT MTIME EITHER, which is what this was first written as. justify/install.sh COPIES its
# package.json into $JUSTIFY_DIR on every run, so the manifest is always newer than
# node_modules and an mtime comparison can never once report "current" - the offline fix would
# have been dead code for the component that needed it most. Caught by a row going red, not by
# reading it back.
#
# SO: a CONTENT fingerprint of the manifest and any lockfile, recorded inside node_modules
# after a successful install and compared on the next run. Immune to the installer rewriting
# its own manifest, and it answers the question that actually matters.
#
# ONE-TIME COST, stated plainly: a machine whose node_modules predates this stamp has no stamp,
# so the first run after upgrading still performs a real `npm install` and needs the network.
# Every run after that is offline-capable. Guessing instead would mean assuming an unstamped
# tree matches a manifest nobody recorded.
#
# Duplicated in justify/install.sh, lotus/install.sh and install.sh because those run as
# separate processes. If you change the rule, change all three.
_deps_sha() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" 2>/dev/null | cut -d' ' -f1
  else
    # No hasher: emit a token that can never match a recorded stamp, so the caller installs
    # rather than skipping. Failing toward "do the work" is the safe direction here.
    printf 'no-hasher'
  fi
}

deps_fingerprint() {
  local d="$1" f acc=""
  for f in package.json package-lock.json npm-shrinkwrap.json yarn.lock pnpm-lock.yaml; do
    if [ -f "$d/$f" ]; then
      acc="${acc}${f}:$(_deps_sha "$d/$f")
"
    fi
  done
  # An empty accumulator means there is no manifest at all; return a token rather than the
  # hash of nothing, so two different empty directories are not declared equivalent.
  if [ -z "$acc" ]; then printf 'no-manifest'; return 0; fi
  printf '%s' "$acc" | { if command -v shasum >/dev/null 2>&1; then shasum -a 256; else sha256sum; fi; } | cut -d' ' -f1
}

deps_current() {
  local d="$1" want got
  [ -d "$d/node_modules" ] || return 1
  [ -f "$d/node_modules/.improv-deps-stamp" ] || return 1
  want="$(deps_fingerprint "$d")"
  got="$(cat "$d/node_modules/.improv-deps-stamp" 2>/dev/null)" || return 1
  [ -n "$got" ] || return 1
  [ "$got" = "$want" ]
}

deps_record() {
  local d="$1"
  [ -d "$d/node_modules" ] || return 0
  deps_fingerprint "$d" > "$d/node_modules/.improv-deps-stamp" 2>/dev/null || true
}

# SKIPPED when the dependencies are already current. This installer used to run `npm install`
# unconditionally, so re-installing a machine where nothing had changed still required the
# network - and because the failure is `exit 4`, routed into the top-level ledger, an OFFLINE
# re-install of an already-complete machine exited 1 having changed nothing at all.
echo "Installing dependencies..."
if deps_current "$JUSTIFY_DIR"; then
  echo "  dependencies already current - skipping npm install (rm -rf $JUSTIFY_DIR/node_modules to force)"
else
  (cd "$JUSTIFY_DIR" && npm install 2>/dev/null) || {
    echo "ERROR: npm install failed. Run manually: cd $JUSTIFY_DIR && npm install" >&2
    exit 4
  }
  # Record WHAT was installed, so the next run can tell whether it is still current. Only
  # after a SUCCESSFUL install - stamping a failed one would license skipping it forever.
  deps_record "$JUSTIFY_DIR"
fi

echo "Building core script..."
(cd "$JUSTIFY_DIR" && node build.js 2>/dev/null) || {
  echo "ERROR: the core build failed. Run manually: cd $JUSTIFY_DIR && node build.js" >&2
  exit 4
}

# `npx -y tsc` FETCHES when tsc is not already installed, and the `-y` means it does so
# without asking. On a machine whose node_modules is intact the compiler is right there, so
# prefer it and leave npx as the fallback for a tree that genuinely lacks it. This is the
# other half of making an offline re-install possible.
echo "Building server..."
# AN ARRAY, not a scalar. `$JUSTIFY_TSC` unquoted word-splits, so a home containing a space -
# /Users/Alice Smith - turned the resolved compiler path into two nonexistent arguments and the
# offline build failed for a reason unrelated to anything it was testing. Quoting the scalar
# would have broken the two-word npx fallback instead. Flagged by independent review.
if [ -x "$JUSTIFY_DIR/node_modules/.bin/tsc" ]; then
  JUSTIFY_TSC=("$JUSTIFY_DIR/node_modules/.bin/tsc")
else
  JUSTIFY_TSC=(npx -y tsc)
fi
(cd "$JUSTIFY_DIR" && "${JUSTIFY_TSC[@]}" -p tsconfig.server.json 2>/dev/null) || {
  echo "ERROR: the server build failed. Run manually: cd $JUSTIFY_DIR && npx tsc -p tsconfig.server.json" >&2
  exit 4
}

# And then falsify it anyway: a build tool that exits 0 without writing its output is the
# other half of the same failure, and this is the last point before the MCP registration
# where either half can be caught.
build_missing=0
for artifact in "$JUSTIFY_DIR/dist/justify-core.js" "$JUSTIFY_DIR/dist/server/index.js"; do
  if [ ! -f "$artifact" ]; then
    echo "ERROR: the build exited 0 but did not produce $artifact" >&2
    build_missing=$((build_missing + 1))
  # `-f` follows a link, so an artifact that IS a link to somewhere else passes it. Check
  # where the file actually lives, not just that the name resolves to something.
  elif ! refuse_escaping_symlink "$artifact" "$JUSTIFY_DIR" "justify build artifact"; then
    build_missing=$((build_missing + 1))
  fi
done
if [ "$build_missing" -gt 0 ]; then
  echo "ERROR: $build_missing Justify build artifact(s) are missing." >&2
  echo "       Refusing to register an MCP server whose entrypoint does not exist." >&2
  echo "       Fix the build (cd $JUSTIFY_DIR && npm install && node build.js && npx tsc -p tsconfig.server.json), then re-run." >&2
  exit 4
fi

# Install CLI tools
echo "Installing CLI tools..."
for cli in init remove; do
  atomic_install_file "$SCRIPT_DIR/cli/$cli.sh" "$JUSTIFY_DIR/$cli.sh" || exit 2
done
# Daemon-owned watch (2026-07-08): the headless apply worker the daemon spawns,
# plus the CLI arm/disarm path (chat "watch justify" / "stop watching" is the
# other). justify-watch.sh now ARMS the daemon instead of running a session loop.
for cli in justify-watch justify-done justify-serve justify-worker justify-watch-arm justify-watch-disarm; do
  atomic_install_file "$SCRIPT_DIR/cli/$cli.sh" "$JUSTIFY_DIR/$cli.sh" || exit 2
done
chmod +x "$JUSTIFY_DIR/init.sh" "$JUSTIFY_DIR/remove.sh" "$JUSTIFY_DIR/justify-watch.sh" "$JUSTIFY_DIR/justify-done.sh" \
  "$JUSTIFY_DIR/justify-serve.sh" "$JUSTIFY_DIR/justify-worker.sh" "$JUSTIFY_DIR/justify-watch-arm.sh" "$JUSTIFY_DIR/justify-watch-disarm.sh"

# >>> justify-shim-bin-selection >>>
# WHERE THE SHIMS GO, and the rule that decides it.
#
# THE DEFECT THIS REPLACES. The old selection took the first WRITABLE of /usr/local/bin,
# /opt/homebrew/bin, $HOME/.local/bin. The first two of those belong to the real user no
# matter what $HOME says, so a run with $HOME redirected planted symlinks into the real
# machine's shared bin pointing at scripts inside the sandbox. Reproduced live on
# 2026-07-28: eight shims in /opt/homebrew/bin aimed at a sandbox HOME, and the run
# REPORTED SUCCESS, because the verification loop below compares each link against
# "$JUSTIFY_DIR/$target" and $JUSTIFY_DIR is derived from the same redirected $HOME. The
# links it had just mis-planted were exactly the links it expected. Self-consistency was
# the false green.
#
# The guard that used to sit here refused only when $HOME resolved under a TEMP root. That
# was the right subject in 2026-07-16 (a reaped /var/folders tree) and the wrong PREDICATE:
# any durable sandbox path - /Users/me/Documents/sandbox, a CI workspace, a second checkout
# under a home-relative dir - walked straight through it. It also could not be complied
# with: its own advice was "set BIN_DIR inside the temp tree", while the selection above it
# unconditionally reset BIN_DIR="" before probing, discarding any override.
#
# THE RULE NOW. A shared bin may be written ONLY when $HOME is this user's actual home
# directory according to the account database - not according to $HOME, which is the thing
# under suspicion. Anything else, including a home we cannot determine, falls back to
# "$HOME/.local/bin", which belongs to whoever the run is pretending to be and is therefore
# always safe to write. This strictly subsumes the temp-root check (a temp HOME is never the
# passwd home), so that check is gone rather than kept alongside.
#
# WHY FALL BACK RATHER THAN REFUSE. The old guard exited 1, which fails every sandboxed
# rehearsal of this installer - and rehearsing it in a sandbox is the correct thing to do,
# which is how this defect came to be found in the first place. Redirecting the shims makes
# a sandboxed install both correct AND useful. A run that cannot even create its own
# ~/.local/bin still fails loudly below.
#
# A note on sudo: `id -un` under sudo is root, whose passwd home is /var/root, so a sudo run
# with the caller's HOME preserved reads as "not the real home" and lands in $HOME/.local/bin
# instead of a shared bin. That is the safe direction and is deliberate - a root-owned
# symlink in /opt/homebrew/bin pointing into a user's home is worse than a user-owned one in
# their own bin.

# justify_real_home: the invoking user's home per the account database. Three probes because
# no single one is portable, and a FAILURE to determine it must be distinguishable from
# determining it to be empty - the caller treats "unknown" as "not the real home".
# EVERY PROBE'S EXIT STATUS IS CHECKED, not just its output. A pipeline that prints a
# plausible line and then fails - `dscl` emitting a cached row before erroring, a `getent`
# that writes a passwd entry and exits non-zero - would otherwise be accepted, and since this
# runs inside an `if`, errexit does not intervene. Accepting output from a failed probe is
# the worst available outcome here: it says "this IS the real home" on no evidence, which is
# the exact permission the shared-bin write needs. Flagged by independent review.
#
# The result must also look like an absolute path. A probe that succeeds and prints "" or a
# relative fragment tells us nothing, and treating it as an answer would compare $HOME
# against garbage.
justify_real_home() {
  local u h rc
  u="$(id -un 2>/dev/null)" || return 1
  [ -n "$u" ] || return 1
  if command -v dscl >/dev/null 2>&1; then
    h="$(dscl . -read "/Users/$u" NFSHomeDirectory 2>/dev/null | sed -n 's/^NFSHomeDirectory: *//p')"; rc=$?
    if [ "$rc" -eq 0 ]; then case "$h" in /?*) printf '%s' "$h"; return 0 ;; esac; fi
  fi
  if command -v getent >/dev/null 2>&1; then
    h="$(getent passwd "$u" 2>/dev/null | cut -d: -f6)"; rc=$?
    if [ "$rc" -eq 0 ]; then case "$h" in /?*) printf '%s' "$h"; return 0 ;; esac; fi
  fi
  if command -v python3 >/dev/null 2>&1; then
    h="$(python3 -c 'import os,pwd,sys; sys.stdout.write(pwd.getpwuid(os.getuid()).pw_dir)' 2>/dev/null)"; rc=$?
    if [ "$rc" -eq 0 ]; then case "$h" in /?*) printf '%s' "$h"; return 0 ;; esac; fi
  fi
  return 1
}

# justify_home_is_real: is $HOME the account's home? Compared PHYSICALLY on both sides, so a
# symlinked home (/home -> /Users, a /private spelling, a trailing slash) still matches.
justify_home_is_real() {
  local rh rh_phys home_phys
  rh="$(justify_real_home)" || return 1
  [ -n "$rh" ] || return 1
  home_phys="$(phys_of "$HOME" 2>/dev/null)" || home_phys="$HOME"
  rh_phys="$(phys_of "$rh" 2>/dev/null)" || rh_phys="$rh"
  [ "${home_phys%/}" = "${rh_phys%/}" ]
}

# justify_path_is_within <inner> <outer> - is <inner> at or below <outer>, PHYSICALLY?
#
# A LEXICAL PREFIX TEST IS NOT ENOUGH, and that gap was live: with HOME=/Users/a/sandbox and
# $HOME/.local/bin a symlink to /opt/homebrew/bin, "$BIN_DIR" starts with "$HOME/" so every
# lexical check passes while the writes land in the real shared bin. Resolve both sides
# first. Flagged by independent review.
justify_path_is_within() {
  local inner="$1" outer="$2" ip op
  ip="$(phys_of "$inner" 2>/dev/null)" || ip="$inner"
  op="$(phys_of "$outer" 2>/dev/null)" || op="$outer"
  ip="${ip%/}"; op="${op%/}"
  [ -n "$op" ] || return 1
  [ "$ip" = "$op" ] && return 0
  case "$ip" in "$op"/*) return 0 ;; esac
  return 1
}

# justify_choose_bin_dir <shared-bin>... - sets BIN_DIR.
#
# The candidate list is a PARAMETER, not a baked-in literal and not an environment
# override. A parameter lets the regression suite drive this with fixture directories
# without the production path growing a testing seam that a caller could point at a bin of
# their choosing.
justify_choose_bin_dir() {
  local d
  BIN_DIR=""
  if justify_home_is_real; then
    for d in "$@"; do
      if [ -d "$d" ] && [ -w "$d" ]; then
        BIN_DIR="$d"
        return 0
      fi
    done
  else
    echo "NOTE: HOME ($HOME) is not this user's home directory." >&2
    echo "      Planting the justify shims in \$HOME/.local/bin instead of a shared bin," >&2
    echo "      so a sandboxed or redirected run cannot repoint the real user's commands." >&2
  fi
  # Guarded like every other directory this installer creates. Flagged by independent
  # review: a ~/.local or ~/.local/bin symlinked into the checkout would otherwise get a
  # directory made inside tracked source, and shims planted there.
  refuse_repo_mkdir "${HOME}/.local/bin" "shim bin" || return 3
  if ! mkdir -p "${HOME}/.local/bin"; then
    echo "ERROR: could not create ${HOME}/.local/bin for the justify shims" >&2
    return 1
  fi
  # AND THEN CHECK WHERE IT ACTUALLY LANDED. "$HOME/.local/bin" is only a safe fallback if it
  # really is inside $HOME; a symlink there pointing at /opt/homebrew/bin turns the fallback
  # into the very escape this function exists to prevent, and every lexical test passes
  # because the path still starts with "$HOME/". Refuse rather than redirect: at this point
  # the run has no location left that it can prove is its own to write.
  if ! justify_path_is_within "${HOME}/.local/bin" "$HOME"; then
    echo "ERROR: ${HOME}/.local/bin resolves outside HOME ($HOME)." >&2
    echo "       Refusing to plant shims through it - it would write a directory this run" >&2
    echo "       does not own. Remove or repoint that link and re-run." >&2
    return 1
  fi
  BIN_DIR="${HOME}/.local/bin"
  return 0
}

# justify_bin_dir_is_permitted <bin-dir> - 0 if this run is allowed to have written there.
#
# THE INVARIANT THE PER-SHIM CHECKS CANNOT SEE. Every per-shim check compares against
# "$JUSTIFY_DIR/$target", and $JUSTIFY_DIR comes from $HOME - so when $HOME is redirected
# the whole verification loop is self-consistent and green while the shims sit in someone
# else's bin. That is not a hole in the loop; it is the limit of what any check phrased in
# terms of $HOME can detect, which is why the real fix is the selection above. This exists
# so a future edit to the selection cannot quietly reintroduce the escape without a row
# going red. A bin outside $HOME is legitimate ONLY when $HOME is the account's home.
# The in-HOME carve-out resolves the path rather than prefix-matching it, for the same reason
# the fallback does: "$HOME/.local/bin" symlinked to /opt/homebrew/bin satisfies a lexical
# prefix test while sitting in the real shared bin.
justify_bin_dir_is_permitted() {
  local bd="$1"
  if justify_path_is_within "$bd" "$HOME"; then
    return 0
  fi
  justify_home_is_real
}
# <<< justify-shim-bin-selection <<<

JUSTIFY_DIR_PHYS="$(phys_of "$JUSTIFY_DIR")" || JUSTIFY_DIR_PHYS="$JUSTIFY_DIR"

justify_choose_bin_dir /usr/local/bin /opt/homebrew/bin || exit $?

# name:target pairs, so planting and verification cannot drift apart.
#
# WHAT MAY BE REPLACED AT A SHIM NAME, and what may not. `ln -sfn` destroys whatever is
# there, and these names live in a SHARED bin the installer does not own. So:
#   - nothing there, or a SYMLINK: replace it. A symlink named justify-* in a bin dir is
#     this installer's own artifact, including the stale and dangling ones - repairing
#     those is the whole point (2026-07-16: eight shims pointing into a reaped temp tree).
#   - a REGULAR FILE or a DIRECTORY: refuse. That is someone else's command, and clobbering
#     it is not an install step. A directory additionally makes `ln -sfn` create the link
#     INSIDE it and return 0, which the old `[ -e ]` check then passed on the strength of
#     the directory existing while the command was nowhere on PATH.
# Both flagged by independent review.
justify_shims="justify-init:init.sh
justify-remove:remove.sh
justify-watch:justify-watch.sh
justify-done:justify-done.sh
justify-serve:justify-serve.sh
justify-watch-arm:justify-watch-arm.sh
justify-watch-disarm:justify-watch-disarm.sh
justify-worker:justify-worker.sh"

shim_failures=0
while IFS=: read -r shim target; do
  [ -n "$shim" ] || continue
  if [ -e "$BIN_DIR/$shim" ] && [ ! -L "$BIN_DIR/$shim" ]; then
    if [ -d "$BIN_DIR/$shim" ]; then
      echo "ERROR: $BIN_DIR/$shim is a directory - refusing to link inside it" >&2
    else
      echo "ERROR: $BIN_DIR/$shim is an existing file this installer did not create - refusing to replace it" >&2
    fi
    shim_failures=$((shim_failures + 1))
    continue
  fi
  # A link that already points somewhere ELSE is still ours to replace - stale and dangling
  # justify-* links are exactly what this installer exists to repair - but the repoint is
  # now ANNOUNCED rather than silent. The 2026-07-28 escape was invisible partly because
  # eight links were rewritten without a word: the run's output was indistinguishable from
  # a run that changed nothing. Ownership policy unchanged (see the block comment above);
  # only its observability changed.
  if [ -L "$BIN_DIR/$shim" ]; then
    _existing="$(readlink "$BIN_DIR/$shim" 2>/dev/null || printf '')"
    if [ -n "$_existing" ] && [ "$_existing" != "$JUSTIFY_DIR/$target" ]; then
      echo "NOTE: repointing $BIN_DIR/$shim from $_existing to $JUSTIFY_DIR/$target" >&2
    fi
  fi
  if ! ln -sfn "$JUSTIFY_DIR/$target" "$BIN_DIR/$shim"; then
    echo "ERROR: could not plant $BIN_DIR/$shim" >&2
    shim_failures=$((shim_failures + 1))
  fi
done <<SHIMS
$justify_shims
SHIMS

# The ownership invariant, checked here rather than at selection time so that it covers the
# state actually on disk. See justify_bin_dir_is_permitted for why the per-shim checks below
# cannot see this class on their own.
if ! justify_bin_dir_is_permitted "$BIN_DIR"; then
  echo "ERROR: shims were planted in $BIN_DIR, which is outside HOME ($HOME)," >&2
  echo "       and HOME is not this user's home directory. Refusing to report success." >&2
  shim_failures=$((shim_failures + 1))
fi

# Falsify the install rather than trusting it. Three separate things are checked, because
# each has been wrong on its own: the path is a SYMLINK (not a directory that swallowed
# the link), it points at the target this run intended (not a stale link from an older
# install, which is how eight shims sat pointing into a reaped temp tree), and `-e`
# follows it to something that exists (not dangling).
while IFS=: read -r shim target; do
  [ -n "$shim" ] || continue
  if [ ! -L "$BIN_DIR/$shim" ]; then
    echo "ERROR: $BIN_DIR/$shim is not a symlink" >&2
    shim_failures=$((shim_failures + 1))
  elif [ "$(readlink "$BIN_DIR/$shim")" != "$JUSTIFY_DIR/$target" ]; then
    echo "ERROR: $BIN_DIR/$shim points at $(readlink "$BIN_DIR/$shim"), not $JUSTIFY_DIR/$target" >&2
    shim_failures=$((shim_failures + 1))
  elif [ ! -e "$BIN_DIR/$shim" ]; then
    echo "ERROR: $BIN_DIR/$shim does not resolve to an existing file" >&2
    shim_failures=$((shim_failures + 1))
  fi
done <<SHIMS
$justify_shims
SHIMS
if [ "$shim_failures" -gt 0 ]; then
  echo "ERROR: $shim_failures justify shim(s) are wrong. Install aborted." >&2
  exit 1
fi
echo "Installed justify-init, justify-remove, justify-watch, justify-done, justify-serve, justify-watch-arm, justify-watch-disarm, justify-worker to $BIN_DIR (all verified resolvable)"

# launchd KeepAlive agent (macOS): make the daemon itself durable. Placement only
# - activation is the user's choice (see claude/docs/justify-daemon-launchd.md).
# The committed plist keeps THIS machine's absolute paths; template $HOME to the
# installing machine before placing it in ~/Library/LaunchAgents.
JUSTIFY_PLIST_SRC="$SCRIPT_DIR/../claude/launchd/com.yesand.justify-serve.plist"
if [ "$(uname)" = "Darwin" ] && [ -f "$JUSTIFY_PLIST_SRC" ] && command -v python3 >/dev/null 2>&1; then
  # Both of these are created, so both are checked first - same rule as every other
  # directory here. Flagged by independent review.
  refuse_repo_mkdir "$CLAUDE_DIR/logs" "justify logs" || exit 3
  mkdir -p "$CLAUDE_DIR/logs"
  LA_DIR="$HOME/Library/LaunchAgents"
  JUSTIFY_PLIST_DST="$LA_DIR/com.yesand.justify-serve.plist"
  refuse_repo_mkdir "$LA_DIR" "launchd agents" || exit 3
  mkdir -p "$LA_DIR"
  if python3 - "$JUSTIFY_PLIST_SRC" "$JUSTIFY_PLIST_DST" "$HOME" <<'PYPLIST'
import os, re, sys, tempfile
from xml.sax.saxutils import escape
src, dst, home = sys.argv[1:4]
with open(src, encoding="utf-8") as f:
    text = f.read()
# The author's HOME is embedded verbatim in the committed plist; extract it so
# the rewrite works even if re-authored on another machine. The plist runs node
# directly on the daemon entrypoint (see the plist header for why not justify-serve).
m = re.search(r'<string>([^<]+)/\.claude/justify/dist/server/index\.js</string>', text)
if not m:
    sys.stderr.write("justify plist template: could not locate author home\n")
    sys.exit(1)
text = text.replace(m.group(1), escape(home))
# Stage beside the destination and rename, rather than `open(dst, "w")`.
# ~/Library/LaunchAgents/com.yesand.justify-serve.plist is an installer-owned
# artifact, so a link there is ours to REPLACE - which os.replace does, where
# open(dst, "w") would have written through it into whatever it pointed at. The
# rename also means launchd can never read a half-written plist, and a failed write
# leaves the previous, working one in place instead of a truncated file.
parent = os.path.dirname(dst) or "."
if os.path.exists(dst) and not os.path.isfile(dst) and not os.path.islink(dst):
    sys.stderr.write("justify plist template: %s is not a regular file\n" % dst)
    sys.exit(1)
fd, tmp = tempfile.mkstemp(prefix=".%s." % os.path.basename(dst), dir=parent)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.chmod(tmp, 0o644)
    os.replace(tmp, dst)
except OSError as exc:
    if os.path.exists(tmp):
        os.unlink(tmp)
    sys.stderr.write("justify plist template: could not write %s: %s\n" % (dst, exc))
    sys.exit(1)
PYPLIST
  then
    echo "launchd agent placed at $JUSTIFY_PLIST_DST (templated for $HOME)"
    echo "  To activate: launchctl bootstrap gui/\$(id -u) $JUSTIFY_PLIST_DST"
  else
    # A DELIBERATE EXCEPTION to the no-swallowed-failures rule, called out here because
    # it is the only one left in this file. The launchd agent is PLACEMENT ONLY and the
    # user activates it by hand (claude/docs/justify-daemon-launchd.md); Justify installs,
    # runs and is usable without it. Nothing downstream reads this artifact, so a warning
    # is the honest signal - unlike the build, whose output the MCP registration depends on.
    echo "WARNING: could not template the justify launchd plist - place it manually from $JUSTIFY_PLIST_SRC"
  fi
fi

# Register MCP server in ~/.claude.json - see register_mcp_server for what the previous
# `json.dump(d, open(p, 'w'))` did to this file when a write failed.
refuse_repo_write "$HOME/.claude.json" "MCP registration" || exit 3
register_mcp_server "$HOME/.claude.json" justify node "$JUSTIFY_DIR/dist/server/index.js" || {
  echo "ERROR: could not register the justify MCP server in ~/.claude.json (see above)." >&2
  exit 5
}

# Install skill. The containment check runs BEFORE the mkdir for the same reason it does
# at the install root: a check that runs after it has already created a directory in
# tracked source is a report, not a guard.
SKILL_DIR="${CLAUDE_DIR}/skills/justify"
refuse_repo_mkdir "$SKILL_DIR" "justify skill" || exit 3
mkdir -p "$SKILL_DIR"
refuse_repo_write "$SKILL_DIR/SKILL.md" "justify skill" || exit 3
# The DIRECTORY, not just the file. A symlink at SKILL.md is replaced rather than followed,
# but a symlink at the containing justify/ directory sends the write - and the absolute
# path this installer bakes into it - somewhere outside the skills tree entirely. Flagged
# by independent review on the sibling installer; the same shape is here.
refuse_escaping_symlink "$SKILL_DIR" "${CLAUDE_DIR}/skills" "justify skill dir" || exit 3

# The heredoc goes through atomic_write_from_stdin, not `cat > "$SKILL_DIR/SKILL.md"`.
# `cat >` truncates the destination at open and FOLLOWS a symlink parked there, writing
# a file outside the directory this installer owns - and the placeholder rewrite below
# cannot help with that, because by the time it runs the write through the link has
# already happened. The staged-then-renamed write has neither problem: one rename covers
# the regular-file, symlink and nothing-there cases identically, replacing a link rather
# than following it, and never leaving a truncated SKILL.md behind when a write fails.
atomic_write_from_stdin "$SKILL_DIR/SKILL.md" << 'SKILLEOF' || exit 6
---
name: justify
description: Start and run Justify, the in-browser micro-adjustment tool. Invoke with /justify to bootstrap everything in the project the session is open in - bring up the Justify server, inject justify-core into the running site, trust the self-signed cert, activate the toolbar, and verify it live in the browser, self-healing past any failure. Also triggers on "start justify", "launch justify", "wire up justify", "fire up justify". Once running, this is the reference for Justify's modes and MCP tools.
---

# Justify

Justify is a live in-browser design tool: visually tweak a running page, hand the changes back to Claude as structured diffs over a WebSocket. `/justify` is the single command that gets it running in whatever project the session is open in.

It runs entirely in THIS session: the Claude session that runs `/justify` owns the Justify connection and applies the changes - there is no separate launcher, daemon, or operative. A teammate just runs `/justify` in the Claude of their project directory and Justify starts working. The only one-time prerequisites per machine are that Justify is installed (its MCP server registered) and the session was started after that - both true for any normal install; the steps below detect and fix the cold-start cases.

The source lives at `__JUSTIFY_SRC__` (the dotfiles `justify/` dir); the installed runtime lives at `~/.claude/justify/`.

## /justify - bootstrap everything (self-healing)

When the user runs `/justify` (or asks to start / launch / wire up / fire up Justify), run this sequence against the CURRENT project. Do NOT stop at the first failure: diagnose, fix, and retry until Justify is verified live - a connected tab in `justify_status` AND the toolbar visible in a browser screenshot. Report success only when both are true. If a step genuinely needs the user (a session restart or a sudo), say exactly what to do, then continue once they confirm.

### Step 1 - Server up (and installed)
The Justify server runs as the `justify` MCP server (`node ~/.claude/justify/dist/server/index.js`, registered in `~/.claude.json`). When connected it listens on **9223** (ws+http) and **9224** (https, serving `justify-core.js`).
- Probe: load the `justify_status` MCP tool (ToolSearch "justify_status") and call it; and `curl -sk https://localhost:9224/justify-core.js | head -c 80` should return JS.
- If the `justify_*` tools are MISSING, the MCP server is not connected this session:
  - If `~/.claude/justify/dist/server/index.js` does not exist, Justify is not installed -> run `bash __JUSTIFY_SRC__/install.sh` (builds the server + core, registers the MCP server, installs `justify-init`).
  - Then the session MUST be restarted for the MCP server to attach (MCP servers only connect at session start - there is no mid-session workaround). Tell the user to restart, then re-run `/justify`.
  - Note: a legacy `improv` MCP server may also be registered (the pre-rename install). It binds the same 9223 and will fight `justify`. If present, recommend retiring it (unregister `improv` from `~/.claude.json` mcpServers); do not delete its files without asking.
- If the tools exist but `curl` to 9224 fails, the HTTPS listener did not start -> rebuild via `install.sh`; confirm `justify` (not `improv`) is the live MCP server.

### Step 2 - Trust the cert (once per machine)
9224 uses a self-signed cert at `~/.claude/justify/dist/server/certs/cert.pem`. Until trusted, browsers block `justify-core` as untrusted / mixed-content on https pages.
- If `curl -sk` works but the browser will not load the script: run `bash __JUSTIFY_SRC__/setup-cert.sh` once (sudo; adds the cert to the macOS System Keychain), or open `https://localhost:9224/justify-core.js` in the browser and accept the cert. The cert only exists after the server has started at least once.

### Step 3 - Inject justify-core into the project
From the project, run `justify-init <project-root>` (or `bash __JUSTIFY_SRC__/cli/init.sh <project-root>`). It detects the stack and wires the `https://localhost:9224/justify-core.js` tag:
- WordPress: sets `WP_DEBUG=true` in `wp-config.php` and adds a `WP_DEBUG`-gated `wp_enqueue_script('justify-dev', ...)` to the active (non-`twenty*`) theme's `functions.php`.
- Vite / Next / Drupal / generic: edits `index.html` / the layout / theme libraries.
It is idempotent (grep-guarded). If it prints a WARNING that it could not find the wiring point, do that wiring manually per its printed instruction.

### Step 4 - Site running
The project's own dev server must be up. For a Lando WordPress site: `lando start` -> the `*.lndo.site` URL. Confirm with `curl`, and that the SERVED html now contains the script: `curl -sk <url> | grep justify-core`.

### Step 5 - Load, activate, VERIFY
- Open the site in the browser (chrome MCP or cmux). Hard-reload so the injected script loads.
- Call `justify_activate` (preferred - no keyboard needed) to show the toolbar. Keyboard fallback: `cmd+shift+.`.
- VERIFY both: `justify_status` shows >=1 connected tab at the site URL, AND a screenshot shows the Justify toolbar. Read the screenshot and describe it.
- If the tab is NOT connected, the core did not load. Re-check in order: cert trusted (step 2); the script tag is in the SERVED html (curl + grep, not the source - check `WP_DEBUG` is true and the right theme); a hard reload (cache). Fix and retry from the failing point.

### Step 6 - The watch is DAEMON-OWNED (arm it; do not run a session poll loop)
The watch lives in the persistent :9223 daemon, not this session. "watch justify" ARMS the daemon (`justify-watch-arm`); the daemon then spawns a headless worker for every Send-All batch and keeps doing so across session teardowns. You do NOT run a session-owned poll loop.

If you want to handle a queued batch IN this session instead of waiting for the daemon, CLAIM it first so the daemon does not also dispatch a worker for it (never raw-poll `/prompts` - that returns daemon-claimed prompts too and would double-apply):

1. CLAIM (returns only unclaimed/stale prompts, marks them yours):
   ```bash
   curl -s -X POST http://localhost:9223/prompts/claim -H 'Content-Type: application/json' -d '{"by":"interactive"}'
   ```
   Each claimed prompt is `{id, context, prompt, elementCount, timestamp, selectors, claimedBy, claimedAt}`.
2. APPLY: for each prompt, make the user's intended change in this project's source files.
3. RESPOND - this is what fills the bottom-left **Changes** panel and flips the claudebar to "Review":
   ```bash
   curl -s -X POST http://localhost:9223/respond -H 'Content-Type: application/json' \
     -d '{"promptId":"<id>","summary":"<what changed>","filesChanged":["<file>"],"changes":[{"selector":"<sel>","property":"<prop>","oldValue":"<old>","newValue":"<new>"}],"status":"completed"}'
   ```
4. CLEAR: `curl -s -X POST http://localhost:9223/prompts/clear`
5. Re-run the poll. Keep looping until the user says stop. Tell the user once: "Justify is live - tweak or prompt in the browser and I'll apply it; results show in the bottom-left Changes panel."

The bottom-left tray (queuebar + claudebar pills + Changes panel, per `decision_improv_claudebar_architecture`) is driven by this loop: a prompt fires `justify_working` (claudebar "Working") and your `/respond` fires `justify_response` (claudebar "Review", Changes panel fills). If the bottom-left stays empty, the loop is not running or `/respond` was never POSTed - fix the loop; do not blame the panel.

### Self-heal quick map
- `justify_*` tools missing -> not installed / not connected: `install.sh` + restart session (retire legacy `improv` if present).
- `curl :9224` fails -> server/https down: rebuild (`install.sh`); confirm `justify` is the live MCP server.
- page loads, no connection -> cert untrusted (`setup-cert.sh`) OR tag missing from served html (re-init / `WP_DEBUG` / theme) OR cached (hard reload).
- connected but no toolbar -> call `justify_activate`; check the page console for errors.

## Usage once running

Activate per tab with `justify_activate` (or `cmd+shift+.`). Two modes:
- **Manipulate** - click an element, scrub a CSS property in the panel (mouse left/right = decrease/increase); changes buffer server-side until `justify_apply_changes`.
- **Prompt** (`p`) - click an element, type an instruction inline ("make this button more rounded"); sent to Claude with the selector + computed styles.

### MCP tools (11)
`justify_activate`, `justify_status`, `justify_get_selection`, `justify_get_pending_changes`, `justify_apply_changes`, `justify_get_annotations`, `justify_watch`, `justify_acknowledge`, `justify_get_layout`, `justify_get_components`, `justify_clear`.

### Typical loop
activate -> Manipulate to scrub -> `justify_get_pending_changes` to preview -> `justify_apply_changes` for clean diffs -> apply to source.
SKILLEOF

# The heredoc is quoted, so bake the absolute source path in now.
replace_placeholder_atomically "$SKILL_DIR/SKILL.md" "__JUSTIFY_SRC__" "$SCRIPT_DIR" || exit 6

echo "Justify installed successfully."
echo "  Core script: $JUSTIFY_DIR/dist/justify-core.js"
echo "  MCP server: $JUSTIFY_DIR/dist/server/index.js"
echo "  Skill: $SKILL_DIR/SKILL.md"
echo "  CLI: justify-init / justify-remove (symlinked to $CLAUDE_DIR)"
