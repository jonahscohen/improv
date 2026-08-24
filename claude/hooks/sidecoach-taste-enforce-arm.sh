#!/bin/bash
# UserPromptSubmit hook. Mints the single-use taste-rule ENFORCE consent token when the USER types,
# as their WHOLE prompt, exactly:   enforce-confirm <ruleId> <precision-digest>
#
# This is the ONLY sanctioned writer of the enforce consent token (default
# ~/.claude/.taste-rule-enforce-consent), modeled byte-for-byte on sidecoach-taste-promote-arm.sh.
# The model never writes it: an agent cannot submit a user prompt, so it cannot trigger this arm; and
# bash-guard/content-guard fence the token PATH + ledger SECRET from every agent Write/Edit/Bash, and
# fence DIRECT EXECUTION of this hook. sidecoach-taste-enforce consumes the token (check/consume only)
# - it has NO mint path.
#
# The token is HMAC-signed with the machine-local ENFORCE ledger secret (distinct from the promotion
# secret; defense in depth: even if the path fence were bypassed, a valid signature needs the secret,
# which is itself guard-fenced).
#
# Arms ONLY when the whole prompt is exactly the three tokens "enforce-confirm <id> <digest>" with a
# safe id and a 64-hex precision digest; anything else does nothing. Emits no context; exits 0.
#
# The <precision-digest> binds the sign-off to a FRESH held-out precision measurement
# (eval/taste-enforce-precision.mjs, printed by "sidecoach-taste-enforce approve <id>"). Binding it
# means the enforce CLI re-measures precision at enforce time and refuses unless the fresh digest
# matches - so an agent that swaps the spec/corpus, or a precision that drifted below the bar since
# the human looked, is caught. The arm hook does NOT compute the digest - it carries the string the
# human copied; the CLI (one impl) both prints and re-checks it, so there is no cross-language
# canonicalization to keep in sync. NO APOSTROPHES.
#
# SIDECOACH_ENFORCE_TEST_ROOT relocates the token + secret (matches the CLI) so the test suite can
# exercise the real arm path in isolation. TASTE_ENFORCE_CONSENT_TTL (default 120) sets the token life.

INPUT=$(cat)

printf '%s' "$INPUT" | TASTE_ENFORCE_CONSENT_TTL="${TASTE_ENFORCE_CONSENT_TTL:-120}" python3 -c '
import json, os, sys, re, hmac, hashlib, secrets, time

try:
    prompt = json.load(sys.stdin).get("prompt", "") or ""
except Exception:
    sys.exit(0)

# The confirm phrase binds the precision the human approved: enforce-confirm <id> <precision-digest>.
parts = prompt.strip().split()
if len(parts) != 3 or parts[0] != "enforce-confirm":
    sys.exit(0)
_, rid, digest = parts
if not re.match(r"^[A-Za-z0-9._-]+$", rid) or ".." in rid:
    sys.exit(0)
if not re.match(r"^[0-9a-f]{64}$", digest):
    sys.exit(0)

# The token/secret ALWAYS use the guard-fenced basenames, even under a test root, so an agent who
# points SIDECOACH_ENFORCE_TEST_ROOT at the real data dir still cannot get a tool-writable
# token/secret (the guards block those basenames on any directory). Matches the CLI.
root = os.environ.get("SIDECOACH_ENFORCE_TEST_ROOT") or ""
if root:
    token_file = os.path.join(root, ".taste-rule-enforce-consent")
    secret_file = os.path.join(root, ".taste-enforce-ledger-secret")
else:
    home = os.path.expanduser("~")
    token_file = os.path.join(home, ".claude", ".taste-rule-enforce-consent")
    secret_file = os.path.join(home, ".claude", ".taste-enforce-ledger-secret")

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
    ttl = int(os.environ.get("TASTE_ENFORCE_CONSENT_TTL", "120") or "120")
    body = "%s|%s|%s|%d|%d" % (rid, digest, nonce, minted, ttl)
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    try:
        os.makedirs(os.path.dirname(token_file), exist_ok=True)
    except OSError:
        pass
    fd = os.open(token_file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.write(fd, (body + "|" + sig + "\n").encode())
    os.close(fd)
except Exception:
    # Fail silent (like sidecoach-taste-promote-arm): an arm that cannot write simply does not arm.
    sys.exit(0)
sys.exit(0)
'
exit 0
