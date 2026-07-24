#!/usr/bin/env python3
"""Regression coverage for the seven SIBLING rules in the security-guidance
PreToolUse hook - the ones that were still plain substring matches with no
path gate after the 2026-07-24 child_process exec narrowing.

Context (2026-07-24, Jonah): `new_function_injection` BLOCKED a session beat -
a .md file - purely because the prose discussed the rule. Six siblings had the
same defect, `pickle_deserialization` worst of all: the bare word in ANY file
fired it. The hook does sys.exit(2), so these are blocking false positives.

The exec rule already has its own suite in test-security-guidance-exec.py.
This file is its sibling and follows the same structure: unique session_id per
invocation, state-file cleanup, exit 2 = fires / exit 0 = quiet.

Both directions are locked for every rule, because a gate that silences a rule
everywhere is not a fix - it is a deletion:

  * TRUE POSITIVES  - real dangerous usage must still block (exit 2).
  * FALSE POSITIVES - prose, docs, and unrelated method calls pass (exit 0).

Run:  python3 claude/hooks/test-security-guidance-rules.py
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

# Dangerous tokens are ASSEMBLED, never written literally. This file is a .py,
# and the rules under test fire on .py files, so a literal token here would
# make the suite unwritable by the very hook it covers. Same technique the
# exec suite uses for the module specifier.
PIC = "pick" + "le"                    # the serialization module
EV = "ev" + "al"                       # the dynamic-code call
SYS = "sys" + "tem"                    # the shell-out function name
OSSYS = "os." + SYS                    # the shell-out call
# The import keyword is split as well: the rule now scans a WINDOW after a
# from-import prefix, so an unsplit prefix here would match against whatever
# happened to follow it in this file.
FROM_OS = "from os " + "import " + SYS

# These are JS/markup-only rules, so a .py test file cannot trip them. Written
# plainly because assembling them would cost readability for no protection.
NEWFN = "new Function"
DANGER = "dangerouslySetInnerHTML"
DOCWRITE = "document.write"
INNER = ".innerHTML ="


# A phrase unique to each rule's reminder text. Asserting on the exit code
# alone lets a true positive start passing for the WRONG reason - a different
# rule firing on the same payload - without any test noticing.
RULE_SIGNATURE = {
    "new_function": "new Function()",
    "eval": "executes arbitrary code",
    "react_html": "dangerouslySetInnerHTML",
    "document_write": "document.write()",
    "innerHTML": "Setting innerHTML",
    "pickle": "safe serialization formats",
    "pickle_alias": "safe serialization formats",
    "os_system": "appears to use os.system",
    "collateral": "GitHub Actions workflow",
}


def run_hook(file_path, new_string=None, content=None, tool="Edit", edits=None):
    """Invoke the hook exactly as Claude Code does and return (exit, stderr)."""
    tool_input = {"file_path": file_path}
    if edits is not None:
        tool_input["edits"] = edits
    elif tool == "Write":
        tool_input["content"] = content
    else:
        tool_input["new_string"] = new_string
    payload = {
        # Unique per call: the hook suppresses a repeat warning for the same
        # file+rule within a session, which would mask a real result.
        "session_id": "sgrules-" + uuid.uuid4().hex,
        "tool_name": tool,
        "tool_input": tool_input,
    }
    proc = subprocess.run(
        [sys.executable, HOOK],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        timeout=60,
    )
    state = os.path.expanduser(
        "~/.claude/security_warnings_state_%s.json" % payload["session_id"]
    )
    try:
        os.remove(state)
    except OSError:
        pass
    return proc.returncode, proc.stderr


def write(tmp, name, text=""):
    path = os.path.join(tmp, name)
    with open(path, "w") as f:
        f.write(text)
    return path


def build_cases(tmp):
    """Return [(rule, label, expected_exit, kwargs_for_run_hook), ...]."""
    c = []

    def case(rule, label, expected, name, payload):
        c.append((rule, label, expected,
                  {"file_path": write(tmp, name), "new_string": payload}))

    # ------------------------------------------------------------------
    # new_function_injection - JS constructor, gated to web files
    # ------------------------------------------------------------------
    case("new_function", "TP js dynamic constructor", BLOCK,
         "nf_tp.js", "const f = %s('return ' + userInput);" % NEWFN)
    case("new_function", "TP inline script in markup", BLOCK,
         "nf_tp.html", "<script>const f = %s(body);</script>" % NEWFN)
    # The reported failure: prose in a beat file.
    case("new_function", "FP prose in a markdown beat", PASS,
         "nf_fp.md", "The rule matched the bare phrase %s in prose." % NEWFN)
    case("new_function", "FP python file", PASS,
         "nf_fp.py", "# unrelated: %s is a JS concept" % NEWFN)

    # ------------------------------------------------------------------
    # eval_injection - not language-gated, but dot-excluded and doc-excluded
    # ------------------------------------------------------------------
    case("eval", "TP bare call in js", BLOCK,
         "ev_tp.js", "const v = %s(userSuppliedSource);" % EV)
    case("eval", "TP bare call in python", BLOCK,
         "ev_tp.py", "value = %s(expr)" % EV)
    # DELIBERATE TRADE, not an oversight: a space before the paren is no
    # longer matched. Allowing it also matched an English sentence where the
    # word is followed by a parenthetical aside (see the F2 prose case below),
    # which is realistic in comments; a real call written that way violates
    # PEP 8 and every JS formatter removes it. Upstream matches without the
    # space too. Locked here so the tolerance is not quietly restored.
    case("eval", "FP space before paren is not a call", PASS,
         "ev_fp_space.py", "value = %s (expr)" % EV)
    # The two dot-preceded method calls upstream's lookbehind exists for.
    case("eval", "FP torch model method", PASS,
         "ev_fp_model.py", "acc = model.%s()" % EV)
    case("eval", "FP redis client method", PASS,
         "ev_fp_redis.js", "const r = redis.%s(script, 1, key);" % EV)
    case("eval", "FP underscore-prefixed method", PASS,
         "ev_fp_priv.py", "return self._%s(node)" % EV)
    case("eval", "FP longer identifier ending in the name", PASS,
         "ev_fp_ident.js", "const out = safe%s(input);" % EV)
    case("eval", "FP prose in markdown", PASS,
         "ev_fp.md", "Rules with a bare %s( substring fire on docs." % EV)
    case("eval", "FP json data file", PASS,
         "ev_fp.json", '{"note": "%s(x) appears in this string"}' % EV)

    # ------------------------------------------------------------------
    # react_dangerously_set_html - React prop, JS/TS only
    # ------------------------------------------------------------------
    case("react_html", "TP jsx prop", BLOCK,
         "rx_tp.tsx", "<div %s={{ __html: body }} />" % DANGER)
    case("react_html", "FP prose in markdown", PASS,
         "rx_fp.md", "React docs mention %s here." % DANGER)

    # ------------------------------------------------------------------
    # document_write_xss - browser DOM, JS or inline script
    # ------------------------------------------------------------------
    case("document_write", "TP js call", BLOCK,
         "dw_tp.js", "%s('<b>' + name + '</b>');" % DOCWRITE)
    case("document_write", "TP inline script in markup", BLOCK,
         "dw_tp.html", "<script>%s(payload);</script>" % DOCWRITE)
    case("document_write", "FP prose in markdown", PASS,
         "dw_fp.md", "Legacy pages used %s for injection." % DOCWRITE)

    # ------------------------------------------------------------------
    # innerHTML_xss - browser DOM, JS or inline script
    # ------------------------------------------------------------------
    case("innerHTML", "TP js assignment", BLOCK,
         "ih_tp.js", "el%s untrustedHtml;" % INNER)
    case("innerHTML", "TP inline script in markup", BLOCK,
         "ih_tp.html", "<script>node%s data;</script>" % INNER)
    case("innerHTML", "FP prose in markdown", PASS,
         "ih_fp.md", "Assigning %s value is an XSS sink." % INNER)
    case("innerHTML", "FP python building a template string", PASS,
         "ih_fp.py", 'tpl = "el%s x"' % INNER)

    # ------------------------------------------------------------------
    # pickle_deserialization - Python only, DESERIALIZATION only
    # ------------------------------------------------------------------
    case("pickle", "TP loads call", BLOCK,
         "pk_tp_loads.py", "obj = %s.loads(payload)" % PIC)
    case("pickle", "TP load call", BLOCK,
         "pk_tp_load.py", "obj = %s.load(fh)" % PIC)
    case("pickle", "TP Unpickler", BLOCK,
         "pk_tp_unp.py", "obj = %s.Unpickler(fh).load()" % PIC)
    case("pickle", "TP from-import of a load name", BLOCK,
         "pk_tp_from.py", "from %s import loads" % PIC)
    case("pickle", "TP cPickle variant", BLOCK,
         "pk_tp_cpk.py", "obj = c%s.loads(blob)" % PIC.capitalize())
    case("pickle", "TP cloudpickle variant", BLOCK,
         "pk_tp_cloud.py", "obj = cloud%s.load(fh)" % PIC)
    case("pickle", "TP pandas reader", BLOCK,
         "pk_tp_pd.py", "df = pd.read_%s(path)" % PIC)
    case("pickle", "TP numpy opt-in", BLOCK,
         "pk_tp_np.py", "arr = np.load(f, allow_%s=True)" % PIC)
    case("pickle", "TP ipynb notebook source", BLOCK,
         "pk_tp_nb.ipynb", '"source": "obj = %s.loads(b)"' % PIC)
    # The worst false positive in the set: an ordinary English word.
    case("pickle", "FP bare word in markdown prose", PASS,
         "pk_fp_prose.md", "We ate a %s at lunch." % PIC)
    case("pickle", "FP bare word in a go comment", PASS,
         "pk_fp_go.go", "// see the %s format docs" % PIC)
    case("pickle", "FP import alone is not deserialization", PASS,
         "pk_fp_import.py", "import %s" % PIC)
    # Serialization is not the RCE surface; only reading untrusted data is.
    case("pickle", "FP dumps is the safe direction", PASS,
         "pk_fp_dumps.py", "blob = %s.dumps(obj)" % PIC)
    case("pickle", "FP identifier containing the word", PASS,
         "pk_fp_ident.py", "un%sd_path = cache_dir / 'x'" % PIC)
    case("pickle", "FP numpy default opt-out", PASS,
         "pk_fp_np_false.py", "arr = np.load(f, allow_%s=False)" % PIC)

    # ------------------------------------------------------------------
    # os_system_injection - Python only, call shape required
    # ------------------------------------------------------------------
    case("os_system", "TP direct call", BLOCK,
         "os_tp.py", "%s(f'ls {user_dir}')" % OSSYS)
    case("os_system", "TP from-import form", BLOCK,
         "os_tp_from.py", "%s" % FROM_OS)
    case("os_system", "FP prose in markdown", PASS,
         "os_fp.md", "Never call %s with user input." % OSSYS)
    case("os_system", "FP bare name in a comment, no call", PASS,
         "os_fp_comment.py", "# avoid %s here; use subprocess.run" % OSSYS)
    case("os_system", "FP longer attribute name", PASS,
         "os_fp_attr.py", "%sd_notify(READY=1)" % OSSYS)

    # ==================================================================
    # Independent-review findings, folded. Each FAILED before its fix.
    # ==================================================================

    # F2 - the gate is an ALLOWLIST of languages where the call is a sink.
    # "everything except prose" left all of these in scope and blocking.
    for name, payload in [
        ("f2.patch", "+ const v = %s(x);" % EV),
        ("f2.diff", "+ %s(x)" % EV),
        ("f2.snap", "exports[`k`] = `%s(1)`;" % EV),
        ("f2_pyproject.toml", "description = 'wraps %s(x)'" % EV),
        ("f2.sql", "-- %s(x) appears here" % EV),
        ("f2.adoc", "the %s( token in prose" % EV),
        ("f2.tex", "\\texttt{%s(x)}" % EV),
    ]:
        case("eval", "FP non-executable %s" % name.split(".")[-1], PASS,
             name, payload)

    # F2 - a DECLARATION of a function with this name is not a call to the
    # global. Writing an expression interpreter must not be a blocked edit.
    case("eval", "FP go interpreter declaration", PASS,
         "f2_interp.go", "func %s(n *Node) Value { return nil }" % EV)
    case("eval", "FP rust interpreter declaration", PASS,
         "f2_interp.rs", "fn %s(&self) -> V { V::Nil }" % EV)
    case("eval", "FP python method declaration", PASS,
         "f2_interp.py", "    def %s(self, node): pass" % EV)
    case("eval", "FP js function declaration", PASS,
         "f2_interp.js", "function %s(ast) { return 1; }" % EV)
    # An English aside: the word, then a parenthetical. This is why the rule
    # no longer tolerates whitespace before the paren.
    case("eval", "FP prose aside in a comment", PASS,
         "f2_prose.py", "# a function named %s (see below) is not a call" % EV)
    case("eval", "TP ruby call still fires", BLOCK,
         "f2_real.rb", "%s(params[:x])" % EV)

    # F3 - the lookbehind omitted the dollar sign, so an AngularJS scope
    # helper and any dollar-prefixed wrapper fired.
    case("eval", "FP dollar-prefixed scope helper", PASS,
         "f3_ng.js", "scope.$%s(expr);" % EV)
    case("eval", "FP dollar-prefixed local helper", PASS,
         "f3_helper.js", "const r = $%s(x);" % EV)

    # F4 - deserialization forms the narrowed regex could not express. The
    # parenthesized multi-line import is black's and ruff's DEFAULT output.
    c.append((
        "pickle", "TP parenthesized multi-line from-import", BLOCK,
        {"file_path": write(tmp, "f4_multi.py"),
         "new_string": "from %s import (\n    loads,\n)\nobj = loads(b)" % PIC},
    ))
    c.append((
        "pickle", "TP star import then bare load", BLOCK,
        {"file_path": write(tmp, "f4_star.py"),
         "new_string": "from %s import *\nobj = loads(b)" % PIC},
    ))
    c.append((
        "pickle", "TP backslash-continued from-import", BLOCK,
        {"file_path": write(tmp, "f4_cont.py"),
         "new_string": "from %s import \\\n    loads" % PIC},
    ))
    case("pickle", "TP Unpickler subclass, no call paren", BLOCK,
         "f4_sub.py", "class R(%s.Unpickler): pass" % PIC)
    case("pickle", "TP truthy numpy opt-in, not literal True", BLOCK,
         "f4_np1.py", "arr = np.load(f, allow_%s=1)" % PIC)

    # F5 - extensionless executables slipped every gate. bin/ scripts and
    # container entrypoints are exactly where shell-outs live.
    c.append((
        "pickle", "TP extensionless python by shebang", BLOCK,
        {"file_path": write(tmp, "f5_deploy", "#!/usr/bin/env python3\n"),
         "new_string": "obj = %s.loads(untrusted)" % PIC},
    ))
    c.append((
        "os_system", "TP extensionless python entrypoint", BLOCK,
        {"file_path": write(tmp, "f5_entrypoint", "#!/usr/bin/env python3\n"),
         "new_string": "%s(cmd)" % OSSYS},
    ))
    c.append((
        "new_function", "TP extensionless node by shebang", BLOCK,
        {"file_path": write(tmp, "f5_tool", "#!/usr/bin/env node\n"),
         "new_string": "const f = %s(body);" % NEWFN},
    ))
    c.append((
        "pickle", "FP extensionless shell script stays quiet", PASS,
        {"file_path": write(tmp, "f5_sh", "#!/bin/sh\n"),
         "new_string": "echo 'we ate a %s at lunch'" % PIC},
    ))

    # F6 - markup and JSX holes left after the first pass.
    case("innerHTML", "TP inline script inside an svg", BLOCK,
         "f6_x.svg", "<script>el%s v;</script>" % INNER)
    case("document_write", "TP xhtml inline script", BLOCK,
         "f6_x.xhtml", "<script>%s(v);</script>" % DOCWRITE)
    case("document_write", "TP aspx inline script", BLOCK,
         "f6_x.aspx", "<script>%s(v);</script>" % DOCWRITE)
    case("innerHTML", "TP pug template", BLOCK,
         "f6_x.pug", "script el%s v" % INNER)
    # MDX compiles to a React component and carries the prop verbatim.
    case("react_html", "TP mdx carries the react prop", BLOCK,
         "f6_c.mdx", "<div %s={{ __html: b }} />" % DANGER)

    # F7 - os gaps, including a reference form the old substring did catch.
    c.append((
        "os_system", "TP aliased os import member call", BLOCK,
        {"file_path": write(tmp, "f7_alias.py", "import os as o\n"),
         "new_string": "o.%s(cmd)" % SYS},
    ))
    case("os_system", "TP parenthesized from-import", BLOCK,
         "f7_paren.py", "from os " + "import (%s)" % SYS)
    case("os_system", "TP multi-name from-import", BLOCK,
         "f7_multi.py", "from os " + "import path, %s" % SYS)
    c.append((
        "os_system", "TP bare reference bound then invoked", BLOCK,
        {"file_path": write(tmp, "f7_ref.py"),
         "new_string": "handler = %s\nhandler(user_cmd)" % OSSYS},
    ))

    # F8 - MultiEdit joined new_strings with a SPACE, so two edits that each
    # contained no sink could together fabricate one.
    c.append((
        "innerHTML", "FP sink fabricated across two edits", PASS,
        {"file_path": write(tmp, "f8_split.js"), "tool": "MultiEdit",
         "edits": [{"new_string": "const s = el.innerHTML"},
                   {"new_string": "= sanitized;"}]},
    ))
    c.append((
        "innerHTML", "TP real sink inside a single edit", BLOCK,
        {"file_path": write(tmp, "f8_real.js"), "tool": "MultiEdit",
         "edits": [{"new_string": "el%s untrusted;" % INNER}]},
    ))

    # F10 - the Write tool path was never exercised at all.
    c.append((
        "pickle", "TP whole-file Write", BLOCK,
        {"file_path": os.path.join(tmp, "f10_w.py"), "tool": "Write",
         "content": "import %s\nobj = %s.loads(untrusted)\n" % (PIC, PIC)},
    ))
    c.append((
        "eval", "FP whole-file Write of prose", PASS,
        {"file_path": os.path.join(tmp, "f10_w.md"), "tool": "Write",
         "content": "Docs discussing %s( and %s usage.\n" % (EV, PIC)},
    ))

    # ------------------------------------------------------------------
    # Earlier review findings, folded. Each of these FAILED before the fix.
    # ------------------------------------------------------------------

    # str.endswith is case-sensitive, so an uppercase extension used to slip
    # every gate. That is the original bug returning on .MD, and a silent loss
    # of real findings on .PY / .JS. Gates now compare a lowercased path.
    case("case", "FP uppercase doc ext still excluded", PASS,
         "CASE_README.MD", "prose about %s and %s( in a doc" % (PIC, EV))
    case("case", "TP uppercase python ext still fires", BLOCK,
         "CASE_MOD.PY", "obj = %s.loads(payload)" % PIC)
    case("case", "TP uppercase js ext still fires", BLOCK,
         "CASE_APP.JS", "el%s untrusted;" % INNER)
    case("case", "TP mixed-case markup ext still fires", BLOCK,
         "CASE_Page.Html", "<script>%s(x);</script>" % DOCWRITE)

    # Executable extensions the first cut of the gates omitted. Every one of
    # these fired BEFORE the gates existed, so omitting them was a recall loss
    # the gate introduced, not a false positive it removed.
    case("ext", "TP pyw windows python script", BLOCK,
         "ext_win.pyw", "%s(cmd)" % OSSYS)
    case("ext", "TP ipy ipython script", BLOCK,
         "ext_s.ipy", "obj = %s.loads(b)" % PIC)
    case("ext", "TP pyx cython source", BLOCK,
         "ext_s.pyx", "%s(cmd)" % OSSYS)
    case("ext", "TP php template inline script", BLOCK,
         "ext_t.phtml", "<script>%s(x);</script>" % DOCWRITE)
    case("ext", "TP erb template inline script", BLOCK,
         "ext_t.erb", "<script>el%s v;</script>" % INNER)
    case("ext", "TP jsp template inline script", BLOCK,
         "ext_t.jsp", "<script>el%s v;</script>" % INNER)
    case("ext", "TP jinja template inline script", BLOCK,
         "ext_t.jinja", "<script>%s(x);</script>" % DOCWRITE)
    case("ext", "TP twig template inline script", BLOCK,
         "ext_t.twig", "<script>const f = %s(b);</script>" % NEWFN)
    case("ext", "TP liquid template inline script", BLOCK,
         "ext_t.liquid", "<script>el%s v;</script>" % INNER)
    case("ext", "TP cshtml template inline script", BLOCK,
         "ext_t.cshtml", "<script>%s(x);</script>" % DOCWRITE)

    # An aliased import names no module at the call site. The bare-word rule
    # caught this by accident; the narrowed regex needed a matcher for it.
    c.append((
        "pickle_alias", "TP aliased import, load call in same edit", BLOCK,
        {"file_path": write(tmp, "pa_same.py"),
         "new_string": "import %s as pk\nobj = pk.loads(blob)" % PIC},
    ))
    # The realistic shape: the import is already on disk, the edit is one line.
    c.append((
        "pickle_alias", "TP aliased import on disk, bare edit", BLOCK,
        {"file_path": write(tmp, "pa_disk.py", "import %s as pk\n" % PIC),
         "new_string": "    obj = pk.loads(blob)"},
    ))
    # The matcher must not fire on an alias that is never used to load.
    c.append((
        "pickle_alias", "FP aliased import with only a dump call", PASS,
        {"file_path": write(tmp, "pa_dump.py", "import %s as pk\n" % PIC),
         "new_string": "    blob = pk.dumps(obj)"},
    ))
    c.append((
        "pickle_alias", "FP unrelated pk object with a load method", PASS,
        {"file_path": write(tmp, "pa_unrelated.py", "import json\n"),
         "new_string": "    cfg = pk.loads(blob)"},
    ))

    # ------------------------------------------------------------------
    # Collateral: the path_check rule is untouched by any of this.
    # ------------------------------------------------------------------
    c.append((
        "collateral", "TP workflow path rule still fires", BLOCK,
        {"file_path": write(tmp, "ci.yml"), "new_string": "on: issues\n",
         "tool": "Edit"},
    ))
    # A .github/workflows path is matched by substring on the normalized path,
    # so build one explicitly rather than relying on the temp dir layout.
    wf_dir = os.path.join(tmp, ".github", "workflows")
    os.makedirs(wf_dir, exist_ok=True)
    wf = os.path.join(wf_dir, "ci.yml")
    with open(wf, "w") as f:
        f.write("")
    c[-1] = ("collateral", "TP workflow path rule still fires", BLOCK,
             {"file_path": wf, "new_string": "on: issues\n"})

    return c


def perf_check():
    """A blocking hook makes a performance case a CORRECTNESS case.

    THE LESSON THIS FUNCTION EXISTS TO ENCODE: the first version of this check
    named the backtracking shape in its docstring and then measured the one
    input that CANNOT exhibit it - a single from-import on a long line. Cost
    was Theta(N*L) in the NUMBER of occurrences times line length, so varying
    only the length showed 0.003s and looked fine while the real shape took
    86s at 608KB. An independent review found it by varying the other axis.

    So: vary the COUNT of occurrences on one line, not just the line length,
    and assert the growth is linear rather than merely "under a threshold" at
    one size. A ratio test catches a reintroduced quadratic even if the
    machine running it is fast.
    """
    import importlib.util
    import time

    spec = importlib.util.spec_from_file_location("sg_hook_rules", HOOK)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    pic = "pick" + "le"
    ev = "ev" + "al"
    sys_ = "sys" + "tem"

    def measure(content):
        start = time.perf_counter()
        mod._pickle_alias_match(content, "")
        mod._os_system_match(content, "")
        mod._eval_injection_match(content, "")
        for rx in mod._COMPILED_RULE_REGEXES.values():
            rx.search(content)
        return time.perf_counter() - start

    ok = True

    # Growth test. Doubling the occurrence count on ONE line must roughly
    # double the time. Quadratic growth shows up as ~4x and fails here.
    unit_pickle = "from %s import zzz " % pic
    unit_os = "from os " + "import zzz "
    for label, unit in (("from-import (deserialization)", unit_pickle),
                        ("from-import (os)", unit_os)):
        timings = []
        for n in (4000, 8000, 16000):
            timings.append(measure(unit * n))
        ratio = timings[-1] / timings[0] if timings[0] > 0 else 0
        # 4x the input; linear is ~4x, quadratic is ~16x. 8x is a wide margin
        # that still separates the two unambiguously.
        good = ratio < 8.0 and timings[-1] < 0.5
        ok = ok and good
        print("  %s  %-14s %-44s %.3fs %.1fx over 4x input" % (
            "PASS" if good else "FAIL", "[perf]",
            "%s growth is linear" % label, timings[-1], ratio))

    # Absolute ceilings on single pathological inputs.
    for label, content in [
        ("single-line notebook, 600KB", unit_pickle * 32000),
        ("call name + whitespace run", "x = " + ev + " " * 60000 + "]"),
        ("os name + whitespace run", "x = os." + sys_ + " " * 60000 + "]"),
        ("unterminated open paren", "from %s import (" % pic + "z" * 200000),
        ("many near-misses",
         "\n".join("self._%s(n%d); %s_path%d = 1" % (ev, i, pic, i)
                   for i in range(5000))),
    ]:
        elapsed = measure(content)
        good = elapsed < 0.5
        ok = ok and good
        print("  %s  %-14s %-44s %.3fs" % (
            "PASS" if good else "FAIL", "[perf]",
            "%s (< 0.5s)" % label, elapsed))
    return ok


def main():
    if not os.path.exists(HOOK):
        print("SKIP: hook not found at %s" % HOOK)
        print("      set SG_HOOK to point at it")
        return 0

    print("hook: %s\n" % HOOK)

    syntax = subprocess.run(
        [sys.executable, "-c",
         "import py_compile,sys; py_compile.compile(sys.argv[1], doraise=True)",
         HOOK],
        capture_output=True, text=True,
    )
    if syntax.returncode != 0:
        print("FAIL: hook does not compile\n%s" % syntax.stderr)
        return 1

    passed = failed = 0
    with tempfile.TemporaryDirectory(prefix="sg-rules-test-") as tmp:
        for rule, label, expected, kwargs in build_cases(tmp):
            code, err = run_hook(**kwargs)
            ok = code == expected
            # A true positive must fire the RULE UNDER TEST. Checking only the
            # exit code lets a case keep passing for the wrong reason if some
            # other rule starts matching the same payload.
            wrong_rule = ""
            if ok and expected == BLOCK:
                sig = RULE_SIGNATURE.get(rule)
                if sig and sig not in err:
                    ok = False
                    wrong_rule = " (fired, but NOT %s)" % rule
            if ok:
                passed += 1
                print("  PASS  %-14s %-44s exit=%d" % (rule, label, code))
            else:
                failed += 1
                want = "block(2)" if expected == BLOCK else "pass(0)"
                print("  FAIL  %-14s %-44s exit=%d expected %s%s" % (
                    rule, label, code, want, wrong_rule))
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
