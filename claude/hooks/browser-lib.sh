#!/usr/bin/env bash
# browser-lib.sh - pure bash accessor layer over browser-tree.json.
#
# Sourced by install.sh (and by test-component-browser.sh). Defines functions
# only; nothing runs at source time. Call browser_load <tree.json> once to
# populate the lookup tables, then use the accessors below.
#
# Data model (mirrors browser-tree.json, see Task 1):
#   - Every bucket and every nested member is a NODE, addressed by its PATH:
#     the node keys slash-joined, e.g. "Beats", "Beats/Hooks", "sidecoach".
#     No key contains "/", so "/" is a safe path separator.
#   - Node KIND is DERIVED, never read from a stored field:
#       has "members"  -> group   (children are the member keys)
#       has "hooks"    -> hooks    (children are the hook names)
#       otherwise      -> leaf     (no children)
#   - Bucket/member keys may contain SPACES ("Voice & chat", "Dev surface",
#     "Design Tools"). To survive that, ordered lists (the bucket list and each
#     node's children) are stored TAB-delimited internally and only converted to
#     spaces for display by browser_buckets / node_children / node_hooks. A tab
#     never appears inside a key, so the round-trip is lossless.
#
# Storage note (bash 3.2 compatibility): the target runtime is macOS system bash
# 3.2, which has NO associative arrays and no `declare -g`. install.sh itself
# uses zero bash-4 features by design, and it sources this file. So instead of
# `declare -gA BR_KIND[path]`, each field/path pair is held in a PLAIN global
# scalar whose name is "BR_<FIELD>_<hex>", where <hex> is the byte-hex encoding
# of the path (a valid, collision-free identifier suffix). browser_load emits
# these assignments from one python call and evals them; the accessors recompute
# the same encoded name and read it back with indirect expansion. The public API
# and every output are identical to an associative-array implementation.
#
# All accessors are safe under `set -u`: a missing path yields empty output, and
# `set -e` never trips (query functions always return 0).

