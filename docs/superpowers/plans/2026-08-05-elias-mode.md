# ELIAS mode ("Explain Like I'm A Stakeholder") - implementation plan

**Authored against commit:** `821d51fd`
**Author:** Jonah (via planning teammate)
**Date:** 2026-08-05
**Status:** PLAN ONLY. Nothing in this document has been implemented.

> Stamp check (Team Rule 10): this plan is authored against `821d51fd`. Before executing any step, run `git rev-parse --short HEAD`. If HEAD has moved, re-run the cheap greps in Section 9 before trusting any line number in this document. Every line number below was verified present at `821d51fd`.

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Each task carries a runnable `-> verify:` clause. A task is not done until its verify clause passes.

---

## 0. TL;DR for the executor

ELIAS is a toggleable MODE that reshapes responses for a non-technical stakeholder (project manager, account manager, director, client). It is built as a three-hook trio modeled byte-for-byte on the existing `concise-*` trio, with one inversion and one interaction:

| | concise | ELIAS |
|---|---|---|
| Governs | length and structure | audience and vocabulary |
| Default | ON | OFF |
| Marker | `~/.claude/.concise-disabled` (DISABLE) | `~/.claude/.elias-enabled` (ENABLE) |
| Mandate | `concise-mandate.sh` | `elias-mandate.sh` |
| Toggle | `concise-toggle.sh` | `elias-toggle.sh` |
| Stop gate | `concise-detect-stop.sh` | `elias-detect-stop.sh` |
| Cluster | grounding | grounding |

Six decisions are resolved in Section 2. The ruleset text is final in Section 3 and is ready to paste. Sections 4 through 8 are the build. Section 9 is the acceptance gate. Section 10 is the risk register, and every item in it is a way this can be built wrong.

Eight tasks. Tasks 1 to 3 create the hooks, Task 4 makes the two modes compose, Task 5 wires everything, Task 6 is the test suite, Task 7 is documentation counts, Task 8 is the gate.

---

## 1. Global constraints

- No emojis. No emdashes. No AI attribution anywhere in code, comments, commits, or docs.
- Hooks are stdlib only: bash plus `python3` standard library. No pip installs, no third-party deps.
- Every hook failure path exits 0 with no output. A hook must never break a turn.
- Repo files are the source of truth. `~/.claude/hooks/*` are deployed copies or symlinks back into `claude/hooks/`.
- Hook scripts are invoked DIRECTLY by settings.json (`~/.claude/hooks/x.sh`, no `bash` prefix), so every new hook must be `chmod +x`.
- The grounding cluster deploys `.sh` files ONLY. All lexicons, rulesets, and wordlists stay INLINE in the script. A sibling `.txt` or `.json` would install inert on any other machine. This is why the concise ruleset is a heredoc inside `concise-mandate.sh`, and ELIAS follows the same rule.
- `claude/settings.json` is the BASE settings file and contains NO cluster hook wiring. Wiring lives in `claude/hooks/cluster-wirings.json` and is JSON-merged into the user's `~/.claude/settings.json` by `install.sh`. **Do not add ELIAS entries to `claude/settings.json`.**
- Collaborator name in beats: Jonah.
- Write a session beat to `.claude/memory/` after each task, before reporting it done.

---

## 2. Design decisions (resolved, with rationale)

### D1. Default state: OFF, gated by an ENABLE marker

`~/.claude/.elias-enabled` PRESENT means ELIAS is ON. ABSENT means OFF, and the mandate emits nothing at all.

This is the exact inverse of concise, which uses a DISABLE marker so it is on by default on any machine that installs the hook. ELIAS must not do that. Concise is a universal preference (nobody wants padding). ELIAS is a per-conversation AUDIENCE choice, and injecting stakeholder framing into a normal engineering session would actively make the model worse at the work: it would strip the file paths, commands, and identifiers that a developer session runs on. The precedent is the voice system, which is installed but silent until `~/.claude/.voice-enabled` exists.

Consequence to hold onto: the WORST possible defect in this feature is a mandate that injects when the marker is absent. Section 6 makes that the first assertion in the first test.

**Rejected alternative:** default-ON with a project-level opt-out. Rejected because the marker is per-machine, not per-project, and a developer would have to turn it off on every machine they use.

### D2. Interaction with concise: orthogonal, both may be on, ELIAS wins ties

Concise governs LENGTH. ELIAS governs AUDIENCE. They compose. Four things are specified precisely, and the builder must implement all four:

**(a) Rule-by-rule composition.** Under ELIAS every concise rule still applies, with exactly three adjustments and no others:

| concise rule | Under ELIAS |
|---|---|
| 1. Lead with the action or the answer | Unchanged in force, sharpened in target: the first sentence carries the OUTCOME |
| 2. Number multi-step work | Unchanged. Steps are described as outcomes, not commands |
| 3. End with one concrete next action, response ENDS there | Unchanged. The action is the STAKEHOLDER's next action, not a developer command |
| 4. Finish the thread before tangents | Unchanged |
| 5. Completed work visible in plain terms | Unchanged, and reinforced (this rule is already ELIAS-shaped) |
| 6. Errors: cause then fix | ADJUSTED. Gains a middle beat: cause, impact, fix |
| 7. Five-item list ceiling | Unchanged. ELIAS does not relax it |
| 8. No preamble, no recap | ADJUSTED. Exactly one orienting sentence is permitted, naming what changed and who it affects, because the reader lacks the context an engineer has |
| 9. Specific estimates | Unchanged in force, sharpened: the estimate is in calendar terms, not engineering units |
| 10. Prefer short, cut any sentence that can go | ADJUSTED. Never applies to the sentence that says why this matters to the business. That sentence is the deliverable |

**(b) Volume-gate relaxation.** Plain language costs words: a jargon term is one word, its plain-language gloss is a clause. `concise-detect-stop.sh` blocks at 300 prose words (`CONCISE_WORD_CAP`). When ELIAS is on, that ceiling rises to 400 (`ELIAS_WORD_CAP`, tunable). An explicitly-set `CONCISE_WORD_CAP` always wins over the ELIAS default, so an operator who tuned the cap keeps their tuning. Implementation is in Task 4.

The 400 figure is a starting position, not a measurement, and it is honestly labeled as such. Concise's own volume gate was set from a measured distribution over 232 real responses; ELIAS has no such corpus yet. Section 11 stages that measurement as phase 2.

**(c) Cross-gate deferral (single block per burst).** Both Stop gates run on the same Stop event. Without coordination a single response can be blocked twice with contradictory instructions ("cut it" against "rewrite it for the reader"), and the retry can ping-pong. Each gate checks the other's burst flag and stays silent if the other already claimed the burst. Whichever the runtime runs first owns the burst; the other defers. Exactly one block lands regardless of hook ordering, which is not guaranteed.

Deadlock check, done explicitly: burst 1, ELIAS blocks and creates its flag. On the retry, concise sees the ELIAS flag and defers; ELIAS sees its own flag and defers. The retry passes through. No loop is possible.

**(d) Precedence when both would fire.** ELIAS wins, by construction of (c) plus (b). Rationale: a response written for the wrong audience is wrong; a response that is thirty words long is merely unpolished. Audience correctness outranks length.

### D3. Toggle surface: whole-message commands only

Matching `concise-toggle.sh` and `voice-toggle.sh`, the command must be the WHOLE message, lowercased and normalized. This is what stops "we should tell Elias on Friday" from flipping the mode mid-prose. The exact set:

| Intent | Accepted whole messages |
|---|---|
| ON | `elias on`, `elias mode on`, `stakeholder mode`, `stakeholder mode on`, `explain like i'm a stakeholder`, `explain like im a stakeholder` |
| OFF | `elias off`, `elias mode off`, `stakeholder mode off`, `technical mode`, `back to technical` |
| TOGGLE | `elias toggle`, `stakeholder mode toggle` |
| STATUS | `elias status`, `elias?`, `stakeholder status`, `stakeholder mode status` |

