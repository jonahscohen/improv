#!/usr/bin/env python3
"""Regression coverage for the child_process exec rule in the
security-guidance PreToolUse hook.

Context (2026-07-24, Jonah): the rule matched a bare call token as a plain
SUBSTRING, so every RegExp string-match call tripped a BLOCKING
command-injection warning. That trains people to bypass a security hook,
which is the real damage - a hook that cries wolf gets ignored when it is
right.

This file locks both directions so the narrowing cannot silently regress:

  * TRUE POSITIVES  - a real shell call must still block (exit 2).
  * FALSE POSITIVES - RegExp string matching must pass clean (exit 0).

Run:  python3 claude/hooks/test-security-guidance-exec.py
Override the hook location with SG_HOOK=/path/to/security_reminder_hook.py
"""

import json
import os
import subprocess
import sys
import tempfile
import uuid

DEFAULT_HOOK = os.path.expanduser(
    "~/.claude/plugins/cache/claude-plugins-official/"
    "security-guidance/unknown/hooks/security_reminder_hook.py"
)
HOOK = os.environ.get("SG_HOOK", DEFAULT_HOOK)

BLOCK = 2   # hook fired: warning on stderr, tool call blocked
PASS = 0    # hook stayed quiet
TIMEOUT = -1  # hook hung; a wall-clock hang is a failure, not a crash

# Text unique to the child_process reminder. Asserted on every BLOCK case so a
# true positive cannot pass by tripping some OTHER rule - an exit code alone
# does not prove the right rule fired.
RULE_MARKER = "command injection vulnerabilities"

# The module specifier is assembled rather than written literally so this
# test file does not itself trip a substring-matching guard.
CP = "child" + "_process"


def run_hook(file_path, new_string=None, content=None, tool="Edit",
             edits=None, raw_tool_input=None):
    """Invoke the hook exactly as Claude Code does and return (exit, stderr)."""
    if raw_tool_input is not None:
        tool_input = raw_tool_input
    else:
        tool_input = {"file_path": file_path}
        if tool == "Write":
            tool_input["content"] = content
        elif tool == "MultiEdit":
            tool_input["edits"] = edits or []
        else:
            tool_input["new_string"] = new_string
    payload = {
        # Unique per call: the hook suppresses a repeat warning for the same
        # file+rule within a session, which would mask a real result.
        "session_id": "sgtest-" + uuid.uuid4().hex,
        "tool_name": tool,
        "tool_input": tool_input,
    }
    try:
        proc = subprocess.run(
            [sys.executable, HOOK],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=20,
        )
        code, err = proc.returncode, proc.stderr
    except subprocess.TimeoutExpired:
        # A hang is a RESULT, not a crash. This hook blocks the edit while it
        # runs, so "never returns" is the worst outcome it has - the suite has
        # to be able to report it rather than die on it.
        code, err = TIMEOUT, "timed out"
    state = os.path.expanduser(
        "~/.claude/security_warnings_state_%s.json" % payload["session_id"]
    )
    try:
        os.remove(state)
    except OSError:
        pass
    return code, err


def write(tmp, name, text):
    path = os.path.join(tmp, name)
    with open(path, "w") as f:
        f.write(text)
    return path


