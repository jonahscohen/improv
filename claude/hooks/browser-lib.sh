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
           ${!BR_HOOKOWNER_@} ${!BR_PINNED_@} ${!BR_HOOKPATH_@} \
           ${!BR_OWNERLEAF_@}; do
    unset "$v"
  done
  BR_BUCKETS=""
  BR_ALLHOOKS=""

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

# Ordered, de-duplicated list of every hook name in depth-first walk order, plus a
# per-hook leaf-path map (name -> the "<hooksNodePath>/<name>" leaf). apply_plan needs
# the leaf path to probe/stage a hook by name, since the owner key does not encode
# where a hook lives in the tree (e.g. the memory hooks live under Beats/Hooks).
# NOTE: keep apostrophes out of this heredoc body; bash 3.2 counts single quotes even
# inside a quoted heredoc when scanning the enclosing $(...) for its closing paren.
all_hooks = []
seen_hooks = set()

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
        for h in node["hooks"]:
            # Dedup HOOKPATH to the FIRST occurrence so it stays in lockstep with
            # BR_ALLHOOKS order even if a hook name ever appears in two hooks nodes.
            if h not in seen_hooks:
                seen_hooks.add(h)
                all_hooks.append(h)
                emit("HOOKPATH", h, path + "/" + h)
    else:
        emit("CHILDREN", path, "")
        # Owner-key -> component-leaf path. Leaf keys are globally unique, so this maps
        # an install-owner (e.g. memory, reflect, tilt-lab) to its master-switch leaf.
        emit("OWNERLEAF", node.get("key", path.rsplit("/", 1)[-1]), path)

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
print("BR_ALLHOOKS=" + esc("\t".join(all_hooks)))
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
# leaf_paths; on = number counted active. A PINNED hook leaf (parent node is a hooks
# node) is always-on and NOT installer-toggleable, so it is counted in `on` WITHOUT
# consulting the probe while remaining in `total`; this keeps the rollup consistent
# with item_state, which reads a pinned leaf as active. A folder holding only pinned
# leaves therefore reads partial, never none. Iterated space-safe.
counts() {
  local path="$1" probe total on leaf key parent
  probe="${BR_STATE_PROBE:-_real_probe}"
  total=0; on=0
  while IFS= read -r leaf; do
    [ -n "$leaf" ] || continue
    total=$((total + 1))
    key="${leaf##*/}"
    parent="${leaf%/*}"
    if [ "$(node_kind "$parent")" = "hooks" ] && hook_pinned "$key"; then
      on=$((on + 1))
    elif "$probe" "$leaf"; then
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

# --- staging + apply-plan layer (Task 4) ------------------------------------
#
# Pending changes are held in two bookended-"|" strings of LEAF PATHS:
#   PENDING_INSTALL   - leaves to turn ON
#   PENDING_UNINSTALL - leaves to turn OFF
# e.g. "|justify/justify-source-guard|tilt-lab|". Empty is "" (both "" and "||"
# are treated as empty). "|" bookends make membership a single glob:
#   case "$PENDING_INSTALL" in *"|$leaf|"*) ... ;; esac
# A leaf may contain spaces (buckets like "Voice & chat") but NEVER a "|", so the
# delimiter is unambiguous. apply_plan only COMPUTES a line-based plan; it runs
# nothing (the actual install pass is a later task).

# _br_all_hooks - every hook name in tree (walk) order, ONE PER LINE. Built from the
# TAB-delimited BR_ALLHOOKS the loader emits. Always returns 0.
_br_all_hooks() {
  local v="${BR_ALLHOOKS-}"
  if [ -n "$v" ]; then
    printf '%s\n' "${v//$'\t'/$'\n'}"
  fi
  return 0
}

# _br_hook_path <hook> - the leaf path a hook lives at (e.g. memory-approve ->
# Beats/Hooks/memory-approve). Empty if unknown.
_br_hook_path() { _br_get HOOKPATH "$1"; }

# _owner_leaf_path <owner> - the component-leaf path whose key is <owner> (e.g. memory ->
# Beats/memory, reflect -> Beats/reflect, tilt-lab -> tilt-lab). Empty for a hooks-only
# owner (justify, sidecoach, the clusters) that has NO leaf node. This leaf is the owner
# master switch: staging it uninstall removes the whole component, install brings it in
# WITH its hooks.
_owner_leaf_path() { _br_get OWNERLEAF "$1"; }

# hooks_owned_by <owner> - every NON-pinned hook whose hook_owner is <owner>, in tree
# (walk) order, ONE PER LINE. Pure bash over _br_all_hooks (no per-call python).
hooks_owned_by() {
  local owner="$1" h
  while IFS= read -r h; do
    [ -n "$h" ] || continue
    if [ "$(hook_owner "$h")" = "$owner" ] && ! hook_pinned "$h"; then
      printf '%s\n' "$h"
    fi
  done < <(_br_all_hooks)
  return 0
}

# _pend_has <set> <leaf> - 0 if <leaf> is a member of the bookended set string.
_pend_has() {
  case "$1" in
    *"|$2|"*) return 0 ;;
    *) return 1 ;;
  esac
}

