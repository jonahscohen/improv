#!/usr/bin/env bash
# node-path-default.sh - SessionStart hook: make the Bash tool honor the user's nvm default.
#
# THE BUG (reproduced 2026-07-16):
# Claude Code's Bash tool runs a NON-interactive zsh that never sources ~/.zshrc (NVM_DIR is
# unset in it), so the `nvm use default` line there never runs. The harness builds its own
# PATH and lists the nvm version dirs in ASCENDING order:
#   5 ~/.nvm/versions/node/v12.22.12/bin   <- wins
#   6 ~/.nvm/versions/node/v18.2.0/bin
#   7 ~/.nvm/versions/node/v18.20.0/bin
#   8 ~/.nvm/versions/node/v20.19.6/bin
# so `node` resolves to v12.22.12 while `nvm alias default` says 20. Every global npm CLI
# that needs node>=16 then dies. codex was the first casualty: `codex` is a symlink in the
# v20 bin dir whose `#!/usr/bin/env node` shebang re-picks v12, and codex 0.142.5 uses
# top-level await -> "SyntaxError: Unexpected reserved word" at codex.js:188, before it runs.
# That error is especially costly because CLAUDE.md tells sessions to probe `codex --version`
# to decide whether the cross-model review gate can run: the probe ERRORS instead of
# reporting "not installed", so sessions wrongly conclude Codex is unavailable and silently
# drop to the weaker same-model reviewer.
#
# WHY A HOOK AND NOT A `codex` PATH SHIM:
# A shim only wins if it sits earlier on PATH than the real binary. The real codex is at
# position 8 and NO dotfiles-controlled dir exists before it (~/.local/bin is at 13), so a
# shim can never win. (~/.claude/cmux looks like a counter-example but is not: cmux INJECTS
# that dir into the env it launches claude with, so it is absent from PATH here.) This was
# already established and the shim already rejected on 2026-07-15 - see
# .claude/memory/reference_codex_broken_node12_path.md. Fixing `node` instead fixes the
# whole class rather than one symptom, and honors a default the user already set.
#
# WHY SURGERY AND NOT A PREPEND:
# Prepending a node dir to the front of PATH would jump AHEAD of ~/.claude/cmux inside a
# cmux session, bypassing the `node` shim there (claude/cmux/node) that heals a purged
# NODE_OPTIONS preload at exec time - reintroducing the MODULE_NOT_FOUND breakage that shim
# exists to prevent. So we never prepend. We REMOVE the offending nvm dirs instead, leaving
# every remaining entry in its original relative order. Nothing can be jumped ahead of.
#
# BLAST RADIUS: only sessions whose ambient node is <16. When node is already >=16 (a normal
# login shell, or any machine without an ancient nvm version) this is a silent no-op and
# PATH is not touched at all.
#
# Mechanism: SessionStart hooks may append `export` lines to $CLAUDE_ENV_FILE, which are
# applied to every subsequent Bash tool call in the session (Claude Code hooks doc).
# Fails soft and stays silent on success; speaks only when it cannot find a usable node.
#
# Portability: `/usr/bin/env bash` resolves to /bin/bash (3.2) on stock macOS, so this avoids
# bash-4-only syntax and the `${arr[*]}`-under-set-u trap. No arrays are used.
set -u

ENV_FILE="${CLAUDE_ENV_FILE:-}"
# Older Claude Code, or a non-SessionStart event: no env file to write to. Do nothing.
[ -n "$ENV_FILE" ] || exit 0
# Fail soft on a malformed ambient env rather than dying under `set -u` and surfacing as a
# hook error. Both are pathological, neither is worth breaking session start over.
[ -n "${HOME:-}" ] || exit 0
[ -n "${PATH:-}" ] || exit 0

NVM_ROOT="$HOME/.nvm/versions/node"
[ -d "$NVM_ROOT" ] || exit 0   # no nvm on this machine; nothing to reorder

# Major version of a node binary, or -1 if it will not run. Never trust a directory name for
# this - a dir can be renamed or hold a broken/missing binary (same discipline as
# codex-review.py's _node_major, which resolves node for the cross-model review path).
# MUST echo -1 (not just return) on failure: every caller compares the result with `-lt`/`-ge`,
# and an empty string there is a `[: integer expression expected` error that evaluates FALSE -
# which would silently keep a BROKEN node selected and skip the fallback below.
node_major() {
  local out
  out="$("$1" --version 2>/dev/null)" || { echo -1; return 0; }
  case "$out" in
    v[0-9]*) echo "${out#v}" | cut -d. -f1 ;;
    *) echo -1 ;;
  esac
}

# --- 1. No-op when the ambient node is already usable ---------------------------
# This is the common case everywhere except this harness, and it is what keeps the hook out
# of the way of the cmux `node` shim: any session that already resolves a good node exits
# here without touching PATH.
_amb="$(command -v node 2>/dev/null)" || _amb=""
if [ -n "$_amb" ] && [ "$(node_major "$_amb")" -ge 16 ]; then
  exit 0
fi

# --- 2. nvm version dirs, newest first ------------------------------------------
# Sort by numeric major.minor.patch (sort -V), not lexically: lexical sort puts v9 after v10.
_versions="$(ls -1 "$NVM_ROOT" 2>/dev/null | sort -V -r)"
[ -n "$_versions" ] || exit 0