Normalization before matching, in this order: JSON-decode the prompt, replace the curly apostrophes U+2019 and U+02BC with a straight apostrophe, collapse runs of whitespace to one space, strip, lowercase, then strip trailing `.` and `!` characters.

Two notes the builder must not get wrong:
- Trailing `?` is NOT stripped, because `elias?` is a significant command. Only `.` and `!` are stripped.
- The curly-apostrophe replacement is load-bearing. Most keyboards and every phone produce U+2019 in "i'm", so without it the most natural spelling of the ON command silently does nothing.

A bare `elias` is deliberately NOT a command. It is a common human first name, and a message that is exactly that word is more likely to be about a person than about this mode.

### D4. The ruleset

Final text in Section 3. It lives as a heredoc inside `elias-mandate.sh` and is single-sourced through `elias-mandate.sh --emit-body`, exactly as concise does it, so `elias-toggle.sh` never carries a second copy.

### D5. Enforcement: YES, `elias-detect-stop.sh` ships in phase 1, scoped to ARTIFACT SHAPE only

The call: build the Stop gate now, and give it only detections that key on the SHAPE of engineering artifacts. Explicitly defer the jargon wordlist to phase 2.

Reasoning, which is the important part:

The obvious detector is a curated technical-term wordlist ("idempotent", "middleware", "race condition") that fires when unexplained jargon appears. It is the wrong first build, and not merely because it is false-positive prone. It fires hardest on the exact behavior the ruleset ASKS for: rule 4 explicitly permits naming an unavoidable term once and defining it in the same breath. A wordlist cannot tell "we hit a race condition, meaning two things ran at once and collided" from a jargon dump, so it would punish compliance. This repo already has the scar: the visual-verification gate earned four distinct false-fire classes by classifying too broadly (`session_2026-07-26_visual-gate-narrowed.md`), and `concise-detect-stop.sh`'s own header refuses a raw length gate for the same reason.

What IS mechanically checkable with near-zero ambiguity is whether the finished response still contains things a stakeholder response can never legitimately contain:

1. A fenced code block.
2. A filesystem path.
3. A shell command line.
4. Code-cased identifiers in backticks (two or more).

These are structural, countable, and narrow, in the same family as concise's list-count and opener-lexicon detections. Prose that is merely technical in flavour passes untouched. This is what makes the gate shippable now rather than a phase-2 hope.

**One deliberate inversion the builder must not copy wrong.** `concise-detect-stop.sh` SKIPS a response that is predominantly code (line 227, `emit(skip="predominantly-code")`). `elias-detect-stop.sh` must NOT have that skip. Under ELIAS, a wall of code the reader did not ask for IS the violation. The legitimate "user wanted code" case is handled one level up, at the PROMPT, which is higher precision: if the user's last two prompts asked for the technical layer or contained a path or a code fence, the gate skips entirely.

### D6. Naming and no shared library

Files: `claude/hooks/elias-mandate.sh`, `claude/hooks/elias-toggle.sh`, `claude/hooks/elias-detect-stop.sh`, plus `claude/hooks/test-elias-mandate.sh`, `claude/hooks/test-elias-toggle.sh`, `claude/hooks/test-elias-detect-stop.sh`. Marker `~/.claude/.elias-enabled`. Burst flag `~/.claude/.elias-stop-blocked.<session>`. Log `~/.claude/.elias-blocks.log`.

**No shared library is introduced.** `elias-detect-stop.sh` duplicates roughly sixty lines of transcript-parsing preamble from `concise-detect-stop.sh` rather than extracting a `stop-transcript-lib.sh`. Three reasons:

1. `concise-detect-stop.sh` is a proven, heavily-tested artifact with a documented false-fire history. Refactoring it to consume a library expands the blast radius of this feature to include re-verifying a hook that is not changing behaviorally.
2. The shared part is smaller than it looks. The two gates deliberately differ in their skip set (ELIAS inverts predominantly-code and uses a different prompt-override lexicon), so a shared library would immediately need per-caller switches.
3. A library adds a wiring surface for zero user-visible benefit. `hook-registry-guard.sh:91` exempts `*-lib` from ownership, and `test-settings-wire-parity.sh` would need an `UNWIRED_BY_DESIGN_JSON` reacher entry. Neither is needed if no library exists.

**Therefore: no `REACHER_KIND` entry, no `UNWIRED_BY_DESIGN_JSON` entry, no `hook-registry-guard.sh` exemption is required by this feature.** All three ELIAS hooks are genuinely wired to events, so they are managed by the normal path (present in `browser-tree.json` AND named by `install.sh`). If the builder finds themselves editing an exemption list, they have gone off-plan.

Extract the library later, under the rule of three, when a THIRD Stop-gate hook needs the same preamble.

---

## 3. The ELIAS ruleset (final text, ready to paste)

This text goes inside `elias_rules_body()` in `elias-mandate.sh`, between `cat <<'RULES'` and `RULES`. Paste it exactly. It contains no emdashes and no emojis, and it must stay that way or `content-guard.sh` will refuse the write.

```
ELIAS MODE IS ON ("Explain Like I'm A Stakeholder"). Write every response for a smart, busy non-engineer who is accountable for this work but does not build it: a project manager, account manager, director, or client. They need to know what is true, what it costs, and what to do next. They do not need to know what happens under the hood. Rules:

1. Lead with the outcome, not the activity. The first sentence says what is now true for the project ("Client logins work again"), never what you did to the system ("patched the session middleware").
2. Translate on the spot, or do not say it. Any system, component, or failure you name arrives in the same sentence as its consequence: what it unblocks, what it costs, what it puts at risk. A technical noun with no consequence attached is not an answer.
3. No code, file paths, commands, tool names, error strings, or identifiers. Do not show them, quote them, or wrap them in backticks. If a sentence only makes sense to someone with a terminal open, rewrite the sentence.
4. Say it the way the reader would repeat it in a status meeting. No jargon, and no acronyms they did not use first. If a term is genuinely unavoidable, define it in plain words in the same breath, once, then use the plain words for the rest of the response.
5. Analogies explain mechanisms, never numbers. A short everyday comparison is the right tool for how something works. Scope, cost, and risk get plain figures instead, never a metaphor.
6. Give the timeline effect out loud. Say whether this moves a date and by how much, in calendar terms ("adds about a day", "still lands before Thursday's review"). "It depends" is not a timeline. Give a range and name the one thing that would narrow it.
7. State risk and cost in the reader's units. What could still go wrong, how likely it is, what fixing it would take, and what you need from them to lower it. Never hide a risk because it is technical, and never inflate one to sound careful.
8. Define done as something they can check themselves. Not "tests pass" or "the build is green", but "you can log in on your phone and see last month's invoices".
9. Separate what is settled from what is waiting on them. If you need a decision, an approval, a budget, or a date, that ask is the closing line, and it names who owes what by when.
10. When they ask for more, go deeper in plain language. Deeper means more of the story: the sequence, the trade-off, the consequence. It does not mean more terminology. Switching back into engineering vocabulary because the question got harder is the failure this mode exists to prevent.

Plain language never buys accuracy. Do not soften a bad result, do not report progress that does not exist, and do not invent a number to sound precise. "I do not know yet, and here is when I will" is a complete answer.

Override ONLY when: the user explicitly asks for the technical layer (code, a path, a command, a log line), in which case give it but still open with the plain-language answer; a destructive or irreversible action needs its confirmation; or an exact string has to be reproduced verbatim to be useful. ELIAS governs audience and vocabulary, not process. It never suspends standing mandates (AskUserQuestion for questions, verification before reporting done, beats discipline, safety confirmations).

WITH CONCISE MODE (the two compose, and either can be on alone). Concise governs LENGTH, ELIAS governs AUDIENCE. Every concise rule still applies, with three adjustments and no others. Concise rule 6 (errors: cause then fix) gains a middle beat: cause, impact, fix. Concise rule 8 (no preamble) permits exactly one orienting sentence naming what changed and who it affects, because the reader lacks the context an engineer has. Concise rule 10 (if a sentence can go, cut it) never applies to the sentence that says why this matters to the business, because that sentence is the deliverable. Untouched: the five-item list ceiling, the ban on post-conclusion tangents, and the rule that the response ends at the next-action line. The next action concise asks for is the STAKEHOLDER's next action, not a developer command.

Rules 1, 3 and 4 are mechanically enforced: elias-detect-stop.sh reads the finished response at Stop and blocks once when it still carries a code block, a file path, a command line, or code-shaped identifiers while ELIAS is on.

Toggle: the user can say "elias off" or "technical mode" to disable, "elias on" or "explain like i'm a stakeholder" to enable, "elias status" to check.
```

