#!/usr/bin/env python3
"""
codex-review.py - reliable REAL-Codex cross-model review, or a loud failure.

WHY THIS EXISTS (2026-06-30, Jonah): the codex:codex-rescue agent, when its
underlying codex call is slow (config defaults to gpt-5.5 + xhigh) or wedges,
returns a placeholder and silently falls back to reviewing the diff ITSELF -
a same-model review wearing a cross-model label. The produce-and-verify gate
(CLAUDE.md Verification Protocol #8) then passes without a real different-model
pass and with no error surfaced.

This tool is the dependable path. It ALWAYS invokes real Codex, and it either
returns a genuine Codex verdict (exit 0) or fails LOUDLY with a distinct exit
code. It never emits a same-model fallback - the caller decides the documented
fallback (independent Claude reviewer) only after seeing an explicit failure.

It folds in the hard-won invocation rules from
reference_codex_exec_hang_sigkill.md plus a real Codex review of this tool
(2026-06-30):
  - prompt passed as the POSITIONAL arg after `--` (a redirected stdin with no
    positional prompt makes codex wait on a tty and wedge; `--` stops a prompt
    that starts with `-` from being parsed as a flag); the diff goes via input=.
  - bounded by a watchdog that SIGKILLs the whole PROCESS GROUP on timeout (a
    wedged codex ignores SIGTERM, and it may spawn descendants that outlive a
    bare child kill).
  - model_reasoning_effort=high, not xhigh (xhigh is slow on real diffs and is
    what trips the agent's wait window in the first place).
  - SUCCESS is rc==0 AND non-empty stdout. A non-zero exit is never reported as
    success even if it printed partial output. Capacity signatures are trusted
    only from stderr or from SHORT stdout - a real review that merely DISCUSSES
    "at capacity"/"error" is long and must not be misread as a backend failure.

USAGE
  git diff HEAD | ~/.claude/hooks/codex-review.py "Review this diff for bugs. Findings by severity." -C "$(git rev-parse --show-toplevel)"
  ~/.claude/hooks/codex-review.py --smoke    # health check

EXIT CODES
  0  real Codex verdict obtained (printed to stdout)
  2  codex not installed -> caller must use the independent-Claude-reviewer fallback
  3  wedged / timed out (process group SIGKILLed) -> infra hang
  4  capacity / backend error after one retry, or non-zero exit -> backend flake
  5  empty / no-verdict output -> ran but produced nothing usable
"""
import argparse
import os
import re
import shutil
import signal
import subprocess
import sys
import time

# Capacity/backend failure signatures, mirrored from codex-failure-watcher.sh.
CAPACITY_SIGS = [
    r"selected model is at capacity",
    r"model is at capacity",
    r"\bat capacity\b",
    r"stream[ _]error",
    r"error sending request",
    r"request failed",
]
# A real review is long; a bare codex error message is short. Only trust a
# capacity signature found in STDOUT when the whole stdout is short, so that a
# genuine review which merely discusses these phrases is not misclassified.
SHORT_OUTPUT = 600


def _cap_in(text: str) -> bool:
    if any(re.search(p, text, re.IGNORECASE) for p in CAPACITY_SIGS):
        return True
    if re.search(r"(?m)^\s*ERROR\b", text):  # codex/rust-style error line, case-sensitive
        return True
    return False


def _is_capacity(out: str, err: str) -> bool:
    """Capacity/backend flake: trust stderr always; trust stdout only if short."""
    if _cap_in(err):
        return True
    if out.strip() and len(out.strip()) < SHORT_OUTPUT and _cap_in(out):
        return True
    return False


