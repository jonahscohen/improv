#!/usr/bin/env bash
# Falsification suite for figma-fidelity-stop.sh.
# Every rule must be shown to BLOCK when violated and PASS when satisfied.
# A guard that cannot go red is not a guard.

GATE="/Users/spare3/Documents/Github/improv/claude/hooks/figma-fidelity-stop.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0; fail=0
report() { # name expected_rc actual_rc extra
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf '  ok   %-52s (exit %s)\n' "$1" "$3"
  else fail=$((fail+1)); printf '  FAIL %-52s expected %s got %s\n' "$1" "$2" "$3"; fi
}

# Build a root with one check, driven by a python dict literal.
mk() { # $1 = python expression producing the check dict; $2 = legacy_attested_count (optional)
  root="$TMP/$RANDOM$RANDOM"; mkdir -p "$root"
  printf 'CANARY\n' > "$root/.figma-fidelity.pending"
  printf 'border-radius: 10px\n' > "$root/evidence.css"
  python3 - "$root" "$1" "${2:-}" <<'PY'
import json,sys
root,expr,dec=sys.argv[1],sys.argv[2],sys.argv[3]
doc={"checks":[eval(expr)]}
if dec!="": doc["provenance"]={"legacy_attested_count":int(dec)}
json.dump(doc, open(root+"/.figma-fidelity.json","w"))
PY
  echo "$root"
}

BASE='{"element":"CANARY widget","node":"1:1","property":"border-radius","figma":"10px","measured":"10px","dom":"10px","dom_status":"read","evidence":{"file":"evidence.css","grep":"border-radius: 10px"}}'

run() { ( cd "$1" && bash "$GATE" 2>"$1/err.txt" ); echo $?; }

echo "=== the happy path must pass (else every red below is meaningless) ==="
r=$(mk "$BASE"); report "baseline: exact dom match" 0 "$(run "$r")"

echo
echo "=== rule 3: numeric tolerance (Blink quantum = 0.015625) ==="
r=$(mk "dict($BASE, dom='9.9922px')");  report "within quantum (delta 0.0078)" 0 "$(run "$r")"
r=$(mk "dict($BASE, dom='9.9845px')");  report "at the boundary (delta 0.0155)" 0 "$(run "$r")"
r=$(mk "dict($BASE, dom='9.98px')");    report "DRIFT beyond quantum (delta 0.02)" 2 "$(run "$r")"
r=$(mk "dict($BASE, dom='10.1px')");    report "DRIFT 0.1px" 2 "$(run "$r")"
r=$(mk "dict($BASE, figma='533.0775 / 415.8102', measured='533.0775 / 415.8102', dom='533.078 / 415.81')")
report "numeric pair (aspect-ratio) within tol" 0 "$(run "$r")"
r=$(mk "dict($BASE, figma='533.0775 / 415.8102', measured='533.0775 / 415.8102', dom='533.078 / 415.9')")
report "numeric pair, 2nd number drifts" 2 "$(run "$r")"

echo
echo "=== rule 2: colour equality ==="
r=$(mk "dict($BASE, property='color', figma='#12633E', measured='#12633E', dom='rgb(18, 99, 62)', evidence=dict(file='evidence.css', grep='border-radius'))")
report "hex == rgb()" 0 "$(run "$r")"
r=$(mk "dict($BASE, property='color', figma='#12633E', measured='#12633E', dom='rgb(18, 99, 63)', evidence=dict(file='evidence.css', grep='border-radius'))")
report "hex != rgb() by one channel" 2 "$(run "$r")"