---

## 4. Task 1: `claude/hooks/elias-mandate.sh`

**Create.** SessionStart / PostCompact hook. Mirrors `concise-mandate.sh` exactly, with the marker test inverted from `[ ! -f ]` to `[ -f ]`.

Shebang is `#!/bin/bash`, matching `concise-mandate.sh` (the other two ELIAS hooks use `#!/usr/bin/env bash`, matching their concise counterparts). Do not homogenize; mirror each counterpart.

Header comment must state, at minimum: the ENABLE-marker semantics and why they are inverted from concise; that `$1` carries the event name so `hookSpecificOutput.hookEventName` matches the event it ran under (a top-level `additionalContext` is not reliably honored); that the ruleset lives here and is single-sourced through `--emit-body`; and that it is self-contained on purpose because the grounding cluster deploys `.sh` files only.

Body:

```bash
elias_rules_body() {
  cat <<'RULES'
[the full Section 3 text]
RULES
}

case "${1:-}" in
  --emit-body) elias_rules_body; exit 0 ;;
esac

EVENT="${1:-SessionStart}"
MARKER="$HOME/.claude/.elias-enabled"

if [ -f "$MARKER" ]; then
  EVENT="$EVENT" BODY="$(elias_rules_body)" python3 -c '
import json, os
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": os.environ.get("EVENT", "SessionStart"),
    "additionalContext": os.environ.get("BODY", "")}}))
'
fi
# marker absent -> no output (no-op)
```

**-> verify:** `chmod +x claude/hooks/elias-mandate.sh && bash -n claude/hooks/elias-mandate.sh && [ -z "$(HOME=$(mktemp -d) bash claude/hooks/elias-mandate.sh SessionStart)" ] && echo SILENT-WHEN-OFF` prints `SILENT-WHEN-OFF`.

**-> verify:** `H=$(mktemp -d); mkdir -p "$H/.claude"; : > "$H/.claude/.elias-enabled"; HOME="$H" bash claude/hooks/elias-mandate.sh PostCompact | python3 -c 'import json,sys; d=json.load(sys.stdin)["hookSpecificOutput"]; assert d["hookEventName"]=="PostCompact"; assert "ELIAS MODE IS ON" in d["additionalContext"]; print("INJECTS-WHEN-ON")'` prints `INJECTS-WHEN-ON`.

**-> verify:** `bash claude/hooks/elias-mandate.sh --emit-body | head -1 | grep -q '^ELIAS MODE IS ON' && echo EMIT-BODY-OK` prints `EMIT-BODY-OK`, and the output is not JSON.

---

## 5. Task 2: `claude/hooks/elias-toggle.sh`

**Create.** UserPromptSubmit hook. Mirrors `concise-toggle.sh` including its `emit`, `emit_on`, and honest-failure structure, with marker polarity inverted.

```bash
#!/usr/bin/env bash
MARKER="$HOME/.claude/.elias-enabled"
MANDATE="$HOME/.claude/hooks/elias-mandate.sh"
OFF_NOTE='ELIAS MODE IS OFF. The user turned off stakeholder framing. Resume normal technical depth: code, file paths, command names, and engineering vocabulary are welcome again. Say "elias on" to re-enable stakeholder framing.'

msg="$(cat | python3 -c '
import sys, json, re
try:
    p = json.load(sys.stdin).get("prompt", "") or ""
except Exception:
    p = ""
p = p.replace("’", chr(39)).replace("ʼ", chr(39))
p = re.sub(r"\s+", " ", p).strip().lower()
p = re.sub(r"[.!]+$", "", p).strip()
print(p)
' 2>/dev/null)"
```

`emit` is byte-identical to `concise-toggle.sh`'s (systemMessage plus `hookSpecificOutput.additionalContext` with `hookEventName: UserPromptSubmit`).

`emit_on` is the same shape: prefer `"$MANDATE" --emit-body`; if the mandate is missing, non-executable, or emits nothing, say so honestly in the systemMessage rather than claiming stakeholder framing is active with no rules injected. Copy that behavior; it exists because the per-hook off-list can drop the mandate while keeping the toggle.

Marker helpers, inverted from concise:

```bash
enable_elias()  { mkdir -p "$HOME/.claude" 2>/dev/null; touch "$MARKER" 2>/dev/null; [ -f "$MARKER" ]; }
disable_elias() { rm -f "$MARKER" 2>/dev/null; [ ! -f "$MARKER" ]; }
```

Case arms, exactly these, in this order:

```bash
case "$msg" in
    "elias on"|"elias mode on"|"stakeholder mode"|"stakeholder mode on"|"explain like i'm a stakeholder"|"explain like im a stakeholder")
        # enable_elias -> emit_on "ELIAS mode is now ON." ; failure -> honest error on both channels
        ;;
    "elias off"|"elias mode off"|"stakeholder mode off"|"technical mode"|"back to technical")
        # disable_elias -> emit "ELIAS mode is now OFF. Normal technical depth resumed." "$OFF_NOTE"
        ;;
    "elias toggle"|"stakeholder mode toggle")
        # marker present -> disable ; absent -> enable. Same honest-failure handling on both arms.
        ;;
    "elias status"|"elias?"|"stakeholder status"|"stakeholder mode status")
        # marker present -> "ELIAS mode is currently ON." ; absent -> "ELIAS mode is currently OFF."
        ;;
esac
```

Anything not matching produces NO output at all, which is what keeps this hook invisible on every ordinary prompt.

**-> verify:** `chmod +x claude/hooks/elias-toggle.sh && bash -n claude/hooks/elias-toggle.sh && H=$(mktemp -d) && mkdir -p "$H/.claude" && echo '{"prompt":"elias on"}' | HOME="$H" bash claude/hooks/elias-toggle.sh | grep -q 'ELIAS mode is now ON' && [ -f "$H/.claude/.elias-enabled" ] && echo ON-OK` prints `ON-OK`.

**-> verify:** `H=$(mktemp -d); mkdir -p "$H/.claude"; [ -z "$(echo '{"prompt":"we should tell elias on friday"}' | HOME="$H" bash claude/hooks/elias-toggle.sh)" ] && echo NO-MIDPROSE` prints `NO-MIDPROSE`.

**-> verify (curly apostrophe):** `H=$(mktemp -d); mkdir -p "$H/.claude"; printf '{"prompt":"Explain like I’m a stakeholder."}' | HOME="$H" bash claude/hooks/elias-toggle.sh | grep -q 'now ON' && echo CURLY-OK` prints `CURLY-OK`.

---

## 6. Task 3: `claude/hooks/elias-detect-stop.sh`

**Create.** Stop hook. Structure mirrors `concise-detect-stop.sh`: `set -euo pipefail`, `trap 'exit 0' EXIT`, four anti-loop layers, a python heredoc that prints `KEY=value` lines, and a bash tail that reads those fields.

