#!/usr/bin/env python3
"""
Security Reminder Hook for Claude Code
This hook checks for security patterns in file edits and warns about potential vulnerabilities.
"""

import json
import os
import random
import re
import stat
import sys
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/security-warnings-log.txt"


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception as e:
        # Silently ignore logging errors to avoid disrupting the hook
        pass


# State file to track warnings shown (session-scoped using session ID)

# ---------------------------------------------------------------------------
# child_process exec detection
#
# This rule is about Node's child_process exec, which runs its argument
# through a shell. It is NOT about RegExp.prototype.exec, which is pure string
# matching and involves no shell at all.
#
# The original rule tested for a bare three-letter call token as a plain
# SUBSTRING, so every /pattern/.exec(str) call in every file tripped a
# blocking command-injection warning. A security hook that cries wolf gets
# ignored when it is right, so detection is narrowed below to calls that can
# actually reach a shell, while keeping every true-positive form.
# ---------------------------------------------------------------------------

_JS_EXTS = (
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts",
    ".es6", ".vue", ".svelte",
)

# Markup that can carry an inline <script>. The browser-DOM rules below apply
# here too: an inline script in a template is the same XSS surface as a .js
# file, and gating those rules to _JS_EXTS alone would lose that coverage.
# Server-side template languages are included deliberately: each one emits
# HTML and routinely carries an inline <script>, so before these gates existed
# the DOM rules fired on them. Omitting them would be a recall LOSS introduced
# by the gate rather than a narrowing of a false positive.
_MARKUP_EXTS = (
    ".html", ".htm", ".xhtml", ".astro", ".ejs", ".hbs", ".handlebars",
    ".php", ".phtml", ".erb", ".jsp", ".aspx", ".cshtml",
    ".jinja", ".jinja2", ".j2", ".twig", ".liquid", ".njk",
    ".pug", ".vm", ".tpl", ".heex",
    # Inline <script> inside an SVG document is a documented XSS vector.
    ".svg",
)

# Where the browser-DOM and dynamic-code rules can legitimately apply.
_WEB_EXTS = _JS_EXTS + _MARKUP_EXTS

# Every extension whose contents are executed as Python: .pyw is the Windows
# GUI script, .ipy an IPython script, .pyx Cython source. All four fired
# before the gate existed, so leaving them out would lose true positives.
_PY_EXTS = (".py", ".pyw", ".pyi", ".pyx", ".ipy", ".ipynb")

# Prose and data files. Nothing here EXECUTES, so a rule about a dangerous
# call has no true positive to find - only the documentation of that call.
# This is the tuple that stops the hook from blocking its own beats.
_DOC_EXTS = (".md", ".mdx", ".txt", ".rst", ".json", ".yaml", ".yml")

# Languages where the dynamic-code call is genuinely a sink. This is an
# ALLOWLIST, matching the other six rules. The previous "everything except
# prose" polarity left .patch, .diff, .snap, .toml, .sql and Dockerfile in
# scope, and blocked expression-interpreter source in Go, Rust, C and Java
# where the name is an ordinary function and not a sink at all.
_EVAL_EXTS = _WEB_EXTS + _PY_EXTS + (
    ".rb", ".pl", ".pm", ".lua", ".sh", ".bash", ".zsh", ".coffee",
)

# Cap on the on-disk file read used for import evidence. Keeps a PreToolUse
# hook cheap on generated bundles.
_MAX_FILE_EVIDENCE_BYTES = 512 * 1024

# Call names that actually reach a shell. Longest first: the alternation is
# ordered so the Sync variant is preferred over its prefix.
_CALL = r"(?:execSync|exec)"

# Call punctuation, tolerating optional chaining -  foo(  and  foo?.(
# ONE whitespace quantifier per branch. The earlier form had two adjacent
# \s* separated by an optional group, which backtracks quadratically: a
# single long whitespace run after a bare call name took 19.7s to reject,
# and this hook BLOCKS the edit for the whole duration.
_CALL_OPEN = r"\s*(?:\?\.\s*)?\("

# Module specifier, with or without the node: prefix, in any quote style.
_CP_SPEC = r"""['"`](?:node:)?child_process['"`]"""

# Cap on distinct module aliases considered. A real module binds it once or
# twice; the cap is what keeps a pathological file from making the alias scan
# superlinear. See _cp_aliases.
_MAX_ALIASES = 25

