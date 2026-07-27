# Agent Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the session model dispatch work-shaped prompts to a cheaper agent whose model is pinned in frontmatter, cutting reasoning effort per prompt.

**Architecture:** Three units. A roster of agent definition files declares which models exist and what each is for. A pure-shell UserPromptSubmit hook classifies the prompt and injects one advisory line naming a candidate. The session model decides every dispatch and may always decline. The classifier has no authority, so a wrong nudge is harmless.

**Tech Stack:** Bash + stdlib Python 3 (no third-party deps, matching every other hook in `claude/hooks/`). JSON lexicon. Bash test harness.

Spec: `docs/superpowers/specs/2026-07-26-agent-routing-design.md`, authored against `1bd2e239`.

## Global Constraints

- No emojis, no emdashes, no AI attribution anywhere in output, comments, or commits.
- Hooks are stdlib-only: bash + `python3` standard library. No pip installs.
- Every hook failure path exits 0 with no output. This hook must never break a turn.
- Repo files are the source of truth; `~/.claude/hooks/*` are symlinks into `claude/hooks/`.
- Hook scripts are invoked DIRECTLY by settings.json (`~/.claude/hooks/x.sh`, no `bash` prefix), so every new hook must be `chmod +x`.
- Collaborator name in beats: Jonah.
- Write a session beat to `.claude/memory/` after each task before reporting it done.

## File Structure

Create:
- `claude/agents/quick-answer.md` - haiku tier, read-only
- `claude/agents/sonnet-impl.md` - sonnet tier, edit-capable
- `claude/agents/opus-executor.md` - opus tier, promoted from `.claude/agents/`
- `claude/hooks/route-intent.json` - tunable lexicon, no logic
- `claude/hooks/route-intent.sh` - classifier, no policy data
- `claude/hooks/test-route-intent.sh` - regression harness

Modify:
- `claude/hooks/cluster-wirings.json` - add routing wiring, remove model-router wiring
- `install.sh` - add the `agent-routing` cluster, remove the `model-routing` cluster
- `claude/hooks/sidecoach_lanes.py:3` and `claude/hooks/sidecoach-keyword.sh:89` - stale comments

Delete:
- `claude/hooks/model-router-guard.sh`

Keep (do not touch):
- `claude/hooks/detect-session-model.sh` - still called by `fable-orchestrator-guard.sh:26`
- `claude/hooks/fable-orchestrator-guard.sh` - independent hook, `settings.json:144`

The lexicon and the classifier are split so prompt-shape tuning never risks the
fail-open logic, and the logic can be tested against a fixture lexicon.

**Task 8 is independent.** Tasks 1-7 deliver working routing on their own. If the
guard removal is deferred or narrowed, nothing in Tasks 1-7 changes.

---

### Task 1: Agent roster

**Files:**
- Create: `claude/agents/quick-answer.md`
- Create: `claude/agents/sonnet-impl.md`
- Create: `claude/agents/opus-executor.md`
- Test: `claude/hooks/test-route-intent.sh` (created here, extended by later tasks)

**Interfaces:**
- Consumes: nothing
- Produces: agent names `quick-answer`, `sonnet-impl`, `opus-executor`, referenced by `route-intent.json` in Task 2 and dispatched via `Agent(subagent_type: <name>)`

- [ ] **Step 1: Write the failing test**

Create `claude/hooks/test-route-intent.sh`:

```bash
#!/bin/bash
# Regression tests for route-intent.sh and the agent roster.
# Run: bash claude/hooks/test-route-intent.sh
# Exits non-zero if any test fails.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$HOOK_DIR/../.." && pwd)"
HOOK="$HOOK_DIR/route-intent.sh"
AGENTS_DIR="$REPO_DIR/claude/agents"

PASS=0
FAIL=0
FAIL_LABELS=()

pass() { echo "PASS: $1"; ((PASS++)); }
fail() { echo "FAIL: $1 ($2)"; FAIL_LABELS+=("$1"); ((FAIL++)); }

# Assert an agent file declares an exact `model:` value in its frontmatter.
assert_agent_model() {
  local label="$1" file="$2" expected="$3"
  if [ ! -f "$AGENTS_DIR/$file" ]; then
    fail "$label" "missing $AGENTS_DIR/$file"; return
  fi
  local got
  got=$(awk '/^---$/{n++; next} n==1 && /^model:/{print $2; exit}' "$AGENTS_DIR/$file")
  if [ "$got" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "expected model: $expected, got: ${got:-<none>}"
  fi
}

# Assert an agent file declares an exact `tools:` line in its frontmatter.
assert_agent_tools() {
  local label="$1" file="$2" expected="$3"
  local got
  got=$(awk '/^---$/{n++; next} n==1 && /^tools:/{sub(/^tools:[[:space:]]*/,""); print; exit}' "$AGENTS_DIR/$file")
  if [ "$got" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "expected tools: $expected, got: ${got:-<none>}"
  fi
}

assert_agent_model "quick-answer is haiku"   quick-answer.md  haiku
assert_agent_model "sonnet-impl is sonnet"   sonnet-impl.md   sonnet
assert_agent_model "opus-executor is opus"   opus-executor.md opus
assert_agent_tools "quick-answer is read-only" quick-answer.md "Read, Grep, Glob"

echo ""
echo "============================================================"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed cases:"
  for label in "${FAIL_LABELS[@]}"; do
    echo "  - $label"
  done
  exit 1
fi
echo "All tests pass."
exit 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: FAIL, 4 failures, "missing .../quick-answer.md"

- [ ] **Step 3: Create the roster directory and the haiku tier**

```bash
mkdir -p claude/agents
```

Create `claude/agents/quick-answer.md`:

```markdown
---
name: quick-answer
description: Read-only lookup tier. Use for a single factual question about the codebase that a targeted read or grep answers - what a function returns, where a value is set, which file owns a symbol. Not for multi-file synthesis, not for anything requiring a judgment call, and never for edits.
model: haiku
tools: Read, Grep, Glob
---

