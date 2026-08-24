#!/bin/bash
# UserPromptSubmit hook. Mints the single-use taste-rule promotion consent token when the USER
# types, as their WHOLE prompt, exactly:   promote-confirm <candidateId> <store> <digest>
#
# This is the ONLY sanctioned writer of the consent token (default
# ~/.claude/.taste-rule-promote-consent), modeled byte-for-byte on frontier-confirm-arm.sh.
# The model never writes it: an agent cannot submit a user prompt, so it cannot trigger this
# arm; and bash-guard/content-guard fence the token PATH from every agent Write/Edit/Bash.
# sidecoach-taste-promote consumes the token (check/consume only) - it has NO mint path.
#
# The token is HMAC-signed with the machine-local ledger secret (defense in depth: even if the
# path fence were bypassed, a valid signature needs the secret, which is itself guard-fenced).
#
# Arms ONLY when the whole prompt is exactly the four tokens "promote-confirm <id> <store> <digest>"
# with a safe id and an allowlisted store; anything else does nothing. Emits no context; exits 0.
#
# SIDECOACH_PROMOTE_TEST_ROOT relocates the token + secret (matches the CLI) so the test suite
# can exercise the real arm path in isolation. TASTE_PROMOTE_CONSENT_TTL (default 120) sets the
# token lifetime.

INPUT=$(cat)

printf '%s' "$INPUT" | TASTE_PROMOTE_CONSENT_TTL="${TASTE_PROMOTE_CONSENT_TTL:-120}" python3 -c '
import json, os, sys, re, hmac, hashlib, secrets, time

ALLOWED = {"design-laws", "craft-corpus", "design-judgment-rules"}

try:
    prompt = json.load(sys.stdin).get("prompt", "") or ""
except Exception:
    sys.exit(0)

# The confirm phrase binds the CONTENT the human approved: promote-confirm <id> <store> <digest>.
# <digest> is the candidate content digest the approve/show helper printed for copy-paste.
# Binding it means an agent that swaps the candidate content between review and promote is caught
# (the promoted content will not match the approved digest). The arm hook does NOT compute the
# digest - it just carries the string the human copied; the CLI (one impl) both prints and
# re-checks it, so there is no cross-language canonicalization to keep in sync. NO APOSTROPHES.
parts = prompt.strip().split()
if len(parts) != 4 or parts[0] != "promote-confirm":
    sys.exit(0)
_, cid, store, digest = parts
if not re.match(r"^[A-Za-z0-9._-]+$", cid) or ".." in cid or store not in ALLOWED:
    sys.exit(0)
if not re.match(r"^[0-9a-f]{64}$", digest):
    sys.exit(0)

# The token/secret ALWAYS use the guard-fenced basenames, even under a test root, so an agent
# who points SIDECOACH_PROMOTE_TEST_ROOT at the real data dir still cannot get a tool-writable
# token/secret (the guards block those basenames on any directory). Matches the CLI.
root = os.environ.get("SIDECOACH_PROMOTE_TEST_ROOT") or ""
if root:
    token_file = os.path.join(root, ".taste-rule-promote-consent")
    secret_file = os.path.join(root, ".taste-promotion-ledger-secret")
else:
    home = os.path.expanduser("~")
    token_file = os.path.join(home, ".claude", ".taste-rule-promote-consent")
    secret_file = os.path.join(home, ".claude", ".taste-promotion-ledger-secret")

# read-or-create the machine-local signing secret (0600, O_EXCL), matching the CLI getSecret.
def get_secret():
    try:
        with open(secret_file) as fh:
            return fh.read().strip()
    except OSError:
        pass
    try:
        os.makedirs(os.path.dirname(secret_file), exist_ok=True)
    except OSError:
        pass
    s = secrets.token_hex(32)
    try:
        fd = os.open(secret_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.write(fd, (s + "\n").encode())
        os.close(fd)
        return s
    except FileExistsError:
        with open(secret_file) as fh:
            return fh.read().strip()

try:
    secret = get_secret()
    nonce = secrets.token_hex(12)
    minted = int(time.time())
    ttl = int(os.environ.get("TASTE_PROMOTE_CONSENT_TTL", "120") or "120")
    body = "%s|%s|%s|%s|%d|%d" % (cid, store, digest, nonce, minted, ttl)
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    try:
        os.makedirs(os.path.dirname(token_file), exist_ok=True)
    except OSError:
        pass
    fd = os.open(token_file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.write(fd, (body + "|" + sig + "\n").encode())
    os.close(fd)
except Exception:
    # Fail silent (like frontier-confirm-arm): an arm that cannot write simply does not arm.
    sys.exit(0)
sys.exit(0)
'
exit 0