echo
echo "=== rule 4: dom_equivalence must be GATE-VERIFIED, not free text ==="
r=$(mk "dict($BASE, property='letter-spacing', figma='0px', measured='0px', dom='normal', evidence=dict(file='evidence.css', grep='border-radius'))")
report "kind mismatch WITHOUT equivalence (the v1 hole)" 2 "$(run "$r")"
r=$(mk "dict($BASE, property='letter-spacing', figma='0px', measured='0px', dom='normal', dom_equivalence='Chrome serialises 0 as normal', evidence=dict(file='evidence.css', grep='border-radius'))")
report "0px <-> normal WITH equivalence (gate-verified)" 0 "$(run "$r")"
grep -q 'declared dom_equivalence' "$r/err.txt" && echo "       (and the equivalence is printed, not hidden)"
r=$(mk "dict($BASE, property='letter-spacing', figma='normal', measured='normal', dom='0px', dom_equivalence='0 serialises to normal, either way', evidence=dict(file='evidence.css', grep='border-radius'))")
report "normal <-> 0px reverse direction is verified too" 0 "$(run "$r")"
# THE v2 HOLE-CLOSURE: a bogus free-text justification must NOT rescue a real
# mismatch. Under the pre-2026-08-28 code every one of these returned 0 (passed).
r=$(mk "dict($BASE, property='margin', figma='10px', measured='10px', dom='24px', dom_equivalence='these are basically the same', evidence=dict(file='evidence.css', grep='border-radius'))")
report "REAL mismatch + bogus prose no longer passes" 2 "$(run "$r")"
r=$(mk "dict($BASE, property='color', figma='#000000', measured='#000000', dom='#ffffff', dom_equivalence='close enough', evidence=dict(file='evidence.css', grep='border-radius'))")
report "black vs white + 'close enough' blocks" 2 "$(run "$r")"
r=$(mk "dict($BASE, property='letter-spacing', figma='2px', measured='2px', dom='normal', dom_equivalence='basically normal', evidence=dict(file='evidence.css', grep='border-radius'))")
report "2px is NOT zero: equivalence is value-sensitive" 2 "$(run "$r")"
# Codex 2026-08-28: zero<->normal is PROPERTY-scoped. `normal` computes to 0 only
# for letter-spacing/word-spacing; for line-height normal is ~1.2x (NOT zero), and
# margin has no `normal` at all. Those pairs must NOT be rescued by the note.
r=$(mk "dict($BASE, property='word-spacing', figma='0px', measured='0px', dom='normal', dom_equivalence='word-spacing normal is 0', evidence=dict(file='evidence.css', grep='border-radius'))")
report "word-spacing 0px <-> normal is verified (allowlisted)" 0 "$(run "$r")"
r=$(mk "dict($BASE, property='line-height', figma='0px', measured='0px', dom='normal', dom_equivalence='0 is normal', evidence=dict(file='evidence.css', grep='border-radius'))")
report "line-height 0px <-> normal BLOCKS (normal != 0 here)" 2 "$(run "$r")"
r=$(mk "dict($BASE, property='margin', figma='0px', measured='0px', dom='normal', dom_equivalence='same thing', evidence=dict(file='evidence.css', grep='border-radius'))")
report "margin 0px <-> normal BLOCKS (margin has no normal)" 2 "$(run "$r")"

echo
echo "=== dom_status enum ==="
r=$(mk "{k:v for k,v in $BASE.items() if k!='dom_status'}")
report "no dom_status at all" 2 "$(run "$r")"
r=$(mk "dict($BASE, dom_status='not_read')");        report "dom_status=not_read" 2 "$(run "$r")"
r=$(mk "dict($BASE, dom_status='definitely_read')"); report "unknown dom_status" 2 "$(run "$r")"
r=$(mk "{k:v for k,v in dict($BASE, dom_status='read').items() if k!='dom'}")
report "dom_status=read but no dom value" 2 "$(run "$r")"
r=$(mk "dict($BASE, dom_status='read_independent')"); report "read_independent" 0 "$(run "$r")"
grep -q '1 independently read' "$r/err.txt" && echo "       (and it is counted as independent)"