Header comment must state: what it enforces; that it deliberately does NOT judge jargon by wordlist and WHY (D5 above, including that a wordlist fires hardest on ruleset rule 4 compliance); the predominantly-code INVERSION versus concise; and the fifth anti-loop layer (cross-gate deferral).

### 6.1 Preamble (mirror `concise-detect-stop.sh:47-94`)

Identical except for two lines:
- The mode check becomes `[ -f "$HOME/.claude/.elias-enabled" ] || exit 0` (note: `||`, not `&&`).
- Flag names: `BLOCKED_FLAG="$HOME/.claude/.elias-stop-blocked.$SESSION_KEY"`, plus `CONCISE_FLAG="$HOME/.claude/.concise-stop-blocked.$SESSION_KEY"`, and the 24h reaper globs `.elias-stop-blocked.*`.

### 6.2 Detection (python heredoc)

Emits six lines: `SKIP=`, `FENCE=`, `PATHS=`, `CMDS=`, `IDENTS=`, `SAMPLE=`. `SAMPLE` is emitted LAST and its value is newline-stripped and truncated to 120 chars, so the bash-side `cut -d= -f2-` can never be confused by an `=` inside it.

```python
TECH_REQUEST_RE = re.compile(r"""(
      \bcode\b | \bsnippet\b | \bdiff\b | \bpatch\b | \bstack\s*trace\b
    | \blog\s+(?:line|output|file)\b | \bthe\s+logs?\b
    | \berror\s+(?:message|string|text)\b
    | \bcommand\b | \bterminal\b | \bshell\b | \bscript\b
    | \bfile\s+(?:path|name)\b | \bwhich\s+file\b | \bwhat\s+file\b | \bshow\s+me\b
    | \bpaste\b | \bverbatim\b | \bexact(?:ly)?\s+(?:string|text|output|wording)\b
    | \bgrep\b | \bregex\b | \brepo\b | \bbranch\b | \bcommit\b | \bpull\s+request\b
    | \btechnical(?:ly)?\b | \bunder\s+the\s+hood\b | \bimplementation\b
    | \bhow\s+(?:does|did)\s+(?:it|that|this)\s+work\b
    | \bdebug\b | \bapi\b | \bendpoint\b | \bquery\b
)""", re.IGNORECASE | re.VERBOSE)

PROMPT_ARTIFACT_RE = re.compile(r"(?:```|~~~|(?<![\w./])/[\w.@+-]+/[\w.@+-]+)")

FENCE_OPEN_RE = re.compile(r"(?m)^[ \t]{0,3}(?:```|~~~)")
URL_RE   = re.compile(r"https?://\S+|\bwww\.\S+")
BRAND_RE = re.compile(r"\b(?:node|next|three|vue|d3|express|nuxt|ember|nest|remix|alpine|chart)\.js\b",
                      re.IGNORECASE)

PATH_RE = re.compile(r"""(?:
      (?<![\w.])(?:~|\.{1,2})/[\w.@+-]+(?:/[\w.@+-]+)*
    | (?<![\w./])/[\w.@+-]+/[\w.@+-]+
    | \b[\w-]+(?:/[\w.@+-]+)*\.(?:sh|bash|zsh|py|rb|go|rs|ts|tsx|jsx|mjs|cjs|json|jsonl|ya?ml|toml|ini|cfg|conf|env|lock|md|css|scss|sass|less|html?|xml|sql|java|kt|swift|cpp|hpp|php|pl|lua|vim|plist|log|tsv)\b
)""", re.VERBOSE)

CMD_TOOLS = (r"npm|npx|yarn|pnpm|bun|git|grep|rg|sed|awk|curl|wget|chmod|chown|mkdir|rmdir|rm|"
             r"python3?|deno|bash|zsh|docker|kubectl|brew|pip3?|cargo|rustc|ssh|scp|rsync|"
             r"unzip|xargs|psql|mysql|redis-cli|terraform|ansible|gh|jq|tsc|eslint|prettier|"
             r"pytest|jest|vitest|shellcheck")
CMD_LINE_RE = re.compile(r"^\s*(?:\$\s+)?(?:" + CMD_TOOLS + r")\s+[\w./@-]", re.IGNORECASE)

BACKTICK_RE   = re.compile(r"`([^`\n]{1,80})`")
CODE_SHAPE_RE = re.compile(r"""(
      \w+\(\s*\)
    | [a-z0-9]+_[a-z0-9_]+
    | \b[a-z]+[A-Z][A-Za-z0-9]*
    | ^--?[A-Za-z][\w-]*$
    | [{}<>;=]
    | \$\w
)""", re.VERBOSE)
```

Transcript parsing is a straight copy of `concise-detect-stop.sh:160-208`: track `last_assistant`, `user_texts`, `last_ok_assistant_line`, `last_bad_line`; skip `isSidechain` entries; a `user` entry only counts when it has real text.

Skip order, and ONLY these skips:

```python
if not last_assistant.strip():
    emit(skip="no-assistant-text")
if last_bad_line > last_ok_assistant_line:
    emit(skip="unparseable-line-after-response")
recent = "\n".join(user_texts[-2:])
if TECH_REQUEST_RE.search(recent) or PROMPT_ARTIFACT_RE.search(recent):
    emit(skip="user-asked-for-the-technical-layer")
```

There is NO `predominantly-code` skip and NO `too-little-prose` skip. Both are deliberate (D5). A one-line answer containing a path is still a violation.

Scoring:

```python
text  = last_assistant
fence = 1 if FENCE_OPEN_RE.search(text) else 0

scrub = URL_RE.sub(" ", text)          # a link to a staging site is fine to give a stakeholder
scrub = BRAND_RE.sub(" ", scrub)       # "Node.js" is a product name, not a filename
scrub = "\n".join(ln for ln in scrub.split("\n") if not ln.lstrip().startswith(">"))

paths  = PATH_RE.findall(scrub)
cmds   = [ln.strip() for ln in scrub.split("\n")
          if CMD_LINE_RE.match(ln) and not ln.rstrip().endswith((".", "!", "?", ":"))]
idents = [m for m in BACKTICK_RE.findall(scrub) if CODE_SHAPE_RE.search(m)]

sample = paths[0] if paths else (cmds[0] if cmds else (idents[0] if idents else ""))
emit(fence=fence, paths=len(paths), cmds=len(cmds),
     idents=(len(idents) if len(idents) >= 2 else 0), sample=sample)
```

Three thresholds, each chosen deliberately and each worth defending in review:
- A single fence, a single path, or a single command line blocks. None of the three has a legitimate stakeholder use.
- Backticked identifiers need TWO or more. One backticked token is plausibly a product or feature name; two is a habit.
- The trailing-sentence-punctuation exclusion on command lines is what stops a sentence starting with a tool-shaped word from firing. Shell command lines do not end in a period.

### 6.3 Bash tail

```bash
[ -z "${DETECT:-}" ] && exit 0
field() { printf '%s\n' "$DETECT" | grep "^$1=" | head -1 | cut -d= -f2-; }
SKIP_REASON=$(field SKIP || true)
FENCE=$(field FENCE  || true); case "$FENCE"  in ''|*[!0-9]*) FENCE=0 ;; esac
PATHS=$(field PATHS  || true); case "$PATHS"  in ''|*[!0-9]*) PATHS=0 ;; esac
CMDS=$(field CMDS    || true); case "$CMDS"   in ''|*[!0-9]*) CMDS=0 ;; esac
IDENTS=$(field IDENTS|| true); case "$IDENTS" in ''|*[!0-9]*) IDENTS=0 ;; esac
SAMPLE=$(field SAMPLE || true)

[ -n "$SKIP_REASON" ] && exit 0

# Clean stop -> re-arm this gate for the next burst.
if [ "$FENCE" -eq 0 ] && [ "$PATHS" -eq 0 ] && [ "$CMDS" -eq 0 ] && [ "$IDENTS" -eq 0 ]; then
  rm -f "$BLOCKED_FLAG" 2>/dev/null || true
  exit 0
