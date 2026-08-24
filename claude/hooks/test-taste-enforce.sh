#!/bin/bash
# Test suite for the SECOND, precision-gated, human-signed ENFORCE gate (the security-critical half).
# Covers:
#   sidecoach/bin/sidecoach-taste-enforce.js         - enforce/approve/check/verify-ledger/audit/list
#   sidecoach/eval/taste-enforce-precision.mjs        - held-out precision gate (pass / under-floor / stale)
#   claude/hooks/sidecoach-taste-enforce-arm.sh       - the UserPromptSubmit mint (enforce-confirm model)
#   claude/hooks/bash-guard.sh                        - enforce-token + enforce-secret + arm-exec Bash fences
#   claude/hooks/content-guard.sh                     - enforce-token + enforce-secret Write/Edit fences
#
# The safety-critical properties:
#   (a) an AGENT write of the enforce token / ledger secret is BLOCKED by the guards; an agent cannot
#       EXECUTE the arm hook (any form)
#   (b) enforce WITHOUT a valid token is REFUSED (exit 5)
#   (c) enforce WITH a token minted the sanctioned way (the ARM HOOK) flips the rule INTO the enforced
#       (blocking) tier, chains an enforcement-ledger entry, consumes the token single-use, replay fails
#   (d) enforce REFUSED (exit 7) when held-out precision is under threshold OR the denominator is under
#       floor - the two-gate precision bar
#   (e) a rule that is NOT guidance-promoted is REFUSED (exit 12)
#   (f) a hand-tampered enforcement ledger (field edit, tail truncation, forged head) is DETECTED
#   (g) the precision-digest binding: a spec swapped after sign-off is REFUSED (fresh digest != token)
#   (h) the build gate: a failing build rolls back the enforced file (exit 13); the ledger entry stays
#       a safe orphan (audit shows it)
#   (i) promote fences still work (no regression)
#
# The enforce flow runs entirely under SIDECOACH_ENFORCE_TEST_ROOT; guard-block checks name the REAL
# token/secret paths but write nothing.
#
# Run: bash claude/hooks/test-taste-enforce.sh

set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
SC="$REPO_ROOT/sidecoach"
CLI="$SC/bin/sidecoach-taste-enforce.js"
HARNESS="$SC/eval/taste-enforce-precision.mjs"
ARM="$HOOK_DIR/sidecoach-taste-enforce-arm.sh"
PROMOTE_ARM="$HOOK_DIR/sidecoach-taste-promote-arm.sh"
BG="$HOOK_DIR/bash-guard.sh"
CG="$HOOK_DIR/content-guard.sh"
PASS=0; FAIL=0; FAILS=()

pass(){ echo "PASS: $1"; PASS=$((PASS+1)); }
fail(){ echo "FAIL: $1"; FAILS+=("$1"); FAIL=$((FAIL+1)); }
ck(){ if [ "$2" = "$3" ]; then pass "$1 (exit $3)"; else fail "$1 (expected $2, got $3)"; fi; }
ckt(){ if [ "$2" = "0" ]; then pass "$1"; else fail "$1"; fi; }

[ -f "$CLI" ] || { echo "FATAL: CLI not found at $CLI"; exit 2; }
[ -f "$HARNESS" ] || { echo "FATAL: harness not found at $HARNESS"; exit 2; }
[ -f "$ARM" ] || { echo "FATAL: arm hook not found at $ARM"; exit 2; }
node -c "$CLI" 2>/dev/null && pass "CLI parses as valid JS" || fail "CLI has a JS syntax error"
bash -n "$ARM" 2>/dev/null && pass "arm hook parses" || fail "arm hook has a syntax error"
bash -n "$BG" 2>/dev/null && pass "bash-guard parses" || fail "bash-guard syntax error"
bash -n "$CG" 2>/dev/null && pass "content-guard parses" || fail "content-guard syntax error"

# The interpreter dist must exist for the precision harness to run.
DIST="$SC/dist/validators/checks/pattern-interpreter.js"
if [ ! -f "$DIST" ]; then
  echo "dist interpreter missing - building sidecoach once ..."
  ( cd "$SC" && npm run build >/dev/null 2>&1 ) || { echo "FATAL: build failed, cannot run precision harness"; exit 2; }
fi

# ---- module export invariant: requiring the CLI must expose NOTHING
EXPORTS=$(node -e 'const m=require(process.argv[1]);process.stdout.write(Object.keys(m).join(","))' "$CLI" 2>/dev/null)
[ -z "$EXPORTS" ] && pass "module exports nothing (no require-reachable mint/secret)" || fail "module exports: $EXPORTS"