# Does this module pull in child_process at all? Covers require(...),
# static import ... from '...', and dynamic await import('...').
# The lookbehind stops `myrequire(` from matching as `require(`.
_CP_IMPORT_RE = re.compile(
    r"""(?<![A-Za-z0-9_$])require\s*\(\s*""" + _CP_SPEC + r"""\s*\)"""
    r"""|(?:from|import)\s*\(?\s*""" + _CP_SPEC
)

# A NAMESPACE binding for the module, so an aliased member call is still
# caught:  const cp = require('child_process')  /  import * as cp from '...'
# Deliberately does NOT match a braced named import, which binds a function
# rather than a namespace; treating it as one would make every member call in
# the file fire again.
_CP_NAMESPACE_RE = re.compile(
    # const cp = require('...')   /   const cp = await import('...')
    r"""(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?"""
    r"""(?:require|import)\s*\(\s*""" + _CP_SPEC + r"""\s*\)"""
    # import cp from '...'   /   import * as cp from '...'
    r"""|import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from\s*""" + _CP_SPEC +
    # TypeScript: import cp = require('...')
    r"""|import\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*""" + _CP_SPEC + r"""\s*\)"""
)


def _cp_aliases(scope):
    """Distinct local names bound to the module, capped and de-duplicated.

    Deliberately returns a bounded list: the caller builds ONE alternation
    regex from it rather than compiling a fresh pattern per binding. The naive
    per-binding loop was quadratic - a file with a few thousand bindings took
    seconds, and this hook BLOCKS the edit while it runs.
    """
    seen = []
    for m in _CP_NAMESPACE_RE.finditer(scope):
        alias = m.group(1) or m.group(2) or m.group(3)
        if alias and alias not in seen:
            seen.append(alias)
            if len(seen) >= _MAX_ALIASES:
                break
    return seen

# Forms that are unambiguously child_process regardless of imports.
#
# NOTE: the Sync variant is NOT treated as always-qualified. It runs through
# the same three tiers as the base call, because matching it unconditionally
# made a database driver's own .execSync() and a locally declared helper of
# the same name fire. Do not "restore" that - two tests forbid it.
_CP_QUALIFIED_RE = re.compile(
    r"""\bchild_process\s*\.\s*""" + _CALL + _CALL_OPEN +
    r"""|(?<![A-Za-z0-9_$])require\s*\(\s*""" + _CP_SPEC +
    r"""\s*\)\s*\.\s*""" + _CALL + _CALL_OPEN +
    # promisify(child_process.exec): the fully qualified name is right there,
    # even though a ')' rather than a call-open follows it.
    r"""|promisify\s*\(\s*child_process\s*\.\s*""" + _CALL + r"""\s*\)"""
)

# promisify(exec) / promisify(cp.exec) - the standard async shell pattern.
# The result is then invoked under an arbitrary name (execAsync, run, sh...),
# so this binding line is the ONLY place the chain can be caught. Import-gated
# like a bare call, since the receiver here may be any local name.
_PROMISIFY_RE = re.compile(
    r"""promisify\s*\(\s*(?:[A-Za-z_$][\w$]*\s*\.\s*)?""" + _CALL + r"""\s*\)"""
)

# An UNQUALIFIED call, never a member call on something else.
# The leading-dot exclusion is what rules out RegExp string matching:
# a regex literal, a variable, and optional chaining are all dot-preceded.
# The File variant cannot match here: a '(' must follow the call name.
_BARE_CALL_RE = re.compile(r"(?<![A-Za-z0-9_$.])" + _CALL + _CALL_OPEN)

# A DECLARATION of something named exec is not a call to child_process. This
# matters because the safest remediation - wrapping execFile in your own
# `function exec(cmd, args)` - necessarily lives in a file that imports
# child_process, so without this the hook blocks the very fix it recommends.
_DECL_BEFORE_RE = re.compile(
    r"(?:function|async|get|set|static|class)\s*\*?\s+$|\*\s*$"
)


def _bare_call_hit(content):
    """A bare call that is an actual call, not a declaration of the name."""
    for m in _BARE_CALL_RE.finditer(content):
        if _DECL_BEFORE_RE.search(content[max(0, m.start() - 40):m.start()]):
            continue
        return True
    return False


