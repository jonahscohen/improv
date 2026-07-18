#!/bin/bash
# test-figma-ledger.sh
#
# Level 2 of the Figma-fidelity gate: a tamper-evident, HMAC-signed, hash-chained
# ARM LEDGER (.figma-fidelity.ledger) that the Stop gate trusts INSTEAD of the
# mutable .figma-fidelity.pending marker. It closes the residual Level-1 could not:
# a lazy self-opt-out that edits the arming record to skip a node's pixel check.
#
# The arm hook (figma-fidelity-arm.sh) appends a signed `arm` line per pulled node;
# the Stop gate (figma-fidelity-stop.sh) verifies the whole chain, requires coverage
# of every UNRESOLVED arm (union with the marker), and signs a `resolve` when a node
# is genuinely covered. The signing secret lives at ~/.claude/.fidelity-secret,
# OUTSIDE any repo. Design: decision_2026-07-17_fidelity-gate-level2-tamper-evident-ledger.md.
#
# Threat model = a lazy Claude taking the opt-out shortcut, NOT a determined forger
# (which reads the secret / recomputes HMACs - excluded by the behavioral rules and
# the Level-1 read-block). So the bar is: the shortcut is STRUCTURALLY unavailable
# and any residual tamper is DETECTED and BLOCKING. Every case is falsified BOTH ways.
#
# Isolation: each case runs in its own tempdir repo-root with its own tempdir HOME
# (so the secret path ~/.claude/.fidelity-secret resolves inside the case). Nothing
# touches the developer's real ~/.claude or any real repo.
set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
ARM="$HOOK_DIR/figma-fidelity-arm.sh"
STOP="$HOOK_DIR/figma-fidelity-stop.sh"
BG="$HOOK_DIR/bash-guard.sh"
fail=0

ck() { # desc want got
  local m="PASS"; [ "$2" != "$3" ] && { m="FAIL"; fail=1; }
  echo "[$m] want=$2 got=$3 : $1"
}