You answer one narrow factual question and stop.

Rules:
- Answer from the files. Quote the exact line and cite it as `path:line`. Never answer from memory or inference about what a file probably contains.
- If the answer needs more than about three file reads, stop and report that the question is broader than this tier. Do not expand the search to compensate.
- If the files contradict each other or the answer is genuinely absent, say so plainly. A wrong confident answer is far more expensive than an admitted miss, because the caller will act on it.
- You cannot modify files. If the question implies a change, report what would need to change and let the caller decide.
- Report the answer in one to three sentences. No preamble, no restatement of the question.
```

- [ ] **Step 4: Create the sonnet tier**

Create `claude/agents/sonnet-impl.md`:

```markdown
---
name: sonnet-impl
description: Implementation tier for a single well-specified change unit - a rename across known call sites, a mechanical refactor with a stated shape, adding a test to an existing suite. Use when the spec is complete and no design decision remains. Escalate to opus-executor when the change spans subsystems or the approach is still open.
model: sonnet
tools: All tools
---

You implement one fully specified change unit and verify it.

Rules:
- Implement the spec as written. If it is ambiguous or impossible on a load-bearing point, STOP and report the conflict. Design belongs to the caller, and improvising one is the failure mode this tier exists to avoid.
- Verify before reporting: run the code, run the tests, show the real command and its real output. Never report done on something you have not executed.
- Stay inside the stated unit. Adjacent problems you notice get reported, not fixed.
- Match the surrounding file's conventions: its naming, its comment density, its idiom.
- No emojis, no emdashes, no attribution comments anywhere in what you write.
- Report: what you changed, the exact commands you ran, their output, and anything in the spec you could not satisfy.
```

- [ ] **Step 5: Promote opus-executor to the global roster**

```bash
cp .claude/agents/opus-executor.md claude/agents/opus-executor.md
```

Verify the copy declares `model: opus` in its frontmatter (it does at `1bd2e239`).
Leave the original `.claude/agents/opus-executor.md` in place; project-level
definitions take precedence and removing it is out of scope.

- [ ] **Step 6: Run test to verify it passes**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: PASS, "RESULTS: 4 passed, 0 failed"

- [ ] **Step 7: Link the roster into the live harness**

```bash
mkdir -p ~/.claude/agents
for f in quick-answer sonnet-impl opus-executor; do
  ln -sfn "$PWD/claude/agents/$f.md" "$HOME/.claude/agents/$f.md"
done
ls -la ~/.claude/agents/
```

Expected: three symlinks resolving into `claude/agents/`.

- [ ] **Step 8: Commit**

```bash
git add claude/agents claude/hooks/test-route-intent.sh
git commit -m "agents: add global roster tiers for prompt routing

quick-answer (haiku, read-only), sonnet-impl (sonnet, edit-capable), and
a global copy of opus-executor. Models are pinned in frontmatter so the
session model dispatches by name and never selects a model id."
```

---

### Task 2: Lexicon and classifier core

**Files:**
- Create: `claude/hooks/route-intent.json`
- Create: `claude/hooks/route-intent.sh`
- Test: `claude/hooks/test-route-intent.sh`

**Interfaces:**
- Consumes: agent names from Task 1
- Produces: `route-intent.sh` reading a UserPromptSubmit payload on stdin and printing either nothing or a single JSON object `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "<nudge>"}}`. Tasks 3-6 extend this same file.

- [ ] **Step 1: Write the failing test**

Append to `claude/hooks/test-route-intent.sh`, immediately BEFORE the
`echo ""` / `RESULTS` summary block:

```bash
run_hook() {
  local prompt="$1" input
  input=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt")
  echo "$input" | bash "$HOOK" 2>/dev/null
}

# Assert the hook fires and names the expected agent.
assert_routes() {
  local label="$1" prompt="$2" expected_agent="$3" out
  out=$(run_hook "$prompt")
  if echo "$out" | grep -qF "$expected_agent"; then
    pass "$label"
  else
    fail "$label" "expected agent '$expected_agent', got: ${out:-<silent>}"
  fi
}

# Assert the hook produces no output at all.
assert_silent() {
  local label="$1" prompt="$2" out
  out=$(run_hook "$prompt")
  if [ -z "$out" ]; then
    pass "$label"
  else
    fail "$label" "expected silence, got: $out"
  fi
}

assert_routes "lookup routes to quick-answer" \
  "where is the cooldown seconds value set for the sidecoach intent hook" \
  "quick-answer"
assert_routes "sweep routes to Explore" \
  "find all the callers of detect-session-model across the hooks directory" \
  "Explore"
assert_routes "mechanical edit routes to sonnet-impl" \
  "rename the helper touch_cooldown to mark_cooldown across every hook that uses it" \
  "sonnet-impl"