fi

# Layer 2: one block per burst.
[ -f "$BLOCKED_FLAG" ] && exit 0
# Layer 2a: CROSS-GATE DEFERRAL. If concise already claimed this burst, stay silent.
[ -f "$CONCISE_FLAG" ] && exit 0
# Layer 3: atomic claim.
mkdir -p "$HOME/.claude" 2>/dev/null || true
if ! (set -o noclobber; : > "$BLOCKED_FLAG") 2>/dev/null; then
  exit 0
fi
```

Block reason, assembled per detection and always ending with the same tail:

- fence: `Rule 3 (no code, paths, commands, or identifiers): your response contains a code block. The reader cannot use it and will not read it. Say what the code changes for them instead.`
- paths: `Rule 3: your response names a file or path ("<SAMPLE>"). Name the capability or the screen it affects, not the file.`
- cmds: `Rule 3: your response contains a command line ("<SAMPLE>"). Describe the effect, not the invocation.`
- idents: `Rules 3 and 4: <IDENTS> code-shaped names in backticks. Replace each with the plain-language thing it does.`
- tail: `Re-send your previous message rewritten for the stakeholder: same facts, same honesty, no engineering artifacts, leading with the outcome. Do not comment on this block. This gate fires once, then stays quiet until a clean response. If the technical layer is genuinely needed, the user can ask for it or say "elias off".`

Log one line to `$LOG_FILE` in the same format concise uses, then print `{"decision": "block", "reason": ...}` via the same `python3 -c` json.dumps pattern and `exit 0`.

**-> verify:** `chmod +x claude/hooks/elias-detect-stop.sh && bash -n claude/hooks/elias-detect-stop.sh && echo SYNTAX-OK` prints `SYNTAX-OK`.

**-> verify:** `H=$(mktemp -d); mkdir -p "$H/.claude"; printf '{"session_id":"x","transcript_path":"/nope","stop_hook_active":false}' | HOME="$H" bash claude/hooks/elias-detect-stop.sh; echo "rc=$?"` prints `rc=0` with no other output (ELIAS off means silent).

**-> verify:** the full behavior gate is `bash claude/hooks/test-elias-detect-stop.sh` in Task 6.

---

## 7. Task 4: interaction edits to `claude/hooks/concise-detect-stop.sh`

Two surgical insertions. This is the only existing hook this feature modifies.

**Edit A: the volume relaxation.** Insert immediately AFTER line 68 (`[ -f "$HOME/.claude/.concise-disabled" ] && exit 0`) and BEFORE the `SESSION_KEY=` assignment:

```bash
# ELIAS relaxation. Plain language costs words: a jargon term is one word, its
# plain-language gloss is a clause. When ELIAS mode is on the volume ceiling rises
# so the two modes do not pull in opposite directions. An explicitly-set
# CONCISE_WORD_CAP always wins, so operator tuning is never overridden.
if [ -f "$HOME/.claude/.elias-enabled" ] && [ -z "${CONCISE_WORD_CAP:-}" ]; then
  export CONCISE_WORD_CAP="${ELIAS_WORD_CAP:-400}"
fi
```

Use the `if` block form, not a one-line `&&` chain. The chain happens to be safe under `set -e` today (a non-final failing command in an AND-OR list is exempt) but only while the final command always succeeds, and this file's `trap 'exit 0' EXIT` would swallow the resulting early exit SILENTLY, disabling the rest of a working gate with no error anywhere. The `if` form removes the footgun.

**Edit B: the cross-gate deferral.** Insert AFTER the clean-stop re-arm block (current lines 365-368) and BEFORE the existing Layer 2 check at line 372:

```bash
# Layer 2a: CROSS-GATE DEFERRAL. elias-detect-stop.sh runs at the same Stop event and
# can block the same response with a contradictory instruction (this gate says "cut
# it", that one says "rewrite it for the reader"). Whichever gate claims the burst
# first owns it; the other stays silent. Placed AFTER the clean-stop re-arm above, so
# a clean response still clears this gate's own flag even while ELIAS holds a block.
[ -f "$HOME/.claude/.elias-stop-blocked.$SESSION_KEY" ] && exit 0
```

Placement is load-bearing in both directions. Above the re-arm, a live ELIAS block would leave concise's own flag stale forever. Below Layer 2, the deferral would come too late to prevent the double block.

**-> verify:** `bash -n claude/hooks/concise-detect-stop.sh && bash claude/hooks/test-concise-detect-stop.sh` exits 0 with zero FAIL rows (this is the regression gate: every pre-existing concise case must still pass unchanged).

**-> verify:** `grep -n 'elias' claude/hooks/concise-detect-stop.sh | wc -l` prints `2` or more, and `grep -c 'CONCISE_WORD_CAP' claude/hooks/concise-detect-stop.sh` is at least 3.

---

## 8. Task 5: wiring (four files, six edit sites)

### 8.1 `claude/hooks/cluster-wirings.json`

Insert three top-level keys immediately after the `"concise-detect-stop.sh"` block (which ends at line 398), keeping the file's one-space indent style:

```json
 "elias-mandate.sh": [
  {
   "event": "SessionStart",
   "matcher": null,
   "hook": {
    "type": "command",
    "command": "~/.claude/hooks/elias-mandate.sh SessionStart",
    "timeout": 5,
    "statusMessage": "Loading stakeholder mode..."
   }
  },
  {
   "event": "PostCompact",
   "matcher": null,
   "hook": {
    "type": "command",
    "command": "~/.claude/hooks/elias-mandate.sh PostCompact",
    "timeout": 5,
    "statusMessage": "Loading stakeholder mode..."
   }
  }
 ],
 "elias-toggle.sh": [
  {
   "event": "UserPromptSubmit",
   "matcher": null,
   "hook": {
    "type": "command",
    "command": "~/.claude/hooks/elias-toggle.sh",
    "timeout": 5
   }
  }
 ],
 "elias-detect-stop.sh": [
  {
   "event": "Stop",
   "matcher": null,
   "hook": {
    "type": "command",
    "command": "~/.claude/hooks/elias-detect-stop.sh",
    "timeout": 10
   }
  }
 ],
```

**-> verify:** `python3 -m json.tool claude/hooks/cluster-wirings.json > /dev/null && python3 -c "import json; d=json.load(open('claude/hooks/cluster-wirings.json')); assert len(d['elias-mandate.sh'])==2 and len(d['elias-toggle.sh'])==1 and len(d['elias-detect-stop.sh'])==1; print('WIRING-OK')"` prints `WIRING-OK`.

### 8.2 `install.sh` line 2193

Append the three filenames to the `grounding)` cluster list. After the edit the line reads:

```
    grounding)           echo "grounding-gate.sh grounding-guard.sh task-loop-mandate.sh justify-queue-mandate.sh concise-mandate.sh concise-toggle.sh concise-detect-stop.sh elias-mandate.sh elias-toggle.sh elias-detect-stop.sh" ;;
```

Do NOT add anything to `hook_data_files` (the table just below it). ELIAS ships no companion data file, by design (Section 1).

**-> verify:** `grep -c 'elias-mandate.sh elias-toggle.sh elias-detect-stop.sh' install.sh` prints `1`.

### 8.3 `claude/hooks/browser-tree.json`, spot 1 (cluster hooks list, around lines 270-284)

In the `"key": "grounding"` bucket:
- `"tag"`: change `"the 7 grounding hooks"` to `"the 10 grounding hooks"`.
- `"desc"`: append one sentence to the existing text: `A fourth, off by default, rewrites replies for a non-technical stakeholder when you switch it on.`
- `"hooks"`: append `"elias-mandate"`, `"elias-toggle"`, `"elias-detect-stop"` after `"concise-detect-stop"`.

### 8.4 `claude/hooks/browser-tree.json`, spot 2 (`hook_desc` map, after line 547)

Add three entries. House style is two sentences, plain language, no emdash, no emoji:

```json
    "elias-mandate": "Injects the stakeholder ruleset each session so replies are written for a non-technical reader: outcome first, plain language, timeline and risk stated out loud. Off unless you turn it on by saying \"elias on\".",
    "elias-toggle": "Turns stakeholder framing on or off at runtime, reacting to \"elias on\", \"elias off\", \"stakeholder mode\", \"technical mode\" and \"elias status\". The command must be your whole message, so those words never fire mid-prose.",
    "elias-detect-stop": "Checks the finished reply while stakeholder mode is on and blocks once when it still carries a code block, a file path, a command line or code-shaped names. It judges shape, not vocabulary, so ordinary plain-English explanation passes.",
