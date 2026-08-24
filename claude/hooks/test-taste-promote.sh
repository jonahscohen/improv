#!/bin/bash
# Test suite for the FULLY-GATED taste-rule promote path (safety core).
# Covers:
#   sidecoach/bin/sidecoach-taste-promote.js  - promote/check/verify-ledger/audit/list/show/approve
#   claude/hooks/sidecoach-taste-promote-arm.sh         - the UserPromptSubmit mint (frontier-confirm model)
#   claude/hooks/bash-guard.sh                - consent-token + ledger-secret Bash fences
#   claude/hooks/content-guard.sh             - consent-token + ledger-secret Write/Edit fences
#
# The five safety-critical properties + every Codex-round-1 finding fold:
#   (a) an AGENT write of the consent token / ledger secret is BLOCKED by the guards
#   (b) promote WITHOUT a valid token is REFUSED
#   (c) promote WITH a token minted the sanctioned way (the ARM HOOK, as the user's REPL confirm
#       would) moves the candidate into the guidance store, chains a ledger entry, consumes the
#       token single-use, and a replay fails
#   (d) a hand-tampered ledger (field edit, tail truncation, forged head) is DETECTED
#   (e) the frontier-confirm fence still works (no regression)
# Folds: single TEST_ROOT (no per-path mix), secret Write fence, arm-hook mint (no CLI mint /
# no pseudo-TTY), JSON-array MAC (no separator redistribution), empty-ledger head check, id
# safety + id-binding, atomic single-use, structural no-import.
#
# The promote flow runs entirely under SIDECOACH_PROMOTE_TEST_ROOT; guard-block checks name the
# REAL token/secret paths but write nothing.
#
# Run: bash claude/hooks/test-taste-promote.sh

set -u
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HOOK_DIR/../.." && pwd)"
CLI="$REPO_ROOT/sidecoach/bin/sidecoach-taste-promote.js"
ARM="$HOOK_DIR/sidecoach-taste-promote-arm.sh"
BG="$HOOK_DIR/bash-guard.sh"
CG="$HOOK_DIR/content-guard.sh"
PASS=0; FAIL=0; FAILS=()

pass(){ echo "PASS: $1"; PASS=$((PASS+1)); }
fail(){ echo "FAIL: $1"; FAILS+=("$1"); FAIL=$((FAIL+1)); }
ck(){ if [ "$2" = "$3" ]; then pass "$1 (exit $3)"; else fail "$1 (expected $2, got $3)"; fi; }
ckt(){ if [ "$2" = "0" ]; then pass "$1"; else fail "$1"; fi; }

[ -f "$CLI" ] || { echo "FATAL: CLI not found at $CLI"; exit 2; }
[ -f "$ARM" ] || { echo "FATAL: arm hook not found at $ARM"; exit 2; }
node -c "$CLI" 2>/dev/null && pass "CLI parses as valid JS" || fail "CLI has a JS syntax error"
bash -n "$ARM" 2>/dev/null && pass "arm hook parses" || fail "arm hook has a syntax error"
bash -n "$BG" 2>/dev/null && pass "bash-guard parses" || fail "bash-guard syntax error"
bash -n "$CG" 2>/dev/null && pass "content-guard parses" || fail "content-guard syntax error"

# ---- module export invariant: requiring the CLI must expose NOTHING (no getSecret/mint reachable)
EXPORTS=$(node -e 'const m=require(process.argv[1]);process.stdout.write(Object.keys(m).join(","))' "$CLI" 2>/dev/null)
[ -z "$EXPORTS" ] && pass "module exports nothing (no require-reachable mint/secret)" || fail "module exports: $EXPORTS"

# ---------------------------------------------------------------------------
# Sandbox - ONE env var relocates the whole apparatus (token, secret, quarantine, guidance, ledger).
# ---------------------------------------------------------------------------
SB="$(mktemp -d)"
trap 'rm -rf "$SB"' EXIT
export SIDECOACH_PROMOTE_TEST_ROOT="$SB"
export TASTE_PROMOTE_CONSENT_TTL=120
mkdir -p "$SB/proposed-rules"
TOKEN="$SB/.taste-rule-promote-consent"; SECRET="$SB/.taste-promotion-ledger-secret"; LEDGER="$SB/promotion-ledger.jsonl"; HEAD="$SB/promotion-ledger.jsonl.head"

