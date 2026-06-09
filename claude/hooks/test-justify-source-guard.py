import json, subprocess, os
H = os.path.expanduser("~/.claude/hooks/justify-source-guard.sh")
home = os.path.expanduser("~")
inst = home + "/.claude/justify"
dot = home + "/Documents/Github/improv/justify"

# (label, tool, field, value, expect)
cases = [
    ("edit stale install toolbar.ts", "Edit", "file_path", inst + "/core/toolbar.ts", "DENY"),
    ("write stale install dist",      "Write", "file_path", inst + "/dist/x.js", "DENY"),
    ("bash cd install && build",      "Bash", "command", "cd " + inst + " && node build.js --core-only", "DENY"),
    ("bash build.js in install path", "Bash", "command", "node " + inst + "/build.js", "DENY"),
    ("npm run deploy in install",     "Bash", "command", "cd ~/.claude/justify && npm run deploy", "DENY"),
    ("edit dotfiles source",          "Edit", "file_path", dot + "/core/toolbar.ts", "ALLOW"),
    ("build in dotfiles",             "Bash", "command", "cd " + dot + " && node build.js --core-only", "ALLOW"),
    ("deploy.sh sanctioned",          "Bash", "command", "cd " + dot + " && bash deploy.sh --core-only", "ALLOW"),
    ("manual recovery cp",            "Bash", "command", "cp " + dot + "/dist/justify-core.js " + inst + "/dist/justify-core.js", "ALLOW"),
    ("normal project edit",           "Edit", "file_path", home + "/Documents/Github/yesandwebsite/style.css", "ALLOW"),
    ("read install (cat, no build)",  "Bash", "command", "cat ~/.claude/justify/dist/justify-core.js | wc -c", "ALLOW"),
]
passed = 0
for label, tool, field, val, expect in cases:
    payload = json.dumps({"tool_name": tool, "tool_input": {field: val}})
    out = subprocess.run(["bash", H], input=payload, capture_output=True, text=True).stdout
    got = "DENY" if '"deny"' in out else "ALLOW"
    ok = got == expect
    passed += ok
    print(("PASS" if ok else "FAIL") + f" [{got}/{expect}] {label}")
print(f"\n{passed}/{len(cases)} passed")