# ---------------------------------------------------------------------------
# Sandbox - ONE env var relocates the whole apparatus. Low precision floors so a compact fixture
# corpus clears the bar (the floor MECHANISM is tested separately via the under-floor case).
# ---------------------------------------------------------------------------
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
export SIDECOACH_ENFORCE_TEST_ROOT="$SB"
export SIDECOACH_ENFORCE_PRECISION_CACHE="$SB/pcache"
export SIDECOACH_ENFORCE_CORPUS_BASE="$SB"
export SIDECOACH_ENFORCE_NEGATIVES_DIR="$SB/neg"
export SIDECOACH_ENFORCE_MIN_HELDOUT_POSITIVES=3
export SIDECOACH_ENFORCE_MIN_FIRES=3
export SIDECOACH_ENFORCE_PRECISION_THRESHOLD=0.90
export TASTE_ENFORCE_CONSENT_TTL=120
export SIDECOACH_ENFORCE_BUILD_CMD=true          # fast no-op build gate for the happy path
mkdir -p "$SB/corpus" "$SB/neg" "$SB/guidance/craft-corpus"

TOKEN="$SB/.taste-rule-enforce-consent"
SECRET="$SB/.taste-enforce-ledger-secret"
LEDGER="$SB/enforcement-ledger.jsonl"
HEAD="$SB/enforcement-ledger.jsonl.head"
PROMLEDGER="$SB/promotion-ledger.jsonl"

# corpus: positives carry the defect marker, negatives are clean.
mk_corpus(){  # $1 = number of positives ; $2 = number of held-out negatives ; $3 = number that FALSELY fire
  local np="$1" nn="$2" nfp="${3:-0}" i
  rm -f "$SB/corpus/"*.html "$SB/neg/"*.html
  for i in $(seq 1 "$np"); do printf '<!doctype html><html><body><div class="c" data-fires>pos %s</div></body></html>' "$i" > "$SB/corpus/pos-$i.html"; done
  for i in $(seq 1 "$nn"); do printf '<!doctype html><html><body><div class="c">neg %s</div></body></html>' "$i" > "$SB/corpus/neg-$i.html"; done
  # false-positive negatives: labeled clean but they DO carry the marker (the detector wrongly fires)
  for i in $(seq 1 "$nfp"); do printf '<!doctype html><html><body><div class="c" data-fires>fp %s</div></body></html>' "$i" > "$SB/corpus/fp-$i.html"; done
  # a shared clean negative in the negatives dir
  printf '<!doctype html><html><body><div class="c">shared clean</div></body></html>' > "$SB/neg/shared-1.html"
}

# write a guidance rule (already-promoted shape) + its promotion-ledger entry.
write_guidance(){  # $1 = ruleId ; $2 = number of positives ; $3 = held-out negatives ; $4 = false-fire negatives
  local id="$1" np="$2" nn="$3" nfp="${4:-0}"
  mk_corpus "$np" "$nn" "$nfp"
  python3 - "$SB/guidance/craft-corpus/$id.json" "$id" "$np" "$nn" "$nfp" <<'PY'
import json,sys
out,rid,np,nn,nfp=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5])
pos=[{"id":f"p{i}","file":f"corpus/pos-{i}.html","label":"fires","labeledBy":"codex","split":"heldout"} for i in range(1,np+1)]
neg=[{"id":f"n{i}","file":f"corpus/neg-{i}.html","label":"clean","labeledBy":"codex","split":"heldout"} for i in range(1,nn+1)]
neg+=[{"id":f"fp{i}","file":f"corpus/fp-{i}.html","label":"clean","labeledBy":"codex","split":"heldout"} for i in range(1,nfp+1)]
rec={"ruleId":rid,
  "rule":{"ruleId":rid,"canonicalRuleKey":f"mined/{rid}","sourceVocabulary":"mined-taste","severity":"minor",
    "findingClass":"polish","evidenceRequirements":["css-rule"],
    "patternSpec":{"specVersion":1,"engine":"static-css-regex",
      "applicability":{"anyOf":["class\\s*="],"scope":"markup"},
      "defect":{"anyOf":[{"pattern":"data-fires","flags":"i"}]},
      "message":"generated-ui fires marker present","evidenceScope":"markup"},
    "exampleCorpus":{"positives":pos,"negatives":neg}},
  "provenance":{"source":"internal-audit-history","commit":"abc1234","retrieved_utc":"2026-08-24T00:00:00Z"},
  "_promotion":{"candidateId":rid,"promotedTo":"craft-corpus","approvedBy":"human"}}
