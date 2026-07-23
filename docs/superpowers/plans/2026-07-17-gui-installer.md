# GUI installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser-based GUI installer for improv - a localhost-only server that serves the existing bucket-browser prototype, feeds it a live JSON manifest, and drives the same install/deactivate engine the CLI and TUI use, with a streamed install log.

**Architecture:** The GUI is a thin front-end over the installer core. `install.sh` gains three non-interactive subcommands (`--manifest`, `--apply-plan`, `--gui`). A python3-stdlib server binds `127.0.0.1`, serves an adapted copy of the prototype HTML, proxies the manifest, and runs applies through `install.sh`, which reuses `browser-lib.sh`'s already-tested `item_state()` and `apply_pending()`. TUI, CLI flags, and GUI become three doors to one engine.

**Tech Stack:** bash (install.sh + browser-lib.sh), python3 standard library (`http.server`, `subprocess`, `json`), plain HTML/JS (no framework, no build), the repo's `test-*.sh` shell-test convention.

**Authored against commit `84432079`.** Before executing, run `git rev-parse --short HEAD`; if it differs, re-verify the line numbers and function names cited below (they drift as `install.sh` changes).

---

## Grounding (verified at `84432079`)

- `install.sh` sources `claude/hooks/browser-lib.sh` at lines 56-58 (functions only; `browser_load` is called later).
- Arg parser is the `while [[ $# -gt 0 ]]` loop at `install.sh:987-1007`. `--dry-run` (line 993) is the model for a no-side-effect flag.
- `browser-lib.sh` public functions used here: `browser_load <treejson>`, `browser_buckets`, `node_kind <path>`, `node_children <path>`, `node_hooks <path>`, `node_tag/desc/label <path>`, `hook_desc <hook>`, `hooks_owned_by <owner>`, `_owner_leaf_path <owner>`, `leaf_paths <path>`, `counts <path>`, `item_state <path>` (returns `none|partial|active`), `stage_reset`, `apply_pending`. Test probe injection via `BR_STATE_PROBE`.
- Pending model: `PENDING_INSTALL` / `PENDING_UNINSTALL` are bookended-`|` strings of leaf paths, e.g. `|tilt-lab|justify/justify-source-guard|`.
- Existing headless apply seam: `install.sh:3168-3176` runs `apply_pending()` when `_AMPERSAND_APPLY_TEST=1`, seeding pending from `_AMPERSAND_TEST_PI/PU`. `claude/hooks/test-apply-pending.sh` exercises it end-to-end in a throwaway `HOME`. Task 2 promotes this to a production `--apply-plan` entry.
- The interactive browser block starts at `install.sh:3178` (`# --- Interactive entry`) and is gated so `--dry-run`/`--yes`/`--only` never reach it. New non-interactive subcommands must short-circuit (exit) before this block, exactly like the apply seam does.
- Reusable UI: `docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html` (358 lines, complete client-side bucket browser, mock data + no-op apply).
- Tooling present: `/usr/bin/python3` (3.9.6), `jq` (1.7.1). python3 is already a hard dependency (the `--help` component list needs it).
- Tests are standalone: `bash claude/hooks/test-<name>.sh`, exit 0 = pass. There is no aggregate runner.

## File structure

- Create `claude/installer-gui/manifest.py` - pure JSON assembler (tree structure + component metadata + state -> manifest JSON). No side effects.
- Create `claude/installer-gui/server.py` - the localhost server (routing, nonce, allowlist, streaming). No install logic of its own; only shells `install.sh`.
- Create `claude/installer-gui/index.html` - copy of the prototype with three wiring changes.
- Modify `install.sh` - add `--manifest`, `--apply-plan`, `--gui` (arg parser + three short handler blocks before line 3178); extend `--help`.
- Create `claude/hooks/test-installer-manifest.sh` - manifest shape + state parity test.
- Create `claude/hooks/test-installer-gui-server.sh` - server nonce + allowlist + endpoint test (drives `server.py` with `curl`).
- Modify `claude/hooks/test-apply-pending.sh` OR create `claude/hooks/test-apply-plan.sh` - covers the production `--apply-plan` entry.

---

## Task 1: `install.sh --manifest` + `manifest.py`