def _run(cmd, diff_bytes, timeout):
    """Run codex bounded. On timeout, SIGKILL the whole process group (codex may
    spawn descendants); start_new_session makes the child a group leader."""
    t0 = time.time()
    p = subprocess.Popen(
        cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        start_new_session=True,
    )
    # Capture the process-group id NOW, while the leader is guaranteed alive. If
    # we wait until the timeout handler, the leader may already have exited and
    # os.getpgid would raise - leaving surviving descendants un-killed.
    try:
        pgid = os.getpgid(p.pid)
    except ProcessLookupError:
        pgid = None
    try:
        out, err = p.communicate(input=diff_bytes, timeout=timeout)
        return p.returncode, out.decode(errors="replace"), err.decode(errors="replace"), time.time() - t0, False
    except subprocess.TimeoutExpired:
        if pgid is not None:
            try:
                os.killpg(pgid, signal.SIGKILL)  # whole group: codex + any descendants
            except (ProcessLookupError, PermissionError):
                pass
        try:
            p.kill()
        except Exception:
            pass
        try:
            p.communicate(timeout=10)
        except Exception:
            pass
        return None, "", "", time.time() - t0, True


# --- codex launcher resolution ---------------------------------------------
# There are TWO shapes of `codex` in the wild and we must launch each correctly:
#
#   1. A Node script. A stock npm/nvm install of codex is a JS entrypoint whose
#      `#!/usr/bin/env node` shebang picks up whatever `node` is first on PATH.
#      In a non-interactive shell that can be an ancient node (e.g. v12) which
#      cannot parse codex's top-level await, so codex dies with
#      `SyntaxError: Unexpected reserved word` BEFORE it runs. For this shape we
#      must NOT lean on the ambient node: resolve a node>=16 absolutely and
#      invoke `<node> <codex.js>`. See reference_codex_broken_node12_path.md.
#
#   2. A shell shim / non-Node executable. On a cmux machine `codex` on PATH is a
#      Bourne-Again shell SHIM (cmux-cli-shims/.../codex) that execs the real
#      codex. Forcing THAT through node (`node <shim>`) crashes instantly -
#      node's module loader tries to parse bash as JS and throws
#      `SyntaxError: Unexpected token '['`, exit 1, before codex ever runs. For
#      this shape we invoke the executable DIRECTLY and let its own shebang pick
#      the interpreter.
#
# So: detect what the resolved codex actually IS, then dispatch. The node>=16
# resolution applies ONLY to the Node-script shape; everything else runs direct.
_CODEX_ARGV = None


def _is_node_script(path):
    """True if `path` is a Node entrypoint we should launch via an explicit node:
    any file whose shebang invokes node, or (absent a shebang) a .js/.mjs/.cjs
    file. A shell shim, a compiled binary, or anything unreadable is NOT a node
    script -> run direct.

    The shebang is AUTHORITATIVE and wins over the extension: a shim named
    `codex.js` that actually starts `#!/usr/bin/env bash` is a shell script and
    must run direct, not through node. Only when there is no shebang do we fall
    back to the filename extension (a bare JS entrypoint). A read failure leaves
    us with no shebang, so an unreadable non-.js file (e.g. the cmux shim) falls
    through to direct - we never force a non-node file through node, the very
    crash this guards against. Reads 1024 bytes so a long
    `#!/usr/bin/env -S ... node` line is not truncated past its `node`."""
    try:
        with open(path, "rb") as fh:
            first = fh.readline(1024).decode("utf-8", errors="replace")
    except OSError:
        first = ""
    if first.startswith("#!"):
        return re.search(r"\bnode\b", first) is not None
    return re.search(r"\.(?:js|mjs|cjs)$", path, re.IGNORECASE) is not None


def _node_major(node_bin):
    try:
        out = subprocess.run([node_bin, "--version"], capture_output=True,
                             text=True, timeout=10).stdout.strip()
    except Exception:
        return -1
    m = re.match(r"v?(\d+)\.", out)
    return int(m.group(1)) if m else -1


def _nvm_nodes_newest_first():
    root = os.path.expanduser("~/.nvm/versions/node")
    if not os.path.isdir(root):
        return []

    def key(v):
        nums = [int(n) for n in re.findall(r"\d+", v)[:3]]
        return tuple(nums) + (0,) * (3 - len(nums))

    return [os.path.join(root, v, "bin", "node")
            for v in sorted(os.listdir(root), key=key, reverse=True)]