# _set_add <varname> <leaf> - add <leaf> to the named bookended set (no dup). Space-safe.
_set_add() {
  local var="$1" leaf="$2" cur
  eval "cur=\"\${$var-}\""
  case "$cur" in
    *"|$leaf|"*) return 0 ;;
  esac
  if [ -z "$cur" ] || [ "$cur" = "||" ]; then
    eval "$var=\"|\$leaf|\""
  else
    # cur ends with "|"; append "<leaf>|" to keep the bookend intact.
    eval "$var=\"\${$var}\$leaf|\""
  fi
  return 0
}

# _set_remove <varname> <leaf> - drop <leaf> from the named bookended set. Space-safe.
# Leaf keys/paths carry no glob metacharacters, so the pattern substitution is literal.
_set_remove() {
  local var="$1" leaf="$2" cur
  eval "cur=\"\${$var-}\""
  eval "$var=\"\${cur//|\$leaf|/|}\""
  return 0
}

# _set_lines <set> - each leaf in a bookended set, ONE PER LINE (space-safe). Splits on
# "|" only, so leaves with spaces survive; empty edge fields are emitted and callers
# skip them with `[ -n "$leaf" ]`.
_set_lines() {
  local v="$1"
  if [ -n "$v" ] && [ "$v" != "||" ]; then
    printf '%s\n' "${v//|/$'\n'}"
  fi
  return 0
}

# stage_reset - clear both pending sets. Tests call this between scenarios.
stage_reset() {
  PENDING_INSTALL=""
  PENDING_UNINSTALL=""
  return 0
}

# stage_toggle <leaf> - flip a leaf's staged state against its CURRENT (probed) state.
#   pinned hook leaf (parent is a hooks node): NO-OP (not installer-toggleable).
#   currently ON:  stage an uninstall, or un-stage a pending uninstall.
#   currently OFF: stage an install, or un-stage a pending install.
# Toggling the same leaf twice returns to no-pending for it.
stage_toggle() {
  local leaf="$1" key parent probe
  : "${PENDING_INSTALL:=}" "${PENDING_UNINSTALL:=}"
  key="${leaf##*/}"
  parent="${leaf%/*}"
  if [ "$(node_kind "$parent")" = "hooks" ] && hook_pinned "$key"; then
    return 0
  fi
  probe="${BR_STATE_PROBE:-_real_probe}"
  if "$probe" "$leaf"; then
    if _pend_has "$PENDING_UNINSTALL" "$leaf"; then
      _set_remove PENDING_UNINSTALL "$leaf"
    else
      _set_add PENDING_UNINSTALL "$leaf"
      _set_remove PENDING_INSTALL "$leaf"
    fi
  else
    if _pend_has "$PENDING_INSTALL" "$leaf"; then
      _set_remove PENDING_INSTALL "$leaf"
    else
      _set_add PENDING_INSTALL "$leaf"
      _set_remove PENDING_UNINSTALL "$leaf"
    fi
  fi
  return 0
}

# stage_all <path> <install|uninstall> - drive every non-pinned leaf under <path> so the
# whole subtree ends up all-on (install) or all-off (uninstall). This is TOTAL: for each
# leaf it ALWAYS clears any opposite-direction pending first, then stages the requested
# direction only where it changes the leaf's current (probed) state. Net guarantee: after
# stage_all(path, install) no leaf under path is staged-uninstall; after
# stage_all(path, uninstall) none is staged-install. Pinned leaves are skipped.
# Space-safe over leaf_paths.
stage_all() {
  local path="$1" dir="$2" leaf key parent probe
  : "${PENDING_INSTALL:=}" "${PENDING_UNINSTALL:=}"
  probe="${BR_STATE_PROBE:-_real_probe}"
  while IFS= read -r leaf; do
    [ -n "$leaf" ] || continue
    key="${leaf##*/}"
    parent="${leaf%/*}"
    if [ "$(node_kind "$parent")" = "hooks" ] && hook_pinned "$key"; then
      continue
    fi
    if [ "$dir" = "install" ]; then
      # Totality: never leave a staged-uninstall behind, then stage install if OFF.
      _set_remove PENDING_UNINSTALL "$leaf"
      if ! "$probe" "$leaf"; then
        _set_add PENDING_INSTALL "$leaf"
      fi
    else
      # Totality: never leave a staged-install behind, then stage uninstall if ON.
      _set_remove PENDING_INSTALL "$leaf"
      if "$probe" "$leaf"; then
        _set_add PENDING_UNINSTALL "$leaf"
      fi
    fi
  done < <(leaf_paths "$path")
  return 0
}