assert_routes "build routes to opus-executor" \
  "implement a new caching layer for the flow handler results" \
  "opus-executor"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: FAIL on the 4 new cases with `<silent>` (hook does not exist yet)

- [ ] **Step 3: Create the lexicon**

Create `claude/hooks/route-intent.json`:

```json
{
  "_meta": {
    "purpose": "Prompt-shape registry for route-intent.sh. Names one candidate agent from the roster so the session model can dispatch instead of doing mechanical work inline.",
    "fire_rule": "Fires only on a high-confidence tier match, outside cooldown, on a prompt longer than min_prompt_chars, with no exempt pattern matching. Silence is the default.",
    "tie_break": "A prompt matching several tiers resolves to the MOST capable matched tier, in escalation_order. Routing too low produces work that must be redone.",
    "pattern_syntax": "Values are regex fragments, matched case-insensitively against the scrubbed prompt (code fences, inline backticks, URLs, and XML bodies removed)."
  },
  "config": {
    "cooldown_seconds": 900,
    "cooldown_state_file": "~/.claude/.route-intent-cooldown",
    "min_prompt_chars": 40
  },
  "escalation_order": ["opus_executor", "sonnet_impl", "explore", "quick_answer"],
  "tiers": {
    "quick_answer": {
      "agent": "quick-answer",
      "model": "haiku",
      "label": "a narrow lookup",
      "patterns": [
        "where (is|are) [a-z0-9_.\\- ]{2,40} (set|defined|declared|configured)",
        "what does [a-z0-9_.\\- ]{2,40} (do|return|default to)",
        "which file (owns|holds|defines|contains)",
        "look up (the|what|whether)",
        "check whether [a-z0-9_.\\- ]{2,40} (is|exists|matches)"
      ]
    },
    "explore": {
      "agent": "Explore",
      "model": "built-in",
      "label": "a read-only sweep",
      "patterns": [
        "find (all|every|each) ",
        "search (the|this|our) (repo|codebase|project)",
        "list (all|every) [a-z0-9_.\\- ]{2,40}(file|usage|caller|reference)",
        "trace (how|the|where) [a-z0-9_.\\- ]{2,40} (flows|is used|gets)",
        "map (out )?(the|all|every) "
      ]
    },
    "sonnet_impl": {
      "agent": "sonnet-impl",
      "model": "sonnet",
      "label": "a well-specified mechanical change",
      "patterns": [
        "rename [a-z0-9_.\\- ]{2,40} (to|across|everywhere)",
        "update (all|every) [a-z0-9_.\\- ]{2,40}(reference|import|call site|caller)",
        "apply the same (change|fix|pattern) to",
        "add a (test|flag|field|case) (for|to) ",
        "bump [a-z0-9_.\\- ]{2,40} (to|from) "
      ]
    },
    "opus_executor": {
      "agent": "opus-executor",
      "model": "opus",
      "label": "a multi-file build",
      "patterns": [
        "\\brefactor\\b",
        "implement (a|the|an) [a-z0-9_.\\- ]{2,40}(layer|module|system|pipeline|engine)",
        "\\bmigrate\\b [a-z0-9_.\\- ]{2,40} (to|from|onto)",
        "\\bredesign\\b",
        "build (a|the|an) [a-z0-9_.\\- ]{2,40}(system|subsystem|pipeline|harness)"
      ]
    }
  },
  "exempt": [],
  "nudge": "ROUTE CHECK: this prompt reads as {label}. {agent} ({model}) could field it. Dispatch if the work is longer than the dispatch overhead; answer directly if it is not. Your call either way."
}
```

- [ ] **Step 4: Create the classifier**

Create `claude/hooks/route-intent.sh`:

```bash
#!/bin/bash
# UserPromptSubmit hook. Classifies the WORK SHAPE of a prompt and names one
# candidate agent from the roster at ~/.claude/agents/.
#
# Advisory only. It never dispatches, never blocks a prompt, and the session
# model is free to ignore it. A wrong nudge costs one line of context.
#
# Cost: pure bash + stdlib Python. No model call, no tokens.
#
# The session model reads every prompt at full context before it can dispatch,
# so routing cannot lower that floor - only the continuation (reasoning trace,
# tool loop, answer generation). Short prompts are therefore never routed:
# dispatching them costs more than answering them.
#
# Every failure path exits 0 with no output.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
LEXICON="${ROUTE_INTENT_LEXICON:-$HOOK_DIR/route-intent.json}"

[ -f "$LEXICON" ] || exit 0

INPUT="$(cat)"

LEXICON_PATH="$LEXICON" PROMPT_RAW="$INPUT" python3 <<'PYEOF'
import json
import os
import re
import sys

try:
    raw = os.environ.get("PROMPT_RAW", "")
    payload = json.loads(raw) if raw else {}
    if not isinstance(payload, dict):
        sys.exit(0)

    # UserPromptSubmit puts the message at .prompt; some bridges nest it under
    # .tool_input. Handle both, mirroring sidecoach-keyword.sh.
    prompt = ""
    if isinstance(payload.get("prompt"), str):
        prompt = payload["prompt"]
    elif isinstance(payload.get("tool_input"), dict):
        for key in ("user_message", "prompt", "text", "message"):
            v = payload["tool_input"].get(key)
            if isinstance(v, str):
                prompt = v
                break
    if not prompt.strip():
        sys.exit(0)

    with open(os.environ["LEXICON_PATH"], "r", encoding="utf-8") as fh:
        lex = json.load(fh)

    tiers = lex.get("tiers", {})
    order = lex.get("escalation_order", [])
    template = lex.get("nudge", "")
    if not tiers or not order or not template:
        sys.exit(0)

    text = prompt.lower()

    # Match in escalation order and take the first hit, so a prompt matching
    # several tiers resolves to the most capable one.
    for key in order:
        tier = tiers.get(key)
        if not isinstance(tier, dict):
            continue
        for pat in tier.get("patterns", []):
            try:
                if re.search(pat, text, re.I):
                    nudge = (template
                             .replace("{label}", tier.get("label", key))
                             .replace("{agent}", tier.get("agent", key))
                             .replace("{model}", tier.get("model", "")))
                    print(json.dumps({"hookSpecificOutput": {
                        "hookEventName": "UserPromptSubmit",
                        "additionalContext": nudge,
                    }}))
                    sys.exit(0)
            except re.error:
                # A bad pattern in the lexicon must not break the prompt path.
                continue
except Exception:
    sys.exit(0)
PYEOF

exit 0
```