json.dump(rec,open(out,"w"),indent=2)
PY
  # promotion-ledger entry (the enforce gate only checks existence of candidateId + store)
  python3 -c "import json,sys;open(sys.argv[1],'a').write(json.dumps({'candidateId':sys.argv[2],'store':'craft-corpus'})+'\n')" "$PROMLEDGER" "$id"
}

# compute the precision-digest exactly as the enforce CLI will (same env, same rule file).
digest_of(){ node "$HARNESS" measure "$1" --rule-file "$SB/guidance/craft-corpus/$1.json" --base-dir "$SB" --negatives-dir "$SB/neg" --json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["precisionDigest"])'; }
# mint the token via the REAL arm hook, exactly as the user REPL confirm would.
arm(){ local d; d=$(digest_of "$1"); printf '{"prompt":"enforce-confirm %s %s"}' "$1" "$d" | bash "$ARM"; }

emit_bash(){  python3 -c 'import json,sys;print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$1"; }
emit_write(){ python3 -c 'import json,sys;print(json.dumps({"tool_name":sys.argv[3],"tool_input":{"file_path":sys.argv[1],"content":sys.argv[2]}}))' "$1" "$2" "${3:-Write}"; }
denies(){ echo "$1" | grep -q '"deny"'; }

TOKREAL="$HOME/.claude/.taste-rule-enforce-consent"
SECREAL="$HOME/.claude/.taste-enforce-ledger-secret"
PROMTOKREAL="$HOME/.claude/.taste-rule-promote-consent"

echo; echo "===== (a) an AGENT write of the enforce token / ledger secret is BLOCKED ====="
denies "$(emit_bash "echo forged > $TOKREAL" | bash "$BG")"   && pass "bash-guard: echo> enforce token blocked"   || fail "bash-guard: echo> enforce token NOT blocked"
denies "$(emit_bash "cp /tmp/x $TOKREAL" | bash "$BG")"       && pass "bash-guard: cp-> enforce token blocked"     || fail "bash-guard: cp-> enforce token NOT blocked"
denies "$(emit_bash "echo k > $SECREAL" | bash "$BG")"        && pass "bash-guard: write enforce secret blocked"   || fail "bash-guard: write enforce secret NOT blocked"
denies "$(emit_bash "cat $SECREAL" | bash "$BG")"             && pass "bash-guard: read enforce secret blocked"    || fail "bash-guard: read enforce secret NOT blocked"
denies "$(emit_write "$TOKREAL" "x" Write | bash "$CG")"      && pass "content-guard: Write enforce token (full path) blocked" || fail "content-guard: Write enforce token NOT blocked"
denies "$(emit_write ".taste-rule-enforce-consent" "x" Write | bash "$CG")" && pass "content-guard: Write enforce token (basename) blocked" || fail "content-guard: Write enforce token (basename) NOT blocked"
denies "$(emit_write "$SECREAL" "k" Edit | bash "$CG")"       && pass "content-guard: Edit enforce secret (full path) blocked" || fail "content-guard: Edit enforce secret NOT blocked"
denies "$(emit_write ".taste-enforce-ledger-secret" "k" Write | bash "$CG")" && pass "content-guard: Write enforce secret (basename) blocked" || fail "content-guard: Write enforce secret (basename) NOT blocked"
denies "$(emit_bash "node $CLI enforce foo" | bash "$BG")"    && fail "bash-guard: running the CLI wrongly blocked" || pass "bash-guard: running the CLI is allowed"
# test-root token/secret keep the guarded basename, so an agent write to them is still fenced
denies "$(emit_write "$TOKEN" "x" Write | bash "$CG")"        && pass "content-guard: test-root enforce token still blocked" || fail "content-guard: test-root enforce token NOT blocked"
denies "$(emit_write "$SECRET" "k" Write | bash "$CG")"       && pass "content-guard: test-root enforce secret still blocked" || fail "content-guard: test-root enforce secret NOT blocked"

echo; echo "===== an AGENT cannot RUN the enforce arm hook directly, ANY form (bash-guard) ====="
denies "$(emit_bash "bash $ARM" | bash "$BG")"                && pass "bash-guard: 'bash <arm>' blocked"          || fail "bash-guard: 'bash <arm>' NOT blocked"
denies "$(emit_bash "$ARM" | bash "$BG")"                     && pass "bash-guard: direct '<arm>' exec blocked"   || fail "bash-guard: direct arm exec NOT blocked"
denies "$(emit_bash "/bin/bash $ARM" | bash "$BG")"           && pass "bash-guard: '/bin/bash <arm>' blocked"     || fail "bash-guard: '/bin/bash <arm>' NOT blocked"
denies "$(emit_bash "printf x | bash $ARM" | bash "$BG")"     && pass "bash-guard: piped 'bash <arm>' blocked"    || fail "bash-guard: piped arm exec NOT blocked"
denies "$(emit_bash "env FOO=1 /bin/bash $ARM" | bash "$BG")" && pass "bash-guard: 'env FOO=1 /bin/bash <arm>' blocked" || fail "bash-guard: env-prefixed arm NOT blocked"
denies "$(emit_bash "{ bash $ARM; }" | bash "$BG")"           && pass "bash-guard: brace-group arm exec blocked"  || fail "bash-guard: brace-group arm exec NOT blocked"
denies "$(emit_bash ". $ARM" | bash "$BG")"                   && pass "bash-guard: dot-source arm exec blocked"   || fail "bash-guard: dot-source arm exec NOT blocked"
denies "$(emit_bash "cat $ARM" | bash "$BG")"                 && fail "bash-guard: reading the arm hook wrongly blocked" || pass "bash-guard: reading the arm hook (cat) is allowed"
denies "$(emit_bash "git add $ARM" | bash "$BG")"             && fail "bash-guard: 'git add <arm>' wrongly blocked" || pass "bash-guard: staging the arm hook (git add) is allowed"

echo; echo "===== CRITICAL #1 (Codex): the arm-hook basename hidden in a VARIABLE still BLOCKS ====="
# H=<arm>; bash claude/hooks/$H - the name is in $H so it never reaches the segment being run; the
# hooks-dir path-prefix rule (CASE B) catches it. $H must stay UNEXPANDED, so single-quote at assign.
BYP1='H=sidecoach-taste-enforce-arm.sh; bash claude/hooks/$H'
BYP2='X=sidecoach-taste-enforce-arm.sh; source claude/hooks/$X'
BYP3='H=sidecoach-taste-enforce-arm.sh; /bin/bash ~/.claude/hooks/$H'
BYP4='H=sidecoach-taste-enforce-arm.sh; eval bash claude/hooks/$H'
denies "$(emit_bash "$BYP1" | bash "$BG")" && pass "bash-guard: 'H=<arm>; bash claude/hooks/\$H' BLOCKED" || fail "bash-guard: H-var arm exec NOT blocked"
denies "$(emit_bash "$BYP2" | bash "$BG")" && pass "bash-guard: 'source claude/hooks/\$X' BLOCKED" || fail "bash-guard: source H-var NOT blocked"
denies "$(emit_bash "$BYP3" | bash "$BG")" && pass "bash-guard: '/bin/bash ~/.claude/hooks/\$H' BLOCKED" || fail "bash-guard: homedir H-var NOT blocked"
denies "$(emit_bash "$BYP4" | bash "$BG")" && pass "bash-guard: 'eval bash claude/hooks/\$H' BLOCKED" || fail "bash-guard: eval H-var NOT blocked"
# a PLAIN test-script run (no arm name, no variable) must stay allowed - the path-prefix rule must not
# over-block. Uses a non-arm hooks-dir path with no '$'.
denies "$(emit_bash "bash claude/hooks/test-taste-enforce.sh" | bash "$BG")" && fail "bash-guard: running a hooks-dir test script wrongly blocked" || pass "bash-guard: 'bash claude/hooks/test-*.sh' (no arm name) allowed"

echo; echo "===== CRITICAL #2 (Codex): a STRING-CONSTRUCTED token/secret name still BLOCKS ====="
CON1="node -e \"require('fs').writeFileSync(process.env.HOME+'/.claude/.taste'+'-rule-enforce-consent','x')\""
CON2="python3 -c \"open('.taste-rule-enforce-cons'+'ent','w')\""
CON3="node -e \"const s='.taste-enforce-ledger-sec'+'ret'\""
denies "$(emit_bash "$CON1" | bash "$BG")" && pass "bash-guard: constructed .claude/.taste token path BLOCKED" || fail "bash-guard: constructed token path NOT blocked"
denies "$(emit_bash "$CON2" | bash "$BG")" && pass "bash-guard: enforce-token STEM (taste-rule-enforce) BLOCKED" || fail "bash-guard: enforce-token stem NOT blocked"
denies "$(emit_bash "$CON3" | bash "$BG")" && pass "bash-guard: enforce-secret STEM (taste-enforce-ledger) BLOCKED" || fail "bash-guard: enforce-secret stem NOT blocked"
# legit CLI + harness runs must NOT be caught by the stem/dir fences
denies "$(emit_bash "node $CLI enforce foo" | bash "$BG")"          && fail "bash-guard: enforce CLI run wrongly blocked by the stem fence" || pass "bash-guard: enforce CLI run still allowed"
denies "$(emit_bash "node $HARNESS measure r --rule-file x" | bash "$BG")" && fail "bash-guard: precision harness run wrongly blocked" || pass "bash-guard: precision harness run still allowed"

echo; echo "===== (i) promote fences still work (regression) ====="
denies "$(emit_bash "echo x > $PROMTOKREAL" | bash "$BG")"    && pass "bash-guard: promote token still blocked"   || fail "bash-guard: promote token NOT blocked"
denies "$(emit_bash "bash $PROMOTE_ARM" | bash "$BG")"        && pass "bash-guard: promote arm exec still blocked" || fail "bash-guard: promote arm exec NOT blocked"
denies "$(emit_write "$PROMTOKREAL" "x" Write | bash "$CG")"  && pass "content-guard: promote token still blocked" || fail "content-guard: promote token NOT blocked"

echo; echo "===== arm hook: only the exact whole-prompt confirm mints ====="
write_guidance rule-arm 4 2 0
rm -f "$TOKEN"; arm rule-arm >/dev/null 2>&1
[ -f "$TOKEN" ]; ckt "arm hook mints the token on 'enforce-confirm <id> <digest>'" "$?"
rm -f "$TOKEN"; DIG=$(digest_of rule-arm); printf '{"prompt":"please enforce-confirm rule-arm %s now"}' "$DIG" | bash "$ARM" >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "a sentence merely CONTAINING the phrase does NOT mint" "$?"
rm -f "$TOKEN"; printf '{"prompt":"enforce-confirm rule-arm"}' | bash "$ARM" >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "a 2-token phrase (no digest) does NOT mint" "$?"
rm -f "$TOKEN"; printf '{"prompt":"enforce-confirm rule-arm NOTAHEXDIGEST"}' | bash "$ARM" >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "a non-hex digest does NOT mint" "$?"
rm -f "$TOKEN"; printf '{"prompt":"enforce-confirm ../../etc/evil %s"}' "$(printf 'a%.0s' {1..64})" | bash "$ARM" >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "an unsafe id does NOT mint" "$?"

echo; echo "===== (e) a rule that is NOT guidance-promoted is REFUSED (12) ====="
rm -f "$TOKEN"
node "$CLI" enforce never-promoted >/dev/null 2>&1; ck "un-promoted rule refused" 12 "$?"

echo; echo "===== (b) enforce WITHOUT a token is REFUSED (5) ====="
write_guidance rule-b 4 2 0
rm -f "$TOKEN"
node "$CLI" enforce rule-b >/dev/null 2>&1; ck "enforce with no token refused" 5 "$?"

echo; echo "===== (d) precision under FLOOR is REFUSED (7) - only 2 held-out positives, floor is 3 ====="
write_guidance rule-floor 2 1 0
arm rule-floor >/dev/null 2>&1   # even a token cannot save an under-floor rule
node "$CLI" enforce rule-floor >/dev/null 2>&1; ck "under-floor precision refused" 7 "$?"

echo; echo "===== (d) precision under THRESHOLD is REFUSED (7) - 3 TP + 2 false-firing negatives => P=0.6 ====="
write_guidance rule-lowp 3 1 2
arm rule-lowp >/dev/null 2>&1
node "$CLI" enforce rule-lowp >/dev/null 2>&1; ck "under-threshold precision refused" 7 "$?"

echo; echo "===== (c) enforce WITH a sanctioned token: flip + ledger + consume + replay ====="
write_guidance rule-c 4 2 0
node "$CLI" check rule-c >/dev/null 2>&1; ck "check reports no token before arming" 5 "$?"
arm rule-c
node "$CLI" check rule-c >/dev/null 2>&1; ck "check reports a token after arming" 0 "$?"
node "$CLI" enforce rule-c >/dev/null 2>&1; ck "enforce with a valid token succeeds" 0 "$?"
[ -f "$SB/enforced-rules/rule-c.json" ]; ckt "rule flipped INTO the enforced (blocking) tier" "$?"
python3 -c "import json,sys;o=json.load(open(sys.argv[1]));sys.exit(0 if o['rule']['severity'] in ('major','blocker') else 1)" "$SB/enforced-rules/rule-c.json"; ckt "enforced rule carries a BLOCKING severity" "$?"
[ ! -f "$TOKEN" ]; ckt "token consumed (single-use, file gone)" "$?"
node "$CLI" verify-ledger >/dev/null 2>&1; ck "enforcement ledger chain + head verify after enforce" 0 "$?"
grep -q '"ruleId":"rule-c"' "$LEDGER"; ckt "enforcement ledger records the rule" "$?"
node "$CLI" audit >/dev/null 2>&1; ck "audit clean after a real enforce" 0 "$?"
# replay: re-arm + enforce the same rule -> durable ledger replay guard
arm rule-c
node "$CLI" enforce rule-c >/dev/null 2>&1; ck "replay of an already-enforced rule refused" 11 "$?"

echo; echo "===== (g) precision-digest binding: a spec swapped after sign-off is REFUSED (5) ====="
write_guidance rule-swap 4 2 0
arm rule-swap                                   # token binds the digest of the CURRENT spec/corpus
python3 - "$SB/guidance/craft-corpus/rule-swap.json" <<'PY'
import sys,json
p=sys.argv[1]; o=json.load(open(p))
o["rule"]["patternSpec"]["message"]="SWAPPED after sign-off"   # changes specHash -> changes the digest
json.dump(o, open(p,"w"))
PY
node "$CLI" enforce rule-swap >/dev/null 2>&1; ck "spec-swapped-after-signoff refused (digest mismatch)" 5 "$?"
[ ! -f "$SB/enforced-rules/rule-swap.json" ]; ckt "the swapped rule did NOT reach the enforced tier" "$?"

echo; echo "===== (h) build gate: a FAILING build rolls back the enforced file (13) ====="
write_guidance rule-badbuild 4 2 0
arm rule-badbuild
SIDECOACH_ENFORCE_BUILD_CMD=false node "$CLI" enforce rule-badbuild >/dev/null 2>&1; ck "failing build gate reports build-failed" 13 "$?"
[ ! -f "$SB/enforced-rules/rule-badbuild.json" ]; ckt "enforced file was ROLLED BACK on build failure" "$?"
grep -q '"ruleId":"rule-badbuild"' "$LEDGER"; ckt "the ledger entry remains a safe orphan after rollback" "$?"
node "$CLI" audit >/dev/null 2>&1; ck "audit still clean (orphan is safe, not a discrepancy)" 0 "$?"

echo; echo "===== HIGH (Codex): SIDECOACH_ENFORCE_BUILD_CMD is honored ONLY under a test root ====="
# POSITIVE: under a test root, a custom build cmd IS honored - it writes a marker on the successful path.
write_guidance rule-bcmd 4 2 0
arm rule-bcmd
rm -f "$SB/buildmarker"
SIDECOACH_ENFORCE_BUILD_CMD="touch $SB/buildmarker" node "$CLI" enforce rule-bcmd >/dev/null 2>&1; ck "under test root, custom build cmd runs (enforce succeeds)" 0 "$?"
[ -f "$SB/buildmarker" ]; ckt "under test root, the custom build cmd was actually executed (marker written)" "$?"
# NEGATIVE (structural - a real no-test-root enforce would touch the live repo, so assert the guard in
# source): the buildCmd resolution REQUIRES SIDECOACH_ENFORCE_TEST_ROOT before honoring the override, so
# in production `SIDECOACH_ENFORCE_BUILD_CMD=true enforce <id>` cannot skip the real `npm run build`.
grep -Eq "SIDECOACH_ENFORCE_TEST_ROOT[[:space:]]*&&[[:space:]]*process\.env\.SIDECOACH_ENFORCE_BUILD_CMD" "$CLI"; ckt "buildCmd override is gated on SIDECOACH_ENFORCE_TEST_ROOT (ignored in production)" "$?"
grep -Eq "'npm run build'" "$CLI"; ckt "the production build cmd is the real 'npm run build' fallback" "$?"

echo; echo "===== (f) a hand-tampered enforcement ledger is DETECTED ====="
cp "$LEDGER" "$SB/ledger.bak"; cp "$HEAD" "$SB/head.bak"
# f1: flip a signed field in entry 0
python3 - "$LEDGER" <<'PY'
import sys,json
p=sys.argv[1]; ls=open(p).read().splitlines()
o=json.loads(ls[0]); o["precision"]=0.0; ls[0]=json.dumps(o)
open(p,"w").write("\n".join(ls)+"\n")
PY
node "$CLI" verify-ledger >/dev/null 2>&1; ck "verify detects a field tamper" 8 "$?"
node "$CLI" audit >/dev/null 2>&1;         ck "audit detects a field tamper" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"
# f2: tail truncation - delete last line, keep head
python3 - "$LEDGER" <<'PY'
import sys
p=sys.argv[1]; ls=open(p).read().splitlines()
open(p,"w").write(("\n".join(ls[:-1])+"\n") if len(ls)>1 else "")
PY
node "$CLI" verify-ledger >/dev/null 2>&1; ck "verify detects tail truncation (head anchor)" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"
# f3: forge the head to match a truncated ledger (bad head sig)
python3 - "$LEDGER" "$HEAD" <<'PY'
import sys
lp,hp=sys.argv[1],sys.argv[2]
ls=open(lp).read().splitlines()
open(lp,"w").write((ls[0]+"\n") if ls else "")
open(hp,"w").write("1|deadbeef|deadbeefsig\n")
PY
node "$CLI" verify-ledger >/dev/null 2>&1; ck "verify detects a forged head anchor" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"
node "$CLI" verify-ledger >/dev/null 2>&1; ck "ledger restored and verifies again" 0 "$?"
# f4: separator-redistribution across signed fields must NOT verify
python3 - "$LEDGER" <<'PY'
import sys,json
p=sys.argv[1]; ls=open(p).read().splitlines()
o=json.loads(ls[0]); o["ruleId"]=o["ruleId"]+"|X"; o["store"]="Y|"+o["store"]
ls[0]=json.dumps(o); open(p,"w").write("\n".join(ls)+"\n")
PY
node "$CLI" verify-ledger >/dev/null 2>&1; ck "verify detects separator-redistribution tamper" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"
# f5: a post-enforce CONTENT swap of the enforced file (id preserved) is DETECTED by audit
GF="$SB/enforced-rules/rule-c.json"
cp "$GF" "$SB/rule-c.gf.bak"
python3 - "$GF" <<'PY'
import sys,json
p=sys.argv[1]; o=json.load(open(p))
o["rule"]["injected"]="evil-after-enforce"
json.dump(o, open(p,"w"))
PY
node "$CLI" audit >/dev/null 2>&1; ck "audit detects a post-enforce content swap" 9 "$?"
cp "$SB/rule-c.gf.bak" "$GF"
node "$CLI" audit >/dev/null 2>&1; ck "audit clean after restoring enforced content" 0 "$?"
# f6: an UN-BLESSED enforced rule (no ledger entry) is flagged
cat > "$SB/enforced-rules/sneaked-in.json" <<'JSON'
{ "ruleId":"sneaked-in", "rule":{"ruleId":"sneaked-in","severity":"major","sourceVocabulary":"mined-taste"} }
JSON
node "$CLI" audit >/dev/null 2>&1; ck "audit flags an un-blessed enforced rule" 9 "$?"
rm -f "$SB/enforced-rules/sneaked-in.json"
node "$CLI" audit >/dev/null 2>&1; ck "audit clean again after removing it" 0 "$?"

echo; echo "===== HIGH #2 (Codex): a ledger entry with NO content_digest is an AUDIT FAILURE (9) ====="
# An HMAC-VALID row that simply lacks content_digest (legacy/migrated/forged) must NOT escape content
# binding. Build one in a fresh sub-root: sign it with THAT root's secret so the HMAC chain verifies,
# leaving content_digest OUT. Audit must then fail on the MISSING content_digest, not pass.
SB2="$(mktemp -d)"; mkdir -p "$SB2/enforced-rules"
node "$CLI" verify-ledger >/dev/null 2>&1   # NOTE: uses $SB secret; we use SB2's own below
SIDECOACH_ENFORCE_TEST_ROOT="$SB2" node "$CLI" verify-ledger >/dev/null 2>&1   # creates $SB2 secret
cat > "$SB2/enforced-rules/rule-nocd.json" <<'JSON'
{ "ruleId":"rule-nocd", "rule":{"ruleId":"rule-nocd","severity":"major","sourceVocabulary":"mined-taste"},
  "_enforcement":{"ruleId":"rule-nocd","store":"craft-corpus"} }
JSON
python3 - "$SB2/.taste-enforce-ledger-secret" "$SB2/enforcement-ledger.jsonl" "$SB2/enforcement-ledger.jsonl.head" <<'PY'
import sys,json,hmac,hashlib
secret=open(sys.argv[1]).read().strip()
GEN="taste-enforcement-ledger:genesis"
def mac(body): return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
# entry OMITS content_digest; sign the fixed-order array with null in that slot (matches JS undefined)
entry={"ruleId":"rule-nocd","store":"craft-corpus","precision_digest":"p"*64,"precision":0.95,
       "source":"s","commit":"c","retrieved_utc":"t","approvedBy":"human","approved_utc":"t",
       "token_mac":"m","prev_mac":GEN}
body=json.dumps([entry["ruleId"],entry["store"],None,entry["precision_digest"],entry["precision"],
                 entry["source"],entry["commit"],entry["retrieved_utc"],entry["approvedBy"],
                 entry["approved_utc"],entry["token_mac"],entry["prev_mac"]],separators=(',',':'))
entry["mac"]=mac(body)
open(sys.argv[2],"w").write(json.dumps(entry)+"\n")
open(sys.argv[3],"w").write("1|%s|%s\n"%(entry["mac"], mac("1|"+entry["mac"])))
PY
SIDECOACH_ENFORCE_TEST_ROOT="$SB2" node "$CLI" verify-ledger >/dev/null 2>&1; ck "the hand-signed chain itself VERIFIES (HMAC valid, content_digest just absent)" 0 "$?"
SIDECOACH_ENFORCE_TEST_ROOT="$SB2" node "$CLI" audit >/dev/null 2>&1; ck "audit FAILS on a missing content_digest (HIGH #2)" 9 "$?"
rm -rf "$SB2"

echo; echo "===== precision harness: stale-cache guard (6) ====="
digest_of rule-c >/dev/null 2>&1   # writes a fresh stamped cache
python3 -c "import json,sys;p=sys.argv[1];o=json.load(open(p));o['buildStamp']='deadbeefdeadbeef';json.dump(o,open(p,'w'))" "$SB/pcache/rule-c.json"
node "$HARNESS" verify-cache rule-c >/dev/null 2>&1; ck "verify-cache detects a stale cache" 6 "$?"

echo; echo "===== MEDIUM #3 (Codex): the precision floor env overrides are honored ONLY under a test root ====="
# A tiny corpus (2 held-out positives) with MIN floors env-set to 0. Under a test root the override is
# honored -> it PASSES; in PRODUCTION the override is IGNORED (fixed floor 8) -> it REFUSES under-floor.
M3="$SB/m3"; mkdir -p "$M3/corpus"
for i in 1 2; do printf '<!doctype html><html><body><div class="c" data-fires>p%s</div></body></html>' "$i" > "$M3/corpus/pos-$i.html"; done
python3 - "$M3/rule.json" <<'PY'
import json,sys
pos=[{"id":f"p{i}","file":f"corpus/pos-{i}.html","label":"fires","labeledBy":"codex","split":"heldout"} for i in (1,2)]
json.dump({"rule":{"ruleId":"m3","patternSpec":{"specVersion":1,"engine":"static-css-regex","applicability":{"anyOf":["class\\s*="],"scope":"markup"},"defect":{"anyOf":[{"pattern":"data-fires"}]},"message":"m","evidenceScope":"markup"},"exampleCorpus":{"positives":pos,"negatives":[]}}}, open(sys.argv[1],"w"))
PY
# under a test root, MIN_*=0 honored -> passes (exit 0)
SIDECOACH_ENFORCE_TEST_ROOT="$M3" SIDECOACH_ENFORCE_MIN_HELDOUT_POSITIVES=0 SIDECOACH_ENFORCE_MIN_FIRES=0 SIDECOACH_ENFORCE_PRECISION_CACHE="$M3/pc" \
  node "$HARNESS" measure m3 --rule-file "$M3/rule.json" --base-dir "$M3" >/dev/null 2>&1; ck "test root: MIN_*=0 override honored (tiny corpus passes)" 0 "$?"
# production (no test root), the SAME env override is IGNORED (fixed floor 8) -> under-floor REFUSE (7)
env -u SIDECOACH_ENFORCE_TEST_ROOT SIDECOACH_ENFORCE_MIN_HELDOUT_POSITIVES=0 SIDECOACH_ENFORCE_MIN_FIRES=0 SIDECOACH_ENFORCE_PRECISION_CACHE="$M3/pc" \
  node "$HARNESS" measure m3 --rule-file "$M3/rule.json" --base-dir "$M3" >/dev/null 2>&1; ck "production: MIN_*=0 override IGNORED (fixed floor 8 -> under-floor REFUSE)" 7 "$?"

echo; echo "===== STRUCTURAL fail-closed: the enforcer imports nothing from guidance/enforced/ledger ====="
if grep -rEn "require\(.*(data/guidance|data/enforced-rules|enforcement-ledger|promotion-ledger)" "$SC/src" >/dev/null 2>&1; then
  fail "a sidecoach/src file IMPORTS the guidance/enforced/ledger data tier (structural leak)"
else
  pass "no sidecoach/src file imports the guidance dir, enforced tier, or either ledger"
fi

echo; echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then printf 'FAILED: %s\n' "${FAILS[@]}"; exit 1; fi
exit 0