def codex_argv():
    """Command PREFIX to launch codex, robust to BOTH codex shapes (see the block
    comment above).

    If the resolved codex is a shell shim / non-Node executable (the cmux case),
    return [<codex-on-PATH>] and invoke it DIRECTLY via its own shebang - never
    force it through node, which would crash on a bash script.

    If it is a Node script, return the node>=16 launcher prefix independent of the
    ambient `node`: prefers, in order, $CODEX_NODE_BIN, the node co-located with
    the codex symlink (normally >=16, since codex was installed under it), the
    ambient node if it happens to be >=16, then the newest nvm node>=16. Every
    candidate is still version-checked; if nothing compatible is found it falls
    back to invoking codex directly (its shebang picks the ambient node and fails
    loudly, exactly as before). Memoized."""
    global _CODEX_ARGV
    if _CODEX_ARGV is not None:
        return list(_CODEX_ARGV)
    link = shutil.which("codex")
    if not link:
        _CODEX_ARGV = ["codex"]
        return list(_CODEX_ARGV)
    codex_target = os.path.realpath(link)
    # Shell shim / non-Node executable: run it directly, let its shebang decide.
    if not _is_node_script(codex_target):
        _CODEX_ARGV = [link]
        return list(_CODEX_ARGV)
    # Node-script codex: force a known-good node>=16 so an ancient ambient node
    # cannot crash it before it runs.
    candidates = []
    if os.environ.get("CODEX_NODE_BIN"):
        candidates.append(os.environ["CODEX_NODE_BIN"])
    candidates.append(os.path.join(os.path.dirname(link), "node"))  # co-located
    amb = shutil.which("node")
    if amb:
        candidates.append(amb)
    candidates += _nvm_nodes_newest_first()
    for node_bin in candidates:
        if node_bin and os.path.isfile(node_bin) and os.access(node_bin, os.X_OK) \
                and _node_major(node_bin) >= 16:
            _CODEX_ARGV = [node_bin, codex_target]
            return list(_CODEX_ARGV)
    _CODEX_ARGV = [link]  # no compatible node found; run codex directly, fail loudly
    return list(_CODEX_ARGV)


def build_cmd(prompt, repo, effort, model, skip_git):
    cmd = codex_argv() + ["exec", "-s", "read-only"]
    if skip_git:
        cmd.append("--skip-git-repo-check")
    if repo:
        cmd += ["-C", repo]
    cmd += ["-c", f"model_reasoning_effort={effort}"]
    if model:
        cmd += ["-m", model]
    cmd += ["--", prompt]  # `--` ends options so a prompt starting with `-` is not a flag
    return cmd


def classify(rc, out, err):
    """ok | capacity | empty | error.

    SUCCESS is judged by codex's OWN exit code plus non-empty stdout - NOT by the
    absence of scary words, because codex emits ERROR/retry chatter on stderr even
    on a fully successful run. Text scanning is only consulted to (a) catch the
    rare rc==0 short capacity-stub and (b) classify an already-failed (rc!=0) run
    for retry-vs-giveup. On the failure path the stderr scan is safe."""
    out_s = out.strip()
    if rc == 0:
        if not out_s:
            return "empty"
        # rare: codex printed only a short capacity error yet exited 0
        if len(out_s) < SHORT_OUTPUT and _cap_in(out_s):
            return "capacity"
        return "ok"
    # rc != 0 -> genuine failure; decide retry (capacity flake) vs hard error.
    if _is_capacity(out, err):
        return "capacity"
    if not out_s:
        return "empty"
    return "error"