**Files:**
- Create: `claude/installer-gui/manifest.py`
- Modify: `install.sh` (arg parser at 987-1007; new handler block before 3178; `--help` text)
- Test: `claude/hooks/test-installer-manifest.sh`

- [ ] **Step 1: Write the failing test**

Create `claude/hooks/test-installer-manifest.sh`:

```bash
#!/bin/bash
# test-installer-manifest.sh - install.sh --manifest emits valid JSON whose component
# keys and per-leaf state agree with the tree and with item_state. Runs read-only.
set -u
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"
fail=0
say(){ printf '%s\n' "$*"; }

out="$(bash "$INSTALL" --manifest 2>/dev/null)" || { say "FAIL: --manifest exited non-zero"; exit 1; }

# 1. Valid JSON.
echo "$out" | python3 -c 'import sys,json; json.load(sys.stdin)' \
  || { say "FAIL: --manifest is not valid JSON"; fail=1; }

# 2. Has the four top-level keys.
for k in buckets components state meta; do
  echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);sys.exit(0 if '$k' in d else 1)" \
    || { say "FAIL: manifest missing top-level '$k'"; fail=1; }
done

# 3. Every public component key present in components with a non-empty title.
for key in brain config memory skills statusline cmux nvm ampersand discord voice-input voice-output reflect sidecoach task-list; do
  echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);c=d['components'].get('$key');sys.exit(0 if c and c.get('title') else 1)" \
    || { say "FAIL: components['$key'] missing/blank title"; fail=1; }
done

# 4. state values are only none|partial|active.
echo "$out" | python3 -c '
import sys,json
d=json.load(sys.stdin)
bad=[p for p,v in d["state"].items() if v not in ("none","partial","active")]
sys.exit(1 if bad else 0)' || { say "FAIL: state has out-of-enum values"; fail=1; }

[ "$fail" = 0 ] && say "PASS: manifest test" || exit 1
```

- [ ] **Step 2: Run it, verify it fails**

Run: `bash claude/hooks/test-installer-manifest.sh`
Expected: FAIL - `--manifest` is an unknown flag (arg parser errors with exit 2).

- [ ] **Step 3: Write `manifest.py`**

Create `claude/installer-gui/manifest.py`. It reads the tree JSON path from argv[1] and a state map (JSON `{path: none|partial|active}`) plus component metadata (JSON `{key: {title,desc,files}}`) from stdin, and prints the merged manifest. All JSON escaping happens here (python), never in bash:

```python
#!/usr/bin/env python3
"""Assemble the installer GUI manifest.

argv[1] = path to browser-tree.json (structure, already JSON).
stdin   = {"state": {path: "none|partial|active"}, "components": {key: {...}}, "personal": bool}
stdout  = {"buckets": [...], "components": {...}, "state": {...}, "meta": {...}}

Pure: reads inputs, writes JSON, no side effects. The bash caller computes state
(needs the runtime probe) and dumps component metadata; python owns all escaping.
"""
import json, sys

def main():
    with open(sys.argv[1]) as f:
        tree = json.load(f)
    payload = json.load(sys.stdin)
    personal = bool(payload.get("personal"))

    buckets = []
    for b in tree.get("buckets", []):
        if b.get("personal") and not personal:
            continue
        buckets.append({
            "key": b["key"],
            "label": b.get("label", b["key"]),
            "tag": b.get("tag", ""),
            "desc": b.get("desc", ""),
            "section": b.get("section", ""),
            "members": b.get("members", []),
        })

    print(json.dumps({
        "buckets": buckets,
        "components": payload.get("components", {}),
        "state": payload.get("state", {}),
        "meta": {"personal": personal},
    }))

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Add the `--manifest` handler to `install.sh`**

In the arg parser (after the `--dry-run` case at line 993) add:

```bash
    --manifest)     RUN_MANIFEST=1; shift ;;