write_candidate(){  # $1 id ; $2 preflight_ok(default true) ; $3 internal_ruleId(default =id)
  local id="$1" pf="${2:-true}" rid="${3:-$1}"
  cat > "$SB/proposed-rules/$id.json" <<JSON
{ "candidateVersion":1, "ruleId":"$rid", "title":"sample $id", "disposition":"net-new", "rank":5,
  "rule":{"ruleId":"$rid","canonicalRuleKey":"k-$id","findingClass":"polish","severity":"advisory","evidenceRequirements":["css-rule"]},
  "provenance":{"source":"internal-audit-history","commit":"abc1234","retrieved_utc":"2026-08-23T00:00:00Z","minedBy":"recurring-defect-miner","rationale":"test fixture","evidence":["x"]},
  "preflight":{"ok":$pf,"errors":[]} }
JSON
}

# Mint the token exactly as the user's REPL confirm would: get the content digest from the CLI
# (as the approve/show helper prints for the human to copy), then drive the ARM HOOK with the
# 4-token UserPromptSubmit payload. This is the sanctioned mint path (an agent cannot submit a
# user prompt). No raw crypto, no CLI mint - the real arm hook signs the token under the test root.
digest_of(){ node "$CLI" show "$1" --store "$2" 2>/dev/null | sed -n 's/^content digest: //p' | tail -1; }
arm(){ local d; d=$(digest_of "$1" "$2"); printf '{"prompt":"promote-confirm %s %s %s"}' "$1" "$2" "$d" | bash "$ARM"; }