def build_cases(tmp):
    """Return [(label, expected_exit, kwargs_for_run_hook), ...]."""
    cases = []

    # ---------------- TRUE POSITIVES: must still block ----------------

    cases.append((
        "TP qualified member call",
        BLOCK,
        {"file_path": write(tmp, "tp_qualified.js", ""),
         "new_string": "%s.exec(`ls ${userInput}`, cb);" % CP},
    ))

    cases.append((
        "TP require(...) member call",
        BLOCK,
        {"file_path": write(tmp, "tp_require.js", ""),
         "new_string": "require('%s').exec(`rm -rf ${dir}`);" % CP},
    ))

    # The import lives in the file, the edit is a bare call - the common
    # real-world shape, and the one a content-only check would miss.
    cases.append((
        "TP bare call, CommonJS destructured import on disk",
        BLOCK,
        {"file_path": write(tmp, "tp_cjs.js",
                            "const { exec } = require('%s');\n" % CP),
         "new_string": "  exec(`git log ${branch}`, cb);"},
    ))

    cases.append((
        "TP bare call, ESM named import on disk",
        BLOCK,
        {"file_path": write(tmp, "tp_esm.mjs",
                            "import { exec } from 'node:%s';\n" % CP),
         "new_string": "  exec(`curl ${url}`);"},
    ))

    cases.append((
        "TP namespace alias member call",
        BLOCK,
        {"file_path": write(tmp, "tp_alias.js",
                            "const cp = require('%s');\n" % CP),
         "new_string": "  cp.exec(`tar xf ${file}`);"},
    ))

    cases.append((
        "TP Sync variant, bare, with import on disk",
        BLOCK,
        {"file_path": write(tmp, "tp_sync.ts",
                            "import { execSync } from 'node:%s';\n" % CP),
         "new_string": "const out = execSync(`whoami ${flag}`);"},
    ))

    # Found by the cross-model review: all three of these reached a shell and
    # were MISSED by the first cut of the matcher.
    cases.append((
        "TP TypeScript import-equals binding",
        BLOCK,
        {"file_path": write(tmp, "tp_ts_import_eq.ts",
                            "import cp = require('node:%s');\n" % CP),
         "new_string": "  cp.exec(`kill ${pid}`);"},
    ))

    cases.append((
        "TP dynamic await import binding",
        BLOCK,
        {"file_path": write(tmp, "tp_dynamic.mjs",
                            "const cp = await import('node:%s');\n" % CP),
         "new_string": "  cp.exec(`rm ${path}`);"},
    ))

    cases.append((
        "TP optional-chaining call",
        BLOCK,
        {"file_path": write(tmp, "tp_optchain.js", ""),
         "new_string": "require('%s').exec?.(`echo ${v}`);" % CP},
    ))

    cases.append((
        "TP Sync variant, member call",
        BLOCK,
        {"file_path": write(tmp, "tp_sync_member.js", ""),
         "new_string": "const out = %s.execSync(cmd);" % CP},
    ))

    cases.append((
        "TP whole-file Write with import and call",
        BLOCK,
        {"file_path": os.path.join(tmp, "tp_write.js"),
         "tool": "Write",
         "content": ("import { exec } from '%s';\n"
                     "export const go = (i) => exec(`echo ${i}`);\n" % CP)},
    ))

    # The promisify chain is the standard async shell pattern. The call is
    # later invoked under an arbitrary name, so the binding line is the only
    # place it can be caught at all.
    cases.append((
        "TP promisify binding, bare",
        BLOCK,
        {"file_path": write(tmp, "tp_promisify.js",
                            "const { exec } = require('%s');\n" % CP),
         "new_string": "const execAsync = promisify(exec);"},
    ))

    cases.append((
        "TP promisify binding, fully qualified",
        BLOCK,
        {"file_path": write(tmp, "tp_promisify_q.js", ""),
         "new_string": "const run = util.promisify(%s.exec);" % CP},
    ))

    cases.append((
        "TP multi-edit reaches every edit",
        BLOCK,
        {"file_path": write(tmp, "tp_multi.js",
                            "const { exec } = require('%s');\n" % CP),
         "tool": "MultiEdit",
         "edits": [{"new_string": "const safe = 1;"},
                   {"new_string": "exec(`ls ${dir}`);"}]},
    ))

    # _JS_EXTS members that were declared but never exercised.
    for ext in ("jsx", "tsx", "cjs", "vue", "svelte"):
        cases.append((
            "TP .%s is in scope" % ext,
            BLOCK,
            {"file_path": write(tmp, "tp_ext.%s" % ext, ""),
             "new_string": "%s.exec(`ls ${d}`);" % CP},
        ))

    # ---------------- FALSE POSITIVES: must stay quiet ----------------

    # The exact reported repro. Note this file DOES import the Sync variant
    # from the module, so import evidence is present - the dot-exclusion is
    # what has to carry this case, not the import gate.
    repro = "/Users/spare3/Documents/Github/improv/sidecoach/eval/subjective-label-harness.mjs"
    if os.path.exists(repro):
        cases.append((
            "FP reported repro: regex literal .exec() in the real file",
            PASS,
            {"file_path": repro,
             "new_string": r"  const m = /font-family\s*:\s*([^;}]*)/i.exec(str);"},
        ))

    cases.append((
        "FP regex literal .exec()",
        PASS,
        {"file_path": write(tmp, "fp_literal.js", ""),
         "new_string": r"const m = /^(-?[_a-zA-Z][-\w]*)/.exec(rest);"},
    ))

    cases.append((
        "FP regex in a variable .exec()",
        PASS,
        {"file_path": write(tmp, "fp_var.ts", ""),
         "new_string": "const m = pattern.exec(input);"},
    ))

    cases.append((
        "FP optional chaining ?.exec()",
        PASS,
        {"file_path": write(tmp, "fp_optional.ts", ""),
         "new_string": "const m = matcher?.exec(line);"},
    ))

    cases.append((
        "FP constructed RegExp .exec()",
        PASS,
        {"file_path": write(tmp, "fp_ctor.js", ""),
         "new_string": "const m = new RegExp(`^\\.(${IDENT})`).exec(rest);"},
    ))

    # execFile is the SAFE alternative the warning itself recommends; firing
    # on it would tell people to replace the fix with the fix.
    cases.append((
        "FP execFile, the recommended safe call",
        PASS,
        {"file_path": write(tmp, "fp_execfile.js",
                            "const { execFile } = require('%s');\n" % CP),
         "new_string": "  execFile('git', ['log', branch], cb);"},
    ))

    # Regex matching in a file that also legitimately shells out elsewhere.
    cases.append((
        "FP regex .exec() in a file that imports the module",
        PASS,
        {"file_path": write(tmp, "fp_mixed.mjs",
                            "import { execSync } from 'node:%s';\n" % CP),
         "new_string": "  const m = /(<body[\\s\\S]*<\\/body>)/i.exec(html);"},
    ))

    # Also found by the cross-model review: the Sync variant used to fire on
    # any dot-preceded call, so a database driver's own method tripped it.
    cases.append((
        "FP database driver Sync method",
        PASS,
        {"file_path": write(tmp, "fp_db_sync.js", ""),
         "new_string": "sqlite.execSync('vacuum');"},
    ))

    cases.append((
        "FP locally defined helper of the same name",
        PASS,
        {"file_path": write(tmp, "fp_local_helper.js", ""),
         "new_string": "function execSync(sql) { return db.run(sql); }"},
    ))

    # The sharpest own-goal in the class: a safe execFile wrapper DECLARED as
    # `function exec` sits in a file that must import child_process, so the
    # hook was blocking the exact remediation its own message recommends.
    cases.append((
        "FP execFile wrapper declared as function exec",
        PASS,
        {"file_path": write(tmp, "fp_wrapper.ts",
                            "import { execFile } from 'node:%s';\n" % CP),
         "new_string": "export function exec(cmd: string, args: string[]) "
                       "{ return execFile(cmd, args); }"},
    ))

    cases.append((
        "FP class method declared as async exec",
        PASS,
        {"file_path": write(tmp, "fp_method.ts",
                            "import { execFile } from 'node:%s';\n" % CP),
         "new_string": "  async exec(cmd: string) { return execFile(cmd, []); }"},
    ))

    # Documented narrowing: the rule is Node-specific, so it no longer fires
    # on Python. Previously a .py file got the JS-only advice, which was
    # itself wrong.
    cases.append((
        "FP python file no longer gets Node-specific advice",
        PASS,
        {"file_path": write(tmp, "fp_python.py", ""),
         "new_string": "exec(compile(src, name, 'exec'))"},
    ))

    # ---------------- fail-open: malformed input must never block ----------

    cases.append((
        "ROBUST tool_input as a list does not traceback",
        PASS,
        {"file_path": None, "raw_tool_input": ["not", "a", "dict"]},
    ))

    cases.append((
        "ROBUST non-string file_path does not traceback",
        PASS,
        {"file_path": None,
         "raw_tool_input": {"file_path": 12345, "new_string": "exec(cmd)"}},
    ))

    cases.append((
        "ROBUST null new_string does not traceback",
        PASS,
        {"file_path": None,
         "raw_tool_input": {"file_path": os.path.join(tmp, "n.js"),
                            "new_string": None}},
    ))

    # A long whitespace run after a bare call name used to backtrack
    # quadratically: 130k spaces held the edit for 21 seconds.
    cases.append((
        "PERF long whitespace run does not stall the hook",
        PASS,
        {"file_path": write(tmp, "perf_ws.js", ""),
         "new_string": "exec" + " " * 130000 + "X"},
    ))

    # A FIFO stats as 0 bytes, so the size cap does not catch it; opening one
    # blocks forever waiting for a writer, with no timeout to save the edit.
    fifo = os.path.join(tmp, "fifo_evidence.js")
    try:
        os.mkfifo(fifo)
        cases.append((
            "ROBUST FIFO as the edit target does not hang",
            PASS,
            {"file_path": fifo, "new_string": "const m = /re/.exec(s);"},
        ))
    except (OSError, AttributeError, NotImplementedError):
        pass

    return cases