def _child_process_exec_match(content, file_text=""):
    """True only for exec calls that can actually reach a shell.

    `content` is the text being written (an edit's new_string, or the whole
    file for Write). `file_text` is the current on-disk contents, used ONLY as
    extra evidence for imports: an edit's new_string is usually a line or two
    and will not contain the file's import header.
    """
    if _CP_QUALIFIED_RE.search(content):
        return True

    scope = content + "\n" + (file_text or "")

    # An aliased member call, where the alias is bound to the module. ONE
    # alternation over the capped alias set - never a regex per binding.
    aliases = _cp_aliases(scope)
    if aliases:
        alias_re = (
            r"(?<![A-Za-z0-9_$.])(?:"
            + "|".join(re.escape(a) for a in aliases)
            + r")\s*\.\s*" + _CALL + _CALL_OPEN
        )
        if re.search(alias_re, content):
            return True

    # A bare call, or a promisify binding, counts only when this module
    # imports child_process - that is what makes the unqualified identifier a
    # shell call and not a local helper, a regex method, or a database
    # driver's own method.
    if _bare_call_hit(content) or _PROMISIFY_RE.search(content):
        return bool(_CP_IMPORT_RE.search(scope))

    return False


# ---------------------------------------------------------------------------
# pickle alias binding
#
# `import pickle as pk` then `pk.loads(...)` reaches the same RCE surface but
# never spells the module name at the call site. The old bare-word rule caught
# it by accident; the narrowed regex does not, so this closes that specific
# regression rather than widening the rule generally.
# ---------------------------------------------------------------------------

_PICKLE_MODS = r"(?:c[Pp]ickle|cloudpickle|pickle)"
_PICKLE_LOAD = r"(?:loads?|Unpickler)"

# ---------------------------------------------------------------------------
# from-import scanning
#
# The first cut expressed this as one regex branch ending in
# `import\b[^\n]*(?<!\w)(?:loads?|Unpickler)\b`, which is QUADRATIC.
# `[^\n]*` runs greedily to end of line, then backtracks a character at a
# time, for every position where the prefix matches. Measured on a single
# line: 0.10s at 23KB, 0.41s at 46KB, 1.68s at 92KB, 6.6s at 184KB - a clean
# 4x per doubling, reaching 86s at 608KB. A single-line notebook hits this for
# real (json.dumps emits one line by default, and .ipynb is a Python ext).
# This hook BLOCKS the edit for that entire time, and neither new_string nor
# content is size-capped.
#
# Replaced by: match the import prefix, then inspect a BOUNDED window after
# it. Work per match is capped, so total cost is linear in the number of
# matches. The window also spans a parenthesized or backslash-continued
# import, which the single-line regex could not do - that is black's and
# ruff's default formatting for a long import list, and it was a real miss.
# ---------------------------------------------------------------------------

_IMPORT_WINDOW = 400


def _from_import_hit(text, prefix_re, names_re):
    """True when a `from <mod> import ...` list contains one of `names_re`."""
    for m in prefix_re.finditer(text):
        window = text[m.end():m.end() + _IMPORT_WINDOW]
        if window[:1] == "(":
            close = window.find(")")
            segment = window if close == -1 else window[:close]
        else:
            # A logical line, honoring backslash continuations.
            segment, rest = "", window
            while True:
                nl = rest.find("\n")
                if nl == -1:
                    segment += rest
                    break
                segment += rest[:nl]
                if not rest[:nl].rstrip().endswith("\\"):
                    break
                rest = rest[nl + 1:]
        if names_re.search(segment):
            return True
    return False


_PICKLE_FROM_RE = re.compile(
    r"(?<![A-Za-z0-9_])from\s+" + _PICKLE_MODS + r"\s+import\s*"
)
# A star import brings the load names in too.
_PICKLE_NAMES_RE = re.compile(r"(?<![A-Za-z0-9_])" + _PICKLE_LOAD + r"\b|\*")

_OS_FROM_RE = re.compile(r"(?<![A-Za-z0-9_])from\s+os\s+import\s*")
_OS_NAMES_RE = re.compile(r"(?<![A-Za-z0-9_])system\b|\*")

# An aliased os import followed by a member call. The deserialization rule got
# an alias matcher and this one did not - same gap, same shape of fix.
_OS_ALIAS_RE = re.compile(
    r"(?<![A-Za-z0-9_])import\s+os\s+as\s+([A-Za-z_]\w*)"
)
_MAX_OS_ALIASES = 25


