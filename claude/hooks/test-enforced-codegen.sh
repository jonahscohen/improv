#!/bin/bash
# Phase 3c integration test: the ledger-gated CODEGEN that crosses a certified enforced rule into LIVE
# blocking code, WITHOUT breaking the safety model.
#
# PART A (C1) - end to end against a REAL enforce:
#   - seed a valid enforced rule via the enforce CLI (real ledger + enforced file + precision cache),
#   - generate-enforced-rules emits it at BLOCKING severity and its patternSpec FIRES via the interpreter,
#   - a TAMPERED enforcement ledger -> generation FAILS (audit) -> build breaks,
#   - a STALE/absent precision record -> generation FAILS (precision gate) -> build breaks,
#   - --check catches a drifted generated file.
# PART B (C2/C3) - the generated module -> registry, off-by-default:
#   - a certified rule seeded into the generated module is present in RULES (C2),
#   - WITHOUT the per-project opt-in it is ADVISORY (non-blocking); WITH it, it is MAJOR (blocking) (C3).
#
# Run: bash claude/hooks/test-enforced-codegen.sh

set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
SC="$REPO_ROOT/sidecoach"
ENFORCE_CLI="$SC/bin/sidecoach-taste-enforce.js"
GEN="$SC/scripts/generate-enforced-rules.ts"
ARM="$HOOK_DIR/sidecoach-taste-enforce-arm.sh"
HARNESS="$SC/eval/taste-enforce-precision.mjs"
DISTI="$SC/dist/validators/checks/pattern-interpreter.js"
PASS=0; FAIL=0; FAILS=()
pass(){ echo "PASS: $1"; PASS=$((PASS+1)); }
fail(){ echo "FAIL: $1"; FAILS+=("$1"); FAIL=$((FAIL+1)); }
ck(){ if [ "$2" = "$3" ]; then pass "$1 (exit $3)"; else fail "$1 (expected $2, got $3)"; fi; }
ckt(){ if [ "$2" = "0" ]; then pass "$1"; else fail "$1"; fi; }

[ -f "$DISTI" ] || ( cd "$SC" && npm run build >/dev/null 2>&1 ) || { echo "FATAL: build failed"; exit 2; }

SB="$(mktemp -d)"
export SIDECOACH_ENFORCE_TEST_ROOT="$SB"
export SIDECOACH_ENFORCE_PRECISION_CACHE="$SB/pcache"
export SIDECOACH_ENFORCE_CORPUS_BASE="$SB"
export SIDECOACH_ENFORCE_NEGATIVES_DIR="$SB/neg"
export SIDECOACH_ENFORCE_MIN_HELDOUT_POSITIVES=3
export SIDECOACH_ENFORCE_MIN_FIRES=3
export SIDECOACH_ENFORCE_PRECISION_THRESHOLD=0.90
export TASTE_ENFORCE_CONSENT_TTL=120
export SIDECOACH_ENFORCE_BUILD_CMD=true
mkdir -p "$SB/corpus" "$SB/neg" "$SB/guidance/craft-corpus"
GENFILE="$SC/src/validators/enforced-rules.generated.ts"
GENBAK="$SB/generated.bak"
cp "$GENFILE" "$GENBAK"
# Restore the real generated module + clean the sandbox no matter how we exit (Part B writes the real path).
trap 'cp "$GENBAK" "$GENFILE"; rm -rf "$SB"' EXIT

write_guidance(){  # $1 id ; $2 positives ; $3 negatives
  local id="$1" np="$2" nn="$3" i
  rm -f "$SB/corpus/"*.html "$SB/neg/"*.html
  for i in $(seq 1 "$np"); do printf '<!doctype html><html><body><div class="c" data-fires>pos %s</div></body></html>' "$i" > "$SB/corpus/pos-$i.html"; done
  for i in $(seq 1 "$nn"); do printf '<!doctype html><html><body><div class="c">neg %s</div></body></html>' "$i" > "$SB/corpus/neg-$i.html"; done
  printf '<!doctype html><html><body><div class="c">shared clean</div></body></html>' > "$SB/neg/shared-1.html"
  python3 - "$SB/guidance/craft-corpus/$id.json" "$id" "$np" "$nn" <<'PY'
import json,sys
out,rid,np,nn=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4])
pos=[{"id":f"p{i}","file":f"corpus/pos-{i}.html","label":"fires","labeledBy":"codex","split":"heldout"} for i in range(1,np+1)]
neg=[{"id":f"n{i}","file":f"corpus/neg-{i}.html","label":"clean","labeledBy":"codex","split":"heldout"} for i in range(1,nn+1)]
rec={"ruleId":rid,
  "rule":{"ruleId":rid,"canonicalRuleKey":f"mined/{rid}","sourceVocabulary":"mined-taste","severity":"minor",
    "sourceSeverity":"medium","findingClass":"polish","ownerValidatorId":"polish-standard","registryScope":f"mined-{rid}",
    "narrowTargetBehavior":"evaluate_expanded_context","applicability":"not_applicable",
    "evidenceRequirements":["css-rule"],"supportedSourceKinds":[{"kind":"css","level":"full"}],"scope":"file",
    "patternSpec":{"specVersion":1,"engine":"static-css-regex",
      "applicability":{"anyOf":["class\\s*="],"scope":"markup"},
      "defect":{"anyOf":[{"pattern":"data-fires","flags":"i"}]},
      "message":"generated-ui fires marker present","evidenceScope":"markup"},
    "exampleCorpus":{"positives":pos,"negatives":neg}},
  "provenance":{"source":"internal-audit-history","commit":"abc1234","retrieved_utc":"2026-08-24T00:00:00Z"},
  "_promotion":{"candidateId":rid,"promotedTo":"craft-corpus","approvedBy":"human"}}