- [ ] **Step 5: Make it executable and run the test**

```bash
chmod +x claude/hooks/route-intent.sh
bash claude/hooks/test-route-intent.sh
```

Expected: PASS, "RESULTS: 8 passed, 0 failed"

- [ ] **Step 6: Commit**

```bash
git add claude/hooks/route-intent.json claude/hooks/route-intent.sh claude/hooks/test-route-intent.sh
git commit -m "hooks: add route-intent classifier and lexicon

Pure-shell UserPromptSubmit hook that names one candidate agent per
prompt shape. Advisory only - it cannot dispatch or block."
```

---

### Task 3: Suppression rules

**Files:**
- Modify: `claude/hooks/route-intent.sh`
- Modify: `claude/hooks/route-intent.json`
- Test: `claude/hooks/test-route-intent.sh`

**Interfaces:**
- Consumes: `route-intent.sh` from Task 2
- Produces: a `scrub(text)` step and a `min_prompt_chars` gate, both applied before tier matching

- [ ] **Step 1: Write the failing test**

Append before the RESULTS block:

```bash
assert_silent "short prompt is answered inline, not routed" \
  "where is X set"
assert_silent "informational framing does not route" \
  "what is the difference between a hook and a skill in this harness, explain it"
assert_silent "pattern inside a code fence does not route" \
  'here is the snippet I mean:
```
rename foo to bar across every call site in the repo
```
does that look right to you or not'
assert_silent "pattern inside inline backticks does not route" \
  'the docs literally say `find all the callers` which I think is wrong, is it'
assert_silent "pattern inside a URL does not route" \
  "see https://example.com/docs/find-all-the-callers-guide for the writeup please"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: FAIL on all 5 new cases (hook currently fires on each)

- [ ] **Step 3: Add the exempt patterns to the lexicon**

In `claude/hooks/route-intent.json`, replace `"exempt": [],` with:

```json
  "exempt": [
    "^\\s*(what|which|who|when)\\s+(is|are|was|were)\\b",
    "^\\s*(explain|define|describe|summarize|tell me about)\\b",
    "^\\s*how (do|does|did|would|should)\\b",
    "\\b(what do you think|your thoughts|thoughts on|does that look right|is that right|am i right)\\b",
    "^\\s*(thanks|thank you|ok|okay|got it|nice|cool|yep|nope)\\b"
  ],
```

- [ ] **Step 4: Add scrubbing and gates to the classifier**

In `claude/hooks/route-intent.sh`, replace the line `    text = prompt.lower()` with:

```python
    # Strip regions whose contents are quoted material, not instructions. A
    # pattern appearing inside a code fence, inline backticks, a URL, or an
    # XML body is being discussed, not requested.
    scrubbed = re.sub(r"```.*?```", " ", prompt, flags=re.S)
    scrubbed = re.sub(r"~~~.*?~~~", " ", scrubbed, flags=re.S)
    scrubbed = re.sub(r"`[^`]*`", " ", scrubbed)
    scrubbed = re.sub(r"https?://\S+", " ", scrubbed)
    scrubbed = re.sub(r"<([a-zA-Z][\w-]*)\b[^>]*>.*?</\1>", " ", scrubbed, flags=re.S)

    text = scrubbed.lower().strip()

    # Below this length the answer is cheaper than the dispatch. Routing here
    # would cost the lead a Task call plus a report read to save nothing.
    cfg = lex.get("config", {})
    try:
        min_chars = int(cfg.get("min_prompt_chars", 40))
    except Exception:
        min_chars = 40
    if len(text) < min_chars:
        sys.exit(0)

    # An informational or conversational framing is a question to answer, not
    # work to delegate.
    for pat in lex.get("exempt", []):
        try:
            if re.search(pat, text, re.I):
                sys.exit(0)
        except re.error:
            continue
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: PASS, "RESULTS: 13 passed, 0 failed"

- [ ] **Step 6: Commit**

```bash
git add claude/hooks/route-intent.sh claude/hooks/route-intent.json claude/hooks/test-route-intent.sh
git commit -m "hooks: suppress route-intent on quoted, short, and informational prompts

Scrubs code fences, inline backticks, URLs, and XML bodies before matching,
gates on a minimum length, and exempts informational framings. Short prompts
are never routed because the dispatch costs more than the answer."
```