# pending_under <path> - count of leaves under <path> that are staged (install or
# uninstall). Prints the integer. Used for the "N pending" drill markers.
pending_under() {
  local path="$1" leaf n=0
  : "${PENDING_INSTALL:=}" "${PENDING_UNINSTALL:=}"
  while IFS= read -r leaf; do
    [ -n "$leaf" ] || continue
    if _pend_has "$PENDING_INSTALL" "$leaf" || _pend_has "$PENDING_UNINSTALL" "$leaf"; then
      n=$((n + 1))
    fi
  done < <(leaf_paths "$path")
  printf '%s\n' "$n"
  return 0
}

# _owner_of <leaf> - the install-owner for a staged leaf: hook_owner(key) when the leaf's
# parent is a hooks node, else the leaf's own key (a component leaf).
_owner_of() {
  local leaf="$1" key parent
  key="${leaf##*/}"
  parent="${leaf%/*}"
  if [ "$(node_kind "$parent")" = "hooks" ]; then
    hook_owner "$key"
  else
    printf '%s' "$key"
  fi
}

# apply_plan - compute a deterministic, line-based plan WITHOUT running anything. One
# line per owner touched by a pending leaf:
#   UNINSTALL_COMPONENT <O>            - the whole component/cluster comes out
#   INSTALL <O>                        - install with no hook off-list
#   INSTALL <O> h1 h2 ...              - install, but leave h1 h2 ... OFF (tree order)
# Dual-nature owners (memory, reflect) have BOTH a component LEAF and separately-toggleable
# non-pinned hooks; for them the LEAF is the master switch and the hooks are sub-toggles.
# Hooks-only owners (justify, sidecoach, the clusters) have no leaf node, so all-hooks-off
# DOES mean a full uninstall. Per-owner order (whichever fires first wins):
#   1. leaf staged-uninstall        -> UNINSTALL_COMPONENT (master switch off)
#   2. no owned hooks (pure leaf)   -> INSTALL if leaf staged-install, else nothing
#   3. hooks-only + every hook off  -> UNINSTALL_COMPONENT (whole hooks component out)
#   4. otherwise (partial / target) -> INSTALL <O> + off-list of hooks NOT on after pending,
#      where on iff (currently_on OR staged-install OR leaf-staged-install) AND NOT staged-uninstall.
# Owner order is first-seen across PENDING_INSTALL then PENDING_UNINSTALL (tests grep for
# specific lines, so this order is not asserted, only kept stable).
apply_plan() {
  local probe owners set leaf owner
  : "${PENDING_INSTALL:=}" "${PENDING_UNINSTALL:=}"
  probe="${BR_STATE_PROBE:-_real_probe}"

  # Build the first-seen unique owner list (newline-bookended; owner keys carry no
  # space/tab/newline, so newline bookends are a safe membership test).
  owners=$'\n'
  for set in "$PENDING_INSTALL" "$PENDING_UNINSTALL"; do
    while IFS= read -r leaf; do
      [ -n "$leaf" ] || continue
      owner="$(_owner_of "$leaf")"
      case "$owners" in
        *$'\n'"$owner"$'\n'*) : ;;
        *) owners="$owners$owner"$'\n' ;;
      esac
    done < <(_set_lines "$set")
  done

  local lp H h hp h_count unins_count off_list on leaf_install
  while IFS= read -r owner; do
    [ -n "$owner" ] || continue

    lp="$(_owner_leaf_path "$owner")"   # component-leaf path, or "" for hooks-only owners
    H="$(hooks_owned_by "$owner")"      # non-pinned hooks, tree order

    # (1) master-switch uninstall: the component leaf itself is staged off.
    if [ -n "$lp" ] && _pend_has "$PENDING_UNINSTALL" "$lp"; then
      printf 'UNINSTALL_COMPONENT %s\n' "$owner"
      continue
    fi

    h_count=0
    while IFS= read -r h; do
      [ -n "$h" ] || continue
      h_count=$((h_count + 1))
    done <<EOF