json.dump(rec,open(out,"w"),indent=2)
PY
  python3 -c "import json,sys;open(sys.argv[1],'a').write(json.dumps({'candidateId':sys.argv[2],'store':'craft-corpus'})+'\n')" "$SB/promotion-ledger.jsonl" "$id"
}
digest_of(){ node "$HARNESS" measure "$1" --rule-file "$SB/guidance/craft-corpus/$1.json" --base-dir "$SB" --negatives-dir "$SB/neg" --json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["precisionDigest"])'; }
arm(){ local d; d=$(digest_of "$1"); printf '{"prompt":"enforce-confirm %s %s"}' "$1" "$d" | bash "$ARM"; }

echo "===== PART A (C1): real enforce -> codegen certifies + fires ====="
write_guidance rule-c 4 2
arm rule-c
node "$ENFORCE_CLI" enforce rule-c >/dev/null 2>&1; ck "enforce a valid rule succeeds" 0 "$?"
[ -f "$SB/enforced-rules/rule-c.json" ]; ckt "enforced file exists" "$?"

GENOUT="$SB/gen.ts"
( cd "$SC" && npx ts-node "$GEN" --out "$GENOUT" >/dev/null 2>&1 ); ck "codegen emits a module for the valid enforced tier" 0 "$?"
grep -q '"ruleId": "rule-c"' "$GENOUT"; ckt "generated module contains the certified rule" "$?"
grep -q '"severity": "major"' "$GENOUT"; ckt "certified rule is at BLOCKING severity major" "$?"
grep -q 'exampleCorpus' "$GENOUT" && fail "exampleCorpus wrongly inlined into the live module" || pass "exampleCorpus dropped from the live module"