```

### 8.5 `claude/hooks/browser-tree.json`, spot 3 (`hook_owner` map, after line 605)

```json
    "elias-mandate": "grounding",
    "elias-toggle": "grounding",
    "elias-detect-stop": "grounding",
```

**-> verify (all three spots):** `python3 -m json.tool claude/hooks/browser-tree.json > /dev/null && python3 -c "
import json
d = json.load(open('claude/hooks/browser-tree.json'))
names = ['elias-mandate','elias-toggle','elias-detect-stop']
assert all(d['hook_desc'].get(n) for n in names), 'hook_desc missing'
assert all(d['hook_owner'].get(n) == 'grounding' for n in names), 'hook_owner missing'
print('TREE-OK')"` prints `TREE-OK`. (If `hook_desc` is not the literal key name, it is the map whose entries end at line 567, immediately preceding `hook_owner`. Confirm the key before writing the assertion.)

**-> verify (registry):** `bash claude/hooks/hook-registry-guard.sh --check elias-mandate && bash claude/hooks/hook-registry-guard.sh --check elias-toggle && bash claude/hooks/hook-registry-guard.sh --check elias-detect-stop && echo MANAGED` prints `MANAGED` (exit 0 means managed).

**-> verify (registry sweep):** `bash claude/hooks/hook-registry-guard.sh --audit` exits 0.

### 8.6 What NOT to touch

- `claude/settings.json` gets no ELIAS entries. It is the base file and carries no cluster wiring.
- `claude/hooks/app-wirings.json` gets no ELIAS entries. ELIAS is cluster-owned, not app-level.
- `hook-registry-guard.sh`'s `_is_excluded` gets no ELIAS entry. All three hooks are genuinely wired.
- `test-settings-wire-parity.sh`'s `UNWIRED_BY_DESIGN_JSON` gets no ELIAS entry, and no `REACHER_KIND` is introduced, because no shared library is introduced (D6).

---

## 9. Task 6: the test suite

Three new suites plus additions to one existing suite. All mirror `test-concise-detect-stop.sh`'s idioms exactly: `pass`/`fail` counters, `ok()`/`bad()` printers, a fake `$HOME` per case via `newhome()`, a `transcript()` python heredoc builder, `run()`/`run_rc()` wrappers, a `fired()` predicate, and the footer:

```bash
echo
echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
```

Every suite writes ONLY inside its own `mktemp -d`. No suite may touch the real `$HOME` or the real `claude/hooks/` directory.

### 9.1 `claude/hooks/test-elias-mandate.sh`

| # | Case | Expected |
|---|---|---|
| 1 | marker absent, `SessionStart` | zero bytes of output, exit 0 |
| 2 | marker absent, `PostCompact` | zero bytes of output, exit 0 |
| 3 | marker absent, no argument at all | zero bytes of output, exit 0 |
| 4 | marker present, `SessionStart` | valid JSON, `hookEventName == "SessionStart"` |
| 5 | marker present, `PostCompact` | valid JSON, `hookEventName == "PostCompact"` |
| 6 | marker present, no argument | `hookEventName == "SessionStart"` (the default) |
| 7 | marker present | `additionalContext` contains `ELIAS MODE IS ON` |
| 8 | marker present | `additionalContext` contains all ten numbered rules (`grep -c` for `^10\.` finds one) |
| 9 | marker present | `additionalContext` names the concise composition (contains `WITH CONCISE MODE`) |
| 10 | `--emit-body` | prints the raw ruleset, is NOT valid JSON, exit 0 |
| 11 | `--emit-body` with marker absent | still prints the body (the flag ignores the marker) |
| 12 | ruleset hygiene | body contains no emdash and no emoji |
| 13 | MUTANT | with the marker present, output is non-empty; case 1 and case 13 together prove the gate can go both ways |

Case 1 is the single most important assertion in the entire feature. A mandate that injects while off would put stakeholder framing into every engineering session on every machine that installs the grounding cluster.

**-> verify:** `bash claude/hooks/test-elias-mandate.sh` exits 0 with zero FAIL rows.

### 9.2 `claude/hooks/test-elias-toggle.sh`

| # | Case | Expected |
|---|---|---|
| 1-6 | each ON alias as the whole message | marker created, systemMessage says ON, `additionalContext` contains `ELIAS MODE IS ON` |
| 7-11 | each OFF alias | marker removed, systemMessage says OFF, `additionalContext` contains `ELIAS MODE IS OFF` |
| 12 | `elias toggle` with marker absent | marker created, ON message |
| 13 | `elias toggle` with marker present | marker removed, OFF message |
| 14 | `elias status` with marker present | reports ON, marker unchanged |
| 15 | `elias?` with marker absent | reports OFF, marker unchanged |
| 16 | `stakeholder status` | same as `elias status` |
| 17 | `ELIAS ON` (uppercase) | works (lowercasing) |
| 18 | `  elias   on  ` (padded, internal double space) | works (whitespace collapse) |
| 19 | `elias on.` and `elias on!` | works (trailing `.` and `!` stripped) |
| 20 | `Explain like I<U+2019>m a stakeholder` | works (curly apostrophe mapped) |
| 21 | `we should tell elias on friday` | NO output, marker unchanged |
| 22 | `elias` alone | NO output (deliberately not a command) |
| 23 | `can you turn elias on?` | NO output (not a whole-message match) |
| 24 | empty prompt / malformed stdin | NO output, exit 0 |
| 25 | ON path with the mandate missing from the fake HOME | emits the honest warning on BOTH channels, never claims the ruleset is active |
| 26 | ON path with `$HOME/.claude` made read-only (`chmod 500`) | reports the failure honestly, does not claim ON |
| 27 | ON path | `additionalContext` is byte-identical to `elias-mandate.sh --emit-body` (proves single-sourcing) |

Case 27 is what stops the ruleset from being duplicated into the toggle over time.

**-> verify:** `bash claude/hooks/test-elias-toggle.sh` exits 0 with zero FAIL rows.

### 9.3 `claude/hooks/test-elias-detect-stop.sh`

Fixtures to define at the top:

- `FIX_CLEAN` - a genuine stakeholder answer. Outcome first, timeline named, closing ask. No paths, no code, no backticks.
- `FIX_FENCE` - a clean stakeholder answer with one fenced code block appended.
- `FIX_PATH` - `The fix is in claude/hooks/elias-mandate.sh and it ships tonight.`
- `FIX_CMD` - an answer whose own line reads `npm run build --workspace web`.
- `FIX_IDENTS` - an answer with two backticked code-cased tokens, for example `` `getUserToken()` `` and `` `--dry-run` ``.
- `FIX_ONE_IDENT` - the same answer with only ONE backticked token.
- `FIX_URL` - an answer containing `https://staging.example.com/invoices/latest` and nothing else path-like.
- `FIX_BRAND` - an answer saying `we are upgrading Node.js next sprint`.
- `FIX_HESHE` - an answer containing `read/write/execute` and `he/she/it`.