echo
echo "=== not_a_dom_property ==="
r=$(mk "dict({k:v for k,v in $BASE.items() if k!='dom'}, dom_status='not_a_dom_property', note='svg path in a file')")
report "not_a_dom_property + note, no dom" 0 "$(run "$r")"
r=$(mk "dict($BASE, dom_status='not_a_dom_property', note='x')")
report "not_a_dom_property but a dom value present" 2 "$(run "$r")"
r=$(mk "dict({k:v for k,v in $BASE.items() if k!='dom'}, dom_status='not_a_dom_property')")
report "not_a_dom_property without a note" 2 "$(run "$r")"

echo
echo "=== legacy_attested: accepted, counted, rejected under STRICT ==="
r=$(mk "dict({k:v for k,v in $BASE.items() if k!='dom'}, dom_status='legacy_attested')" 1)
report "legacy_attested (declared) passes" 0 "$(run "$r")"
grep -q 'legacy_attested' "$r/err.txt" && echo "       (and the debt is reported on stderr)"
r2=$(mk "dict({k:v for k,v in $BASE.items() if k!='dom'}, dom_status='legacy_attested')" 1)
rc=$( cd "$r2" && FIGMA_FIDELITY_STRICT=1 bash "$GATE" 2>/dev/null; echo $? )
report "legacy_attested BLOCKS under STRICT=1" 2 "$rc"

echo
echo "=== the original invariants still hold ==="
r=$(mk "dict($BASE, measured='12px')");  report "figma != measured" 2 "$(run "$r")"
r=$(mk "dict($BASE, evidence=dict(file='evidence.css', grep='border-radius: 99px'))")
report "evidence grep absent from the file" 2 "$(run "$r")"
r=$(mk "dict($BASE, evidence=dict(file='nope.css', grep='x'))")
report "evidence file missing" 2 "$(run "$r")"
r=$(mk "dict($BASE, element='other thing')")
report "manifest does not cover the marker token" 2 "$(run "$r")"