---

### Task 4: Escalate-up tie-break

**Files:**
- Test: `claude/hooks/test-route-intent.sh`

**Interfaces:**
- Consumes: the escalation-order loop already implemented in Task 2
- Produces: regression coverage proving multi-tier prompts resolve upward

The behavior is already implemented (Task 2 iterates `escalation_order` and
returns the first hit). This task proves it and locks it against regression,
because a future contributor reordering the lexicon would silently invert it.

- [ ] **Step 1: Write the failing test**

Append before the RESULTS block:

```bash
# A prompt matching BOTH sonnet_impl and opus_executor must resolve to the
# more capable tier. Routing too low produces work that has to be redone.
assert_routes "multi-tier prompt escalates to opus-executor" \
  "refactor the flow handler and update every reference to the old name" \
  "opus-executor"
assert_routes "sweep plus lookup escalates to Explore" \
  "find all the places where the cooldown value is set and tell me which file owns it" \
  "Explore"

# Guard the lexicon's declared order against a silent reorder.
assert_escalation_order() {
  local got
  got=$(python3 -c 'import json;print(",".join(json.load(open("'"$HOOK_DIR"'/route-intent.json"))["escalation_order"]))')
  if [ "$got" = "opus_executor,sonnet_impl,explore,quick_answer" ]; then
    pass "escalation_order is most-capable-first"
  else
    fail "escalation_order is most-capable-first" "got: $got"
  fi
}
assert_escalation_order
```

- [ ] **Step 2: Run test to verify it passes immediately**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: PASS, "RESULTS: 16 passed, 0 failed"

If any of the three fails, the Task 2 loop is iterating the wrong order.
Fix `escalation_order` in `route-intent.json` to
`["opus_executor", "sonnet_impl", "explore", "quick_answer"]` and re-run.

- [ ] **Step 3: Commit**

```bash
git add claude/hooks/test-route-intent.sh
git commit -m "test: lock route-intent escalate-up tie-break

A prompt matching several tiers must resolve to the most capable one, and
the lexicon order that produces that is now asserted directly."
```

---

### Task 5: Cooldown

**Files:**
- Modify: `claude/hooks/route-intent.sh`
- Test: `claude/hooks/test-route-intent.sh`

**Interfaces:**
- Consumes: `config.cooldown_seconds` and `config.cooldown_state_file` from the lexicon
- Produces: `ROUTE_INTENT_COOLDOWN_FILE` and `ROUTE_INTENT_COOLDOWN` env overrides, used by the tests to control the window

- [ ] **Step 1: Write the failing test**

Append before the RESULTS block:

```bash
# Cooldown: a second nudge inside the window must stay silent, so an active
# build does not get re-nagged on every prompt.
cd_file=$(mktemp -t routeintent)
rm -f "$cd_file"

run_hook_cd() {
  local prompt="$1" input
  input=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt")
  echo "$input" | ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=900 bash "$HOOK" 2>/dev/null
}

first=$(run_hook_cd "find all the callers of detect-session-model in the hooks directory")
second=$(run_hook_cd "find all the callers of make_symlink in the installer script")

if [ -n "$first" ]; then pass "first nudge fires"; else fail "first nudge fires" "got silence"; fi
if [ -z "$second" ]; then pass "second nudge suppressed by cooldown"; else fail "second nudge suppressed by cooldown" "got: $second"; fi

# A zero-second window disables cooldown entirely.
rm -f "$cd_file"
z1=$(echo '{"prompt":"find all the callers of detect-session-model in the hooks directory"}' | ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=0 bash "$HOOK" 2>/dev/null)
z2=$(echo '{"prompt":"find all the callers of make_symlink in the installer script"}' | ROUTE_INTENT_COOLDOWN_FILE="$cd_file" ROUTE_INTENT_COOLDOWN=0 bash "$HOOK" 2>/dev/null)
if [ -n "$z1" ] && [ -n "$z2" ]; then pass "cooldown 0 disables suppression"; else fail "cooldown 0 disables suppression" "z1=${z1:-<silent>} z2=${z2:-<silent>}"; fi
rm -f "$cd_file"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: FAIL on "second nudge suppressed by cooldown" (both currently fire)

- [ ] **Step 3: Add cooldown to the classifier**

In `claude/hooks/route-intent.sh`, add these helpers immediately after the
`min_chars` gate block, before the exempt loop:

```python
    import time

    cooldown_file = os.environ.get("ROUTE_INTENT_COOLDOWN_FILE") or os.path.expanduser(
        cfg.get("cooldown_state_file", "~/.claude/.route-intent-cooldown")
    )
    try:
        cooldown_seconds = int(
            os.environ.get("ROUTE_INTENT_COOLDOWN", cfg.get("cooldown_seconds", 900))
        )
    except Exception:
        cooldown_seconds = 900

    def in_cooldown():
        if cooldown_seconds <= 0:
            return False
        try:
            with open(cooldown_file, "r", encoding="utf-8") as fh:
                return (time.time() - float(fh.read().strip())) < cooldown_seconds
        except Exception:
            # No state file, or an unreadable one, means not in cooldown.
            return False

    def touch_cooldown():
        try:
            with open(cooldown_file, "w", encoding="utf-8") as fh:
                fh.write(str(time.time()))
        except Exception:
            pass

    if in_cooldown():
        sys.exit(0)