def _os_system_match(content, file_text=""):
    """The from-import list forms, plus a call through an aliased os module."""
    if _from_import_hit(content, _OS_FROM_RE, _OS_NAMES_RE):
        return True
    aliases = []
    for m in _OS_ALIAS_RE.finditer(content + "\n" + (file_text or "")):
        a = m.group(1)
        if a and a not in aliases:
            aliases.append(a)
            if len(aliases) >= _MAX_OS_ALIASES:
                break
    if not aliases:
        return False
    alias_re = (
        r"(?<![A-Za-z0-9_])(?:"
        + "|".join(re.escape(a) for a in aliases)
        + r")\s*\.\s*system\s*\("
    )
    return bool(re.search(alias_re, content))

# Same capped-set-plus-one-alternation shape as the exec alias scan. A regex
# per binding is quadratic, and this hook blocks the edit while it runs.
_MAX_PICKLE_ALIASES = 25

# ---------------------------------------------------------------------------
# dynamic-code call detection
#
# The dollar sign joins the lookbehind class. Without it, an AngularJS scope
# helper and any dollar-prefixed wrapper of the same name fired. The exec rule
# already excluded it; this rule was inconsistent with it.
#
# No whitespace allowance before the paren, matching upstream. Allowing it
# matches an English sentence where the word is followed by a parenthetical
# aside, which is realistic in comments and docstrings; a real call with a
# space before the paren violates PEP 8 and every JS formatter removes it.
# ---------------------------------------------------------------------------

_EVAL_CALL_RE = re.compile(r"(?<![A-Za-z0-9_$.])eval\(")

# A DECLARATION of a function with this name is not a call to the global - the
# same guard the exec rule needs, and for the same reason: writing an
# expression interpreter should not be blocked by the hook.
_EVAL_DECL_BEFORE_RE = re.compile(
    r"(?:function|def|async|get|set|static|class)\s*\*?\s+$|\*\s*$"
)


def _eval_injection_match(content, file_text=""):
    """A call to the global, never a declaration of that name."""
    for m in _EVAL_CALL_RE.finditer(content):
        if _EVAL_DECL_BEFORE_RE.search(content[max(0, m.start() - 40):m.start()]):
            continue
        return True
    return False


_PICKLE_ALIAS_RE = re.compile(
    r"(?<![A-Za-z0-9_])import\s+" + _PICKLE_MODS + r"\s+as\s+([A-Za-z_]\w*)"
)


def _pickle_alias_match(content, file_text=""):
    """Load calls the declarative regex cannot express.

    Two shapes: a from-import list (including the parenthesized multi-line
    form black and ruff produce), and a call through a locally aliased module
    binding. `file_text` supplies the import header, which a one-line edit
    will not contain.
    """
    if _from_import_hit(content, _PICKLE_FROM_RE, _PICKLE_NAMES_RE):
        return True

    aliases = []
    for m in _PICKLE_ALIAS_RE.finditer(content + "\n" + (file_text or "")):
        a = m.group(1)
        if a and a not in aliases:
            aliases.append(a)
            if len(aliases) >= _MAX_PICKLE_ALIASES:
                break
    if not aliases:
        return False
    alias_re = (
        r"(?<![A-Za-z0-9_])(?:"
        + "|".join(re.escape(a) for a in aliases)
        + r")\s*\.\s*" + _PICKLE_LOAD + r"\s*\("
    )
    return bool(re.search(alias_re, content))