def perf_check():
    """Lock the fix for the quadratic alias scan.

    The first cut compiled a fresh regex and rescanned the whole file for
    EVERY module binding it found. The cross-model review measured 0.375s at
    1k bindings, 3.3s at 3k, and a hang at 10k. This hook BLOCKS the edit
    while it runs, so that is a denial-of-editing, not just slowness.
    """
    import importlib.util
    import time

    spec = importlib.util.spec_from_file_location("sg_hook", HOOK)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    cp = "child" + "_process"
    ok = True
    for n in (1000, 3000, 10000):
        content = "\n".join(
            "const cp%d = require('%s');" % (i, cp) for i in range(n)
        )
        start = time.perf_counter()
        mod._child_process_exec_match(content, "")
        elapsed = time.perf_counter() - start
        # Generous ceiling: the point is linear-not-quadratic, and the old
        # code blew past this at n=3000.
        limit = 0.5
        good = elapsed < limit
        ok = ok and good
        print("  %s  %-58s %.3fs" % (
            "PASS" if good else "FAIL",
            "perf %d module bindings (< %.1fs)" % (n, limit), elapsed))
    return ok


def main():
    if not os.path.exists(HOOK):
        print("SKIP: hook not found at %s" % HOOK)
        print("      set SG_HOOK to point at it")
        return 0

    print("hook: %s\n" % HOOK)

    # Fail loudly if the hook does not even import.
    syntax = subprocess.run(
        [sys.executable, "-c", "import py_compile,sys; py_compile.compile(sys.argv[1], doraise=True)", HOOK],
        capture_output=True, text=True,
    )
    if syntax.returncode != 0:
        print("FAIL: hook does not compile\n%s" % syntax.stderr)
        return 1

    passed = failed = 0
    with tempfile.TemporaryDirectory(prefix="sg-exec-test-") as tmp:
        for label, expected, kwargs in build_cases(tmp):
            code, err = run_hook(**kwargs)
            ok = code == expected
            wrong_rule = ok and expected == BLOCK and RULE_MARKER not in err
            if wrong_rule:
                ok = False
            if ok:
                passed += 1
                print("  PASS  %-58s exit=%d" % (label, code))
            else:
                failed += 1
                if wrong_rule:
                    print("  FAIL  %-58s exit=%d but a DIFFERENT rule fired"
                          % (label, code))
                else:
                    want = "block(2)" if expected == BLOCK else "pass(0)"
                    print("  FAIL  %-58s exit=%d expected %s"
                          % (label, code, want))
                if err.strip():
                    print("        stderr: %s" % err.strip().splitlines()[0])

    if not perf_check():
        failed += 1
    else:
        passed += 1

    print("\n%d passed, %d failed" % (passed, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