```

Then, in the match loop, add `touch_cooldown()` immediately before the
`print(json.dumps(...))` call:

```python
                    touch_cooldown()
                    print(json.dumps({"hookSpecificOutput": {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: PASS, "RESULTS: 19 passed, 0 failed"

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/route-intent.sh claude/hooks/test-route-intent.sh
git commit -m "hooks: add route-intent cooldown

One nudge per 15-minute window so an active build is not re-nagged on
every prompt. Overridable via ROUTE_INTENT_COOLDOWN for tests."
```

---

### Task 6: Fail-open hardening

**Files:**
- Test: `claude/hooks/test-route-intent.sh`

**Interfaces:**
- Consumes: the outer `try/except` from Task 2
- Produces: regression coverage proving no input can make the hook emit output or a non-zero exit

- [ ] **Step 1: Write the failing test**

Append before the RESULTS block:

```bash
# The hook sits in the prompt path. No input may make it fail loudly, emit
# junk, or return non-zero - any of those would break every turn.
assert_failopen() {
  local label="$1" stdin_payload="$2" out rc
  out=$(printf '%s' "$stdin_payload" | bash "$HOOK" 2>/dev/null); rc=$?
  if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
    pass "$label"
  else
    fail "$label" "rc=$rc out=${out:-<empty>}"
  fi
}

assert_failopen "malformed json exits 0 silently"   'not json at all {{{'
assert_failopen "empty stdin exits 0 silently"      ''
assert_failopen "null prompt exits 0 silently"      '{"prompt": null}'
assert_failopen "array payload exits 0 silently"    '[1,2,3]'
assert_failopen "whitespace prompt exits 0 silently" '{"prompt": "     "}'

# A corrupt lexicon must degrade to silence, never to an error.
bad_lex=$(mktemp -t routelex); echo '{ this is not valid json' > "$bad_lex"
out=$(echo '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' | ROUTE_INTENT_LEXICON="$bad_lex" bash "$HOOK" 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && [ -z "$out" ]; then pass "corrupt lexicon exits 0 silently"; else fail "corrupt lexicon exits 0 silently" "rc=$rc out=$out"; fi
rm -f "$bad_lex"

# A lexicon with an invalid regex must skip that pattern, not crash.
bad_re=$(mktemp -t routelex2)
python3 -c '
import json
lex = json.load(open("'"$HOOK_DIR"'/route-intent.json"))
lex["tiers"]["explore"]["patterns"] = ["([unclosed", "find (all|every|each) "]
json.dump(lex, open("'"$bad_re"'", "w"))
'
out=$(echo '{"prompt":"find all the callers of detect-session-model in the hooks dir"}' | ROUTE_INTENT_LEXICON="$bad_re" ROUTE_INTENT_COOLDOWN=0 bash "$HOOK" 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && echo "$out" | grep -qF "Explore"; then pass "invalid regex is skipped, valid one still matches"; else fail "invalid regex is skipped, valid one still matches" "rc=$rc out=${out:-<silent>}"; fi
rm -f "$bad_re"
```

- [ ] **Step 2: Run test to verify**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: PASS, "RESULTS: 26 passed, 0 failed"

If "corrupt lexicon" fails, the `json.load` call is outside the outer `try`.
Move it inside. If "invalid regex" fails, the `re.error` catch is missing from
the pattern loop.

- [ ] **Step 3: Commit**

```bash
git add claude/hooks/test-route-intent.sh
git commit -m "test: prove route-intent fails open on every bad input

Malformed stdin, corrupt lexicon, and invalid regex must all exit 0 with
no output. The hook sits in the prompt path and cannot fail loudly."
```

---

### Task 7: Wire the hook into the harness and installer

**Files:**
- Modify: `claude/hooks/cluster-wirings.json`
- Modify: `install.sh:477` (KEYS), `:489-497` (DESCS), `:498-507` (FILES), `:508` (DIRS), `:509` (PICKS), `:602` (CLUSTER_KEYS), `:635` (cluster_hooks), `:1222`, `:1789` (case statements)
- Modify: `~/.claude/settings.json` (live wiring)
- Test: `claude/hooks/test-route-intent.sh`

**Interfaces:**
- Consumes: `route-intent.sh` from Tasks 2-6
- Produces: an `agent-routing` installer cluster key, and a live UserPromptSubmit registration

- [ ] **Step 1: Write the failing test**

Append before the RESULTS block:

```bash
# The hook must be registered in cluster-wirings.json so `install.sh` can
# deploy it on a fresh machine, not just on the machine that authored it.
assert_wired() {
  local label="$1"
  if python3 -c '
import json,sys
w = json.load(open("'"$HOOK_DIR"'/cluster-wirings.json"))
entry = w.get("route-intent.sh")
sys.exit(0 if entry and any(e.get("event")=="UserPromptSubmit" or "UserPromptSubmit" in json.dumps(e) for e in (entry if isinstance(entry,list) else [entry])) else 1)
' 2>/dev/null; then
    pass "$label"
  else
    fail "$label" "route-intent.sh missing or not UserPromptSubmit in cluster-wirings.json"
  fi
}
assert_wired "route-intent.sh is wired in cluster-wirings.json"

# The installer must know the cluster.
if grep -q 'agent-routing' "$REPO_DIR/install.sh"; then
  pass "installer knows the agent-routing cluster"
else
  fail "installer knows the agent-routing cluster" "no 'agent-routing' key in install.sh"
fi
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: FAIL on both new cases

- [ ] **Step 3: Inspect the existing wiring shape before editing**

```bash
python3 -c '
import json
w = json.load(open("claude/hooks/cluster-wirings.json"))
print(json.dumps({"sidecoach-keyword.sh": w.get("sidecoach-keyword.sh")}, indent=2))
'
```

Copy that exact shape for the new entry. Do not invent a schema.

- [ ] **Step 4: Add the wiring**

Add a `"route-intent.sh"` key to `claude/hooks/cluster-wirings.json` using the
shape printed in Step 3, with `UserPromptSubmit` as the event, command
`~/.claude/hooks/route-intent.sh`, and `"timeout": 5`.

- [ ] **Step 5: Register the installer cluster**

Make five index-aligned edits in `install.sh`. The `KEYS`, `DESCS`, `FILES`,
`DIRS`, and `PICKS` arrays are positional: appending to one without the others
shifts every later cluster's description.

- `:477` append ` agent-routing` to `KEYS+=(...)`
- `:497` append this DESCS entry, after the surface entry:
  `"Agent routing: classify each prompt's work shape and name a cheaper roster agent that could field it. Advisory only - the session model decides every dispatch and can decline. Installs route-intent.sh + route-intent.json and the ~/.claude/agents/ roster."`
- `:507` append this FILES entry:
  `"~/.claude/hooks/route-intent.sh + route-intent.json\n~/.claude/agents/ (3 roster files)\n~/.claude/settings.json (wiring)"`
- `:508` add one `""` to `DIRS+=(...)`
- `:509` add one `1` to `PICKS+=(...)`
- `:602` append ` agent-routing` to `CLUSTER_KEYS=(...)`
- `:635` add a `cluster_hooks()` case: `agent-routing)       echo "route-intent.sh" ;;`
- `:1222` and `:1789` add `|agent-routing` to both cluster case patterns

- [ ] **Step 6: Verify array alignment**

```bash
python3 - <<'PY'
import re
src = open("install.sh").read()
def count(name, op):
    m = re.search(re.escape(name) + re.escape(op) + r"\((.*?)\)", src, re.S)
    return len(re.findall(r'"', m.group(1))) // 2 if '"' in m.group(1) else len(m.group(1).split())
print("KEYS ", count("KEYS", "+="))
print("DESCS", count("DESCS", "+="))
print("FILES", count("FILES", "+="))
print("DIRS ", count("DIRS", "+="))
print("PICKS", count("PICKS", "+="))
PY
```

Expected: all five report the same count. If they differ, the arrays are
misaligned and every cluster below the insertion point is now mislabeled.
Fix before continuing.

- [ ] **Step 7: Wire the live harness and confirm settings.json still parses**

```bash
python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p))
ups = [g for g in s["hooks"]["UserPromptSubmit"]]
cmds = [h.get("command","") for g in ups for h in g.get("hooks",[])]
if not any("route-intent.sh" in c for c in cmds):
    ups[-1]["hooks"].append({"type":"command","command":"~/.claude/hooks/route-intent.sh","timeout":5})
    json.dump(s, open(p,"w"), indent=2)
    print("registered")
else:
    print("already registered")
json.load(open(p))
print("settings.json parses")
PY
ln -sfn "$PWD/claude/hooks/route-intent.sh"   ~/.claude/hooks/route-intent.sh
ln -sfn "$PWD/claude/hooks/route-intent.json" ~/.claude/hooks/route-intent.json
```

- [ ] **Step 8: Run the full suite**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: PASS, "RESULTS: 28 passed, 0 failed"

- [ ] **Step 9: Commit**

```bash
git add claude/hooks/cluster-wirings.json install.sh claude/hooks/test-route-intent.sh
git commit -m "install: register the agent-routing cluster

Wires route-intent.sh as a UserPromptSubmit hook and adds the cluster to
the installer so a fresh machine gets the roster and the classifier."
```

---

### Task 8: Remove the model-routing cluster

**Independent of Tasks 1-7.** Routing works without this. Defer or narrow it
freely.

**Files:**
- Delete: `claude/hooks/model-router-guard.sh`
- Modify: `claude/hooks/cluster-wirings.json:293-310`
- Modify: `install.sh` at `:477`, `:506`, `:602`, `:635`, `:1222`, `:1789`, `:4827`, and the DESCS/DIRS/PICKS entries for `model-routing`
- Modify: `claude/hooks/sidecoach_lanes.py:3`, `claude/hooks/sidecoach-keyword.sh:89`, `claude/hooks/fable-orchestrator-guard.sh:10` (stale comment references)
- Modify: `~/.claude/settings.json` (drop entries at `:64` and `:109`)

**Interfaces:**
- Consumes: nothing
- Produces: nothing. This is pure removal.

**Do NOT delete** `claude/hooks/detect-session-model.sh`. It is still executed
by `fable-orchestrator-guard.sh:26`, and `install.sh:4776` confirms the fable
cluster deploys it independently.

- [ ] **Step 1: Write the failing test**

Append before the RESULTS block:

```bash
# The guard is gone, but its shared dependency and the fable guard survive.
if [ ! -f "$REPO_DIR/claude/hooks/model-router-guard.sh" ]; then
  pass "model-router-guard.sh removed"
else
  fail "model-router-guard.sh removed" "file still present"
fi
if [ -f "$REPO_DIR/claude/hooks/detect-session-model.sh" ]; then
  pass "detect-session-model.sh retained"
else
  fail "detect-session-model.sh retained" "wrongly deleted - fable-orchestrator-guard:26 calls it"
fi
if grep -q 'detect-session-model' "$REPO_DIR/claude/hooks/fable-orchestrator-guard.sh"; then
  pass "fable-orchestrator-guard still resolves its dependency"
else
  fail "fable-orchestrator-guard still resolves its dependency" "reference lost"
fi
stale=$(grep -rln 'model-router-guard' "$REPO_DIR/install.sh" "$REPO_DIR/claude/hooks/" 2>/dev/null | grep -v test-route-intent || true)
if [ -z "$stale" ]; then
  pass "no stale model-router-guard references"
else
  fail "no stale model-router-guard references" "still referenced in: $stale"
fi
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bash claude/hooks/test-route-intent.sh`
Expected: FAIL on "model-router-guard.sh removed" and "no stale references"

- [ ] **Step 3: Remove the live wiring first**

```bash
python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.claude/settings.json")
s = json.load(open(p))
n = 0
for ev, groups in s.get("hooks", {}).items():
    for g in groups:
        before = len(g.get("hooks", []))
        g["hooks"] = [h for h in g.get("hooks", []) if "model-router-guard" not in h.get("command", "")]
        n += before - len(g["hooks"])
json.dump(s, open(p, "w"), indent=2)
json.load(open(p))
print(f"removed {n} registrations; settings.json parses")
PY
rm -f ~/.claude/hooks/model-router-guard.sh
```

Expected: "removed 2 registrations; settings.json parses"

- [ ] **Step 4: Remove the repo file and its wirings**

```bash
git rm claude/hooks/model-router-guard.sh
python3 - <<'PY'
import json
p = "claude/hooks/cluster-wirings.json"
w = json.load(open(p))
w.pop("model-router-guard.sh", None)
json.dump(w, open(p, "w"), indent=1)
print("cluster-wirings.json updated")
PY
```

- [ ] **Step 5: Remove the installer cluster**

Delete the `model-routing` entry from each of these, keeping all five parallel
arrays index-aligned: `KEYS` (`:477`), its `DESCS` entry ("Model routing: govern
which model runs which tool..."), its `FILES` entry (`:506`), one element from
`DIRS` (`:508`), one from `PICKS` (`:509`), `CLUSTER_KEYS` (`:602`), the
`cluster_hooks()` case (`:635`), and the `model-routing` alternative in both
case statements (`:1222`, `:1789`).

At `:4827`, delete the special-case block that links `detect-session-model.sh`
when `model-router-guard.sh` is present:

```bash
    if [ "$_h" = "model-router-guard.sh" ]; then
      chmod +x "$REPO_DIR/claude/hooks/detect-session-model.sh"
      link_or_copy "$REPO_DIR/claude/hooks/detect-session-model.sh" "$CLAUDE_DIR/hooks/detect-session-model.sh"
    fi
```

This is safe because `install.sh:4776-4779` already symlinks
`detect-session-model.sh` unconditionally in the fable pass.

- [ ] **Step 6: Fix the three stale comments**

- `claude/hooks/sidecoach_lanes.py:3` - drop the trailing `(model-router-guard)` parenthetical, keep "Pure regex/Python. No LLM calls."
- `claude/hooks/sidecoach-keyword.sh:89` - same edit on the inline comment
- `claude/hooks/fable-orchestrator-guard.sh:10` - rewrite the sentence so it no longer cites an exception in a deleted file, e.g. "Fable is orchestrator-only: it delegates production to an Opus teammate."

- [ ] **Step 7: Verify array alignment and run the suite**

```bash
python3 - <<'PY'
import re
src = open("install.sh").read()
for name in ("KEYS","DESCS","FILES","DIRS","PICKS"):
    m = re.search(re.escape(name) + r"\+=\((.*?)\n\)", src, re.S)
    body = m.group(1) if m else ""
    print(name, body.count('"') // 2 if '"' in body else len(body.split()))
PY
bash claude/hooks/test-route-intent.sh
bash claude/hooks/test-sidecoach-keyword.sh
```

Expected: all five arrays report the same count; both suites pass.

- [ ] **Step 8: Confirm the fable guard still runs**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"echo hi"},"transcript_path":"","session_id":""}' \
  | bash claude/hooks/fable-orchestrator-guard.sh; echo "exit=$?"
```

Expected: `exit=0` (no-op on a non-Fable session), no "command not found" on
`detect-session-model.sh`.

- [ ] **Step 9: Commit**

```bash
git add -A install.sh claude/hooks/
git commit -m "install: retire the model-routing cluster

Removes model-router-guard.sh, its two settings registrations, its installer
cluster, and three stale comment references. detect-session-model.sh and
fable-orchestrator-guard.sh are retained; the latter still calls the former."
```

---

## Verification baseline

Before Task 1, confirm the existing suite runs green so later failures are
attributable:

```bash
bash claude/hooks/test-sidecoach-keyword.sh
```

If it does not pass at `1bd2e239`, that is finding number one and it gets fixed
before any routing work begins.

## Post-implementation

The classifier's value is entirely in its precision. After a week of real use,
check whether nudges are being accepted or declined. A decline rate above
roughly half means the lexicon targets the wrong prompt shape, and the tier
patterns in `route-intent.json` should be narrowed rather than the layer kept
as ambient noise.