# Security patterns configuration
SECURITY_PATTERNS = [
    {
        "ruleName": "github_actions_workflow",
        "path_check": lambda path: ".github/workflows/" in path
        and (path.endswith(".yml") or path.endswith(".yaml")),
        "reminder": """You are editing a GitHub Actions workflow file. Be aware of these security risks:

1. **Command Injection**: Never use untrusted input (like issue titles, PR descriptions, commit messages) directly in run: commands without proper escaping
2. **Use environment variables**: Instead of ${{ github.event.issue.title }}, use env: with proper quoting
3. **Review the guide**: https://github.blog/security/vulnerability-research/how-to-catch-github-actions-workflow-injections-before-attackers-do/

Example of UNSAFE pattern to avoid:
run: echo "${{ github.event.issue.title }}"

Example of SAFE pattern:
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"

Other risky inputs to be careful with:
- github.event.issue.body
- github.event.pull_request.title
- github.event.pull_request.body
- github.event.comment.body
- github.event.review.body
- github.event.review_comment.body
- github.event.pages.*.page_name
- github.event.commits.*.message
- github.event.head_commit.message
- github.event.head_commit.author.email
- github.event.head_commit.author.name
- github.event.commits.*.author.email
- github.event.commits.*.author.name
- github.event.pull_request.head.ref
- github.event.pull_request.head.label
- github.event.pull_request.head.repo.default_branch
- github.head_ref""",
    },
    {
        "ruleName": "child_process_exec",
        # child_process is a Node module, so this rule is JS/TS only.
        "path_filter": lambda p: p.endswith(_JS_EXTS),
        "matcher": _child_process_exec_match,
        "reminder": """⚠️ Security Warning: Using child_process.exec() can lead to command injection vulnerabilities.

This codebase provides a safer alternative: src/utils/execFileNoThrow.ts

Instead of:
  exec(`command ${userInput}`)

Use:
  import { execFileNoThrow } from '../utils/execFileNoThrow.js'
  await execFileNoThrow('command', [userInput])

The execFileNoThrow utility:
- Uses execFile instead of exec (prevents shell injection)
- Handles Windows compatibility automatically
- Provides proper error handling
- Returns structured output with stdout, stderr, and status

Only use exec() if you absolutely need shell features and the input is guaranteed to be safe.""",
    },
    {
        "ruleName": "new_function_injection",
        # A JS constructor. Gated to code that can run it, so prose in a .md
        # (including the beats that document this very rule) stays unblocked.
        "path_filter": lambda p: p.endswith(_WEB_EXTS),
        "substrings": ["new Function"],
        "reminder": "⚠️ Security Warning: Using new Function() with dynamic strings can lead to code injection vulnerabilities. Consider alternative approaches that don't evaluate arbitrary code. Only use new Function() if you truly need to evaluate arbitrary dynamic code.",
    },
    {
        "ruleName": "eval_injection",
        # Deliberately NOT language-gated: the call is a real injection sink
        # in JS, Python and Ruby alike, so gating it to one of them would lose
        # true positives in the others. Only prose and data files are excluded,
        # since nothing there executes.
        # Not covered: the shell builtin, which takes no parentheses.
        "path_filter": lambda p: p.endswith(_EVAL_EXTS),
        # The dot exclusion is the load-bearing part: it rules out method calls
        # on unrelated objects, which is the overwhelming majority of real
        # matches - a model's eval mode, a redis client's script call, a
        # spec object's own helper. Same shape of fix as the exec rule.
        "matcher": _eval_injection_match,
        "reminder": "⚠️ Security Warning: eval() executes arbitrary code and is a major security risk. Consider using JSON.parse() for data parsing or alternative design patterns that don't require code evaluation. Only use eval() if you truly need to evaluate arbitrary code.",
    },
    {
        "ruleName": "react_dangerously_set_html",
        # A React prop. MDX compiles to a React component and carries the
        # prop verbatim, and .astro embeds JSX, so both belong here.
        "path_filter": lambda p: p.endswith(_JS_EXTS + (".astro", ".mdx")),
        "substrings": ["dangerouslySetInnerHTML"],
        "reminder": "⚠️ Security Warning: dangerouslySetInnerHTML can lead to XSS vulnerabilities if used with untrusted content. Ensure all content is properly sanitized using an HTML sanitizer library like DOMPurify, or use safe alternatives.",
    },
    {
        "ruleName": "document_write_xss",
        # Browser DOM API: JS source, or an inline script inside markup.
        "path_filter": lambda p: p.endswith(_WEB_EXTS),
        "substrings": ["document.write"],
        "reminder": "⚠️ Security Warning: document.write() can be exploited for XSS attacks and has performance issues. Use DOM manipulation methods like createElement() and appendChild() instead.",
    },
    {
        "ruleName": "innerHTML_xss",
        # Browser DOM API: JS source, or an inline script inside markup.
        "path_filter": lambda p: p.endswith(_WEB_EXTS),
        "substrings": [".innerHTML =", ".innerHTML="],
        "reminder": "⚠️ Security Warning: Setting innerHTML with untrusted content can lead to XSS vulnerabilities. Use textContent for plain text or safe DOM methods for HTML content. If you need HTML support, consider using an HTML sanitizer library such as DOMPurify.",
    },
    {
        "ruleName": "pickle_deserialization",
        # A Python module, so Python files only.
        "path_filter": lambda p: p.endswith(_PY_EXTS),
        # DESERIALIZATION is the RCE surface - not the module name on its own,
        # and not the dump side. The bare word matched any occurrence in any
        # file, which made this the broadest rule in the set: it fired on the
        # word in an unrelated English sentence.
        # Recall is kept by covering the variants whose names all CONTAIN the
        # module name, which is exactly what the old substring caught: the
        # module call forms, a from-import of a load name, the pandas reader,
        # and the numpy opt-in.
        "regex": (
            # Unpickler needs no call paren: subclassing it is the same
            # surface, and the subclass form ends in a close paren.
            r"(?<![A-Za-z0-9_])" + _PICKLE_MODS + r"\s*\.\s*"
            r"(?:loads?\s*\(|Unpickler\b)"
            r"|(?<![A-Za-z0-9_])(?:pd|pandas)\s*\.\s*read_pickle\s*\("
            # Any truthy opt-in, not only the literal True.
            r"|(?<![A-Za-z0-9_])allow_pickle\s*=\s*(?:True|1)\b"
        ),
        # Covers only the aliased-import form, which names no module at the
        # call site and so cannot be expressed in the regex above.
        "matcher": _pickle_alias_match,
        "reminder": "⚠️ Security Warning: Using pickle with untrusted content can lead to arbitrary code execution. Consider using JSON or other safe serialization formats instead. Only use pickle if it is explicitly needed or requested by the user.",
    },
    {
        "ruleName": "os_system_injection",
        # A Python stdlib call, so Python files only.
        "path_filter": lambda p: p.endswith(_PY_EXTS),
        # A call, OR a bare reference being stored or passed - binding the
        # function to a name and invoking it later reaches the same shell.
        # Requiring the paren alone lost that form, which the old substring
        # did catch. The lookahead keeps prose out: a sentence has a word
        # after the name, an assignment or an argument does not.
        "regex": (
            r"(?<![A-Za-z0-9_])os\s*\.\s*system\s*"
            # The newline branch is explicit: these are compiled without
            # MULTILINE, so `$` alone only matches at end of the whole string
            # and the assignment form on any earlier line was missed.
            r"(?=\(|\s*[,)\]]|[ \t]*\r?\n|\s*$)"
        ),
        "matcher": _os_system_match,
        "reminder": "⚠️ Security Warning: This code appears to use os.system. This should only be used with static arguments and never with arguments that could be user-controlled.",
    },
]