```

Add `RUN_MANIFEST=0` beside the other flag defaults (near `DRY_RUN=0`, line 838). Then, immediately BEFORE the apply seam at line 3168 (all functions and `browser-lib.sh` are in scope by then), add the handler:

```bash
# --manifest: emit the GUI manifest as JSON and exit. Read-only, no TTY. The state
# map is computed here (item_state needs the runtime probe); component metadata is
# dumped from the KEYS/TITLES/DESCS/FILES arrays; manifest.py merges + escapes.
if [ "${RUN_MANIFEST:-0}" = "1" ]; then
  browser_load "$REPO_DIR/claude/hooks/browser-tree.json" || { err "manifest: could not load tree"; exit 1; }
  # state map: {leafpath: state} over every leaf, via item_state.
  state_json="$(
    printf '{'
    first=1
    while IFS= read -r bkt; do
      [ -n "$bkt" ] || continue
      while IFS= read -r leaf; do
        [ -n "$leaf" ] || continue
        st="$(item_state "$leaf")"
        [ "$first" = 1 ] && first=0 || printf ','
        # leaf paths carry no double-quote/backslash, so this is JSON-safe.
        printf '"%s":"%s"' "$leaf" "$st"
      done < <(leaf_paths "$bkt")
    done < <(browser_buckets)
    printf '}'
  )"
  # component metadata: dump KEYS/TITLES/DESCS/FILES as tab-delimited, python escapes.
  comp_dump="$(
    i=0
    for k in "${KEYS[@]}"; do
      printf '%s\t%s\t%s\t%s\n' "$k" "${TITLES[$i]}" "${DESCS[$i]}" "${FILES[$i]}"
      i=$((i+1))
    done
  )"
  python3 - "$REPO_DIR/claude/hooks/browser-tree.json" "$state_json" "${PERSONAL:-0}" <<'PY'
import json, sys, subprocess, os
tree_path, state_json, personal = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
state = json.loads(state_json)
components = {}
for line in os.environ.get("COMP_DUMP", "").splitlines():
    if not line.strip():
        continue
    parts = line.split("\t")
    key = parts[0]
    components[key] = {
        "title": parts[1] if len(parts) > 1 else "",
        "desc": parts[2] if len(parts) > 2 else "",
        "files": (parts[3].split("\\n") if len(parts) > 3 and parts[3] else []),
    }
payload = json.dumps({"state": state, "components": components, "personal": personal})
gui = os.path.join(os.path.dirname(tree_path), "..", "installer-gui", "manifest.py")
gui = os.path.normpath(gui)
subprocess.run([sys.executable, gui, tree_path], input=payload, text=True, check=True)
PY
  exit $?
fi
```

Note: pass `comp_dump` to python via env to avoid argv length limits:

```bash
  COMP_DUMP="$comp_dump" python3 - "$REPO_DIR/claude/hooks/browser-tree.json" "$state_json" "${PERSONAL:-0}" <<'PY'
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `bash claude/hooks/test-installer-manifest.sh`
Expected: `PASS: manifest test`

- [ ] **Step 6: Verify parity against `--help` by eye**

Run: `bash install.sh --manifest | python3 -m json.tool | head -40`
Expected: buckets in the same order as `bash install.sh --help` lists them; `state` values plausible for this machine.

- [ ] **Step 7: Add `--manifest` to `--help` text and commit**

Add a `./install.sh --manifest   Print the GUI manifest as JSON and exit` line to the `print_help` body (near the `--dry-run` help line ~944).

```bash
git add claude/installer-gui/manifest.py claude/hooks/test-installer-manifest.sh install.sh
git commit -m "installer: add --manifest JSON emitter for the GUI"
```

---

## Task 2: `install.sh --apply-plan` (promote the headless seam)

**Files:**
- Modify: `install.sh` (arg parser; new handler before line 3178)
- Test: `claude/hooks/test-apply-plan.sh`

- [ ] **Step 1: Write the failing test**

Create `claude/hooks/test-apply-plan.sh`. It mirrors `test-apply-pending.sh`'s throwaway-HOME approach but drives the production `--apply-plan` (stdin JSON), installing a pure-hook component and confirming the hook lands:

```bash
#!/bin/bash
# test-apply-plan.sh - install.sh --apply-plan reads {install:[leafpaths],uninstall:[...]}
# from stdin, validates leaves against the tree, and runs apply_pending. Subject: chrome
# (3 pure hooks, sandbox-safe). Verifies the hooks land in a throwaway HOME.
set -u
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"
TMP="$(mktemp -d)"; export HOME="$TMP/home"; mkdir -p "$HOME/.claude/hooks"
trap 'rm -rf "$TMP"' EXIT

# Resolve chrome's leaf paths from the tree (do not hardcode).
plan="$(cd "$REPO_DIR" && python3 - <<'PY'
import json
t=json.load(open("claude/hooks/browser-tree.json"))
# find the Guardrails > chrome hooks leaves
leaves=[]
def walk(prefix,node):
    for m in node.get("members",[]):
        p=prefix+"/"+m["key"]
        if m.get("kind")=="hooks":
            for h in m.get("hooks",[]): leaves.append(p+"/"+h)
        elif "members" in m: walk(p,m)
for b in t["buckets"]:
    walk(b["key"],b)
chrome=[l for l in leaves if "chrome" in l.lower()]
print(json.dumps({"install":chrome,"uninstall":[]}))
PY
)"

echo "$plan" | bash "$INSTALL" --apply-plan >/dev/null 2>&1 || { echo "FAIL: --apply-plan non-zero"; exit 1; }

# chrome-tabgroup-track.sh must now exist in the sandbox HOME.
if [ -f "$HOME/.claude/hooks/chrome-tabgroup-track.sh" ]; then
  echo "PASS: apply-plan installed chrome hooks"
else
  echo "FAIL: chrome hook not deployed"; exit 1
fi

# Rejects an unknown leaf (allowlist).
echo '{"install":["totally/bogus/leaf; rm -rf x"],"uninstall":[]}' \
  | bash "$INSTALL" --apply-plan >/dev/null 2>&1
[ $? -ne 0 ] && echo "PASS: rejects unknown leaf" || { echo "FAIL: accepted bogus leaf"; exit 1; }
```

- [ ] **Step 2: Run it, verify it fails**

Run: `bash claude/hooks/test-apply-plan.sh`
Expected: FAIL - `--apply-plan` unknown flag.

- [ ] **Step 3: Add the arg-parser case and handler**

Arg parser (after `--manifest`):

```bash
    --apply-plan)   RUN_APPLY_PLAN=1; shift ;;
```

Default `RUN_APPLY_PLAN=0` near the others. Handler, placed right beside the existing apply seam (just before line 3168) so it shares the same "functions all defined, nothing below has run" position:

```bash
# --apply-plan: production headless apply. Reads {"install":[leafpaths],
# "uninstall":[leafpaths]} on stdin, validates every leaf against the loaded tree
# (allowlist - a leaf not in leaf_paths is rejected), seeds the pending sets, runs
# apply_pending (streams its own log to stdout/stderr), exits with its code. Reuses
# the exact executor test-apply-pending.sh already proves.
if [ "${RUN_APPLY_PLAN:-0}" = "1" ]; then
  browser_load "$REPO_DIR/claude/hooks/browser-tree.json" || { err "apply-plan: could not load tree"; exit 1; }
  # Build the set of every valid leaf path once.
  valid="$(while IFS= read -r b; do leaf_paths "$b"; done < <(browser_buckets))"
  # Read stdin JSON -> two newline lists of leaf paths.
  read_leaves="$(python3 - <<'PY'
import json,sys
d=json.load(sys.stdin)
def clean(xs): return [x for x in xs if isinstance(x,str) and x]
print("\x1e".join(clean(d.get("install",[]))))
print("\x1e".join(clean(d.get("uninstall",[]))))
PY
)"
  ins_raw="$(printf '%s\n' "$read_leaves" | sed -n '1p')"
  uni_raw="$(printf '%s\n' "$read_leaves" | sed -n '2p')"
  PENDING_INSTALL="|"; PENDING_UNINSTALL="|"
  validate_add() {  # $1 = record-separated leaves, $2 = target var name
    local IFS=$'\x1e' leaf; local -n dst="$2"
    for leaf in $1; do
      [ -n "$leaf" ] || continue
      case "$valid" in
        *"$leaf"$'\n'*|*"$leaf") dst="${dst}${leaf}|" ;;
        *) err "apply-plan: unknown leaf rejected: $leaf"; exit 2 ;;
      esac
    done
  }
  validate_add "$ins_raw" PENDING_INSTALL
  validate_add "$uni_raw" PENDING_UNINSTALL
  [ "$PENDING_INSTALL" = "|" ] && PENDING_INSTALL=""
  [ "$PENDING_UNINSTALL" = "|" ] && PENDING_UNINSTALL=""
  if apply_pending; then exit 0; else exit $?; fi
fi
```