emit_bash(){  python3 -c 'import json,sys;print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$1"; }
emit_write(){ python3 -c 'import json,sys;print(json.dumps({"tool_name":sys.argv[3],"tool_input":{"file_path":sys.argv[1],"content":sys.argv[2]}}))' "$1" "$2" "${3:-Write}"; }
denies(){ echo "$1" | grep -q '"deny"'; }

TOKREAL="$HOME/.claude/.taste-rule-promote-consent"
SECREAL="$HOME/.claude/.taste-promotion-ledger-secret"
FRONREAL="$HOME/.claude/.frontier-confirm"

echo; echo "===== (a) an AGENT write of the token / ledger secret is BLOCKED ====="
denies "$(emit_bash "echo forged > $TOKREAL" | bash "$BG")"   && pass "bash-guard: echo> token blocked"   || fail "bash-guard: echo> token NOT blocked"
denies "$(emit_bash "cp /tmp/x $TOKREAL" | bash "$BG")"       && pass "bash-guard: cp-> token blocked"     || fail "bash-guard: cp-> token NOT blocked"
denies "$(emit_bash "echo k > $SECREAL" | bash "$BG")"        && pass "bash-guard: write ledger secret blocked" || fail "bash-guard: write ledger secret NOT blocked"
denies "$(emit_bash "cat $SECREAL" | bash "$BG")"             && pass "bash-guard: read ledger secret blocked"  || fail "bash-guard: read ledger secret NOT blocked"
denies "$(emit_write "$TOKREAL" "x" Write | bash "$CG")"      && pass "content-guard: Write token (full path) blocked" || fail "content-guard: Write token (full path) NOT blocked"
denies "$(emit_write ".taste-rule-promote-consent" "x" Write | bash "$CG")" && pass "content-guard: Write token (basename) blocked" || fail "content-guard: Write token (basename) NOT blocked"
denies "$(emit_write "$SECREAL" "k" Write | bash "$CG")"      && pass "content-guard: Write ledger secret (full path) blocked" || fail "content-guard: Write ledger secret NOT blocked"
denies "$(emit_write ".taste-promotion-ledger-secret" "k" Edit | bash "$CG")" && pass "content-guard: Edit ledger secret (basename) blocked" || fail "content-guard: Edit ledger secret NOT blocked"
denies "$(emit_bash "node $CLI promote foo --store craft-corpus" | bash "$BG")" && fail "bash-guard: running the CLI wrongly blocked" || pass "bash-guard: running the CLI is allowed"
denies "$(emit_write "/tmp/ordinary.txt" "x" Write | bash "$CG")" && fail "content-guard: ordinary write wrongly blocked" || pass "content-guard: ordinary write allowed"
# Codex round 2 Critical: even a token/secret RELOCATED under a test root keeps the guarded
# basename, so an agent write to it is still fenced (proves TEST_ROOT gives no unguarded path).
denies "$(emit_write "$TOKEN" "x" Write | bash "$CG")"  && pass "content-guard: test-root token (guarded basename) still blocked"  || fail "content-guard: test-root token NOT blocked"
denies "$(emit_write "$SECRET" "k" Write | bash "$CG")" && pass "content-guard: test-root secret (guarded basename) still blocked" || fail "content-guard: test-root secret NOT blocked"
denies "$(emit_bash "echo x > $TOKEN" | bash "$BG")"    && pass "bash-guard: test-root token still blocked" || fail "bash-guard: test-root token NOT blocked"

echo; echo "===== (e) frontier-confirm fence still works (regression) ====="
denies "$(emit_bash "echo x > $FRONREAL" | bash "$BG")"  && pass "bash-guard: frontier token still blocked"  || fail "bash-guard: frontier token NOT blocked"
denies "$(emit_write "$FRONREAL" "x" Write | bash "$CG")" && pass "content-guard: frontier token still blocked" || fail "content-guard: frontier token NOT blocked"

echo; echo "===== arm hook: only the exact whole-prompt confirm mints ====="
rm -f "$TOKEN"; arm cand-arm craft-corpus >/dev/null 2>&1 || true
[ -f "$TOKEN" ] || { write_candidate cand-arm; arm cand-arm craft-corpus >/dev/null 2>&1; }
[ -f "$TOKEN" ]; ckt "arm hook mints the token on 'promote-confirm <id> <store> <digest>'" "$?"
rm -f "$TOKEN"; printf '{"prompt":"please promote-confirm cand-arm craft-corpus for me"}' | bash "$ARM" >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "a sentence merely CONTAINING the phrase does NOT mint" "$?"
rm -f "$TOKEN"; arm cand-arm not-a-real-store >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "a bad store does NOT mint" "$?"
rm -f "$TOKEN"; arm "../../etc/evil" craft-corpus >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "an unsafe id does NOT mint" "$?"
# the 4-token confirm requires a valid 64-hex digest; a 3-token phrase (no digest) does NOT mint
rm -f "$TOKEN"; write_candidate cand-arm; printf '{"prompt":"promote-confirm cand-arm craft-corpus"}' | bash "$ARM" >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "3-token phrase (no digest) does NOT mint" "$?"
rm -f "$TOKEN"; printf '{"prompt":"promote-confirm cand-arm craft-corpus NOTAHEXDIGEST"}' | bash "$ARM" >/dev/null 2>&1
[ ! -f "$TOKEN" ]; ckt "a non-hex digest does NOT mint" "$?"

echo; echo "===== Codex round 4/5: an AGENT cannot RUN the arm hook directly, ANY form (bash-guard) ====="
ARM_BN=$(basename "$ARM")
denies "$(emit_bash "bash $ARM" | bash "$BG")"                              && pass "bash-guard: 'bash <arm>' blocked"          || fail "bash-guard: 'bash <arm>' NOT blocked"
denies "$(emit_bash "$ARM" | bash "$BG")"                                   && pass "bash-guard: direct '<arm>' exec blocked"   || fail "bash-guard: direct arm exec NOT blocked"
denies "$(emit_bash "printf x | bash $ARM" | bash "$BG")"                   && pass "bash-guard: piped 'bash <arm>' blocked"    || fail "bash-guard: piped arm exec NOT blocked"
# round-5 bypass forms: path-qualified interpreters, expanded paths, env/PATH/command prefixes
denies "$(emit_bash "/bin/bash $ARM" | bash "$BG")"                         && pass "bash-guard: '/bin/bash <arm>' blocked"     || fail "bash-guard: '/bin/bash <arm>' NOT blocked"
denies "$(emit_bash "/bin/sh $ARM" | bash "$BG")"                           && pass "bash-guard: '/bin/sh <arm>' blocked"       || fail "bash-guard: '/bin/sh <arm>' NOT blocked"
denies "$(emit_bash "command /bin/bash $ARM" | bash "$BG")"                 && pass "bash-guard: 'command /bin/bash <arm>' blocked" || fail "bash-guard: 'command /bin/bash <arm>' NOT blocked"
denies "$(emit_bash "env -S /bin/bash $ARM" | bash "$BG")"                  && pass "bash-guard: 'env -S /bin/bash <arm>' blocked" || fail "bash-guard: 'env -S /bin/bash <arm>' NOT blocked"
denies "$(emit_bash "env FOO=1 /bin/bash $ARM" | bash "$BG")"               && pass "bash-guard: 'env FOO=1 /bin/bash <arm>' blocked" || fail "bash-guard: 'env FOO=1 /bin/bash <arm>' NOT blocked"
denies "$(emit_bash "\$PWD/claude/hooks/$ARM_BN" | bash "$BG")"             && pass "bash-guard: '\$PWD/...<arm>' direct blocked" || fail "bash-guard: '\$PWD/...<arm>' NOT blocked"
denies "$(emit_bash "~/x/$ARM_BN" | bash "$BG")"                            && pass "bash-guard: '~/...<arm>' direct blocked"   || fail "bash-guard: '~/...<arm>' NOT blocked"
denies "$(emit_bash "PATH=claude/hooks:\$PATH $ARM_BN" | bash "$BG")"       && pass "bash-guard: 'PATH=... <arm>' (bare) blocked" || fail "bash-guard: 'PATH=... <arm>' NOT blocked"
denies "$(emit_bash "sudo bash $ARM" | bash "$BG")"                         && pass "bash-guard: 'sudo bash <arm>' blocked"     || fail "bash-guard: 'sudo bash <arm>' NOT blocked"
# round-6 bypass forms: shell grouping, keywords, eval, builtin, dot-source, process substitution, xargs-stdin, find -exec
denies "$(emit_bash "{ bash $ARM; }" | bash "$BG")"                         && pass "bash-guard: brace-group exec blocked"      || fail "bash-guard: brace-group exec NOT blocked"
denies "$(emit_bash "if bash $ARM; then :; fi" | bash "$BG")"               && pass "bash-guard: if-keyword exec blocked"       || fail "bash-guard: if-keyword exec NOT blocked"
denies "$(emit_bash "(bash $ARM)" | bash "$BG")"                            && pass "bash-guard: subshell exec blocked"         || fail "bash-guard: subshell exec NOT blocked"
denies "$(emit_bash "eval bash $ARM" | bash "$BG")"                         && pass "bash-guard: 'eval bash <arm>' blocked"     || fail "bash-guard: 'eval bash <arm>' NOT blocked"
denies "$(emit_bash "builtin . $ARM" | bash "$BG")"                         && pass "bash-guard: 'builtin . <arm>' blocked"     || fail "bash-guard: 'builtin . <arm>' NOT blocked"
denies "$(emit_bash ". $ARM" | bash "$BG")"                                 && pass "bash-guard: dot-source exec blocked"       || fail "bash-guard: dot-source exec NOT blocked"
denies "$(emit_bash "source <(cat $ARM)" | bash "$BG")"                     && pass "bash-guard: process-sub 'source <(cat <arm>)' blocked" || fail "bash-guard: process-sub source NOT blocked"
denies "$(emit_bash "timeout 5 bash $ARM" | bash "$BG")"                    && pass "bash-guard: 'timeout 5 bash <arm>' blocked" || fail "bash-guard: timeout exec NOT blocked"
denies "$(emit_bash "printf '%s\\n' $ARM | xargs -n1 bash" | bash "$BG")"   && pass "bash-guard: xargs-stdin exec blocked (printf names hook)" || fail "bash-guard: xargs-stdin NOT blocked"
denies "$(emit_bash "find claude/hooks -name $ARM_BN -exec bash {} ;" | bash "$BG")" && pass "bash-guard: 'find -exec bash' blocked" || fail "bash-guard: find -exec NOT blocked"
denies "$(emit_bash "( cat $ARM )" | bash "$BG")"                           && fail "bash-guard: '( cat <arm> )' wrongly blocked" || pass "bash-guard: subshell cat (read) is allowed"
# read / edit / stage must remain ALLOWED
denies "$(emit_bash "cat $ARM" | bash "$BG")"                               && fail "bash-guard: reading the arm hook wrongly blocked" || pass "bash-guard: reading the arm hook (cat) is allowed"
denies "$(emit_bash "vim $ARM" | bash "$BG")"                               && fail "bash-guard: editing the arm hook wrongly blocked" || pass "bash-guard: editing the arm hook (vim) is allowed"
denies "$(emit_bash "git add $ARM" | bash "$BG")"                           && fail "bash-guard: 'git add <arm>' wrongly blocked" || pass "bash-guard: staging the arm hook (git add) is allowed"
denies "$(emit_bash "chmod +x $ARM" | bash "$BG")"                          && fail "bash-guard: 'chmod +x <arm>' wrongly blocked" || pass "bash-guard: chmod on the arm hook is allowed"

echo; echo "===== approve is a helper, NOT a mint (no token produced) ====="
write_candidate cand-app
rm -f "$TOKEN"
node "$CLI" approve cand-app --store craft-corpus </dev/null >/dev/null 2>&1; RC=$?
[ ! -f "$TOKEN" ]; ckt "approve did not mint a token" "$?"
[ "$RC" = "0" ] || [ "$RC" = "6" ]; ckt "approve exits 0 (tty) or 6 (no tty), never mints" "$?"

echo; echo "===== pre-flight-failed candidate is INELIGIBLE ====="
write_candidate cand-pf false
arm cand-pf craft-corpus
node "$CLI" promote cand-pf --store craft-corpus >/dev/null 2>&1; ck "pre-flight-failed candidate refused" 4 "$?"

echo; echo "===== id binding: filename must match candidate ruleId (Codex #6) ====="
write_candidate cand-mismatch true "a-different-ruleid"
arm cand-mismatch craft-corpus
node "$CLI" promote cand-mismatch --store craft-corpus >/dev/null 2>&1; ck "id-mismatch candidate refused" 4 "$?"
# Codex round 2: a candidate whose TOP-LEVEL id matches but whose NESTED rule.ruleId differs
cat > "$SB/proposed-rules/cand-nested.json" <<'JSON'
{ "candidateId":"cand-nested", "ruleId":"cand-nested", "title":"t",
  "rule":{"ruleId":"a-sneaky-different-id","canonicalRuleKey":"k","findingClass":"polish","severity":"advisory","evidenceRequirements":["css-rule"]},
  "provenance":{"source":"x","commit":"c","retrieved_utc":"t","minedBy":"m","evidence":["e"]},
  "preflight":{"ok":true,"errors":[]} }
JSON
arm cand-nested craft-corpus
node "$CLI" promote cand-nested --store craft-corpus >/dev/null 2>&1; ck "nested rule.ruleId mismatch refused" 4 "$?"

echo; echo "===== path-traversal id is rejected (Codex #6) ====="
node "$CLI" promote "../../etc/evil" --store craft-corpus >/dev/null 2>&1; ck "traversal id rejected" 2 "$?"

echo; echo "===== (b) promote WITHOUT a token is REFUSED ====="
write_candidate cand-b
rm -f "$TOKEN"
node "$CLI" promote cand-b --store craft-corpus >/dev/null 2>&1; ck "promote with no token refused" 5 "$?"

echo; echo "===== wrong-store token does not authorize a different store ====="
write_candidate cand-ws
arm cand-ws craft-corpus
node "$CLI" promote cand-ws --store design-laws >/dev/null 2>&1; ck "token store-binding enforced" 5 "$?"
node "$CLI" promote cand-ws --store craft-corpus >/dev/null 2>&1; ck "correct store promotes" 0 "$?"

echo; echo "===== Codex round 4 High: content swapped after approval is REFUSED (digest binding) ====="
write_candidate cand-swap
arm cand-swap craft-corpus                              # binds the digest of the CURRENT content
# an agent swaps the candidate content AFTER the human confirmed (keeping id + preflight valid)
python3 - "$SB/proposed-rules/cand-swap.json" <<'PY'
import sys,json
p=sys.argv[1]; o=json.load(open(p))
o["rule"]["severity"]="blocker"; o["rule"]["injected"]="evil-after-approval"
json.dump(o, open(p,"w"))
PY
node "$CLI" promote cand-swap --store craft-corpus >/dev/null 2>&1; ck "content-swap-after-approve refused" 5 "$?"
[ ! -f "$SB/guidance/craft-corpus/cand-swap.json" ]; ckt "the swapped content did NOT land in guidance" "$?"

echo; echo "===== (c) promote WITH a sanctioned token: move + ledger + consume + replay ====="
write_candidate cand-c
arm cand-c design-laws
node "$CLI" check cand-c --store design-laws >/dev/null 2>&1; ck "check reports a valid token" 0 "$?"
node "$CLI" promote cand-c --store design-laws >/dev/null 2>&1; ck "promote with valid token succeeds" 0 "$?"
[ -f "$SB/guidance/design-laws/cand-c.json" ]; ckt "candidate moved INTO the guidance store" "$?"
[ ! -f "$SB/proposed-rules/cand-c.json" ]; ckt "candidate REMOVED from quarantine (move, not copy)" "$?"
[ ! -f "$TOKEN" ]; ckt "token consumed (single-use, file gone)" "$?"
node "$CLI" check cand-c --store design-laws >/dev/null 2>&1; ck "check after consume reports no token" 5 "$?"
node "$CLI" verify-ledger >/dev/null 2>&1; ck "ledger chain + head verify after promote" 0 "$?"
grep -q '"candidateId":"cand-c"' "$LEDGER"; ckt "ledger records the promotion" "$?"
# replay: re-propose same candidate, re-mint, promote -> durable ledger replay guard
write_candidate cand-c
arm cand-c design-laws
node "$CLI" promote cand-c --store design-laws >/dev/null 2>&1; ck "replay of an already-promoted candidate refused" 11 "$?"

echo; echo "===== a second, independent promotion chains correctly ====="
write_candidate cand-c2
arm cand-c2 craft-corpus
node "$CLI" promote cand-c2 --store craft-corpus >/dev/null 2>&1; ck "second promotion succeeds" 0 "$?"
node "$CLI" verify-ledger >/dev/null 2>&1; ck "two-entry chain verifies" 0 "$?"
node "$CLI" audit >/dev/null 2>&1; ck "audit clean with two promoted rules" 0 "$?"

echo; echo "===== (d) a hand-tampered ledger is DETECTED ====="
cp "$LEDGER" "$SB/ledger.bak"; cp "$HEAD" "$SB/head.bak"
# d1: flip a signed field in entry 0
python3 - "$LEDGER" <<'PY'
import sys,json
p=sys.argv[1]; ls=open(p).read().splitlines()
o=json.loads(ls[0]); o["source"]="TAMPERED-EVIL"; ls[0]=json.dumps(o)
open(p,"w").write("\n".join(ls)+"\n")
PY
node "$CLI" verify-ledger >/dev/null 2>&1; ck "verify detects a field tamper" 8 "$?"
node "$CLI" audit >/dev/null 2>&1;         ck "audit detects a field tamper" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"
# d2: tail truncation - delete last line, keep head
python3 - "$LEDGER" <<'PY'
import sys
p=sys.argv[1]; ls=open(p).read().splitlines()
open(p,"w").write(("\n".join(ls[:-1])+"\n") if len(ls)>1 else "")
PY
node "$CLI" verify-ledger >/dev/null 2>&1; ck "verify detects tail truncation (head anchor)" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"
# d3: forge the head to match a truncated ledger (bad head sig)
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
# d4: MAC serialization is unambiguous (Codex #4) - a '|' redistributed across fields must NOT verify
python3 - "$LEDGER" <<'PY'
import sys,json
p=sys.argv[1]; ls=open(p).read().splitlines()
o=json.loads(ls[0])
# move a pipe across the candidateId/source boundary; a naive pipe-join MAC would still match
o["candidateId"]=o["candidateId"]+"|X"; o["source"]="Y"+"|"+o["source"]
ls[0]=json.dumps(o); open(p,"w").write("\n".join(ls)+"\n")
PY
node "$CLI" verify-ledger >/dev/null 2>&1; ck "verify detects separator-redistribution tamper" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"
# d5: an UN-BLESSED guidance rule (no ledger entry) is flagged
cat > "$SB/guidance/craft-corpus/sneaked-in.json" <<'JSON'
{ "ruleId":"sneaked-in", "rule":{"ruleId":"sneaked-in"}, "provenance":{"source":"x"} }
JSON
node "$CLI" audit >/dev/null 2>&1; ck "audit flags an un-blessed guidance rule" 9 "$?"
rm -f "$SB/guidance/craft-corpus/sneaked-in.json"
node "$CLI" audit >/dev/null 2>&1; ck "audit clean again after removing it" 0 "$?"

echo; echo "===== (d cont.) content + store binding in the ledger (Codex round 3 Critical) ====="
GF="$SB/guidance/design-laws/cand-c.json"
cp "$GF" "$SB/cand-c.gf.bak"
# a post-promotion CONTENT swap that preserves the id must be DETECTED (the human approved the OLD content)
python3 - "$GF" <<'PY'
import sys,json
p=sys.argv[1]; o=json.load(open(p))
o.setdefault("rule",{})["severity"]="blocker"
o["rule"]["injected"]="evil-payload"
json.dump(o, open(p,"w"))
PY
node "$CLI" audit >/dev/null 2>&1; ck "audit detects a post-promotion content swap" 9 "$?"
cp "$SB/cand-c.gf.bak" "$GF"
node "$CLI" audit >/dev/null 2>&1; ck "audit clean after restoring approved content" 0 "$?"
# a promoted rule COPIED into a different store (masquerade as ledger-backed) must be DETECTED
mkdir -p "$SB/guidance/craft-corpus"; cp "$GF" "$SB/guidance/craft-corpus/cand-c.json"
node "$CLI" audit >/dev/null 2>&1; ck "audit detects a store move / masquerade" 9 "$?"
rm -f "$SB/guidance/craft-corpus/cand-c.json"
node "$CLI" audit >/dev/null 2>&1; ck "audit clean after removing the store-moved copy" 0 "$?"
# a forged UNSIGNED ledger row makes a later legit promote report TAMPER (8), not replay (Codex #3)
write_candidate cand-forge
printf '%s\n' '{"candidateId":"cand-forge","store":"craft-corpus","content_digest":"x","source":"s","commit":"c","retrieved_utc":"t","approvedBy":"human","approved_utc":"t","token_mac":"m","prev_mac":"p","mac":"forged"}' >> "$LEDGER"
arm cand-forge craft-corpus
node "$CLI" promote cand-forge --store craft-corpus >/dev/null 2>&1; ck "forged ledger row -> tamper (8), not replay" 8 "$?"
cp "$SB/ledger.bak" "$LEDGER"; cp "$SB/head.bak" "$HEAD"

echo; echo "===== STRUCTURAL fail-closed: the enforcer imports nothing from quarantine/guidance ====="
if grep -rEn "require\(.*(proposed-rules|data/guidance|promotion-ledger)" "$REPO_ROOT/sidecoach/src" >/dev/null 2>&1; then
  fail "a sidecoach/src file IMPORTS the quarantine/guidance/ledger (structural leak)"
else
  pass "no sidecoach/src file imports the quarantine, guidance data dir, or ledger"
fi

echo; echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then printf 'FAILED: %s\n' "${FAILS[@]}"; exit 1; fi
exit 0