# Rule regexes are compiled ONCE at import. This is a PreToolUse hook that
# blocks the edit for as long as it runs, so a per-call re.compile is a cost
# paid on every single file write in the session.
def _compile_rule_regexes():
    """Compile per rule, skipping any that fails.

    Built at module scope, which is OUTSIDE the guard around main(), so an
    unbuildable pattern here would abort the hook with a traceback instead of
    failing open the way every other error path does.
    """
    out = {}
    for p in SECURITY_PATTERNS:
        if "regex" not in p:
            continue
        try:
            out[p["ruleName"]] = re.compile(p["regex"])
        except re.error as e:
            debug_log("rule %s has an invalid regex: %s" % (p["ruleName"], e))
    return out


_COMPILED_RULE_REGEXES = _compile_rule_regexes()

# ---------------------------------------------------------------------------
# Revision of this patch set. The re-apply script compares it against the
# vendored copy so a PATCHED-BUT-OLDER install is upgradeable rather than
# being skipped forever as "already narrowed". Bump on every change here.
# ---------------------------------------------------------------------------
_SG_PATCH_REV = 2


def get_state_file(session_id):
    """Get session-specific state file path."""
    return os.path.expanduser(f"~/.claude/security_warnings_state_{session_id}.json")


def cleanup_old_state_files():
    """Remove state files older than 30 days."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return

        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)

        for filename in os.listdir(state_dir):
            if filename.startswith("security_warnings_state_") and filename.endswith(
                ".json"
            ):
                file_path = os.path.join(state_dir, filename)
                try:
                    file_mtime = os.path.getmtime(file_path)
                    if file_mtime < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass  # Ignore errors for individual file cleanup
    except Exception:
        pass  # Silently ignore cleanup errors


def load_state(session_id):
    """Load the state of shown warnings from file."""
    state_file = get_state_file(session_id)
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_state(session_id, shown_warnings):
    """Save the state of shown warnings to file."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w") as f:
            json.dump(list(shown_warnings), f)
    except IOError as e:
        debug_log(f"Failed to save state file: {e}")
        pass  # Fail silently if we can't save state