Note for the executor: bash `local -n` nameref needs bash 4+. macOS ships bash 3.2, but the installer already runs under a modern bash (it uses `${KEYS[@]}` and other bash-4 idioms) - confirm with `bash --version` at the top of the repo's expected shell. If bash 3.2 is a target, replace the nameref with two inline loops (one for install, one for uninstall).

- [ ] **Step 4: Run the test, verify it passes**

Run: `bash claude/hooks/test-apply-plan.sh`
Expected: `PASS: apply-plan installed chrome hooks` and `PASS: rejects unknown leaf`.

- [ ] **Step 5: Confirm the existing apply test still passes (no regression)**

Run: `bash claude/hooks/test-apply-pending.sh`
Expected: exit 0 (the seam it uses is untouched).

- [ ] **Step 6: Commit**

```bash
git add claude/hooks/test-apply-plan.sh install.sh
git commit -m "installer: add --apply-plan headless entry for the GUI"
```

---

## Task 3: the local server (`server.py`)

**Files:**
- Create: `claude/installer-gui/server.py`
- Test: `claude/hooks/test-installer-gui-server.sh`

- [ ] **Step 1: Write the failing test**

Create `claude/hooks/test-installer-gui-server.sh`:

```bash
#!/bin/bash
# test-installer-gui-server.sh - starts server.py, checks localhost bind, nonce gate,
# manifest proxy, and that a POST without the nonce is refused.
set -u
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER="$REPO_DIR/claude/installer-gui/server.py"
port=8791
NONCE_FILE="$(mktemp)"
python3 "$SERVER" --port "$port" --print-nonce "$NONCE_FILE" --repo "$REPO_DIR" &
srv=$!; trap 'kill $srv 2>/dev/null; rm -f "$NONCE_FILE"' EXIT
# wait for boot
for i in $(seq 1 20); do curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep 0.2; done
nonce="$(cat "$NONCE_FILE")"
fail=0

# 1. Manifest requires the nonce.
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/manifest")"
[ "$code" = "403" ] || { echo "FAIL: /manifest without nonce got $code, want 403"; fail=1; }

# 2. Manifest with nonce returns JSON.
curl -sf "http://127.0.0.1:$port/manifest?token=$nonce" | python3 -c 'import sys,json;json.load(sys.stdin)' \
  || { echo "FAIL: /manifest with nonce not JSON"; fail=1; }

# 3. Not bound on a non-loopback interface (best-effort: 0.0.0.0 refused elsewhere is
#    hard to test in CI; assert the server reports its bind host as 127.0.0.1).
curl -sf "http://127.0.0.1:$port/health?token=$nonce" | grep -q '127.0.0.1' \
  || { echo "FAIL: /health does not report 127.0.0.1 bind"; fail=1; }

[ "$fail" = 0 ] && echo "PASS: server test" || exit 1
```

- [ ] **Step 2: Run it, verify it fails**

Run: `bash claude/hooks/test-installer-gui-server.sh`
Expected: FAIL - `server.py` does not exist.

- [ ] **Step 3: Write `server.py`**

Create `claude/installer-gui/server.py`:

```python
#!/usr/bin/env python3
"""Localhost-only GUI installer server. Serves the page, proxies install.sh --manifest,
and runs applies via install.sh --apply-plan, streaming the log. No install logic of its
own. Bound to 127.0.0.1 only; every state route requires the one-time nonce."""
import argparse, json, os, re, secrets, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
LEAF_RE = re.compile(r'^[A-Za-z0-9 &/_-]+$')  # tree leaf chars only; no shell metachars

class State:
    nonce = ""
    repo = ""
    host = "127.0.0.1"

def install_sh(*args, stdin=None, stream=False):
    """Run install.sh with an argv LIST (never shell=True)."""
    cmd = ["bash", os.path.join(State.repo, "install.sh"), *args]
    if stream:
        return subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT, text=True, bufsize=1)
    return subprocess.run(cmd, input=stdin, text=True, capture_output=True)

class H(BaseHTTPRequestHandler):
    def _ok(self, body, ctype="application/json"):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(200); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def _deny(self, code=403):
        self.send_response(code); self.end_headers(); self.wfile.write(b"forbidden")

    def _auth(self, q):
        return q.get("token", [""])[0] == State.nonce and State.nonce != ""

    def _origin_ok(self):
        # Reject cross-origin: Host must be our loopback bind.
        host = self.headers.get("Host", "")
        return host.startswith("127.0.0.1") or host.startswith("localhost")

    def log_message(self, *a):  # quiet
        pass

    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/":
            with open(os.path.join(HERE, "index.html"), "rb") as f:
                self._ok(f.read(), "text/html; charset=utf-8"); return
        if u.path == "/health":
            self._ok(json.dumps({"bind": State.host, "ok": True})); return
        if not (self._origin_ok() and self._auth(q)):
            self._deny(); return
        if u.path == "/manifest":
            r = install_sh("--manifest")
            if r.returncode != 0:
                self._deny(500); return
            self._ok(r.stdout); return
        self._deny(404)

    def do_POST(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if not (self._origin_ok() and self._auth(q)):
            self._deny(); return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode() if length else "{}"
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            self._deny(400); return
        if u.path == "/shutdown":
            self._ok(json.dumps({"ok": True}))
            threading.Thread(target=self.server.shutdown, daemon=True).start(); return
        # /dry-run and /apply share the same validated plan.
        plan = self._sanitize(body)
        if plan is None:
            self._deny(400); return
        if u.path == "/dry-run":
            r = install_sh("--dry-run", "--apply-plan", stdin=json.dumps(plan))
            self._ok(json.dumps({"out": r.stdout + r.stderr})); return
        if u.path == "/apply":
            self._stream_apply(plan); return
        self._deny(404)

    def _sanitize(self, body):
        out = {"install": [], "uninstall": []}
        for k in ("install", "uninstall"):
            for leaf in body.get(k, []):
                if not isinstance(leaf, str) or not LEAF_RE.match(leaf):
                    return None  # reject; install.sh also allowlists against the tree
                out[k].append(leaf)
        return out

    def _stream_apply(self, plan):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-cache"); self.end_headers()
        p = install_sh("--apply-plan", stdin=None, stream=True)
        p.stdin.write(json.dumps(plan)); p.stdin.close()
        for line in p.stdout:
            try:
                self.wfile.write(line.encode()); self.wfile.flush()
            except BrokenPipeError:
                p.kill(); return
        p.wait()
        self.wfile.write(f"\n[exit {p.returncode}]\n".encode())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--print-nonce")   # write nonce to this file (launcher + tests read it)
    ap.add_argument("--print-url")     # write the full URL to this file
    args = ap.parse_args()
    State.repo = os.path.abspath(args.repo)
    State.nonce = secrets.token_urlsafe(24)
    srv = ThreadingHTTPServer((State.host, args.port), H)
    port = srv.server_address[1]
    url = f"http://{State.host}:{port}/?token={State.nonce}"
    if args.print_nonce:
        open(args.print_nonce, "w").write(State.nonce)
    if args.print_url:
        open(args.print_url, "w").write(url)
    print(url, flush=True)
    srv.serve_forever()

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `bash claude/hooks/test-installer-gui-server.sh`
Expected: `PASS: server test`

- [ ] **Step 5: Commit**

```bash
git add claude/installer-gui/server.py claude/hooks/test-installer-gui-server.sh
git commit -m "installer: add localhost GUI server (nonce + allowlist + streamed apply)"
```

---

## Task 4: `install.sh --gui` launcher

**Files:**
- Modify: `install.sh` (arg parser; new handler before line 3178; `--help`)

- [ ] **Step 1: Add the arg-parser case**

```bash
    --gui)          RUN_GUI=1; shift ;;
