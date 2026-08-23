#!/usr/bin/env bash
# plugin-node-hook-heal.sh - SessionStart (cmux app hook): make plugin hooks that invoke a
# bare `node` resolve, even when Claude Code runs hooks with a reduced PATH that lacks node.
#
# THE BUG (measured 2026-08-20, reduced hook PATH captured):
# cmux app-launched sessions hand hooks a reduced PATH -
#   <cmux-cli-shims temp>:/Applications/cmux.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin
# - with NO node on it. Plugin hooks.json files that call bare `node` (openai-codex's
# Stop/SessionStart/SessionEnd review gate; impeccable and vercel too, if enabled) then print
# "node: command not found" on every fire and SILENTLY DO NOT RUN. That is degraded coverage
# (the cross-model review gate was not running), not just log noise.
#
# WHY THE FIX IS AT THE CALLER, NOT THE PATH:
# Hooks inherit the claude PROCESS env, and a hook cannot mutate its parent's PATH. The one
# channel a SessionStart hook has, $CLAUDE_ENV_FILE, reaches only the Bash tool, not hook
# shells (measured: node-path-default.sh writes it, yet the later reduced-PATH probe hook still
# saw node MISSING). And the reduced PATH holds no dotfiles-owned writable dir to drop a node
# shim onto (only an ephemeral per-launch temp dir and the signed cmux.app bundle, which is
# unsafe to modify). So we fix the CALLERS: rewrite the bare `node` token in each plugin
# hooks.json to an ABSOLUTE node - the exact pattern the nyx hook already uses
# (/opt/homebrew/bin/node) and never fails on.
#
# DURABILITY: a plugin UPDATE rewrites its cache back to bare `node`. This runs every
# SessionStart, so the next session re-heals it. Idempotent: an absolute path contains '/',
# so `node` there never sits at a shell boundary and the regex never re-matches. Fails soft,
# stays silent on success. Portable: /usr/bin/env bash resolves to bash 3.2 on stock macOS,
# so no bash-4 syntax and no arrays under set -u.
set -u

[ -n "${HOME:-}" ] || exit 0

# --- resolve an absolute, working node >=16 --------------------------------------------
# Preference: the raw homebrew node the nyx hook already uses (newest, satisfies plugins that
# demand node>=22 like impeccable), then the cmux node shim, then the newest nvm version.
# Never trust a path NAME - run --version and read the major (a dir can be renamed or hold a
# broken binary). MUST echo -1 on failure so the `-ge`/`-lt` comparisons never see an empty
# string (which is a `[: integer expression expected` error that evaluates FALSE).
node_major() {
  out="$("$1" --version 2>/dev/null)" || { echo -1; return 0; }
  case "$out" in
    v[0-9]*) echo "${out#v}" | cut -d. -f1 ;;
    *) echo -1 ;;
  esac
}

ABS_NODE=""
for _c in "/opt/homebrew/bin/node" "$HOME/.claude/cmux/node"; do
  if [ -x "$_c" ] && [ "$(node_major "$_c")" -ge 16 ]; then ABS_NODE="$_c"; break; fi