def _read_file_evidence(file_path):
    """Best-effort read of the file being edited. Capped, and never raises.

    A missing file is normal (Write creates new files), so failure returns
    empty evidence rather than propagating.

    REGULAR FILES ONLY. Opening a FIFO blocks forever waiting for a writer,
    and a size check does not catch it (a FIFO stats as 0 bytes). Since this
    is a PreToolUse hook, a block here is an edit that never lands - there is
    no timeout to save it. The same guard covers device nodes and sockets.
    """
    try:
        st = os.stat(file_path)
        if not stat.S_ISREG(st.st_mode):
            return ""
        if st.st_size > _MAX_FILE_EVIDENCE_BYTES:
            return ""
        with open(file_path, "r", errors="replace") as f:
            return f.read(_MAX_FILE_EVIDENCE_BYTES)
    except (OSError, IOError, ValueError):
        return ""


# An extensionless file (bin/deploy, a container entrypoint) has no ext for
# the gates to read, so every gated rule silently skipped it. These are exactly
# the files that shell out. Fall back to the shebang.
_SHEBANG_RE = re.compile(r"^#!\s*(\S+)(?:[ \t]+(\S+))?")
_SHEBANG_EXTS = {
    "python": ".py", "node": ".js", "bun": ".js", "deno": ".js",
    "bash": ".sh", "sh": ".sh", "zsh": ".sh", "ksh": ".sh",
    "ruby": ".rb", "perl": ".pl", "php": ".php", "lua": ".lua",
}


def _shebang_ext(content, file_text):
    """A synthetic extension implied by a shebang, or an empty string."""
    for text in (content, file_text):
        if not text:
            continue
        m = _SHEBANG_RE.match(text)
        if not m:
            continue
        # `#!/usr/bin/env python3` puts the interpreter in the second field.
        first = os.path.basename(m.group(1) or "")
        name = os.path.basename(m.group(2) or "") if first == "env" else first
        stem = re.match(r"[a-z]+", name.lower())
        if stem and stem.group(0) in _SHEBANG_EXTS:
            return _SHEBANG_EXTS[stem.group(0)]
    return ""


def _gate_path(file_path, content, file_text):
    """The path the extension gates compare against.

    Lowercased, because str.endswith is case-sensitive and an uppercase
    extension would otherwise skip every gate in both directions.
    """
    normalized = file_path.lstrip("/").lower()
    if "." not in normalized.rsplit("/", 1)[-1]:
        return normalized + _shebang_ext(content, file_text)
    return normalized


def _is_extensionless(file_path):
    return "." not in file_path.lstrip("/").rsplit("/", 1)[-1]


def _needs_file_evidence(gate_path):
    """Would any matcher-bearing rule apply to this path?

    Matchers are the only consumers of the on-disk text, so this is the exact
    condition for the read being useful. Derived from the rule table rather
    than hardcoded to one language: the previous version tested for JS
    extensions, which was right while the exec matcher was the only one, and
    silently starved the pickle alias matcher of the import header the moment
    a second matcher was added on a Python-gated rule. A regression test now
    covers that shape.
    """
    for pattern in SECURITY_PATTERNS:
        if "matcher" not in pattern:
            continue
        path_filter = pattern.get("path_filter")
        if path_filter is None:
            return True
        try:
            if path_filter(gate_path):
                return True
        except Exception:
            continue
    return False