# _br_enc <str> - byte-hex encode a string into a safe variable-name suffix.
# Matches python's str.encode('utf-8').hex() for ASCII keys (all keys are ASCII).
_br_enc() {
  local s="$1" out="" i c h
  for (( i = 0; i < ${#s}; i++ )); do
    c="${s:i:1}"
    printf -v h '%02x' "'$c"
    out="$out$h"
  done
  printf '%s' "$out"
}

# browser_load <tree.json> - one python invocation emits bash assignments that
# populate the global BR_* scalars; we eval them. Pure (no side effects) and fast.
browser_load() {
  local tree="$1" v blob
  # Reset so a re-load never leaves stale entries behind. Prefix-name expansion is
  # safe under `set -u` even when nothing matches (expands to nothing).
  for v in ${!BR_KIND_@} ${!BR_TAG_@} ${!BR_DESC_@} ${!BR_LABEL_@} \
           ${!BR_CHILDREN_@} ${!BR_HOOKDESC_@} ${!BR_SECTION_@} \
           ${!BR_HOOKOWNER_@} ${!BR_PINNED_@}; do
    unset "$v"
  done
  BR_BUCKETS=""

  blob="$(python3 - "$tree" <<'PY'
import json, sys

tree = json.load(open(sys.argv[1]))

def enc(s):
    return s.encode("utf-8").hex()

def esc(s):
    # Single-quote a string for safe bash eval; escape embedded single quotes.
    # Literal TABs inside the value survive single-quoting untouched.
    return "'" + str(s).replace("'", "'\\''") + "'"

def emit(field, path, val):
    print("BR_%s_%s=%s" % (field, enc(path), esc(val)))

def kind_of(node):
    if node.get("members") is not None:
        return "group"
    if node.get("hooks") is not None:
        return "hooks"
    return "leaf"

def walk(node, path):
    k = kind_of(node)
    emit("KIND", path, k)
    emit("TAG", path, node.get("tag", ""))
    emit("DESC", path, node.get("desc", ""))
    emit("LABEL", path, node.get("label", node.get("key", "")))
    if k == "group":
        kids = [c["key"] for c in node["members"]]
        emit("CHILDREN", path, "\t".join(kids))
        for c in node["members"]:
            walk(c, path + "/" + c["key"])
    elif k == "hooks":
        emit("CHILDREN", path, "\t".join(node["hooks"]))
    else:
        emit("CHILDREN", path, "")

buckets = tree["buckets"]
for b in buckets:
    walk(b, b["key"])
    emit("SECTION", b["key"], b.get("section", ""))

for h, d in tree.get("hook_desc", {}).items():
    emit("HOOKDESC", h, d)

for h, o in tree.get("hook_owner", {}).items():
    emit("HOOKOWNER", h, o)

for h in tree.get("pinned_hooks", []):
    emit("PINNED", h, "1")

print("BR_BUCKETS=" + esc("\t".join(b["key"] for b in buckets)))
PY
)" || return 1

  eval "$blob"
}

# --- internal: convert the TAB-delimited storage form to space-joined display.
_br_untab() { local v="$1"; printf '%s\n' "${v//$'\t'/ }"; }

# --- internal: read the encoded scalar for FIELD/path with an empty default.
_br_get() { local n="BR_${1}_$(_br_enc "$2")"; printf '%s' "${!n-}"; }

# browser_buckets - ordered bucket keys, space-joined on one line.
browser_buckets() { _br_untab "${BR_BUCKETS-}"; }

# node_kind <path> -> group|hooks|leaf (empty if unknown).
node_kind() { _br_untab "$(_br_get KIND "$1")"; }

# node_children <path> -> space-joined child keys (empty for a leaf/unknown).
node_children() { _br_untab "$(_br_get CHILDREN "$1")"; }

# node_hooks <path> -> hook names for a hooks node; empty otherwise.
node_hooks() {
  if [ "$(_br_get KIND "$1")" = "hooks" ]; then
    node_children "$1"
  fi
}

# node_tag / node_desc / node_label <path>. Label falls back to key at load time.
node_tag()   { _br_untab "$(_br_get TAG "$1")"; }
node_desc()  { _br_untab "$(_br_get DESC "$1")"; }
node_label() { _br_untab "$(_br_get LABEL "$1")"; }

# hook_desc <hook> -> its description (empty if unknown).
hook_desc() { _br_untab "$(_br_get HOOKDESC "$1")"; }

# hook_owner <hook> -> its install-owner key: the `--only` key that installs it
# (a cluster key like "safety", an app-component key like "justify", or "memory"/
# "reflect" for the Beats hooks). Empty if unknown.
hook_owner() { _br_untab "$(_br_get HOOKOWNER "$1")"; }

# hook_pinned <hook> -> 0 if the hook is PINNED (project-scoped, always-on, and NOT
# installer-toggleable), 1 otherwise. Reads the encoded BR_PINNED_<hex> flag
# directly; safe under `set -u` via the `-` default.
hook_pinned() {
  local n="BR_PINNED_$(_br_enc "$1")"
  [ "${!n-}" = "1" ]
}

# bucket_section <bucketKey> -> core|more (empty if unknown).
bucket_section() { _br_untab "$(_br_get SECTION "$1")"; }

# --- status + rollup layer (Task 3) -----------------------------------------
#
# A NODE's install state is derived from a per-leaf PROBE. At runtime the probe
# is _real_probe (which asks install.sh whether a hook/component is installed);
# tests inject a deterministic probe by setting BR_STATE_PROBE to a function
# name. Group/hooks nodes roll their leaves up into none|partial|active.
#
# Space-safety: node PATHs can contain spaces (bucket keys "Voice & chat",
# "Dev surface", "Design Tools"), so every list of paths is newline-delimited
# and iterated with `while IFS= read -r`, never `for x in $(...)`.

# _br_children_lines <path> - child keys of a node, ONE PER LINE (space-safe).
# Children are stored TAB-delimited internally; convert TAB -> newline. A child
# key never contains a space or a tab, so this round-trips losslessly. Emits
# nothing for a leaf/unknown node. Always returns 0.
_br_children_lines() {
  local v
  v="$(_br_get CHILDREN "$1")"
  if [ -n "$v" ]; then
    printf '%s\n' "${v//$'\t'/$'\n'}"
  fi
  return 0
}

# leaf_paths <path> - every leaf path under a node, ONE PER LINE.
#   leaf         -> the path itself
#   hooks node   -> path/<hook> for each hook (hooks have no sub-node entry, so
#                   they are emitted directly rather than recursed into)
#   group node   -> recurse into each child sub-node (children carry their own
#                   KIND, so leaf_paths resolves them)
leaf_paths() {
  local path="$1" kind child
  kind="$(node_kind "$path")"
  case "$kind" in
    group)
      while IFS= read -r child; do
        [ -n "$child" ] || continue
        leaf_paths "$path/$child"
      done < <(_br_children_lines "$path")
      ;;
    hooks)
      while IFS= read -r child; do
        [ -n "$child" ] || continue
        printf '%s\n' "$path/$child"
      done < <(_br_children_lines "$path")
      ;;
    *)
      printf '%s\n' "$path"
      ;;
  esac
  return 0
}