$H
EOF

    # (2) pure leaf (no owned hooks): install only if the leaf is staged-install.
    if [ "$h_count" -eq 0 ]; then
      if [ -n "$lp" ] && _pend_has "$PENDING_INSTALL" "$lp"; then
        printf 'INSTALL %s\n' "$owner"
      fi
      continue
    fi

    # (3) hooks-only owner (no component leaf) with every owned hook staged-uninstall ->
    # the whole hooks component comes out. A dual-nature owner (has a leaf) NEVER hits this;
    # its leaf is the only thing that can trigger a full uninstall (step 1).
    if [ -z "$lp" ]; then
      unins_count=0
      while IFS= read -r h; do
        [ -n "$h" ] || continue
        hp="$(_br_hook_path "$h")"
        if _pend_has "$PENDING_UNINSTALL" "$hp"; then
          unins_count=$((unins_count + 1))
        fi
      done <<EOF
$H
EOF
      if [ "$unins_count" -eq "$h_count" ]; then
        printf 'UNINSTALL_COMPONENT %s\n' "$owner"
        continue
      fi
    fi

    # (4) partial / target-state: install the owner, off-listing every hook NOT on after
    # the pending sets. A staged-install of the component leaf forces all its hooks on.
    leaf_install=0
    if [ -n "$lp" ] && _pend_has "$PENDING_INSTALL" "$lp"; then
      leaf_install=1
    fi
    off_list=""
    while IFS= read -r h; do
      [ -n "$h" ] || continue
      hp="$(_br_hook_path "$h")"
      on=0
      if _pend_has "$PENDING_UNINSTALL" "$hp"; then
        on=0
      elif _pend_has "$PENDING_INSTALL" "$hp"; then
        on=1
      elif [ "$leaf_install" = "1" ]; then
        on=1
      elif "$probe" "$hp"; then
        on=1
      fi
      if [ "$on" = "0" ]; then
        off_list="$off_list $h"
      fi
    done <<EOF
$H
EOF
    printf 'INSTALL %s%s\n' "$owner" "$off_list"
  done <<EOF
$owners
EOF
  return 0
}

# --- apply layer (Task 6) ---------------------------------------------------
#
# apply_plan COMPUTES a per-owner plan; this layer TRANSLATES that plan into the two
# concrete actions the installer can run (apply_pending_plan, PURE), then EXECUTES them
# (apply_pending, a thin executor).
#
# The translation collapses apply_plan's N INSTALL lines into ONE install pass: the
# install owners become a single comma-separated `--only` list and every per-owner
# off-hook merges into ONE off-list. Merging is safe because an off-list entry is
# COMPONENT-SCOPED - install.sh's install_app_hooks only matches HOOK_OFF against the
# hooks that call passes in, so another component's entry is inert. That is what makes
# "staged apply = one install pass" (the approved design) correct rather than a shortcut.
#
# The `.sh` suffix is added HERE, and only here: apply_plan emits bare hook names (tree
# keys), while install.sh's HOOK_OFF / _AMPERSAND_HOOK_OFF contract expects hook
# FILENAMES with .sh.

# apply_pending_plan - PURE translation of apply_plan into exactly TWO lines. Both lines
# are ALWAYS emitted, so the shape is fixed and apply_pending can parse it back by
# stripping the literal prefixes:
#   1. INSTALL <owners-csv>|<off-list>
#        owners-csv - install owners, comma-joined, in apply_plan first-seen order.
#        off-list   - EVERY off-hook across ALL INSTALL lines, each .sh-suffixed,
#                     space-joined, in per-owner tree order.
#        Either field may be empty; no install owners at all yields exactly "INSTALL |".
#   2. DEACTIVATE <owners>
#        UNINSTALL_COMPONENT owners, space-joined, first-seen order. Empty yields
#        "DEACTIVATE " - the trailing space is part of the contract (the prefix that
#        apply_pending strips is "DEACTIVATE " with its space).
# Owner keys carry no space, comma or "|", so both joins are unambiguous. Pure bash 3.2;
# always returns 0.
apply_pending_plan() {
  local IFS=$' \t\n'   # pin word-splitting for the off-hook split, whatever the caller had
  local plan line rest owner hooks tok owners_csv off_list deact
  plan="$(apply_plan)"
  owners_csv=""; off_list=""; deact=""
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    case "$line" in
      "INSTALL "*)
        rest="${line#INSTALL }"
        owner="${rest%% *}"                 # first token is the owner key
        if [ -z "$owners_csv" ]; then owners_csv="$owner"; else owners_csv="$owners_csv,$owner"; fi
        # Any tokens after the owner are that owner's off-hooks (bare names, tree order).
        if [ "$rest" != "$owner" ]; then
          hooks="${rest#* }"
          for tok in $hooks; do
            [ -n "$tok" ] || continue
            off_list="$off_list $tok.sh"
          done
        fi
        ;;
      "UNINSTALL_COMPONENT "*)
        owner="${line#UNINSTALL_COMPONENT }"
        if [ -z "$deact" ]; then deact="$owner"; else deact="$deact $owner"; fi
        ;;
    esac
  done <<EOF