def check_patterns(file_path, content, file_text=""):
    """Check if file path or content matches any security patterns."""
    # Both the gate and path_check compare lowercased: path_check was left on
    # the raw path by the first cut, so an uppercased workflow dir slipped it.
    gate_path = _gate_path(file_path, content, file_text)
    normalized_path = gate_path

    for pattern in SECURITY_PATTERNS:
        # path_filter is a GATE: when present, the rule applies only to
        # matching paths. Distinct from path_check, which is itself a
        # positive match condition.
        if "path_filter" in pattern:
            try:
                if not pattern["path_filter"](gate_path):
                    continue
            except Exception:
                continue

        # Check path-based patterns
        if "path_check" in pattern and pattern["path_check"](normalized_path):
            return pattern["ruleName"], pattern["reminder"]

        # Check content-based patterns
        if "substrings" in pattern and content:
            for substring in pattern["substrings"]:
                if substring in content:
                    return pattern["ruleName"], pattern["reminder"]

        # Regex patterns, for rules that need more shape than a substring -
        # typically a lookbehind excluding a leading dot, so a method call on
        # an unrelated object does not read as the dangerous global.
        if "regex" in pattern and content:
            compiled = _COMPILED_RULE_REGEXES.get(pattern["ruleName"])
            if compiled is not None and compiled.search(content):
                return pattern["ruleName"], pattern["reminder"]

        # Callable matchers additionally get the on-disk file text, so a
        # one-line edit can still be judged against the module's imports.
        if "matcher" in pattern and content:
            try:
                if pattern["matcher"](content, file_text):
                    return pattern["ruleName"], pattern["reminder"]
            except Exception:
                pass

    return None, None


def extract_content_from_input(tool_name, tool_input):
    """Extract content to check from tool input based on tool type."""
    if tool_name == "Write":
        return tool_input.get("content", "")
    elif tool_name == "Edit":
        return tool_input.get("new_string", "")
    elif tool_name == "MultiEdit":
        edits = tool_input.get("edits", [])
        if edits:
            # Newline, NOT space: joining with a space fabricated matches
            # across the seam, so two edits that each contained no sink could
            # together produce one and block.
            return "\n".join(edit.get("new_string", "") for edit in edits)
        return ""

    return ""


def main():
    """Main hook function."""
    # Check if security reminders are enabled
    security_reminder_enabled = os.environ.get("ENABLE_SECURITY_REMINDER", "1")

    # Only run if security reminders are enabled
    if security_reminder_enabled == "0":
        sys.exit(0)

    # Periodically clean up old state files (10% chance per run)
    if random.random() < 0.1:
        cleanup_old_state_files()

    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)  # Allow tool to proceed if we can't parse input

    # Extract session ID and tool information from the hook input
    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Check if this is a relevant tool
    if tool_name not in ["Edit", "Write", "MultiEdit"]:
        sys.exit(0)  # Allow non-file tools to proceed

    # Extract file path from tool_input
    file_path = tool_input.get("file_path", "")
    if not file_path:
        sys.exit(0)  # Allow if no file path

    # Extract content to check
    content = extract_content_from_input(tool_name, tool_input)

    # Current on-disk text, used only as import evidence by callable matchers.
    # Skip the read when no matcher-bearing rule applies to this path, rather
    # than paying a stat plus up to 512KB on every edit to a Markdown doc.
    # An extensionless file always gets the read: its shebang is the only
    # thing that can tell the gates which language this is.
    file_text = ""
    if _is_extensionless(file_path) or _needs_file_evidence(
            _gate_path(file_path, content, "")):
        file_text = _read_file_evidence(file_path)

    # Check for security patterns
    rule_name, reminder = check_patterns(file_path, content, file_text)

    if rule_name and reminder:
        # Create unique warning key
        warning_key = f"{file_path}-{rule_name}"

        # Load existing warnings for this session
        shown_warnings = load_state(session_id)

        # Check if we've already shown this warning in this session
        if warning_key not in shown_warnings:
            # Add to shown warnings and save
            shown_warnings.add(warning_key)
            save_state(session_id, shown_warnings)

            # Output the warning to stderr and block execution
            print(reminder, file=sys.stderr)
            sys.exit(2)  # Block tool execution (exit code 2 for PreToolUse hooks)

    # Allow tool to proceed
    sys.exit(0)


if __name__ == "__main__":
    # FAIL OPEN. A PreToolUse hook that raises prints a raw traceback into the
    # user's session; malformed tool_input shapes (a list, a non-string path)
    # reached that path. An advisory guard must never be the reason an edit
    # cannot be made, so any unexpected error allows the tool through.
    try:
        main()
    except SystemExit:
        raise
    except Exception as _e:
        debug_log(f"hook crashed, failing open: {_e!r}")
        sys.exit(0)
