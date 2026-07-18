---
name: Installer GUI localhost server
description: Localhost-only GUI installer server (nonce + allowlist + streamed apply) plus its test
type: project
relates_to: [session_2026-07-17_installer-manifest-emitter.md, session_2026-07-17_apply-plan-entry.md, session_2026-07-17_gui-installer-design.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 3 of the GUI installer plan (branch gui-installer). Built the localhost server that
serves the page, proxies `install.sh --manifest`, and runs applies via
`install.sh --apply-plan`, streaming the log. The server holds NO install logic of its own.

Changes (one line each):
- Added claude/hooks/test-installer-gui-server.sh: boots server on an EPHEMERAL port
  (--port 0), reads host/port/token back from --print-url, asserts /health is open and
  reports bind 127.0.0.1, /manifest without token is 403, /manifest?token=<nonce> is valid
  JSON, and a wrong token is 403. Trap kills server + removes temp files.
- Added claude/installer-gui/server.py: 127.0.0.1-only ThreadingHTTPServer. One-time
  startup nonce (secrets.token_urlsafe) required on every state route; loopback Host check;
  LEAF_RE allowlist on plan leaves; subprocess is always an argv LIST (never shell=True);
  streamed apply. Tolerates a missing index.html (Task 5) with a small placeholder on GET /.

Why (rationale):
- Security posture is the whole point: bind loopback only, gate every state route on a
  per-instance nonce AND a loopback Host, and never build a shell string from user input.
  Leaf values reach install.sh as argv/stdin data and are additionally re-validated by
  install.sh --apply-plan's own allowlist, so the server is defense-in-depth, not the only
  gate.
- Personal (ghostty/shaders) leaves are never offered: install.sh --manifest excludes them
  by default and --apply-plan rejects them, so the server forwards neither.

How (mechanics):
- /manifest -> `bash <repo>/install.sh --manifest` (read-only), returns its stdout JSON.
- /dry-run -> `install.sh --dry-run --apply-plan` over stdin, returns {out:...}, no files
  touched. /apply -> `install.sh --apply-plan`, streams the executor log line by line.
- Ephemeral port + --print-url/--print-nonce make the test port-collision safe.

Codex cross-model review (codex-cli 0.142.5, real verdict exit 0) and folds:
- Medium (Host check): `startswith("127.0.0.1")` accepted `127.0.0.1.evil.com` (DNS-rebind
  bypass) and never inspected Origin. Folded: exact hostname match via partition(":"), plus
  reject a present non-loopback Origin. Absent Origin (curl/same-origin) still allowed.
- Medium (LEAF_RE allows `/`): partly a misread - `/` is load-bearing (real leaves are
  slash paths). `.` is excluded so `..` is impossible; install.sh's manifest-derived
  allowlist is authoritative. Folded the cheap part: reject leading/trailing/double slash.
- Low (nonce naming): behavior matches spec/test (reusable per-instance session nonce).
  Doc-only clarification on State.nonce.
- Low (no body cap): folded a 1 MiB MAX_BODY cap (413) on POST, plus fail-clean 400 on a
  bad Content-Length / non-utf8 body. Re-verified: test still 6/6, smoke re-run green,
  second Codex pass clean.

Second Codex pass (confirmed all three above resolved) surfaced two more:
- Medium (token files world-readable): --print-nonce/--print-url held the bearer token but
  were written with plain open() under the caller umask (0644 under 022). Folded: new
  write_private() opens 0600 + chmod 0600, so another local user cannot read the token.
  Verified with `stat` after a real run (perms 600).
- Low (unbounded ThreadingHTTPServer, local DoS): DECLINED with rationale. A short socket
  timeout is the obvious mitigation but would break the legitimate streaming /apply route -
  a real install (e.g. lotus npm build) streams with multi-minute quiet gaps a timeout
  cannot distinguish from a slow-loris hold. Loopback-only + single-user installer makes the
  local-availability risk acceptable; folding it would regress functionality.

Files touched:
- claude/installer-gui/server.py (new)
- claude/hooks/test-installer-gui-server.sh (new)

Collaborator: Jonah