echo
echo "=== THE ACCUSATION BUG: an unreadable manifest must name no component ==="
r=$(mk "$BASE"); python3 -c "
import sys
p=sys.argv[1]+'/.figma-fidelity.json'
d=open(p).read()
open(p,'w').write(d[:len(d)//2])   # truncate mid-object, exactly what a racing reader sees
" "$r"
rc=$(run "$r"); report "truncated manifest blocks" 2 "$rc"
if grep -qi 'CANARY widget\|border-radius' "$r/err.txt"; then
  fail=$((fail+1)); echo "  FAIL truncated manifest NAMED A COMPONENT:"; sed 's/^/       /' "$r/err.txt"
else
  pass=$((pass+1)); echo "  ok   truncated manifest names no component"
fi
grep -q 'manifest unreadable' "$r/err.txt" && echo "       (reported as a gate failure, not a fidelity failure)"

r=$(mk "$BASE"); : > "$r/.figma-fidelity.json"
rc=$(run "$r"); report "empty manifest blocks" 2 "$rc"
grep -qi 'CANARY widget' "$r/err.txt" && { fail=$((fail+1)); echo "  FAIL empty manifest named a component"; } || { pass=$((pass+1)); echo "  ok   empty manifest names no component"; }

echo
echo "=== legacy_attested must not be a hiding place ==="
r=$(mk "dict($BASE, dom='10.9px', dom_status='legacy_attested')" 1)
report "legacy_attested with a DISAGREEING dom still blocks" 2 "$(run "$r")"
r=$(mk "dict($BASE, dom='10px', dom_status='legacy_attested')" 1)
report "legacy_attested with an agreeing dom passes" 0 "$(run "$r")"

echo
echo "=== the legacy debt is a ratchet: it may shrink, never grow ==="
mkratchet() { # $1 = n legacy rows, $2 = declared ceiling (empty = absent)
  root="$TMP/r$RANDOM$RANDOM"; mkdir -p "$root"
  printf 'CANARY\n' > "$root/.figma-fidelity.pending"
  printf 'border-radius: 10px\n' > "$root/evidence.css"
  python3 - "$root" "$1" "$2" <<'PY'
import json,sys
root,n,dec=sys.argv[1],int(sys.argv[2]),sys.argv[3]
base=dict(element="CANARY widget",node="1:1",property="border-radius",
          figma="10px",measured="10px",
          evidence=dict(file="evidence.css",grep="border-radius: 10px"))
checks=[dict(base,dom_status="legacy_attested") for _ in range(n)]
checks.append(dict(base,dom="10px",dom_status="read"))
doc={"checks":checks}
if dec!="": doc["provenance"]={"legacy_attested_count":int(dec)}
json.dump(doc, open(root+"/.figma-fidelity.json","w"))
PY
  echo "$root"
}
r=$(mkratchet 3 3); report "legacy == declared ceiling" 0 "$(run "$r")"
r=$(mkratchet 2 3); report "legacy BELOW ceiling (debt shrank)" 0 "$(run "$r")"
grep -q 'debt shrank' "$r/err.txt" && echo "       (and it tells you to lower the ceiling)"
r=$(mkratchet 4 3); report "legacy ABOVE ceiling (debt grew)" 2 "$(run "$r")"
grep -q 'may only shrink' "$r/err.txt" && echo "       (named as debt growth, not as a component defect)"
r=$(mkratchet 1 ""); report "legacy row with NO declared ceiling" 2 "$(run "$r")"

echo
echo "=== regex / ladder edge cases (a ladder that over-matches is a hole) ==="
r=$(mk "dict($BASE, figma='10px 20px', measured='10px 20px', dom='20px 10px', evidence=dict(file='evidence.css', grep='border-radius'))")
report "order matters: '10px 20px' != '20px 10px'" 2 "$(run "$r")"
r=$(mk "dict($BASE, figma='10px', measured='10px', dom='10.0px', evidence=dict(file='evidence.css', grep='border-radius'))")
report "'10px' == '10.0px' (same number, different spelling)" 0 "$(run "$r")"
r=$(mk "dict($BASE, figma='-10px', measured='-10px', dom='10px', evidence=dict(file='evidence.css', grep='border-radius'))")
report "sign matters: '-10px' != '10px'" 2 "$(run "$r")"
r=$(mk "dict($BASE, property='color', figma='#12633E', measured='#12633E', dom='rgba(18, 99, 62, 0.5)', evidence=dict(file='evidence.css', grep='border-radius'))")
report "alpha matters: opaque hex != 50% alpha rgba" 2 "$(run "$r")"
r=$(mk "dict($BASE, property='color', figma='rgb(18, 99, 62)', measured='rgb(18, 99, 62)', dom='rgb(18.9, 99, 62)', evidence=dict(file='evidence.css', grep='border-radius'))")
report "colour channel 18.9 vs 18 must not truncate-match" 2 "$(run "$r")"
r=$(mk "dict($BASE, figma='1 / 2', measured='1 / 2', dom='1 / 2 / 3', evidence=dict(file='evidence.css', grep='border-radius'))")
report "different number COUNT does not match" 2 "$(run "$r")"

echo
echo "=== Codex review 2026-07-10: the gate must FAIL CLOSED on a crash ==="
# Claude Code blocks a Stop only on exit 2. Any other non-zero code lets the turn
# end, so an unhandled exception used to be a free pass.
mkraw() { # $1 = python expression for the whole document
  root="$TMP/x$RANDOM$RANDOM"; mkdir -p "$root"
  printf 'CANARY\n' > "$root/.figma-fidelity.pending"
  printf 'border-radius: 10px\n' > "$root/evidence.css"
  python3 - "$root" "$1" <<'PY'
import json,sys
json.dump(eval(sys.argv[2]), open(sys.argv[1]+"/.figma-fidelity.json","w"))
PY
  echo "$root"
}
r=$(mkraw "{'checks':[$BASE],'provenance':[]}")
report "provenance is a list" 2 "$(run "$r")"
r=$(mkraw "{'checks':[dict($BASE, figma='rgb(1,2,3)', measured='rgb(1,2,3)', dom='rgb(1..2,2,3)', evidence=dict(file='evidence.css', grep='border-radius'))]}")
report "unparseable colour channel" 2 "$(run "$r")"
r=$(mkraw "{'checks':[dict($BASE, evidence=['x'])]}")
report "evidence is a list (schema error, named not crashed)" 2 "$(run "$r")"
r=$(mkraw "{'checks':[dict($BASE, figma=10, measured=10)]}")
report "figma is a JSON number (schema error)" 2 "$(run "$r")"

# The guards above all resolve to a clean block, so NONE of them exercises the
# shell net any more. That net is what stands between an unforeseen exception and
# a free pass, and it must be tested where no schema guard can reach it: force
# python3 itself to exit non-zero.
shimtest() { # $1 = exit code the fake python3 returns
  root="$TMP/s$RANDOM$RANDOM"; mkdir -p "$root/bin"
  printf 'CANARY\n' > "$root/.figma-fidelity.pending"
  printf '{"checks":[]}' > "$root/.figma-fidelity.json"
  printf '#!/bin/sh\nexit %s\n' "$1" > "$root/bin/python3"
  chmod +x "$root/bin/python3"
  ( cd "$root" && PATH="$root/bin:$PATH" bash "$GATE" 2>/dev/null ); echo $?
}
report "python3 exits 1 (unhandled exception) => gate BLOCKS" 2 "$(shimtest 1)"
report "python3 exits 7 (killed/OOM/anything)  => gate BLOCKS" 2 "$(shimtest 7)"
report "python3 exits 2 (deliberate block)     => gate BLOCKS" 2 "$(shimtest 2)"

echo
echo "=== Codex: ratchet type confusion (isinstance(True, int) is True) ==="
r=$(mkraw "{'checks':[dict($BASE, dom_status='legacy_attested')],'provenance':{'legacy_attested_count':True}}")
report "legacy_attested_count: true is not a count" 2 "$(run "$r")"
r=$(mkraw "{'checks':[$BASE],'provenance':{'legacy_attested_count':-1}}")
report "legacy_attested_count: -1 is a schema error" 2 "$(run "$r")"
r=$(mkraw "{'checks':[$BASE],'provenance':{'legacy_attested_count':1.5}}")
report "legacy_attested_count: 1.5 is a schema error" 2 "$(run "$r")"

echo
echo "=== Codex: a failing check must not be deletable ==="
r=$(mkraw "{'checks':[$BASE],'provenance':{'checks_count':2}}")
report "one check present, floor declares 2" 2 "$(run "$r")"
r=$(mkraw "{'checks':[$BASE],'provenance':{'checks_count':1}}")
report "check count meets the floor" 0 "$(run "$r")"

echo
echo "=== Codex: tolerance must not apply to non-px units, nor accumulate ==="
r=$(mk "dict($BASE, figma='rotate(45deg)', measured='rotate(45deg)', dom='rotate(45.0157deg)', evidence=dict(file='evidence.css', grep='border-radius'))")
report "45deg vs 45.0157deg (a degree is not a px quantum)" 2 "$(run "$r")"
r=$(mk "dict($BASE, figma='calc(10px + 2px)', measured='calc(10px + 2px)', dom='calc(10.0157px + 2.0157px)', evidence=dict(file='evidence.css', grep='border-radius'))")
report "calc(): per-number slack sums to 0.0314px" 2 "$(run "$r")"
r=$(mk "dict($BASE, figma='50%', measured='50%', dom='50.0157%', evidence=dict(file='evidence.css', grep='border-radius'))")
report "percent is not tolerant" 2 "$(run "$r")"
r=$(mk "dict($BASE, figma='10px', measured='10px', dom='10em', evidence=dict(file='evidence.css', grep='border-radius'))")
report "unit must match: 10px != 10em" 2 "$(run "$r")"

echo
echo "=== Codex: malformed numbers must not tokenise into a match ==="
r=$(mk "dict($BASE, figma='1.2.3', measured='1.2.3', dom='1.2.300', evidence=dict(file='evidence.css', grep='border-radius'))")
report "'1.2.3' vs '1.2.300' (adjacent numbers)" 2 "$(run "$r")"
r=$(mk "dict($BASE, figma='١px', measured='١px', dom='1px', evidence=dict(file='evidence.css', grep='border-radius'))")
report "arabic-indic digit must not equal ascii '1'" 2 "$(run "$r")"

echo
echo "=== Codex: coverage must not match vacuously ==="
cover() { # $1 marker token, $2 element, $3 node
  root="$TMP/c$RANDOM$RANDOM"; mkdir -p "$root"
  printf '%s\n' "$1" > "$root/.figma-fidelity.pending"
  printf 'border-radius: 10px\n' > "$root/evidence.css"
  python3 - "$root" "$2" "$3" <<'PY'
import json,sys
root,el,node=sys.argv[1],sys.argv[2],sys.argv[3]
json.dump({"checks":[dict(element=el,node=node,property="p",figma="10px",
  measured="10px",dom="10px",dom_status="read",
  evidence=dict(file="evidence.css",grep="border-radius: 10px"))]},
  open(root+"/.figma-fidelity.json","w"))
PY
  echo "$root"
}
r=$(cover "card" "discarded component" "1:1");        report "'card' must not match 'discarded component'" 2 "$(run "$r")"
r=$(cover "hero" "heroine bio" "1:1");                report "'hero' must not match 'heroine bio'" 2 "$(run "$r")"
r=$(cover "858:1143" "x" "858:11438");                report "'858:1143' must not match node '858:11438'" 2 "$(run "$r")"
r=$(cover "site-footer" "site-footerless fake" "1:1");report "'site-footer' must not match 'site-footerless fake'" 2 "$(run "$r")"
r=$(cover "text-image" "text-image-alt photo" "1:1"); report "'text-image' must not cover 'text-image-alt'" 2 "$(run "$r")"
r=$(cover "text-image" "text-image band background" "1:1"); report "'text-image' DOES cover 'text-image band ...'" 0 "$(run "$r")"
r=$(cover "site-footer" "site-footer background" "1:1");    report "'site-footer' DOES cover its own check" 0 "$(run "$r")"

echo
echo "=== the documented LIMIT: fabrication passes. This must stay true. ==="
r=$(mk "dict($BASE, figma='777px', measured='777px', dom='777px', evidence=dict(file='evidence.css', grep='border-radius'))")
report "mirror (dom := figma) PASSES - only a human/independent read catches this" 0 "$(run "$r")"

echo
echo "=== marker lifecycle ==="
r=$(mk "$BASE"); run "$r" >/dev/null
[ -f "$r/.figma-fidelity.pending" ] && { fail=$((fail+1)); echo "  FAIL marker not cleared on pass"; } || { pass=$((pass+1)); echo "  ok   marker cleared on pass"; }
r=$(mk "dict($BASE, dom='10.1px')"); run "$r" >/dev/null
[ -f "$r/.figma-fidelity.pending" ] && { pass=$((pass+1)); echo "  ok   marker RETAINED on block"; } || { fail=$((fail+1)); echo "  FAIL marker cleared on block"; }
r=$(mk "$BASE"); rm -f "$r/.figma-fidelity.pending"
report "no marker => gate is inert (exit 0)" 0 "$(run "$r")"

echo
echo "================================================================"
printf 'passed %d, failed %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