# bash-guard decision harness (matches test-figma-optout-block.sh conventions).
decision() {
  printf '%s' "$2" | ( cd "$3" && bash "$1" ) 2>/dev/null | python3 -c 'import json,sys
try: d=json.load(sys.stdin)
except: print("ALLOW"); sys.exit()
print("BLOCK" if d.get("hookSpecificOutput",{}).get("permissionDecision")=="deny" else "ALLOW")'
}
bcmd() { python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$1"; }

# arm <root> <home> <node> : fire the arm hook exactly as the harness does.
arm() {
  printf '{"tool_name":"mcp__plugin_figma_figma__get_design_context","tool_input":{"nodeId":"%s","fileKey":"k"}}' "$3" \
    | ( cd "$1" && HOME="$2" bash "$ARM" ) >/dev/null 2>&1
}

# gate <root> <home> : run the Stop gate, echo its exit code (0=pass, 2=block).
gate() {
  ( cd "$1" && HOME="$2" bash "$STOP" ) >/dev/null 2>&1
  echo $?
}

# manifest <root> [node...] : write a manifest whose checks each PASS validation and
# cover the given node ids. With no nodes, an empty-but-valid single placeholder.
manifest() {
  local root="$1"; shift
  echo g > "$root/f.css"
  python3 - "$root/.figma-fidelity.json" "$@" <<'PY'
import json, sys
path = sys.argv[1]
nodes = sys.argv[2:] or ["0:0"]
checks = [{
    "element": "el-%s" % n, "node": n, "property": "p",
    "figma": "1px", "measured": "1px", "dom": "1px", "dom_status": "read",
    "evidence": {"file": "f.css", "grep": "g"},
} for n in nodes]
json.dump({"checks": checks}, open(path, "w"))
PY
}

newcase() { R="$(mktemp -d)"; H="$(mktemp -d)"; }  # sets $R (repo) and $H (home)
ledger() { cat "$R/.figma-fidelity.ledger" 2>/dev/null; }
prevmac() { head -1 "$R/.figma-fidelity.ledger" | awk -F'|' '{print $5}'; }

# The arm hook only arms in a repo that ALREADY participates in the gate (a
# manifest / marker / measuring file exists), so every case seeds the manifest
# BEFORE arming - exactly the real order (a build pulls Figma into a gate repo).
echo "=== 1) normal flow: arm -> uncovered BLOCKS -> cover -> PASSES + signs resolve ==="
newcase
manifest "$R"                      # gate repo exists; 0:0 placeholder, 10:10 uncovered
arm "$R" "$H" "10:10"
ck "arm wrote a signed arm line"  1 "$(ledger | grep -c '^arm|10:10|')"
ck "secret is 0600"               600 "$(stat -f '%Lp' "$H/.claude/.fidelity-secret" 2>/dev/null)"
ck "arm wrote the head anchor"    1 "$([ -f "$R/.figma-fidelity.ledger.head" ] && echo 1 || echo 0)"
ck "uncovered -> BLOCK"           2 "$(gate "$R" "$H")"
manifest "$R" "10:10"             # now covered
ck "covered  -> PASS"             0 "$(gate "$R" "$H")"
ck "gate signed a resolve"        1 "$(ledger | grep -c '^resolve|10:10|')"
ck "gate cleared the marker"      0 "$([ -f "$R/.figma-fidelity.pending" ] && echo 1 || echo 0)"

echo "=== 2) THE Level-2 win: delete a .pending line, ledger still demands coverage ==="
newcase
manifest "$R" "20:20"                                   # cover only 20:20
arm "$R" "$H" "20:20"; arm "$R" "$H" "21:21"
grep -v '^21:21' "$R/.figma-fidelity.pending" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.pending"
ck "marker line 21:21 is gone"    0 "$(grep -c '^21:21' "$R/.figma-fidelity.pending")"
ck "gate STILL blocks (ledger)"   2 "$(gate "$R" "$H")"

echo "=== 3) delete the WHOLE marker file: a signed unresolved arm keeps the gate armed ==="
newcase
manifest "$R"                                           # 30:30 uncovered
arm "$R" "$H" "30:30"
rm -f "$R/.figma-fidelity.pending"
ck "marker file removed"          0 "$([ -f "$R/.figma-fidelity.pending" ] && echo 1 || echo 0)"
ck "gate STILL blocks (ledger)"   2 "$(gate "$R" "$H")"

echo "=== 4) forge a resolve with a valid chain-link but a bad HMAC -> BLOCK ==="
newcase
manifest "$R" "40:40"
arm "$R" "$H" "40:40"
printf 'resolve|40:40|2026-01-01T00:00:00Z|%s|deadbeefbadhmac\n' "$(prevmac)" >> "$R/.figma-fidelity.ledger"
ck "forged resolve -> BLOCK"      2 "$(gate "$R" "$H")"

echo "=== 5) edit an arm's node id to a COVERED node -> HMAC mismatch -> BLOCK ==="
newcase
manifest "$R" "1:1" "50:50"                             # 1:1 is covered; attacker retargets 50:50 -> 1:1
arm "$R" "$H" "50:50"
sed 's/|50:50|/|1:1|/' "$R/.figma-fidelity.ledger" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.ledger"
ck "edited arm id -> BLOCK"       2 "$(gate "$R" "$H")"

echo "=== 6) delete a middle/first ledger line -> chain break -> BLOCK ==="
newcase
manifest "$R" "60:60" "61:61"                           # both covered - only the chain is broken
arm "$R" "$H" "60:60"; arm "$R" "$H" "61:61"
tail -n +2 "$R/.figma-fidelity.ledger" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.ledger"
ck "deleted first ledger line -> BLOCK" 2 "$(gate "$R" "$H")"

echo "=== 6b) TAIL truncation (the Codex bypass): drop the last arm from marker AND ledger tail -> head anchor BLOCKS ==="
newcase
manifest "$R" "62:62"                                   # cover 62:62 only; 63:63 stays uncovered
arm "$R" "$H" "62:62"; arm "$R" "$H" "63:63"            # 63:63 is the ledger TAIL
grep -v '^63:63' "$R/.figma-fidelity.pending" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.pending"
head -n 1 "$R/.figma-fidelity.ledger" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.ledger"   # cut the tail line
ck "ledger truncated to 1 line"   1 "$(ledger | grep -c '^arm|')"
ck "chain prefix still verifies but head anchor catches the truncation -> BLOCK" 2 "$(gate "$R" "$H")"

echo "=== 6c) truncate the ONLY line to empty: 0-entry ledger vs count-1 head -> BLOCK ==="
newcase
manifest "$R"                                           # 64:64 uncovered
arm "$R" "$H" "64:64"
: > "$R/.figma-fidelity.ledger"                         # empty ledger; head still signs count=1
rm -f "$R/.figma-fidelity.pending"
ck "empty ledger vs stale head -> BLOCK" 2 "$(gate "$R" "$H")"

echo "=== 6d) delete the head anchor while the ledger remains -> BLOCK ==="
newcase
manifest "$R" "65:65"
arm "$R" "$H" "65:65"
rm -f "$R/.figma-fidelity.ledger.head"
ck "missing head anchor -> BLOCK" 2 "$(gate "$R" "$H")"

echo "=== 6e) forge the head anchor (plausible values, no valid HMAC) -> BLOCK ==="
newcase
manifest "$R" "66:66"
arm "$R" "$H" "66:66"
printf '1|%s|deadbeefbadheadhmac\n' "$(prevmac)" > "$R/.figma-fidelity.ledger.head"
ck "forged head anchor -> BLOCK"  2 "$(gate "$R" "$H")"

echo "=== 6f) delete the WHOLE ledger+head but leave the guarded marker -> .pending backstop still BLOCKS ==="
newcase
manifest "$R"                                           # 67:67 uncovered
arm "$R" "$H" "67:67"
rm -f "$R/.figma-fidelity.ledger" "$R/.figma-fidelity.ledger.head"
ck "marker still lists 67:67"     1 "$(grep -c '^67:67' "$R/.figma-fidelity.pending")"
ck "ledger wiped, marker backstops -> BLOCK" 2 "$(gate "$R" "$H")"

echo "=== 6g) LAUNDERING (Codex r2 walk): truncate tail, then re-arm a surviving node -> head NOT re-signed -> BLOCK ==="
newcase
manifest "$R" "68:68"                                   # cover 68:68; 69:69 stays uncovered
arm "$R" "$H" "68:68"; arm "$R" "$H" "69:69"            # 69:69 is the ledger TAIL
grep -v '^69:69' "$R/.figma-fidelity.pending" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.pending"
head -n 1 "$R/.figma-fidelity.ledger" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.ledger"
arm "$R" "$H" "68:68"                                   # re-arm the survivor to try to re-anchor the head
ck "re-arm did NOT launder the truncated head -> BLOCK" 2 "$(gate "$R" "$H")"

echo "=== 6h) LAUNDERING: truncate tail, then arm a NEW node -> append refuses on an inconsistent head -> BLOCK ==="
newcase
manifest "$R" "73:73"                                   # cover 73:73; 74:74 uncovered
arm "$R" "$H" "73:73"; arm "$R" "$H" "74:74"
grep -v '^74:74' "$R/.figma-fidelity.pending" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.pending"
head -n 1 "$R/.figma-fidelity.ledger" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.ledger"
arm "$R" "$H" "75:75"                                   # a real new pull, trying to re-anchor via a fresh append
ck "new arm did NOT append onto the tampered ledger" 1 "$(ledger | grep -c '^arm|')"
ck "tampered-base append refused -> BLOCK"           2 "$(gate "$R" "$H")"

echo "=== 6i) LAUNDERING: truncate tail AND delete head, then arm -> nonempty ledger with no valid head -> BLOCK ==="
newcase
manifest "$R" "76:76"
arm "$R" "$H" "76:76"; arm "$R" "$H" "77:77"
grep -v '^77:77' "$R/.figma-fidelity.pending" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.pending"
head -n 1 "$R/.figma-fidelity.ledger" > "$R/t" && mv "$R/t" "$R/.figma-fidelity.ledger"
rm -f "$R/.figma-fidelity.ledger.head"                  # also nuke the head to dodge the mismatch
arm "$R" "$H" "76:76"                                   # re-arm; head absent + nonempty ledger = inconsistent
ck "arm refused to recreate a head on a nonempty tampered ledger -> BLOCK" 2 "$(gate "$R" "$H")"

echo "=== 7) ledger present but signing secret missing -> cannot verify -> BLOCK ==="
newcase
manifest "$R" "70:70"
arm "$R" "$H" "70:70"
rm -f "$H/.claude/.fidelity-secret"
ck "missing secret -> BLOCK"      2 "$(gate "$R" "$H")"

echo "=== 8) idempotence: the same node armed twice is ONE ledger line ==="
newcase
manifest "$R"
arm "$R" "$H" "80:80"; arm "$R" "$H" "80:80"
ck "one arm line for 80:80"       1 "$(ledger | grep -c '^arm|80:80|')"

echo "=== 9) resolve persists: after a pass clears the marker, re-running is a no-op PASS ==="
newcase
manifest "$R" "90:90"
arm "$R" "$H" "90:90"
ck "first pass"                   0 "$(gate "$R" "$H")"          # signs resolve, rm's marker
ck "marker cleared"               0 "$([ -f "$R/.figma-fidelity.pending" ] && echo 1 || echo 0)"
ck "re-run on resolved ledger PASSES" 0 "$(gate "$R" "$H")"      # nothing unresolved -> exit 0

echo "=== 10) backward compat: a repo with NO ledger behaves exactly as before ==="
newcase
printf '5:5\n' > "$R/.figma-fidelity.pending"          # marker only, no ledger, no arm-hook
manifest "$R"                                          # 5:5 uncovered
ck "no-ledger uncovered -> BLOCK" 2 "$(gate "$R" "$H")"
manifest "$R" "5:5"
ck "no-ledger covered  -> PASS"   0 "$(gate "$R" "$H")"
ck "still no ledger created"      0 "$([ -f "$R/.figma-fidelity.ledger" ] && echo 1 || echo 0)"

echo "=== 11) empty repo: neither marker nor ledger -> gate is a no-op (exit 0) ==="
newcase
ck "no marker, no ledger -> PASS" 0 "$(gate "$R" "$H")"

echo "=== 12) defense in depth: bash-guard blocks reading the ledger signing secret ==="
D="$(mktemp -d)"
sg() { decision "$BG" "$(bcmd "$1")" "$D"; }
ck "cat ~/.claude/.fidelity-secret -> BLOCK"  BLOCK "$(sg 'cat ~/.claude/.fidelity-secret')"
ck "read via \$HOME -> BLOCK"                  BLOCK "$(sg 'cat "$HOME/.claude/.fidelity-secret"')"
ck "head absolute path -> BLOCK"              BLOCK "$(sg 'head -c 8 /Users/x/.claude/.fidelity-secret')"
ck "quoted-obfuscation read -> BLOCK"         BLOCK "$(sg 'cat ~/.claude/".fidelity-secret"')"
ck "normal manifest read -> ALLOW"            ALLOW "$(sg 'cat .figma-fidelity.json')"
ck "normal ls -> ALLOW"                       ALLOW "$(sg 'ls -la')"

echo
if [ "$fail" -eq 0 ]; then echo "ALL PASS"; else echo "SOME FAILED"; fi
exit "$fail"