# --- 3. Resolve `nvm alias default`, following alias chains ---------------------
# The alias file holds an exact version ("v20.19.6"), a bare prefix ("20"), or a symbolic
# name that points at ANOTHER alias: on this machine `default` -> "20", but a common setup is
# `default` -> "lts/*" -> (file ~/.nvm/alias/lts/*) -> "lts/krypton" -> "v20.19.6". Follow the
# chain rather than giving up on it, so a symbolic default is honored like nvm honors it.
# Bounded to 10 hops so a self-referential alias cannot spin forever. Every path is quoted:
# the literal alias filename is `*`, which must never be globbed.
_want=""
if [ -r "$HOME/.nvm/alias/default" ]; then
  _want="$(tr -d '[:space:]' < "$HOME/.nvm/alias/default")"
fi
_hops=0
while [ -n "$_want" ] && [ "$_hops" -lt 10 ]; do
  case "$_want" in
    v[0-9]*|[0-9]*) break ;;                       # a version or bare prefix: resolve below
  esac
  [ -r "$HOME/.nvm/alias/$_want" ] || break        # symbolic but unresolvable (e.g. "node")
  _want="$(tr -d '[:space:]' < "$HOME/.nvm/alias/$_want")"
  _hops=$((_hops + 1))
done

_chosen=""
case "$_want" in
  v[0-9]*|[0-9]*)
    for _v in $_versions; do
      # Exact match ("v20.19.6" or "20.19.6"), or prefix match on a version BOUNDARY so that
      # "20" matches v20.19.6 but never v200.x / v20x.x.
      if [ "$_v" = "$_want" ] || [ "$_v" = "v$_want" ] || \
         [ "${_v#v$_want.}" != "$_v" ] || [ "${_v#$_want.}" != "$_v" ]; then
        _chosen="$_v"; break
      fi
    done
    ;;
esac

# --- 4. Version-check the choice, with a newest-usable fallback ------------------
# Covers a symbolic alias we could not resolve, a missing alias file, and an alias pointing at
# a version that is gone or broken. Never assume the name implies the version - run it.
if [ -n "$_chosen" ] && [ "$(node_major "$NVM_ROOT/$_chosen/bin/node")" -lt 16 ]; then
  _chosen=""
fi
if [ -z "$_chosen" ]; then
  for _v in $_versions; do
    if [ "$(node_major "$NVM_ROOT/$_v/bin/node")" -ge 16 ]; then
      _chosen="$_v"; break
    fi
  done
fi

# Nothing usable: say so plainly. A session that reads "no node >=16" can act on it; the
# SyntaxError it would otherwise hit teaches it nothing.
if [ -z "$_chosen" ]; then
  echo "node-path-default: node is $("${_amb:-node}" --version 2>/dev/null || echo unknown) and no nvm node >=16 is installed under $NVM_ROOT. Global npm CLIs that require node>=16 (codex among them) will fail until one is installed (nvm install 20)."
  exit 0
fi

_keep="$NVM_ROOT/$_chosen/bin"

# --- 5. Drop every OTHER nvm bin dir; keep all relative order --------------------
# Removal only. The chosen dir stays exactly where it already sat, so it cannot jump ahead of
# ~/.claude/cmux or any other shim dir that legitimately precedes it.
#
# An EMPTY PATH component means the current directory (execvp semantics) and is preserved
# verbatim: dropping one would change which node/binary the shell resolves, which is exactly
# the kind of silent behavior change this hook must not cause. The `_first` flag (rather than
# `${_new:+$_new:}`) is what makes an empty component survive - including a leading one.
_new=""
_first=1
_found=""
_rest="$PATH"
_more=1
while [ -n "$_more" ]; do
  case "$_rest" in
    *:*) _d="${_rest%%:*}"; _rest="${_rest#*:}" ;;
    *)   _d="$_rest"; _more="" ;;
  esac

  _drop=""
  if [ "$_d" = "$_keep" ]; then
    _found=1
  elif [ -n "$_d" ] && [ "${_d#$NVM_ROOT/}" != "$_d" ]; then
    _drop=1   # a different nvm version's bin dir
  fi

  if [ -z "$_drop" ]; then
    if [ -n "$_first" ]; then _new="$_d"; _first=""; else _new="$_new:$_d"; fi
  fi
done

# The default's dir was not on PATH at all (the harness listed only some versions). Add it at
# the END so it still cannot jump ahead of anything that was already there.
if [ -z "$_found" ]; then
  if [ -n "$_first" ]; then _new="$_keep"; else _new="$_new:$_keep"; fi
fi

# Nothing actually changed - do not write a redundant export.
[ "$_new" = "$PATH" ] && exit 0

# Append (never truncate): other SessionStart hooks write to this same file, and they run in
# parallel with no ordering guarantee.
# %q, not a bare %s: this harness's PATH contains "/Users/<u>/Library/Application Support/..."
# and the per-session plugin bin dirs - all with SPACES. An unquoted export would split them
# into garbage entries and shred PATH for the whole session.
printf 'export PATH=%q\n' "$_new" >> "$ENV_FILE"
exit 0