done
if [ -z "$ABS_NODE" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  # Newest-first, using a PORTABLE numeric field sort (strip the leading v, sort major.minor.patch
  # numerically descending, restore the v). Avoids `sort -V`, which stock BSD sort may lack.
  for _d in $(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sed 's/^v//' \
              | sort -t. -k1,1nr -k2,2nr -k3,3nr | sed 's/^/v/'); do
    if [ "$(node_major "$HOME/.nvm/versions/node/$_d/bin/node")" -ge 16 ]; then
      ABS_NODE="$HOME/.nvm/versions/node/$_d/bin/node"; break
    fi
  done
fi
# Last resort: whatever node is already on PATH (a full-PATH session) - but only if it is an
# ABSOLUTE path AND a working node >=16 (never rewrite a plugin hook onto a relative resolution
# or an ancient node). If that does not hold, there is nothing safe to point at.
if [ -z "$ABS_NODE" ]; then
  _pv="$(command -v node 2>/dev/null || true)"
  case "$_pv" in
    /*) [ "$(node_major "$_pv")" -ge 16 ] && ABS_NODE="$_pv" ;;
  esac
fi
[ -n "$ABS_NODE" ] || exit 0

CACHE="$HOME/.claude/plugins/cache"
[ -d "$CACHE" ] || exit 0

# Rewrite every plugin hooks.json. A `node` token is the EXECUTABLE (and becomes $ABS_NODE)
# only when it appears at a command-start position OUTSIDE any quotes: the start of the command,
# or right after an unquoted separator ( ; | & { ( or newline ), with leading `VAR=value`
# assignments and a bare `env` prefix skipped. This is a small quote/escape-aware scanner rather
# than a raw regex, so a literal `node` inside a quoted argument or a `node -e '...{ node }...'`
# JS string is NEVER rewritten. Idempotent: an already-absolute `/.../node` is a different word
# and is left alone. Structure-safe (parse + dump JSON); writes only on change to a UNIQUE temp
# file in the same dir (safe if two sessions start at once), then atomically replaces.
python3 - "$CACHE" "$ABS_NODE" <<'PY'
import json, os, re, sys, tempfile

cache, absnode = sys.argv[1], sys.argv[2]

_SEP = set(';|&{(\n')          # unquoted chars that open a new command position
_WORD_END = set(' \t\n;|&<>)') # chars that terminate a bare word
_ASSIGN = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*=')
# words that prefix a command without ending the command-start (the next word is still the exe)
_PREFIX = {'env', 'command', 'exec', '!'}

def _consume_value(s, i):
    """From i, consume a shell word value that may contain quoted spans, up to an unquoted
    whitespace/separator or end. Returns the end index. Used for a VAR=<value> assignment so a
    quoted value (NODE_OPTIONS="--x" / FOO='a b') does not break the command-start chain."""
    n = len(s); q = None
    while i < n:
        c = s[i]
        if q is not None:
            if c == '\\' and q == '"' and i + 1 < n:
                i += 2; continue
            if c == q:
                q = None
            i += 1; continue
        if c == '\\':
            i += 2 if i + 1 < n else 1; continue
        if c == '"' or c == "'":
            q = c; i += 1; continue
        if c in (' ', '\t') or c in _SEP:
            break
        i += 1
    return i

def rewrite(cmd):
    """Return cmd with executable-position bare `node` replaced by absnode. Quote-aware."""
    out = []
    i, n = 0, len(cmd)
    at_start = True   # start of string is a command position
    quote = None      # None | "'" | '"'
    while i < n:
        c = cmd[i]
        if quote is not None:
            out.append(c)
            if c == '\\' and quote == '"' and i + 1 < n:
                out.append(cmd[i + 1]); i += 2; continue
            if c == quote:
                quote = None
            i += 1; continue
        if c == '\\':
            out.append(c)
            if i + 1 < n:
                out.append(cmd[i + 1]); i += 2
            else:
                i += 1
            at_start = False; continue
        if c == '"' or c == "'":
            out.append(c); quote = c; i += 1; at_start = False; continue
        if c in _SEP:
            out.append(c); i += 1; at_start = True; continue
        if c == ' ' or c == '\t':
            out.append(c); i += 1; continue   # whitespace preserves a pending command-start
        if at_start:
            # a VAR=<value> assignment prefix (value may be quoted) keeps us at command start
            m = _ASSIGN.match(cmd[i:])
            if m:
                k = _consume_value(cmd, i + m.end())
                out.append(cmd[i:k]); i = k; at_start = True; continue
            j = i
            while j < n and cmd[j] not in _WORD_END and cmd[j] not in ('"', "'", '\\'):
                j += 1
            word = cmd[i:j]
            if word == 'node':
                out.append(absnode); i = j; at_start = False; continue
            if word in _PREFIX:
                out.append(word); i = j; at_start = True; continue   # still at command start
            out.append(word); i = j; at_start = False; continue      # some other executable
        out.append(c); i += 1; at_start = False
    return ''.join(out)

for root, _dirs, files in os.walk(cache):
    if 'hooks.json' not in files:
        continue
    fp = os.path.join(root, 'hooks.json')
    try:
        with open(fp) as f:
            data = json.load(f)
    except Exception:
        continue
    hooks = data.get('hooks') if isinstance(data, dict) else None
    if not isinstance(hooks, dict):
        continue
    changed = False
    for _evt, groups in hooks.items():
        if not isinstance(groups, list):
            continue
        for g in groups:
            if not isinstance(g, dict):
                continue
            for h in g.get('hooks', []):
                if not isinstance(h, dict):
                    continue
                cmd = h.get('command')
                if not isinstance(cmd, str):
                    continue
                new = rewrite(cmd)
                if new != cmd:
                    h['command'] = new
                    changed = True
    if not changed:
        continue
    try:
        fd, tmp = tempfile.mkstemp(dir=root, prefix='.hooks.', suffix='.heal.tmp')
        try:
            with os.fdopen(fd, 'w') as f:
                json.dump(data, f, indent=2)
            os.replace(tmp, fp)
        except Exception:
            try:
                os.remove(tmp)
            except Exception:
                pass
    except Exception:
        pass
PY
exit 0