# counts <path> - "on/total" over the leaves under a node. total = number of
# leaf_paths; on = number whose probe returns 0. Iterated space-safe.
counts() {
  local path="$1" probe total on leaf
  probe="${BR_STATE_PROBE:-_real_probe}"
  total=0; on=0
  while IFS= read -r leaf; do
    [ -n "$leaf" ] || continue
    total=$((total + 1))
    if "$probe" "$leaf"; then
      on=$((on + 1))
    fi
  done < <(leaf_paths "$path")
  printf '%s/%s\n' "$on" "$total"
}

# item_state <path> -> none | partial | active.
#   leaf:        probe -> active if installed else none.
#   group/hooks: derived from counts (on==0 none, on==total active, else partial).
item_state() {
  local path="$1" kind probe c on total key parent
  kind="$(node_kind "$path")"
  if [ "$kind" = "group" ] || [ "$kind" = "hooks" ]; then
    c="$(counts "$path")"
    on="${c%/*}"; total="${c#*/}"
    if [ "$on" = "0" ]; then
      printf '%s\n' "none"
    elif [ "$on" = "$total" ]; then
      printf '%s\n' "active"
    else
      printf '%s\n' "partial"
    fi
  else
    # A PINNED hook leaf (parent node is a hooks node) is always-on and not
    # installer-toggleable, so it reads active WITHOUT consulting the probe.
    key="${path##*/}"
    parent="${path%/*}"
    if [ "$(node_kind "$parent")" = "hooks" ] && hook_pinned "$key"; then
      printf '%s\n' "active"
      return 0
    fi
    probe="${BR_STATE_PROBE:-_real_probe}"
    if "$probe" "$path"; then
      printf '%s\n' "active"
    else
      printf '%s\n' "none"
    fi
  fi
  return 0
}

# _real_probe <path> - the default runtime probe (used inside install.sh, NOT in
# tests, which inject BR_STATE_PROBE). A leaf is a HOOK when its parent node is a
# hooks node, otherwise a COMPONENT.
#   hook      -> is_our_hook "<key>.sh"
#   component -> detect_component "<key>" == active
# is_our_hook and detect_component are install.sh functions in scope at runtime.
_real_probe() {
  local path="$1" key parent
  key="${path##*/}"
  parent="${path%/*}"
  if [ "$(node_kind "$parent")" = "hooks" ]; then
    is_our_hook "$key.sh"
  else
    [ "$(detect_component "$key")" = "active" ]
  fi
}