```

Default `RUN_GUI=0` near the others.

- [ ] **Step 2: Add the handler (before line 3168, after the manifest handler)**

```bash
# --gui: start the localhost GUI server and open the browser. Foreground; Ctrl-C stops.
if [ "${RUN_GUI:-0}" = "1" ]; then
  if ! command -v python3 >/dev/null 2>&1; then err "--gui needs python3"; exit 1; fi
  url_file="$(mktemp)"
  # Server prints its URL (with the one-time nonce) to url_file, then blocks.
  python3 "$REPO_DIR/claude/installer-gui/server.py" --repo "$REPO_DIR" --print-url "$url_file" &
  gui_pid=$!
  trap 'kill $gui_pid 2>/dev/null' INT TERM
  # Wait for the URL to appear (server bound).
  for _ in $(seq 1 50); do [ -s "$url_file" ] && break; sleep 0.1; done
  url="$(cat "$url_file")"; rm -f "$url_file"
  if [ -z "$url" ]; then err "--gui: server did not start"; kill $gui_pid 2>/dev/null; exit 1; fi
  info "GUI installer running at $url"
  command -v open >/dev/null 2>&1 && open "$url" 2>/dev/null || info "Open the URL above in your browser."
  wait $gui_pid
  exit 0
fi
```

- [ ] **Step 3: Verify launch by hand**

Run: `bash install.sh --gui` (in one terminal). Expected: prints `GUI installer running at http://127.0.0.1:<port>/?token=...`, opens the browser, serves the page. Ctrl-C stops it cleanly.

- [ ] **Step 4: Confirm `ampersand --gui` forwards (read-only check)**

Run: `grep -n 'forwards every other flag\|"$@"' install.sh | head` and confirm the `ampersand` function passes unknown flags through to `install.sh` (per its DESCS entry). No code change expected.

- [ ] **Step 5: Add to `--help` and commit**

Add `./install.sh --gui        Open the browser-based GUI installer` to `print_help`.

```bash
git add install.sh
git commit -m "installer: add --gui launcher for the browser installer"
```

---

## Task 5: the page (`index.html`)

**Files:**
- Create: `claude/installer-gui/index.html` (copy of prototype + three wiring changes)

- [ ] **Step 1: Copy the prototype verbatim**

```bash
cp docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html claude/installer-gui/index.html
```

- [ ] **Step 2: Change 1 - replace the hardcoded tree/state seed with a manifest fetch**

In `index.html`, the block from `const T = {` (line ~165) through the `seed(...)` calls (ending ~219) is the mock data. Replace the module-load `render();` call at the very end (line 355) with an async bootstrap that fetches the manifest, builds `T` and the `installed` map from it, then renders. Keep every render/nav/stage function unchanged. Insert near the top of the `<script>`:

```javascript
const TOKEN = new URLSearchParams(location.search).get('token') || '';
function api(path, opts={}) {
  const u = path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(TOKEN);
  return fetch(u, opts);
}
async function boot() {
  const m = await api('/manifest').then(r => r.json());
  // Build T from m.buckets/m.components; build installed{} from m.state.
  buildTreeFromManifest(m);         // defined below - fills T and installed
  render();
}
```

Add `buildTreeFromManifest(m)` that walks `m.buckets` (each member: leaf, hooks, or nested group), producing the same `T` shape the render code already consumes (`{tag, desc, featured, children, folder, hooks}`), and sets `installed[path] = (m.state[path] === 'active')` for every leaf. Featured = buckets whose `section === 'core'`. Delete the hardcoded `const T`, `HOOK_DESC`, `CLUSTERS`, `HOOKS`, `seed*` block and replace the trailing `render();` with `boot();`.

- [ ] **Step 3: Change 2 - real apply via POST + live log**

Replace `applyPending()` (line 232) usage in the `apply` action (line 342) so that instead of the local mutation + toast, it POSTs the staged plan and streams the log. Add a log panel to the DOM (a `<pre id="log">` appended under `.screen`, hidden until apply). Convert the pending sets to leaf-path arrays:

```javascript
function stagedPlan() {
  const install = [], uninstall = [];
  for (const [p, a] of Object.entries(pending)) (a === 'install' ? install : uninstall).push(p);
  return { install, uninstall };
}
async function runApply() {
  const log = document.getElementById('log'); log.style.display = 'block'; log.textContent = '';
  const res = await api('/apply', { method: 'POST', body: JSON.stringify(stagedPlan()) });
  const reader = res.body.getReader(); const dec = new TextDecoder();
  for (;;) { const { value, done } = await reader.read(); if (done) break; log.textContent += dec.decode(value); log.scrollTop = log.scrollHeight; }
  const m = await api('/manifest').then(r => r.json());   // refresh real state
  buildTreeFromManifest(m); for (const k of Object.keys(pending)) delete pending[k]; render();
}
```

