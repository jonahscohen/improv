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
           ${!BR_CHILDREN_@} ${!BR_HOOKDESC_@} ${!BR_SECTION_@}; do
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

# bucket_section <bucketKey> -> core|more (empty if unknown).
bucket_section() { _br_untab "$(_br_get SECTION "$1")"; }
