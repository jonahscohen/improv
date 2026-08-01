#!/usr/bin/env python3
"""Localhost-only GUI installer server. Serves the page, proxies install.sh --manifest,
and runs applies via install.sh --apply-plan, streaming the log. No install logic of its
own. Bound to 127.0.0.1 only; every state route requires the one-time nonce."""
import argparse, json, os, re, secrets, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
# Tree leaf chars only; no shell metachars. The '/' is load-bearing: real leaves are
# slash-delimited paths (e.g. "Dev surface/task-list"). '.' is deliberately excluded, so
# no leaf can contain ".." - traversal is impossible. This regex is a first-pass filter;
# install.sh --apply-plan's manifest-derived allowlist is the authoritative gate that
# rejects any string that is not an exact known leaf.
LEAF_RE = re.compile(r'^[A-Za-z0-9 &/_-]+$')
LOOPBACK_HOSTS = ("127.0.0.1", "localhost")
MAX_BODY = 1 << 20  # cap POST bodies at 1 MiB; real plans are a few hundred bytes

# Placeholder served for GET / until Task 5 lands the real index.html. Kept tiny and inert
# so the server still boots (and the test suite still runs) before the page exists.
PLACEHOLDER_HTML = (
    "<!doctype html><meta charset=utf-8><title>installer</title>"
    "<p>GUI page not installed yet.</p>"
)

class State:
    # nonce is a per-instance startup secret (secrets.token_urlsafe), generated once and
    # required on every state route for the server's lifetime. It is NOT consumed per
    # request - the same value gates every call until shutdown.
    nonce = ""
    repo = ""
    host = "127.0.0.1"

def write_private(path, data):
    # Write 0600 (chmod forces it even if a looser file pre-existed): the nonce/url files
    # carry the bearer token, so a permissive umask must not leave them world-readable and
    # let another local user drive the state routes.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, data.encode())
    finally:
        os.close(fd)
    os.chmod(path, 0o600)

def install_sh(*args, stdin=None, stream=False):
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
        # Constant-time compare against the one-time startup nonce. Empty nonce never passes.
        tok = q.get("token", [""])[0]
        return State.nonce != "" and secrets.compare_digest(tok, State.nonce)
    def _origin_ok(self):
        # Exact loopback Host match (partition drops the :port), NOT a prefix test - a
        # prefix test accepts "127.0.0.1.evil.com" (a DNS-rebinding bypass). If an Origin
        # header is present it must also be loopback, so a hostile browser origin cannot
        # drive a state route even if the nonce leaks. Absent Origin (curl, same-origin
        # navigation) is allowed.
        hostname = self.headers.get("Host", "").partition(":")[0]
        if hostname not in LOOPBACK_HOSTS:
            return False
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).hostname not in LOOPBACK_HOSTS:
            return False
        return True
    def log_message(self, *a):
        pass
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/":
            index = os.path.join(HERE, "index.html")
            if os.path.isfile(index):
                with open(index, "rb") as f:
                    self._ok(f.read(), "text/html; charset=utf-8")
            else:
                self._ok(PLACEHOLDER_HTML, "text/html; charset=utf-8")
            return
        if u.path == "/styles.css":
            # Fixed path, no user input in it, so no traversal surface. Served
            # before the auth gate for the same reason "/" is: the browser fetches
            # a stylesheet without the page nonce, and a 403 here would leave the
            # installer unstyled rather than unusable, which is worse - it would
            # look broken while still being operable.
            sheet = os.path.join(HERE, "styles.css")
            if os.path.isfile(sheet):
                with open(sheet, "rb") as f:
                    self._ok(f.read(), "text/css; charset=utf-8")
            else:
                self._deny(404)
            return
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
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            self._deny(400); return
        if length < 0 or length > MAX_BODY:
            self._deny(413); return
        try:
            raw = self.rfile.read(length).decode() if length else "{}"
            body = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._deny(400); return
        if u.path == "/shutdown":
            self._ok(json.dumps({"ok": True}))
            threading.Thread(target=self.server.shutdown, daemon=True).start(); return
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
        if not isinstance(body, dict):
            return None
        # Match install.sh --apply-plan's strict contract: the plan must be exactly
        # {"install": [...], "uninstall": [...]} - no missing keys, no extras. This keeps
        # the server seam from accepting a shape the installer itself would reject.
        if set(body.keys()) != {"install", "uninstall"}:
            return None
        out = {"install": [], "uninstall": []}
        for k in ("install", "uninstall"):
            vals = body.get(k, [])
            if not isinstance(vals, list):
                return None
            for leaf in vals:
                if not isinstance(leaf, str) or not LEAF_RE.match(leaf):
                    return None
                # No empty path segments: reject leading/trailing/double slash so a value
                # cannot resolve to an absolute-looking or malformed path. Real leaves never
                # have these; install.sh's allowlist is still the authoritative check.
                if leaf.startswith("/") or leaf.endswith("/") or "//" in leaf:
                    return None
                out[k].append(leaf)
        return out
    def _stream_apply(self, plan):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-cache"); self.end_headers()
        p = install_sh("--apply-plan", stream=True)
        p.stdin.write(json.dumps(plan)); p.stdin.close()
        for line in p.stdout:
            try:
                self.wfile.write(line.encode()); self.wfile.flush()
            except BrokenPipeError:
                p.kill(); return
        p.wait()
        # CLOSING LINE. This is both the last thing a reader sees in the log and the
        # signal the browser reads to decide whether the plan actually landed, so it
        # is worded for the person and matched exactly by the client. Changing this
        # wording means changing the matching test in index.html in the same commit,
        # or every apply will report as failed.
        if p.returncode == 0:
            end = "\nAll changes applied successfully.\n"
        else:
            end = (f"\nApply did not complete. The installer stopped with status "
                   f"{p.returncode} and your staged changes were kept.\n")
        try:
            self.wfile.write(end.encode())
        except BrokenPipeError:
            pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=0)
    ap.add_argument("--repo", required=True)
    ap.add_argument("--print-nonce")
    ap.add_argument("--print-url")
    args = ap.parse_args()
    State.repo = os.path.abspath(args.repo)
    State.nonce = secrets.token_urlsafe(24)
    srv = ThreadingHTTPServer((State.host, args.port), H)
    port = srv.server_address[1]
    url = f"http://{State.host}:{port}/?token={State.nonce}"
    if args.print_nonce:
        write_private(args.print_nonce, State.nonce)
    if args.print_url:
        write_private(args.print_url, url)
    print(url, flush=True)
    srv.serve_forever()

if __name__ == "__main__":
    main()