Wire the `apply` action branch and the `a` keydown to call `runApply()` instead of `applyPending()`.

- [ ] **Step 4: Change 3 - Quit hits /shutdown**

In the `quit` action branch (line 343), before the toast, call `api('/shutdown', { method: 'POST', body: '{}' })` and show a "You can close this tab." message.

- [ ] **Step 5: Verify in the browser (real input, per the verification protocol)**

Run `bash install.sh --gui`. In the opened page:
- Confirm the component list matches `bash install.sh --manifest` (same buckets, same active/partial/none glyphs).
- Drill into a bucket with the mouse, toggle one small component (e.g. `task-list`) to stage it, read the detail line.
- Take a screenshot with the cmux browser surface, Read it, and describe what is shown. Confirm the glyphs, the staged `+1`, and the footer.

- [ ] **Step 6: Commit**

```bash
git add claude/installer-gui/index.html
git commit -m "installer: wire the GUI page to the manifest + streamed apply"
```

---

## Task 6: end-to-end + docs

**Files:**
- Modify: `README.md` (add the GUI path beside the TUI/flags)

- [ ] **Step 1: Real end-to-end install through the browser**

Start `bash install.sh --gui`. In a throwaway `HOME` if you want isolation (`HOME=$(mktemp -d) bash install.sh --gui`), pick `task-list` (a pure skill copy, no daemon), Apply, and watch the streamed log show the real install output. Confirm `~/.claude/skills/task-list/SKILL.md` (or the sandbox equivalent) now exists. Screenshot the completed log, Read it, describe it.

- [ ] **Step 2: Toggle it back off**

In the same session, toggle `task-list` off, Apply, and confirm the streamed log runs the deactivate and the skill dir is gone. This proves the off path end-to-end.

- [ ] **Step 3: Run the full new test set**

```bash
for t in installer-manifest apply-plan installer-gui-server apply-pending; do
  echo "== $t =="; bash claude/hooks/test-$t.sh || echo "FAILED: $t"
done
```

Expected: all `PASS` / exit 0.

- [ ] **Step 4: Document the GUI path in README**

In the customization/install section, add: `./install.sh --gui   # browser-based GUI installer (localhost only)` and one sentence: the GUI is a visual front-end over the same idempotent installer; nothing runs until you click Apply, and the exact command and live log are shown.

- [ ] **Step 5: Independent cross-model review (mandatory gate)**

Run the Codex review over the full diff (`codex-review.py`, or the `codex:rescue` agent). If Codex is unavailable on this box, dispatch a fresh independent Claude reviewer (a different agent, clean context) over the diff. Fold every finding and re-verify (all Task 6 Step 3 tests green, one browser install observed).

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document the GUI installer path"
```

---

## Self-review (done at authoring)

- Spec coverage: `--manifest` (Task 1), `--gui` (Task 4), local server (Task 3), adapted page (Task 5), install + toggle-off via shared engine (Task 2 `--apply-plan`, exercised in Task 6), security posture (Task 3 server: localhost bind, nonce, Origin/Host, allowlist regex + tree allowlist, argv-not-shell, streamed visible log), deferred items left untouched. All spec sections map to a task.
- The spec's open questions are resolved: manifest keyed by leaf path (Task 1); `--only` cannot express a whole-component off-set headlessly, so `--apply-plan` is added reusing `apply_pending()` (Task 2); streaming transport is chunked `text/plain` (Task 3 `_stream_apply`).
- Placeholder scan: no TBD/TODO; every code step shows real code; test steps show real assertions and commands.
- Type/name consistency: `install.sh` flags (`--manifest`, `--apply-plan`, `--gui`), server routes (`/manifest`, `/dry-run`, `/apply`, `/shutdown`, `/health`), and the plan JSON shape (`{install:[],uninstall:[]}`) are used identically across server.py, index.html, and the `--apply-plan` handler.