$plan
EOF
  printf 'INSTALL %s|%s\n' "$owners_csv" "${off_list# }"
  printf 'DEACTIVATE %s\n' "$deact"
  return 0
}

# apply_pending - EXECUTE the staged changes, then clear the pending sets.
#
# RUNTIME CONTRACT: apply_pending only ever runs at install.sh runtime. browser-lib.sh is
# SOURCED into install.sh, so "$0" is install.sh (the recursive-install idiom the
# returning flow already uses), and deactivate_component / stage_reset are in scope.
#
# Order is installs THEN deactivates. The two lists are disjoint by construction (apply_plan
# emits exactly ONE line per owner); step (0) VERIFIES that before touching anything, so a
# planner defect can never install a component and then immediately deactivate it.
#
# Exit codes (fail-loud - pending is cleared ONLY when the whole plan landed):
#   0             every staged change applied
#   3             apply_plan invariant violation (an owner in BOTH lists); nothing executed
#   <installer>   the install pass failed; its exit code is propagated, deactivates skipped
#   <deactivate>  a deactivate_component failed; its exit code is propagated
# On any non-zero return the pending sets are PRESERVED, so the user can retry.
#
# SET -E NOTE (load-bearing): callers test this function's status (`if apply_pending`),
# and bash DISABLES errexit for the entire body of a function whose status is being tested.
# Nothing here may rely on `set -e` to abort. Every failure is therefore checked
# EXPLICITLY - an unchecked command would silently continue and return 0, reporting
# partial work as success.
apply_pending() {
  local IFS=$' \t\n'
  local plan install_line deact_line rest owners_csv off_list deact owner rc logfile
  plan="$(apply_pending_plan)"
  install_line=""; deact_line=""
  { IFS= read -r install_line; IFS= read -r deact_line; } <<EOF
$plan
EOF
  rest="${install_line#INSTALL }"
  owners_csv="${rest%%|*}"
  off_list="${rest#*|}"
  deact="${deact_line#DEACTIVATE }"

  # (0) Refuse a self-contradicting plan BEFORE executing any of it.
  for owner in $deact; do
    [ -n "$owner" ] || continue
    case ",$owners_csv," in
      *",$owner,"*)
        printf 'apply_pending: INVARIANT VIOLATION - apply_plan put owner %s in BOTH the install and deactivate lists; refusing the plan (nothing applied, pending preserved)\n' "$owner" >&2
        return 3
        ;;
    esac
  done

  # (1) ONE install pass for every install owner, carrying the merged off-list. Mirrors
  # the returning flow's recursive-install idiom (install.sh ~line 2021).
  if [ -n "$owners_csv" ]; then
    logfile="$(mktemp)"
    if _AMPERSAND_HOOK_OFF="$off_list" _AMPERSAND_NO_SUMMARY=1 bash "$0" --only "$owners_csv" --yes >"$logfile" 2>&1; then
      rm -f "$logfile"
    else
      rc=$?
      printf 'apply_pending: install pass FAILED (exit %s) for --only %s\n' "$rc" "$owners_csv" >&2
      printf 'apply_pending: last 20 lines of %s:\n' "$logfile" >&2
      tail -20 "$logfile" >&2
      return "$rc"
    fi
  fi

  # (2) Whole-component removals. Status checked explicitly (see SET -E NOTE above).
  for owner in $deact; do
    [ -n "$owner" ] || continue
    if deactivate_component "$owner"; then
      :
    else
      rc=$?
      printf 'apply_pending: deactivate FAILED (exit %s) for component %s (pending preserved)\n' "$rc" "$owner" >&2
      return "$rc"
    fi
  done

  # (3) Every staged change landed. Pending is spent. Status needs no cache refresh:
  # item_state/counts re-probe disk live through _real_probe on the next call.
  stage_reset
  return 0
}