# The certified rule's patternSpec FIRES via the interpreter on a matching page (proves it is runnable live).
FIRES=$(node -e '
const fs=require("fs");
const gen=fs.readFileSync(process.argv[1],"utf8");
const m=gen.match(/ENFORCED_RULES: ProductRuleDefinition\[\] = (\[[\s\S]*?\]);/);
const rules=JSON.parse(m[1]);
const {interpretPatternSpec}=require(process.argv[2]);
const spec=rules[0].patternSpec;
const ctx={cssText:"",markup:"<div class=\"c\" data-fires>x</div>",files:[{path:"i.html",sourceKind:"html",cssText:"",markup:"<div class=\"c\" data-fires>x</div>",evidenceKindsPresent:["markup"]}]};
process.stdout.write(interpretPatternSpec(spec,ctx).status);
' "$GENOUT" "$DISTI" 2>/dev/null)
[ "$FIRES" = "fail" ]; ckt "the certified rule FIRES (status fail) on a matching page via the interpreter" "$?"

echo "===== PART A (C1): a TAMPERED ledger -> generation FAILS (build breaks) ====="
cp "$SB/enforcement-ledger.jsonl" "$SB/ledger.bak"; cp "$SB/enforcement-ledger.jsonl.head" "$SB/head.bak"
python3 - "$SB/enforcement-ledger.jsonl" <<'PY'
import sys,json
p=sys.argv[1]; ls=open(p).read().splitlines()
o=json.loads(ls[0]); o["precision"]=0.0; ls[0]=json.dumps(o)
open(p,"w").write("\n".join(ls)+"\n")
PY
( cd "$SC" && npx ts-node "$GEN" --out "$SB/gen2.ts" >/dev/null 2>&1 ); ck "tampered ledger -> codegen FAILS non-zero (audit)" 3 "$?"
cp "$SB/ledger.bak" "$SB/enforcement-ledger.jsonl"; cp "$SB/head.bak" "$SB/enforcement-ledger.jsonl.head"

echo "===== PART A (C1/MEDIUM#4): a post-enforce CONTENT SWAP of the enforced file -> generation FAILS (content_digest) ====="
cp "$SB/enforced-rules/rule-c.json" "$SB/rule-c.enf.bak"
python3 - "$SB/enforced-rules/rule-c.json" <<'PY'
import sys,json
p=sys.argv[1]; o=json.load(open(p))
o["rule"]["injected"]="evil-after-enforce"   # changes the substantive content -> content_digest mismatch
json.dump(o, open(p,"w"))
PY
( cd "$SC" && npx ts-node "$GEN" --out "$SB/genswap.ts" >/dev/null 2>&1 ); ck "content-swapped enforced file -> codegen FAILS non-zero (audit content_digest)" 3 "$?"
cp "$SB/rule-c.enf.bak" "$SB/enforced-rules/rule-c.json"

echo "===== PART A (C1): a STALE precision record -> generation FAILS ====="
python3 -c "import json,sys;p=sys.argv[1];o=json.load(open(p));o['buildStamp']='staleaaaaaaaaaaa';json.dump(o,open(p,'w'))" "$SB/pcache/rule-c.json"
( cd "$SC" && npx ts-node "$GEN" --out "$SB/gen3.ts" >/dev/null 2>&1 ); ck "stale precision record -> codegen FAILS non-zero (precision gate)" 4 "$?"
# restore the fresh precision cache
digest_of rule-c >/dev/null 2>&1
echo "===== PART A (C1): an ABSENT precision record -> generation FAILS ====="
mv "$SB/pcache/rule-c.json" "$SB/pcache/rule-c.json.hidden"
( cd "$SC" && npx ts-node "$GEN" --out "$SB/gen4.ts" >/dev/null 2>&1 ); ck "absent precision record -> codegen FAILS non-zero" 4 "$?"
mv "$SB/pcache/rule-c.json.hidden" "$SB/pcache/rule-c.json"

echo "===== PART A (Caveat B): a REWRITTEN cache (claims a floor its signed digest was NOT for) -> FAILS ====="
cp "$SB/pcache/rule-c.json" "$SB/pcache/rule-c.json.bak"
# Rewrite a floor field WITHOUT touching the stored precisionDigest. The codegen RE-COMPUTES the digest
# from the (now-lying) fields; the recompute no longer matches the ledger's signed digest -> reject.
python3 -c "import json,sys;p=sys.argv[1];o=json.load(open(p));o['minFires']=o['minFires']+50;o['minHeldoutPositives']=o['minHeldoutPositives']+50;json.dump(o,open(p,'w'))" "$SB/pcache/rule-c.json"
( cd "$SC" && npx ts-node "$GEN" --out "$SB/genB.ts" >/dev/null 2>&1 ); ck "cache floor-field rewritten (digest recompute mismatch) -> codegen FAILS non-zero" 4 "$?"
cp "$SB/pcache/rule-c.json.bak" "$SB/pcache/rule-c.json"
( cd "$SC" && npx ts-node "$GEN" --out "$SB/genBok.ts" >/dev/null 2>&1 ); ck "codegen OK again after restoring the honest cache" 0 "$?"

echo "===== PART A (C1): --check catches drift ====="
( cd "$SC" && npx ts-node "$GEN" --out "$SB/committed.ts" >/dev/null 2>&1 )
( cd "$SC" && npx ts-node "$GEN" --check --out "$SB/committed.ts" >/dev/null 2>&1 ); ck "--check clean against a fresh generated file" 0 "$?"
# enforce a SECOND rule so the committed file is now stale
write_guidance rule-d 4 2
arm rule-d
node "$ENFORCE_CLI" enforce rule-d >/dev/null 2>&1
( cd "$SC" && npx ts-node "$GEN" --check --out "$SB/committed.ts" >/dev/null 2>&1 ); ck "--check DETECTS drift after a new enforce" 1 "$?"

echo "===== PART B (C2/C3): seeded generated module -> registry, off-by-default ====="
cat > "$GENFILE" <<'TS'
// GENERATED test seed - restored by the test trap.
import type { ProductRuleDefinition } from '../product-rule-types';
export const ENFORCED_RULES: ProductRuleDefinition[] = [
  {
    "ruleId": "mined.seeded-live",
    "sourceRuleAliases": ["mined:mined.seeded-live"],
    "canonicalRuleKey": "mined/seeded-live",
    "ownerValidatorId": "polish-standard",
    "sourceVocabulary": "mined-taste",
    "sourceSeverity": "medium",
    "severity": "major",
    "severityOverrideReason": "enforced mined-taste rule (test seed)",
    "findingClass": "polish",
    "registryScope": "enforced-mined.seeded-live",
    "evidenceRequirements": ["css-rule"],
    "supportedSourceKinds": [{ "kind": "css", "level": "full" }],
    "scope": "file",
    "narrowTargetBehavior": "evaluate_expanded_context",
    "applicability": "not_applicable",
    "patternSpec": { "specVersion": 1, "engine": "static-css-regex", "applicability": { "anyOf": ["class\\s*="], "scope": "markup" }, "defect": { "anyOf": [{ "pattern": "data-fires", "flags": "i" }] }, "message": "seed", "evidenceScope": "markup" }
  }
];
export const ENFORCED_RULE_IDS: string[] = ["mined.seeded-live"];
TS
# Import the registry via ts-node --transpile-only (compiles src on the fly, sees the seeded generated
# module) - no build, so the build's generate-enforced-rules --check (which reads the DEFAULT empty
# enforced tier) is never involved. The GLOBAL master toggle (flag file) drives blocking, and the REAL
# toggle hook flips it - end to end.
TBFLAG="$SB/.taste-blocking-enabled"
TBHOOK="$REPO_ROOT/claude/hooks/taste-blocking-toggle.sh"
SEVQ='const {getRuleById}=require("./src/product-rule-registry");const r=getRuleById("mined.seeded-live");process.stdout.write(r?r.severity:"ABSENT");'
rm -f "$TBFLAG"   # DEFAULT = OFF = advisory
SEV_OFF=$(cd "$SC" && TASTE_BLOCKING_FLAG_FILE="$TBFLAG" npx ts-node --transpile-only -e "$SEVQ" 2>/dev/null)
[ "$SEV_OFF" = "advisory" ]; ckt "C2+C3 DEFAULT (toggle OFF): seeded live rule is PRESENT in RULES and ADVISORY (non-blocking)" "$?"
printf '{"prompt":"taste blocking on"}' | TASTE_BLOCKING_FLAG_FILE="$TBFLAG" bash "$TBHOOK" >/dev/null 2>&1
[ -f "$TBFLAG" ]; ckt "toggle hook flips blocking ON (flag created on 'taste blocking on')" "$?"
SEV_ON=$(cd "$SC" && TASTE_BLOCKING_FLAG_FILE="$TBFLAG" npx ts-node --transpile-only -e "$SEVQ" 2>/dev/null)
[ "$SEV_ON" = "major" ]; ckt "toggle ON: the SAME seeded live rule is MAJOR (blocking)" "$?"
printf '{"prompt":"taste blocking off"}' | TASTE_BLOCKING_FLAG_FILE="$TBFLAG" bash "$TBHOOK" >/dev/null 2>&1
[ ! -f "$TBFLAG" ]; ckt "toggle hook flips blocking OFF (flag removed on 'taste blocking off')" "$?"
SEV_BACK=$(cd "$SC" && TASTE_BLOCKING_FLAG_FILE="$TBFLAG" npx ts-node --transpile-only -e "$SEVQ" 2>/dev/null)
[ "$SEV_BACK" = "advisory" ]; ckt "toggle back OFF: the seeded live rule is ADVISORY again" "$?"

# restore the empty generated module (the trap also does this belt-and-suspenders)
cp "$GENBAK" "$GENFILE"
grep -q 'ENFORCED_RULES: ProductRuleDefinition\[\] = \[\];' "$GENFILE"; ckt "generated module restored to empty" "$?"

echo "===== C4 STRUCTURAL: the generated module is code, imports NO data (invariant preserved) ====="
# The ONLY crossing of learned data into live code is the codegen SCRIPT (scripts/, read at build time).
# The generated MODULE inlines literals and imports nothing from the data tier, so `src imports nothing
# from data` holds unchanged - even stronger than a relaxation that let src read data.
# Only actual import/require STATEMENTS count (comment prose that mentions "enforcement-ledger" is fine).
if grep -nE "require[[:space:]]*\(" "$GENFILE" >/dev/null 2>&1 \
   || grep -nE "^[[:space:]]*(import|export)[[:space:]].*from[[:space:]]*['\"].*(data/|enforced-rules\.json|enforcement-ledger|promotion-ledger)" "$GENFILE" >/dev/null 2>&1; then
  fail "the generated module has an import/require of data (should be pure inlined literals)"
else
  pass "the generated module imports NO data (pure inlined literals; structural inertness preserved)"
fi
# And no OTHER src file imports the enforced/ledger data tier (the promote/enforce structural invariant).
if grep -rEn "require\(.*(data/enforced-rules|enforcement-ledger|data/guidance|promotion-ledger)" "$SC/src" >/dev/null 2>&1; then
  fail "a sidecoach/src file imports the enforced/ledger/guidance data tier (structural leak)"
else
  pass "no sidecoach/src file imports the enforced tier, either ledger, or the guidance dir"
fi

echo; echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then printf 'FAILED: %s\n' "${FAILS[@]}"; exit 1; fi
exit 0