def main():
    ap = argparse.ArgumentParser(description="Reliable real-Codex review or loud failure.")
    ap.add_argument("prompt", nargs="?", help="Review prompt (positional). Diff/context goes on stdin.")
    ap.add_argument("-C", "--repo", default=None, help="Repo root passed to codex -C.")
    ap.add_argument("-t", "--timeout", type=int, default=420, help="Hard timeout seconds (SIGKILL). Default 420.")
    ap.add_argument("-e", "--effort", default="high", help="model_reasoning_effort (default high; xhigh is too slow for review).")
    ap.add_argument("-m", "--model", default=None, help="Override model (default: codex config, currently gpt-5.5).")
    ap.add_argument("--no-skip-git", action="store_true", help="Do not pass --skip-git-repo-check.")
    ap.add_argument("--smoke", action="store_true", help="Health check: expect SMOKE_OK fast at low effort.")
    args = ap.parse_args()

    if not shutil.which("codex"):
        print("CODEX NOT INSTALLED: `codex` is not on PATH. Use the independent-Claude-reviewer fallback "
              "(a fresh agent that did NOT produce the unit). See CLAUDE.md Verification Protocol #8.", file=sys.stderr)
        return 2

    if args.smoke:
        cmd = build_cmd("Reply with exactly: SMOKE_OK", args.repo, "low", args.model, not args.no_skip_git)
        rc, out, err, dt, timed_out = _run(cmd, b"", min(args.timeout, 90))
        if timed_out:
            print(f"SMOKE TIMEOUT after {dt:.0f}s -> codex wedged even at low effort.", file=sys.stderr)
            return 3
        if rc == 0 and "SMOKE_OK" in out and len(out.strip()) < 60:
            print(f"HEALTHY: codex returned SMOKE_OK in {dt:.1f}s (exit {rc}).")
            return 0
        print(f"SMOKE FAILED after {dt:.1f}s (exit {rc}). stdout tail: {out.strip()[-200:]!r} stderr tail: {err.strip()[-200:]!r}", file=sys.stderr)
        return 5 if rc == 0 else 4

    if not args.prompt:
        ap.error("a positional review prompt is required (or use --smoke)")

    diff_bytes = b""
    if not sys.stdin.isatty():
        diff_bytes = sys.stdin.buffer.read()

    # Attempt 1 at requested effort.
    cmd = build_cmd(args.prompt, args.repo, args.effort, args.model, not args.no_skip_git)
    rc, out, err, dt, timed_out = _run(cmd, diff_bytes, args.timeout)
    if timed_out:
        print(f"CODEX WEDGED: no verdict after {dt:.0f}s; process group SIGKILLed. This is the documented hang "
              f"(reference_codex_exec_hang_sigkill.md). Do NOT silently downgrade - retry leaner or use the "
              f"independent-Claude-reviewer fallback and SAY the cross-model pass did not complete.", file=sys.stderr)
        return 3

    cls = classify(rc, out, err)

    # One leaner retry on a capacity/backend flake.
    if cls == "capacity":
        print(f"[codex-review] attempt 1 looked like a capacity/backend flake (exit {rc}); "
              f"retrying once at effort=medium. stderr tail: {err.strip()[-200:]!r}", file=sys.stderr)
        cmd2 = build_cmd(args.prompt, args.repo, "medium", args.model, not args.no_skip_git)
        rc, out, err, dt, timed_out = _run(cmd2, diff_bytes, args.timeout)
        if timed_out:
            print(f"CODEX WEDGED on retry after {dt:.0f}s; process group SIGKILLed.", file=sys.stderr)
            return 3
        cls = classify(rc, out, err)

    if cls == "ok":
        sys.stdout.write(out)
        if not out.endswith("\n"):
            sys.stdout.write("\n")
        print(f"\n[codex-review] real Codex verdict obtained in {dt:.1f}s (exit {rc}).", file=sys.stderr)
        return 0
    if cls == "capacity":
        print(f"CODEX BACKEND ERROR after retry (capacity/stream/request). stderr tail: {err.strip()[-300:]!r}\n"
              f"Backend is flaky - fall back to the independent-Claude-reviewer and SAY so.", file=sys.stderr)
        return 4
    if cls == "empty":
        print(f"CODEX EMPTY OUTPUT after {dt:.0f}s (exit {rc}). Ran but produced no verdict. stderr tail: {err.strip()[-300:]!r}", file=sys.stderr)
        return 5
    # cls == "error"
    print(f"CODEX NON-ZERO EXIT {rc} after {dt:.0f}s with output but no clean verdict. NOT reporting success. "
          f"stderr tail: {err.strip()[-300:]!r}", file=sys.stderr)
    return 4


if __name__ == "__main__":
    sys.exit(main())