| Group | # | Case | Expected |
|---|---|---|---|
| FIRES | 1 | `FIX_FENCE` | block; reason cites Rule 3 and says code block |
| | 2 | `FIX_PATH` | block; reason quotes the offending path |
| | 3 | `FIX_CMD` | block; reason quotes the command |
| | 4 | `FIX_IDENTS` | block; reason names the count and cites rules 3 and 4 |
| | 5 | a one-line answer that is ONLY a path | block (proves there is no too-little-prose skip) |
| | 6 | a response that is 90 percent code with no user request for it | block (proves the predominantly-code INVERSION versus concise) |
| SILENT | 7 | `FIX_CLEAN` | silent |
| | 8 | `FIX_ONE_IDENT` | silent (one backticked token is under the threshold) |
| | 9 | `FIX_URL` | silent (URLs are scrubbed before path matching) |
| | 10 | `FIX_BRAND` | silent (`Node.js` is a product name) |
| | 11 | `FIX_HESHE` | silent (slash-separated English words are not paths) |
| | 12 | a sentence starting `Go live next week.` | silent (sentence punctuation excludes it from command matching) |
| | 13 | `FIX_PATH` inside a blockquote (`>` prefixed) | silent (quoted material is the user's words) |
| SKIPS | 14 | `FIX_FENCE` with marker ABSENT | silent (ELIAS off) |
| | 15 | `FIX_PATH` with user prompt `show me the code` | silent |
| | 16 | `FIX_PATH` with user prompt `which file broke?` | silent |
| | 17 | `FIX_FENCE` with a user prompt containing a fenced block | silent |
| | 18 | `FIX_PATH` with a user prompt containing `/etc/hosts` | silent |
| | 19 | tool-only assistant turn (no text) | silent |
| | 20 | `isSidechain` teammate turn carrying `FIX_PATH`, lead turn clean | silent |
| ANTI-LOOP | 21 | two consecutive violating stops | first blocks, second is silent |
| | 22 | after a block | `.elias-stop-blocked.<sid>` exists |
| | 23 | violation, then clean, then violation | third stop blocks again (clean stop re-armed the gate) |
| | 24 | `stop_hook_active: true` | silent |
| | 25 | `.concise-stop-blocked.<sid>` pre-created, violating response | silent (cross-gate deferral) |
| | 26 | same as 25 but with a CLEAN response | `.elias-stop-blocked.<sid>` is still removed (deferral does not block re-arming) |
| FAIL-OPEN | 27 | malformed transcript | silent, exit 0 |
| | 28 | missing transcript file | exit 0 |
| | 29 | malformed stdin | exit 0 |
| | 30 | corrupt line AFTER the judged response | silent |
| | 31 | corrupt line BEFORE a complete response | still fires |
| MUTANT | 32 | `FIX_PATH` with the path replaced by a plain noun | silent (the path detection is load-bearing, not incidental) |
| | 33 | `FIX_IDENTS` reduced to one identifier | silent (the threshold is load-bearing) |

**-> verify:** `bash claude/hooks/test-elias-detect-stop.sh` exits 0 with zero FAIL rows.

### 9.4 Additions to `claude/hooks/test-concise-detect-stop.sh`

Append a new section, `=== ELIAS INTERACTION ===`, with five cases. Do not modify any existing case.

| # | Case | Expected |
|---|---|---|
| A | `LONG_PROSE` (about 350 words) with ELIAS marker ABSENT | blocks on volume (today's behavior, unchanged) |
| B | the same `LONG_PROSE` with `.elias-enabled` present in the fake HOME | silent (the 400-word ELIAS ceiling applies) |
| C | the same, ELIAS on, plus `CONCISE_WORD_CAP=200` in the environment | blocks (an explicit cap always wins over the ELIAS default) |
| D | a tangent-violating response with `.elias-stop-blocked.<sid>` pre-created | silent (cross-gate deferral) |
| E | a CLEAN response with `.elias-stop-blocked.<sid>` pre-created | `.concise-stop-blocked.<sid>` is absent afterwards (the clean-stop re-arm still runs ahead of the deferral) |

Case E is the one that catches a mis-placed deferral. If the deferral is inserted above the re-arm instead of below it, E goes red and everything else stays green.

**-> verify:** `bash claude/hooks/test-concise-detect-stop.sh` exits 0 with zero FAIL rows, and its printed pass count is at least 5 higher than before the edit.

---

## 10. Task 7: documentation counts, and Task 8: the gate

### 10.1 Task 7 - `README.md`

Three hand-maintained numbers go stale. All are in the collapsed "Every hook, by cluster" section:

- Line 196: `<summary><b>Every hook, by cluster (71 total)</b></summary>` becomes `(74 total)`.
- Line 210, Guardrails row: `| Guardrails | 39 |` becomes `| Guardrails | 42 |`.
- Line 210, same row's sub-group list: `grounding (7)` becomes `grounding (10)`.

Then sweep for any other mention. `grep -rn 'concise' . --exclude-dir=.git` names every file that already talks about the concise trio; every one of them is a candidate touchpoint for ELIAS, and the builder must look at each hit and decide. Known non-obvious ones to check explicitly: `claude/CLAUDE.md` and `~/.claude/CLAUDE.md` (behavioral rules), any `.claude/memory/` decision beat about the hook architecture, and any per-hook off-list mechanism referenced in `concise-toggle.sh`'s comments.

**-> verify:** `grep -n '74 total' README.md && grep -n 'grounding (10)' README.md && echo README-OK` prints `README-OK`.

**-> verify:** `grep -rn 'concise' . --exclude-dir=.git -l` produces a file list, and every file on it has been opened and consciously included or excluded. Record the excluded ones and why, in the session beat.

### 10.2 Task 8 - beats

Write a session beat at `.claude/memory/session_2026-08-05_elias-mode.md`, `type: project`, collaborator Jonah, with a `relates_to` link to any existing concise-mode beat found by scanning `MEMORY.md`. Also write a `type: decision` beat recording D1 (default-off), D2 (composition and precedence), and D5 (artifact-shape enforcement, wordlist deferred), because each had real alternatives and the reasoning will be needed if anyone proposes the wordlist later. Update `MEMORY.md` with one-line pointers.

---

## 11. Acceptance checklist - how we know it won

Every line is a command. The feature is done when all of them pass in one sitting, at one commit.

**Unit and behavior**
- [ ] `bash claude/hooks/test-elias-mandate.sh` exits 0, zero FAIL rows
- [ ] `bash claude/hooks/test-elias-toggle.sh` exits 0, zero FAIL rows
- [ ] `bash claude/hooks/test-elias-detect-stop.sh` exits 0, zero FAIL rows
- [ ] `bash claude/hooks/test-concise-detect-stop.sh` exits 0, zero FAIL rows, pass count up by at least 5
- [ ] `for f in claude/hooks/elias-*.sh; do bash -n "$f" || echo "SYNTAX $f"; done` prints nothing

**Registry, wiring, packaging**
- [ ] `bash claude/hooks/hook-registry-guard.sh --audit` exits 0
- [ ] `bash claude/hooks/hook-registry-guard.sh --audit-data` exits 0
- [ ] `bash claude/hooks/test-hook-registry.sh` exits 0, zero FAIL rows
- [ ] `bash claude/hooks/test-settings-wire-parity.sh` exits 0 (a non-zero exit here means a deployed hook that can never fire, which is the silent failure this suite exists for)
- [ ] `python3 -m json.tool claude/hooks/cluster-wirings.json > /dev/null`
- [ ] `python3 -m json.tool claude/hooks/browser-tree.json > /dev/null`
- [ ] `bash install.sh --manifest | python3 -m json.tool > /dev/null` (valid JSON, exit 0)
- [ ] `bash install.sh --manifest | grep -c elias` is at least 1
- [ ] `bash install.sh --dry-run --only config` names all three elias hooks in its resolved plan
- [ ] `ls -l claude/hooks/elias-*.sh` shows the executable bit on all three
- [ ] Run any aggregate hook-test runner the repo has (check `claude/hooks/_tests/`, a Makefile target, and `package.json` scripts). If one exists it must be green; if none exists, the explicit list above is the gate.

**Live behavior, observed and not inferred**
- [ ] With `~/.claude/.elias-enabled` ABSENT: `bash claude/hooks/elias-mandate.sh SessionStart` produces zero bytes
- [ ] After `echo '{"prompt":"elias on"}' | bash claude/hooks/elias-toggle.sh`, the marker exists and the JSON carries the full ruleset
- [ ] In a real session: say `elias on`, ask a technical question, and observe the reply is written for a stakeholder. Then say `elias off` and observe normal depth returns
- [ ] In a real session with both modes on, observe that at most ONE Stop block lands per response

**Hygiene**
- [ ] `grep -rn 'Co-Authored-By\|Generated with' claude/hooks/elias-*.sh` prints nothing
- [ ] No emoji and no emdash in any new file (the `content-guard.sh` PreToolUse hook enforces this at write time; a blocked write is the signal, not a nuisance)
- [ ] Session beat and decision beat written, `MEMORY.md` updated

**Cross-model review (Team Rule 8)**
- [ ] Codex review of the full diff (`codex --version` first; if Codex is unavailable, an independent Claude reviewer with clean context, which was NOT the producer). Fold every finding and re-run the whole gate above, not just the flagged line.

---

## 12. Risk register and precedence edge cases

**R1. The mandate injecting while OFF.** The worst failure in the feature. Every machine installing the grounding cluster would get stakeholder framing in every engineering session. Mitigation: the marker test is `[ -f ]` (present means ON) and it is the first assertion in `test-elias-mandate.sh`. Note the polarity trap: `concise-mandate.sh` uses `[ ! -f ]`. Copying that line without inverting it produces exactly this bug and every other test still passes.

**R2. Double-block ping-pong between the two Stop gates.** Two gates blocking one response with contradictory instructions. Mitigation: the cross-gate deferral in both directions (Task 4 Edit B and Section 6.3 Layer 2a). Verified by test cases 25, 26, D, and E. Hook execution ORDER is not guaranteed, which is exactly why the deferral is symmetric rather than one-sided.

> KNOWN-EDGE (Codex 2026-08-05, Jonah ACCEPTED): the symmetric deferral closes the SEQUENTIAL race but the two burst flags are not atomic ACROSS the two hooks. If Claude Code runs same-event Stop hooks in PARALLEL, both gates can read "no flag" at once on the first burst and both block once. It self-heals on the retry (both flags then exist), needs both modes on and a reply that violates both gates, and only ever doubles the FIRST burst. The robust fix (a single shared claim file both gates race on via O_CREAT|O_EXCL) breaks D6's no-shared-mechanism constraint, so it is deliberately NOT built. Staged as phase 2 (Section 13, item 6) to build only if a doubled first-burst block is observed in practice.

**R3. Misplaced deferral leaving a stale flag.** If Edit B goes above the clean-stop re-arm instead of below it, concise's own burst flag never clears while ELIAS holds a block, and concise goes permanently silent. Caught only by test case E. Do not drop that case.

**R4. Path detector false fires.** Three known classes are handled and each has a test: URLs (scrubbed first, case 9), dotted product names like `Node.js` (scrubbed, case 10), and slash-separated English like `read/write` or `he/she/it` (the absolute-path branch requires the leading slash not be preceded by a word character, case 11). A fourth class the builder should watch for in review: version strings and decimal numbers. Neither matches the current pattern, but any widening of `PATH_RE` must re-check them.

**R5. Command detector false fires on ordinary sentences.** A sentence beginning with a tool-shaped word (`Go live next week`, `Open questions remain`, `Make sure the client signs off`) would match a naive line-start pattern. Mitigation: ambiguous English verbs are deliberately absent from `CMD_TOOLS`, AND a line ending in sentence punctuation is excluded. Case 12 locks this in. If anyone adds `go`, `open`, `make`, `find`, `cd`, `ls`, or `cat` to `CMD_TOOLS`, this gate starts firing on prose.

**R6. `set -e` plus `trap 'exit 0' EXIT` hides a broken gate.** The trap means a strict-mode abort produces a silent, successful-looking no-op. That is correct for fail-open behavior and dangerous during development: a typo can disable the whole gate with no error anywhere. Mitigation: every suite includes MUTANT cases that assert the gate CAN go red. A gate that cannot go red is not a gate.

**R7. Context budget.** With both modes on, two rulesets are injected at SessionStart (roughly 500 words each). This is accepted, not solved. If it becomes a problem the fix is to have the ELIAS body reference concise's rules by number rather than restating the composition, which is why the composition paragraph is already written as a diff against concise rather than a full restatement.

**R8. `elias` is a human first name.** A message that is exactly `elias` is deliberately NOT a command (D3, test case 22). `elias?` IS a status command, and is the one residual collision. Accepted: it is a whole-message exact match, and the failure mode is a harmless one-line status report.

**R9. The marker is per-machine, not per-project or per-conversation.** Turning ELIAS on in one terminal turns it on for every session on that machine. This matches the voice system exactly and is intentional; a per-project marker would need a project-root file that git would then carry to teammates who did not ask for it.

**R10. PostCompact event-name mismatch.** If `$1` is not threaded through, `hookEventName` will not match the event and the injection may be silently dropped. Locked by test cases 4, 5, and 6.

**R11. Toggle firing mid-prose.** Mitigated by whole-message matching, and by the deliberate exclusion of a bare `elias`. Cases 21, 22, and 23.

**R12. Writing this plan's own forbidden strings.** The ruleset and the block reasons quote paths and command shapes. `content-guard.sh` may block a write that contains a pattern it polices. If that happens, per the Hook Override Protocol, ASK for permission to bypass rather than silently weakening the ruleset text. Do not paraphrase around a guard.

### Precedence table (the four states, so no state is left to guess)

| concise | ELIAS | Injection | Volume cap | Stop gates active |
|---|---|---|---|---|
| ON (default) | OFF (default) | concise ruleset only | 300 | concise only. Behavior is byte-for-byte today's |
| ON | ON | both rulesets, composition paragraph governs | 400 | both, one block per burst, ELIAS effectively wins |
| OFF | ON | ELIAS ruleset only | not applicable (concise gate exits at its marker check before the relaxation) | ELIAS only |
| OFF | OFF | neither | not applicable | neither |

The first row is the regression contract: with ELIAS off, nothing about this feature may be observable. `test-concise-detect-stop.sh`'s existing cases are the proof, and they must pass unmodified.

---

## 13. Explicitly out of scope (phase 2 and later)

1. **The jargon wordlist detector.** Deferred deliberately (D5). Revisit only after measuring a real corpus of ELIAS-on responses, the way concise's volume gate was set from 232 measured responses. The measurement is the prerequisite, not the detector.
2. **Tuning `ELIAS_WORD_CAP` from data.** 400 is a reasoned starting position, not a measurement. Same prerequisite.
3. **A shared `stop-transcript-lib.sh`.** Extract under the rule of three, when a third Stop gate needs the same preamble (D6).
4. **Per-project or per-conversation ELIAS state.** The marker is per-machine, matching voice (R9).
5. **An `/elias` skill or slash command.** The hook trio is the whole surface. This repo has a standing lesson on record about adding an orchestrator layer above steps nothing invokes; do not add a skill to make the mode "more discoverable" before the hooks have been used.
6. **A shared atomic cross-gate claim file.** The current cross-gate deferral (D2c) closes the sequential race; the parallel-execution edge (R2 known-edge, accepted by Jonah 2026-08-05) is left unfixed because the robust fix breaks D6's no-shared-mechanism rule. Build only if a doubled first-burst block is observed in practice, and only after weighing it against D6.
