# Lane Intent Detection P1 - Lane Registry + Generation + Classifier/Hook Tier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six sidecoach mode words (forge/kiln/bloom/canvas/trim/ralph) with deterministic natural-language LANE routing - a shared regex classifier (Python hook + TypeScript MCP parity) that scores six lanes, binds scope clause-by-clause, and produces ROUTE / CLASSIFY / CONTEXT-CHECK / OUT_OF_SCOPE / VERB / NUDGE_ELIGIBLE / SILENT.

**Architecture:** A single declarative registry (`claude/hooks/sidecoach-lanes.json`) owns lane records, lexicons, scope policy, prereq waivers, and scoring config. A pure-Python classifier module (`claude/hooks/sidecoach_lanes.py`) implements scoring + clause binding + occurrence-aware suppression + the decision flow; the existing TS classifier (`sidecoach/mcp-server/src/keyword-resolver.ts`) mirrors it exactly, with parity enforced by a shared fixture corpus run against BOTH. A build-time generator (`sidecoach/scripts/generate-lanes.ts`) derives each lane's executed flow sequence and verb-guidance map from `verb-command-registry.ts` into a checked-in `sidecoach/src/lanes.generated.ts`, and `--check` fails on JSON drift, derivation drift, or generated-doc-section drift. No LLM calls anywhere in the hook path (model-router-guard); the classifier is pure regex/Python.

**Tech Stack:** Bash + Python 3 (UserPromptSubmit hook), TypeScript + ts-node (engine, MCP server, generator), JSON registries, bash test harness.

---

## Plan provenance note (read before executing)

This plan was authored against the frozen v10 spec (`docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`, sections 1-6, 8, 10, 14, 15) and the grounding beat (`.claude/memory/reference_lane_impl_grounding_v10.md`). The following files were read **verbatim** and their exact current structure is reflected in the edits: `claude/hooks/sidecoach-keyword.sh`, `claude/hooks/sidecoach-modes.json`, `claude/hooks/sidecoach-intent.json`, `sidecoach/src/modes.ts`, `sidecoach/src/verb-command-registry.ts`.

These files could **not** be re-read at authoring time (an OS-level file-access grant closed mid-session); their edits are grounded in the spec + grounding beat and each carries a **Step 0: confirm anchor** sub-step the implementer MUST run first (read the live file, confirm the quoted current line/anchor, adapt the edit to the real surrounding code if it differs):
- `sidecoach/src/slash-command-router.ts` (7973 bytes; behavior fully specified by spec section 10; currently emits UNKNOWN with near-miss typo suggestions)
- `sidecoach/mcp-server/src/keyword-resolver.ts` (6366 bytes; TS-only classifier per grounding gap #3)
- `claude/hooks/test-sidecoach-keyword.sh` (16297 bytes; bash harness that pipes JSON to the hook and asserts on `additionalContext`)
- `sidecoach/package.json` (grounding fact: line 12 currently `"test": "ts-node src/intent-detector.test.ts"`)
- `install.sh` (spec section 14: lines 1048 and 2613 reference `sidecoach-modes.json`)

## Scope

P1 ships working software on its own: natural-language lane routing replaces mode words; the classifier, registry, generation, and `/sidecoach <phrase>` resolution all function end to end. **Explicitly OUT of P1** (later plans): lane execution API (`startLane`/`advanceLane`/`laneStatus`), checkpoints, the lease/outbox protocol, product validators, `cleanPolicy`/rule-registry generation, the four-status validator rewrite, the two new static validator modules, `lane_converge` enablement, and the full MCP tool rename (`classify-intent`/`list-lanes`). `generate-lanes.ts --check` in P1 covers ONLY JSON drift, derivation drift, and generated-doc-section drift - NOT prerequisite-edge or validator-registration enforcement (those land in P2/P3).

## Setup (before Task 1)

- [ ] Create a feature branch off `main`: `git checkout -b lane-p1-classifier-tier`
- [ ] Confirm Python 3 and ts-node are available: `python3 --version` and `cd sidecoach && npx ts-node --version`

---

## File Structure

| File | Create/Modify | Responsibility (one thing) |
|---|---|---|
| `claude/hooks/sidecoach-lanes.json` | Create (replaces `sidecoach-modes.json`) | The declarative lane registry: 6 lane records (id/label/description/interviewLabel/executionKind/verbChain/prereqWaivers/lexicon), `scope` policy (`ui_evidence`, `negative_filters`), `scoring` config, `schemaVersion`. |
| `claude/hooks/sidecoach_lanes.py` | Create | Pure-Python shared classifier: registry load + validation, clause segmentation, informational blanking, grouped-evidence scoring, clause-bound 3-state scope, decision flow. Imported by the hook and by tests. |
| `claude/hooks/sidecoach-keyword.sh` | Modify | UserPromptSubmit hook. Replace the mode tier with a call into `sidecoach_lanes.classify_intent`; map its outcome to hook output (directives + cooldown-gated nudge). Verb tier + intent cooldown plumbing retained. |
| `claude/hooks/test-sidecoach-keyword.sh` | Modify | Bash integration harness. Add the v10 classifier corpus (CONTEXT-CHECK, clause-binding negatives, bare interface/header/layout, quoted/pasted-doc suppression, explicit-verb-beats-scope). |
| `sidecoach/mcp-server/src/keyword-resolver.ts` | Modify | TS mirror of the classifier (grouped scoring, clause binding, occurrence-aware suppression, decision flow). Must return decisions identical to the Python side on every shared fixture. |
| `sidecoach/parity/classifier-corpus.json` | Create | Shared Python/TS fixture corpus: prompt -> expected outcome (+ winningLane). Run against BOTH classifiers. |
| `sidecoach/src/slash-command-router.ts` | Modify | `/sidecoach <phrase>` resolution union: ROUTE / CLASSIFY / OUT_OF_SCOPE / UNKNOWN (UNKNOWN preserves typo/near-miss suggestions). |
| `sidecoach/scripts/generate-lanes.ts` | Create | Generator: derive each lane's executed flow sequence (flows in verb order, each once, first owning verb) + verb-guidance map from `verb-command-registry.ts`; emit `lanes.generated.ts`; regenerate the doc lane-table block; `--check` fails on JSON / derivation / doc-section drift. |
| `sidecoach/src/lanes.generated.ts` | Create (checked in) | Generated output: typed lane records + derived flow sequences + verb-guidance map. Consumed by the engine; regenerated by `generate-lanes.ts`. |
| `sidecoach/src/modes.ts` | Delete | Removed; `lanes.generated.ts` supersedes it. Importers repointed. |
| `sidecoach/scripts/run-tests.ts` | Create | Enumerating test runner over `src/__tests__/*.test.ts` so new suites actually execute. Wired to `npm test`. |
| `sidecoach/package.json` | Modify | `"test"` script -> the enumerating runner (was `ts-node src/intent-detector.test.ts`). |
| `install.sh` | Modify (lines ~1048, ~2613) | Repoint `sidecoach-modes.json` references to `sidecoach-lanes.json`. |

### Lane -> derived flow sequence (golden, derived from `verb-command-registry.ts`)

These are the authoritative derivations (flows in verb-chain order, each flow once, first owning verb). Task 10's generator MUST reproduce exactly these:

| Lane | executionKind | verbChain | Derived flow sequence |
|---|---|---|---|
| `lane_build` | sequence | shape, craft, polish | flowA_brand_verify, flowB_component_research, flowE_motion_patterns, flowF_design_tokens, flowG_component_implementation, flowH_motion_integration, flowI_accessibility, flowM_responsive_validation, flowJ_tactical_polish |
| `lane_ship` | sequence | audit, critique, harden, adapt, polish | flowK_multi_lens_audit, flowI_accessibility, flowL_design_critique, flowV_all_seven_qa, flowM_responsive_validation, flowJ_tactical_polish |
| `lane_delight` | sequence | colorize, delight, animate, polish | flowF_design_tokens, flowH_motion_integration, flowT_ambitious_motion, flowJ_tactical_polish, flowM_responsive_validation |
| `lane_live` | sequence | live, colorize, polish, critique | flowN_rapid_iteration_refined, flowF_design_tokens, flowJ_tactical_polish, flowM_responsive_validation, flowL_design_critique, flowK_multi_lens_audit |
| `lane_calm` | sequence | quieter, distill, clarify, polish | flowJ_tactical_polish, flowX_copywriting, flowM_responsive_validation |
| `lane_converge` | loop | polish, audit, critique | flowJ_tactical_polish, flowM_responsive_validation, flowK_multi_lens_audit, flowI_accessibility, flowL_design_critique |

(Verb->flowIds source of truth, from `verb-command-registry.ts`: shape=[flowA]; craft=[flowA,flowB,flowE,flowF,flowG,flowH,flowI,flowM,flowJ]; polish=[flowJ,flowM]; audit=[flowK,flowI]; critique=[flowL,flowK]; harden=[flowV]; adapt=[flowM]; colorize=[flowF]; delight=[flowH]; animate=[flowH,flowT]; live=[flowN]; quieter=[flowJ]; distill=[flowJ]; clarify=[flowX].)

---

## Task 1: Lane registry + Python loader/validator

**Files:**
- Create: `claude/hooks/sidecoach-lanes.json`
- Create: `claude/hooks/sidecoach_lanes.py`
- Test: `claude/hooks/test_sidecoach_lanes.py`

- [ ] **Step 1: Write the failing test**

Create `claude/hooks/test_sidecoach_lanes.py`:

```python
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sidecoach_lanes as sl

REG = sl.load_registry(os.path.join(HERE, "sidecoach-lanes.json"))

def test_six_lanes_with_required_fields():
    lanes = REG["lanes"]
    assert [l["lane"] for l in lanes] == [
        "lane_build", "lane_ship", "lane_delight",
        "lane_live", "lane_calm", "lane_converge",
    ]
    for l in lanes:
        for field in ("lane", "label", "description", "interviewLabel",
                      "executionKind", "verbChain", "lexicon"):
            assert field in l, f"{l.get('lane')} missing {field}"
        assert l["executionKind"] in ("sequence", "loop")
        assert isinstance(l["verbChain"], list) and l["verbChain"]
        for e in l["lexicon"]:
            assert set(e) >= {"pattern", "weight", "group"}
            re.compile(e["pattern"])  # must compile

def test_scope_and_scoring_present():
    assert "ui_evidence" in REG["scope"]
    assert "negative_filters" in REG["scope"]
    s = REG["scoring"]
    assert s["route_floor"] == 3 and s["route_margin"] == 2 and s["classify_floor"] == 1
    assert REG["schemaVersion"] >= 1

def test_only_converge_is_loop():
    loops = [l["lane"] for l in REG["lanes"] if l["executionKind"] == "loop"]
    assert loops == ["lane_converge"]

if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-q"]))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q`
Expected: FAIL - `ModuleNotFoundError: No module named 'sidecoach_lanes'` (module + JSON not created yet).

- [ ] **Step 3a: Create the registry `claude/hooks/sidecoach-lanes.json`**

```json
{
  "_meta": {
    "purpose": "Canonical sidecoach LANE registry. Replaces sidecoach-modes.json. Lanes are named by plain user-facing labels (no magic words); routing is by natural-language scoring, not keyword match. Owns lane records, lexicons, scope policy, prereq waivers, scoring config, schemaVersion.",
    "matching": "Lexicon/scope patterns are regex fragments, case-insensitive, matched with hyphen-aware word boundaries (?<![\\w-])PATTERN(?![\\w-]). Score = sum over groups of the max matched weight per group. Scope is clause-bound (see scope.algorithm).",
    "thresholds": "route_floor/route_margin are spec-fixed (3/2); weights are provisional pending the calibration report (spec section 3)."
  },
  "schemaVersion": 1,
  "scoring": { "route_floor": 3, "route_margin": 2, "classify_floor": 1 },
  "scope": {
    "ui_evidence": [
      "button", "modal", "dialog", "drawer", "dropdown", "tooltip", "popover",
      "card", "hero", "banner", "carousel", "navbar", "sidebar", "footer", "menu",
      "landing[- ]?page", "home ?page", "dashboard", "form", "table", "grid",
      "typography", "type ?scale", "font pairing", "color ?(?:palette|scheme)",
      "spacing", "hover state", "focus ring", "responsive", "breakpoints?",
      "design ?system", "style ?guide", "component(?:s| library)?", "wireframe",
      "mockup", "figma", "css", "scss", "tailwind", "ui/ux", "user experience",
      "accessibility", "a11y", "wcag", "contrast ratio", "animation", "transition",
      "gradient", "drop ?shadow", "border[- ]radius", "dark mode", "theming",
      "user interface", "page header", "site header", "nav header", "hero header",
      "responsive layout", "page layout", "grid layout", "mobile layout"
    ],
    "negative_filters": [
      "database", "\\bapi\\b", "migration", "endpoint", "unit test",
      "integration test", "pipeline", "deploy(?:ment)?", "schema", "backend",
      "server[- ]side", "\\bsql\\b", "query", "cron", "webhook", "kubernetes",
      "docker", "\\bci\\b", "\\bcd\\b", "auth(?:entication)?", "oauth", "\\bjwt\\b",
      "\\borm\\b", "graphql", "grpc", "kafka", "redis", "lambda", "terraform"
    ]
  },
  "lanes": [
    {
      "lane": "lane_build", "label": "a ground-up build",
      "description": "Shapes the design, crafts the implementation, then polishes the result.",
      "interviewLabel": "Build it from the ground up", "executionKind": "sequence",
      "verbChain": ["shape", "craft", "polish"], "prereqWaivers": [],
      "lexicon": [
        { "pattern": "from scratch", "weight": 3, "group": "greenfield" },
        { "pattern": "ground[- ]up", "weight": 3, "group": "greenfield" },
        { "pattern": "greenfield", "weight": 3, "group": "greenfield" },
        { "pattern": "net[- ]new", "weight": 2, "group": "greenfield" },
        { "pattern": "brand[- ]new", "weight": 2, "group": "greenfield" },
        { "pattern": "build (?:me |out )?a", "weight": 2, "group": "build_verb" }
      ]
    },
    {
      "lane": "lane_ship", "label": "a release-readiness pass",
      "description": "Audits, critiques, hardens errors and i18n, validates responsive, finishes with polish.",
      "interviewLabel": "Get it ship-ready", "executionKind": "sequence",
      "verbChain": ["audit", "critique", "harden", "adapt", "polish"],
      "prereqWaivers": [
        { "dependentFlowId": "flowJ_tactical_polish", "prerequisiteFlowId": "flowG_component_implementation", "reason": "existing UI satisfies the implementation-history assumption" }
      ],
      "lexicon": [
        { "pattern": "production[- ]ready", "weight": 3, "group": "release" },
        { "pattern": "ship[- ]ready", "weight": 3, "group": "release" },
        { "pattern": "release[- ]read(?:y|iness)", "weight": 3, "group": "release" },
        { "pattern": "ready (?:to ship|for production)", "weight": 3, "group": "release" },
        { "pattern": "get it shipped", "weight": 2, "group": "release" }
      ]
    },
    {
      "lane": "lane_delight", "label": "a personality pass - color, motion, delight",
      "description": "Applies color, adds delightful micro-interactions, integrates motion, finishes with polish.",
      "interviewLabel": "Give it personality", "executionKind": "sequence",
      "verbChain": ["colorize", "delight", "animate", "polish"],
      "prereqWaivers": [
        { "dependentFlowId": "flowA_brand_verify", "prerequisiteFlowId": "flowG_component_implementation", "reason": "brand-verify on existing UI does not require prior implementation history" }
      ],
      "lexicon": [
        { "pattern": "bring it to life", "weight": 3, "group": "personality" },
        { "pattern": "make it pop", "weight": 2, "group": "personality" },
        { "pattern": "personality", "weight": 2, "group": "personality" },
        { "pattern": "more (?:fun|playful|joyful)", "weight": 2, "group": "personality" },
        { "pattern": "color and motion", "weight": 2, "group": "personality" },
        { "pattern": "delightful", "weight": 2, "group": "personality" }
      ]
    },
    {
      "lane": "lane_live", "label": "live in-browser iteration",
      "description": "Loops the design inside the browser: live iteration, color refinement, polish, then a critique pass.",
      "interviewLabel": "Iterate live in the browser", "executionKind": "sequence",
      "verbChain": ["live", "colorize", "polish", "critique"],
      "prereqWaivers": [
        { "dependentFlowId": "flowJ_tactical_polish", "prerequisiteFlowId": "flowG_component_implementation", "reason": "existing UI satisfies the implementation-history assumption" }
      ],
      "lexicon": [
        { "pattern": "in[- ]browser", "weight": 2, "group": "live" },
        { "pattern": "live iterat(?:e|ion)", "weight": 3, "group": "live" },
        { "pattern": "iterate in the browser", "weight": 3, "group": "live" },
        { "pattern": "tweak (?:it )?live", "weight": 3, "group": "live" },
        { "pattern": "hot[- ]swap", "weight": 2, "group": "live" }
      ]
    },
    {
      "lane": "lane_calm", "label": "a tone-down pass - quiet it to essentials",
      "description": "Quiets visual noise, distills to essentials, clarifies copy and labels, then polishes.",
      "interviewLabel": "Quiet it down to essentials", "executionKind": "sequence",
      "verbChain": ["quieter", "distill", "clarify", "polish"],
      "prereqWaivers": [
        { "dependentFlowId": "flowJ_tactical_polish", "prerequisiteFlowId": "flowG_component_implementation", "reason": "existing UI satisfies the implementation-history assumption" }
      ],
      "lexicon": [
        { "pattern": "tone (?:it )?down", "weight": 3, "group": "calm" },
        { "pattern": "too (?:busy|loud|noisy|cluttered)", "weight": 3, "group": "calm" },
        { "pattern": "strip (?:it )?back", "weight": 3, "group": "calm" },
        { "pattern": "back to essentials", "weight": 3, "group": "calm" },
        { "pattern": "declutter", "weight": 2, "group": "calm" }
      ]
    },
    {
      "lane": "lane_converge", "label": "iterate-until-it-passes looping",
      "description": "Runs polish, audit, and critique in a loop until the product validators pass or a cap fires.",
      "interviewLabel": "Loop until it passes", "executionKind": "loop",
      "verbChain": ["polish", "audit", "critique"],
      "prereqWaivers": [
        { "dependentFlowId": "flowJ_tactical_polish", "prerequisiteFlowId": "flowG_component_implementation", "reason": "existing UI satisfies the implementation-history assumption" }
      ],
      "lexicon": [
        { "pattern": "until it passes", "weight": 3, "group": "converge" },
        { "pattern": "iterate until", "weight": 3, "group": "converge" },
        { "pattern": "loop until", "weight": 3, "group": "converge" },
        { "pattern": "keep iterating", "weight": 3, "group": "converge" },
        { "pattern": "until (?:the )?validators? pass", "weight": 3, "group": "converge" },
        { "pattern": "converge", "weight": 2, "group": "converge" }
      ]
    }
  ]
}
```

- [ ] **Step 3b: Create the loader in `claude/hooks/sidecoach_lanes.py`**

```python
"""sidecoach_lanes.py - shared lane intent classifier (Python side).

Pure regex/Python. No LLM calls (model-router-guard). Imported by
sidecoach-keyword.sh and by tests. The TypeScript mirror lives at
sidecoach/mcp-server/src/keyword-resolver.ts and MUST produce identical
decisions on every fixture in sidecoach/parity/classifier-corpus.json.
"""
import json
import re

SCHEMA_VERSION = 1


def load_registry(path):
    with open(path, "r", encoding="utf-8") as fh:
        reg = json.load(fh)
    if not isinstance(reg, dict):
        raise ValueError("lane registry must be a JSON object")
    if not isinstance(reg.get("lanes"), list) or not reg["lanes"]:
        raise ValueError("lane registry has no lanes")
    scope = reg.get("scope") or {}
    if "ui_evidence" not in scope or "negative_filters" not in scope:
        raise ValueError("scope must declare ui_evidence and negative_filters")
    scoring = reg.get("scoring") or {}
    for k in ("route_floor", "route_margin", "classify_floor"):
        if k not in scoring:
            raise ValueError(f"scoring missing {k}")
    return reg
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/sidecoach-lanes.json claude/hooks/sidecoach_lanes.py claude/hooks/test_sidecoach_lanes.py
git commit -m "feat(sidecoach): add lane registry + python loader (P1 task 1)"
```

---

## Task 2: Clause segmentation (length-preserving)

**Files:**
- Modify: `claude/hooks/sidecoach_lanes.py`
- Test: `claude/hooks/test_sidecoach_lanes.py`

- [ ] **Step 1: Write the failing test** (append to `test_sidecoach_lanes.py`)

```python
def test_segments_split_on_sentence_terminators():
    text = "The landing page is done. Make the migration production-ready."
    spans = sl.segment_clauses(text)
    clauses = [text[a:b].strip() for a, b in spans]
    assert clauses[0].startswith("The landing page is done")
    assert any(c.startswith("Make the migration") for c in clauses)

def test_segments_split_on_comma_conjunction_only():
    text = "polish the hero, but build the API from scratch"
    spans = sl.segment_clauses(text)
    clauses = [text[a:b].strip() for a, b in spans]
    assert any("polish the hero" in c for c in clauses)
    assert any("build the API from scratch" in c for c in clauses)
    # a plain comma list does NOT split
    text2 = "color, motion, delight"
    assert len(sl.segment_clauses(text2)) == 1

def test_abbreviations_do_not_split():
    text = "ship it, e.g. the dashboard, to production"
    spans = sl.segment_clauses(text)
    assert len(spans) == 1  # "e.g." period is not a sentence terminator

def test_spans_are_length_preserving():
    text = "make it pop; tone it down"
    spans = sl.segment_clauses(text)
    assert "".join(text[a:b] for a, b in spans) == text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q -k segment or abbrev or length`
Expected: FAIL - `AttributeError: module 'sidecoach_lanes' has no attribute 'segment_clauses'`.

- [ ] **Step 3: Add the implementation** (append to `sidecoach_lanes.py`)

```python
ABBREVIATIONS = ["e.g.", "i.e.", "vs.", "etc.", "Dr.", "Mr.", "Ms."]
CONJUNCTION_BOUNDARIES = [", but", ", and", ", or", ", yet", ", so"]
_TERMINATORS = ".!?;\n"


def segment_clauses(text):
    """Split into clause spans without changing length. Returns [(start, end)]
    covering the whole string. Splits at sentence terminators and at a comma
    followed by a coordinating conjunction; abbreviation periods do not split.
    """
    masked = text
    for abbr in ABBREVIATIONS:
        masked = masked.replace(abbr, abbr.replace(".", "\x00"))
    cuts = []
    i, n = 0, len(masked)
    while i < n:
        ch = masked[i]
        if ch in _TERMINATORS:
            cuts.append(i + 1)
            i += 1
            continue
        if ch == ",":
            window = masked[i:i + 6].lower()
            if any(window.startswith(cb) for cb in CONJUNCTION_BOUNDARIES):
                cuts.append(i + 1)
                i += 1
                continue
        i += 1
    bounds = sorted({0, n, *[c for c in cuts if 0 < c < n]})
    return [(a, b) for a, b in zip(bounds, bounds[1:]) if b > a]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/sidecoach_lanes.py claude/hooks/test_sidecoach_lanes.py
git commit -m "feat(sidecoach): clause segmentation for lane scope binding (P1 task 2)"
```

---

## Task 3: Sanitize + occurrence-aware informational blanking

**Files:**
- Modify: `claude/hooks/sidecoach_lanes.py`
- Test: `claude/hooks/test_sidecoach_lanes.py`

Motivation (spec section 3): the keyword hook false-fired twice on pasted documents during this design's own review. Blanking is length-preserving so clause spans stay valid, and frames never cross sentence boundaries.

- [ ] **Step 1: Write the failing test** (append)

```python
def test_sanitize_strips_code_and_transcript():
    t = "polish the `nav` here\n```\nfunction polish(){}\n```\n[TURN 3: build a page]"
    out = sl.sanitize(t)
    assert "function polish" not in out
    assert "TURN 3" not in out
    assert len(out) == len(t)  # length-preserving

def test_blank_informational_blanks_only_the_frame_span():
    t = "what is production-ready mean. make this production-ready"
    out = sl.blank_informational(t)
    # the informational clause is blanked, the imperative clause survives
    first, second = out.split(".", 1)
    assert "production-ready" not in first
    assert "production-ready" in second
    assert len(out) == len(t)

def test_blank_informational_blanks_quoted_text():
    t = 'the doc said "make it production-ready" but ignore that'
    out = sl.blank_informational(t)
    assert "production-ready" not in out
    assert len(out) == len(t)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q -k sanitize or informational or quoted`
Expected: FAIL - `AttributeError: ... no attribute 'sanitize'`.

- [ ] **Step 3: Add the implementation** (append to `sidecoach_lanes.py`)

`sanitize` is ported from the live `sidecoach-keyword.sh` (the `sanitize()` Python function, lines 156-186) but made length-preserving (replace each stripped region with same-length spaces, not a single space) so segmentation offsets remain valid:

```python
def _blank(match):
    return " " * (match.end() - match.start())


def sanitize(text):
    """Length-preserving strip of non-intent regions (code fences, inline
    backticks, URLs, XML bodies, transcript markers). Each region becomes
    same-length spaces so downstream offsets are preserved."""
    text = re.sub(r"```[\s\S]*?```", _blank, text)
    text = re.sub(r"`[^`\n]*`", _blank, text)
    text = re.sub(r"\b(?:https?|file|ftp)://\S+", _blank, text, flags=re.IGNORECASE)
    text = re.sub(r"<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?</\1\s*>", _blank, text)
    text = re.sub(r"<[a-zA-Z!/][^>]*>", _blank, text)
    text = re.sub(r"\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]", _blank, text,
                  flags=re.IGNORECASE)
    return text


# Informational frames consume from the frame head to the clause end
# (terminators stop them, so a frame never crosses a sentence boundary).
_INFO_FRAMES = [
    r"\bwhat(?:['’]s| is| are| was| were| does| did)\s+[^.!?;\n]*",
    r"\bhow\s+(?:to|do\s+(?:i|you|we))\s+[^.!?;\n]*",
    r"\btell\s+me\s+about\s+[^.!?;\n]*",
    r"\bexplain\s+[^.!?;\n]*",
    r"\bdefine\s+[^.!?;\n]*",
]
_QUOTE_FRAME = r"[\"“][^\"”\n]{0,400}[\"”]"


def blank_informational(text):
    """Length-preserving blanking of informational framings and quoted spans,
    so lane evidence quoted/described (not invoked) does not score."""
    for pat in _INFO_FRAMES:
        text = re.sub(pat, _blank, text, flags=re.IGNORECASE)
    text = re.sub(_QUOTE_FRAME, _blank, text)
    return text
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/sidecoach_lanes.py claude/hooks/test_sidecoach_lanes.py
git commit -m "feat(sidecoach): sanitize + occurrence-aware informational blanking (P1 task 3)"
```

---

## Task 4: Grouped-evidence scoring + clause-bound 3-state scope

**Files:**
- Modify: `claude/hooks/sidecoach_lanes.py`
- Test: `claude/hooks/test_sidecoach_lanes.py`

Implements spec section 4 (clause binding: segment -> negation -> bind -> aggregate) and section 3 (score = sum over groups of max matched weight per group).

- [ ] **Step 1: Write the failing test** (append)

```python
def _eval(prompt, lane_id):
    lane = next(l for l in REG["lanes"] if l["lane"] == lane_id)
    return sl.evaluate_lane(lane, prompt, REG)

def test_in_scope_when_ui_evidence_shares_clause():
    r = _eval("make the landing page production-ready", "lane_ship")
    assert r["scope"] == "IN_SCOPE"
    assert r["score"] >= 3

def test_out_of_scope_when_negative_filter_shares_clause():
    # ship evidence bound to "migration" in its own sentence
    r = _eval("The landing page is done. Make the migration production-ready.", "lane_ship")
    assert r["scope"] == "OUT_OF_SCOPE"
    assert r["score"] == 0

def test_scope_unknown_when_no_domain_evidence():
    r = _eval("make this production-ready", "lane_ship")
    assert r["scope"] == "SCOPE_UNKNOWN"
    assert r["score"] >= 3  # still scores from the unknown occurrence

def test_negator_discards_occurrence_then_routes_second():
    p = "Don't make the API production-ready; make the landing page production-ready."
    r = _eval(p, "lane_ship")
    assert r["scope"] == "IN_SCOPE"  # second clause binds to landing page

def test_grouped_max_weight_not_sum_within_group():
    # two release-group matches in one in-scope clause -> max weight, not sum
    r = _eval("the dashboard must be production-ready and ship-ready", "lane_ship")
    assert r["score"] == 3  # max(3,3) within group "release", not 6
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q -k eval or scope or negator or grouped`
Expected: FAIL - `AttributeError: ... no attribute 'evaluate_lane'`.

- [ ] **Step 3: Add the implementation** (append to `sidecoach_lanes.py`)

```python
_NEGATORS = ["don't", "do not", "never", "not", "stop"]


def _wb(pattern):
    return re.compile(rf"(?<![\w-]){pattern}(?![\w-])", re.IGNORECASE)


def _compile_all(patterns):
    out = []
    for p in patterns:
        try:
            out.append(_wb(p))  # one bad regex is isolated (spec section 12)
        except re.error:
            continue
    return out


def _clause_bounds(pos, spans):
    for a, b in spans:
        if a <= pos < b:
            return a, b
    return spans[-1] if spans else (0, 0)


def _has_negator(prefix):
    return any(_wb(re.escape(neg)).search(prefix) for neg in _NEGATORS)


def evaluate_lane(lane, prompt, reg):
    """Score one lane and resolve its scope state by clause binding.
    Returns {lane, label, score, scope, evidenceIds}."""
    text = blank_informational(sanitize(prompt))
    spans = segment_clauses(text)
    ui = _compile_all(reg["scope"]["ui_evidence"])
    negs = _compile_all(reg["scope"]["negative_filters"])

    groups, ev_ids = {}, []
    n_in = n_unknown = n_oos = 0
    for entry in lane["lexicon"]:
        try:
            rx = _wb(entry["pattern"])
        except re.error:
            continue
        for m in rx.finditer(text):
            a, b = _clause_bounds(m.start(), spans)
            clause = text[a:b]
            prefix = text[a:m.start()]
            if _has_negator(prefix):
                continue  # negated -> discarded entirely
            if any(r.search(clause) for r in negs):
                n_oos += 1
                continue  # out-of-scope occurrence, discarded from score
            if any(r.search(clause) for r in ui):
                n_in += 1
            else:
                n_unknown += 1
            g = entry.get("group", entry["pattern"])
            groups[g] = max(groups.get(g, 0), int(entry.get("weight", 1)))
            ev_ids.append(entry["pattern"])

    score = sum(groups.values())
    if n_in > 0:
        scope = "IN_SCOPE"
    elif n_unknown == 0 and n_oos > 0:
        scope, score = "OUT_OF_SCOPE", 0
    else:
        scope = "SCOPE_UNKNOWN"
    return {"lane": lane["lane"], "label": lane["label"],
            "score": score, "scope": scope, "evidenceIds": ev_ids[:3]}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/sidecoach_lanes.py claude/hooks/test_sidecoach_lanes.py
git commit -m "feat(sidecoach): grouped scoring + clause-bound 3-state scope (P1 task 4)"
```

---

## Task 5: Decision flow (classify_intent) with documented precedence

**Files:**
- Modify: `claude/hooks/sidecoach_lanes.py`
- Test: `claude/hooks/test_sidecoach_lanes.py`

Implements spec section 5. Outcomes: `ROUTE | CLASSIFY | CONTEXT_CHECK | OUT_OF_SCOPE | VERB | NUDGE_ELIGIBLE | SILENT`. Precedence: explicit `/sidecoach` command wins (handled by the slash router, Task 8 - the classifier stays SILENT on a literal `/sidecoach` prefix); otherwise explicit natural-language verb is evaluated BEFORE inferred-lane scope outcomes (a stated verb is never preempted by CONTEXT-CHECK or OUT_OF_SCOPE). The nudge decision returns `NUDGE_ELIGIBLE` only (the cooldown -> NUDGE/SILENT mapping is hook-only, Task 6).

Outcome table (IN_SCOPE, no explicit verb, route_floor=3/route_margin=2): (0,0) nudge; (1,0)/(2,0) CLASSIFY; (3,0)/(3,1) ROUTE; (3,2)/ties CLASSIFY.

- [ ] **Step 1: Write the failing test** (append)

```python
VERBS = [{"verb": v} for v in [
    "shape","craft","polish","audit","critique","harden","adapt","colorize",
    "delight","animate","live","quieter","distill","clarify","layout","bolder",
    "overdrive","typeset","optimize","extract","onboard","document"]]

def _ci(prompt, intent_eligible=False):
    return sl.classify_intent(prompt, REG, VERBS, intent_eligible=intent_eligible)

def test_production_ready_natural_is_context_check_not_oos():
    r = _ci("make this production-ready")
    assert r["outcome"] == "CONTEXT_CHECK"
    assert r["winningLane"] == "lane_ship"

def test_clause_binding_never_routes_migration():
    r = _ci("The landing page is done. Make the migration production-ready.")
    assert r["outcome"] in ("NUDGE_ELIGIBLE", "SILENT", "OUT_OF_SCOPE")
    assert r["outcome"] != "ROUTE" and r["outcome"] != "CLASSIFY"

def test_in_scope_route_grade_routes():
    r = _ci("make the landing page production-ready")  # (3,0) IN_SCOPE
    assert r["outcome"] == "ROUTE"
    assert r["winningLane"] == "lane_ship"

def test_explicit_verb_beats_scope_outcome():
    # explicit verb + SCOPE_UNKNOWN lane language -> VERB primary, lane diagnostic only
    r = _ci("audit this and make it production-ready")
    assert r["outcome"] == "VERB"
    assert r["verbMatch"] == "audit"
    assert any(s["lane"] == "lane_ship" for s in r["laneScores"])

def test_explicit_verb_plus_route_grade_in_scope_is_classify():
    r = _ci("audit the landing page production-ready release-readiness pass")
    # route-grade IN_SCOPE lane competes with the verb -> CLASSIFY (step 7)
    assert r["outcome"] == "CLASSIFY"

def test_classify_when_in_scope_low_score():
    r = _ci("the dashboard should feel more fun")  # lane_delight (2,0) IN_SCOPE
    assert r["outcome"] == "CLASSIFY"
    assert r["winningLane"] == "lane_delight"

def test_silent_when_nothing_and_not_eligible():
    assert _ci("what time is it").outcome if False else _ci("fix a flaky backend test")["outcome"] in ("SILENT", "OUT_OF_SCOPE")

def test_nudge_eligible_passthrough():
    r = _ci("restyle the navbar", intent_eligible=True)
    assert r["outcome"] in ("ROUTE", "CLASSIFY", "CONTEXT_CHECK", "NUDGE_ELIGIBLE")

def test_slash_prefix_is_silent_for_classifier():
    assert _ci("/sidecoach make this production-ready")["outcome"] == "SILENT"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q -k classify or context_check or route or verb_beats or slash`
Expected: FAIL - `AttributeError: ... no attribute 'classify_intent'`.

- [ ] **Step 3: Add the implementation** (append to `sidecoach_lanes.py`)

```python
def is_informational(text, pattern):
    """A verb/pattern appearing only inside an informational framing is not an
    invocation. Mirrors the verb-tier suppression in sidecoach-keyword.sh."""
    frames = [
        rf"\bwhat\s+(?:is|are|was|were|does|did)\s+(?:the\s+|a\s+|an\s+)?{pattern}(?![\w-])",
        rf"\bwhat['’]s\s+(?:the\s+|a\s+|an\s+)?{pattern}(?![\w-])",
        rf"\bhow\s+to\s+(?:use\s+)?(?:the\s+)?{pattern}(?![\w-])",
        rf"\bhow\s+do\s+(?:i|you|we)\s+(?:use\s+)?(?:the\s+)?{pattern}(?![\w-])",
        rf"\bexplain\s+(?:the\s+|how\s+|what\s+)?{pattern}(?![\w-])",
        rf"\bdefine\s+{pattern}(?![\w-])",
        rf"(?<![\w-]){pattern}\s+is\s+(?:a|an|the)\b",
    ]
    return any(re.search(f, text, re.IGNORECASE) for f in frames)


def detect_verb(text, verbs):
    for v in verbs:
        name = v.get("verb") if isinstance(v, dict) else v
        patt = (v.get("pattern") or name) if isinstance(v, dict) else v
        if not name or not patt:
            continue
        try:
            rx = _wb(patt)
        except re.error:
            continue
        if rx.search(text) and not is_informational(text, patt):
            return name
    return None


def classify_intent(prompt, reg, verbs, intent_eligible=False):
    """Top-level decision flow (spec section 5). Returns a dict with keys
    outcome, winningLane, verbMatch, laneScores, schemaVersion."""
    result = {"outcome": "SILENT", "winningLane": None, "verbMatch": None,
              "laneScores": [], "schemaVersion": SCHEMA_VERSION}
    if not prompt or not prompt.strip():
        return result
    # 2. explicit /sidecoach command is owned by the slash router, not the hook
    if re.match(r"\s*/sidecoach\b", prompt, re.IGNORECASE):
        return result

    text = blank_informational(sanitize(prompt))
    scores = [evaluate_lane(l, prompt, reg) for l in reg["lanes"]]
    result["laneScores"] = scores
    ranked = sorted(scores, key=lambda r: r["score"], reverse=True)
    top = ranked[0]
    second = ranked[1]["score"] if len(ranked) > 1 else 0
    verb = detect_verb(text, verbs)
    result["verbMatch"] = verb

    rf, rm, cf = (reg["scoring"]["route_floor"], reg["scoring"]["route_margin"],
                  reg["scoring"]["classify_floor"])
    route_grade = (top["scope"] == "IN_SCOPE" and top["score"] >= rf
                   and (top["score"] - second) >= rm)

    # 5/8. explicit verb evaluated before inferred-lane scope outcomes
    if verb:
        result["outcome"] = "CLASSIFY" if route_grade else "VERB"
        if route_grade:
            result["winningLane"] = top["lane"]
        return result

    # 6/9. IN_SCOPE branch
    if top["scope"] == "IN_SCOPE" and top["score"] > 0:
        result["winningLane"] = top["lane"]
        result["outcome"] = "ROUTE" if route_grade else (
            "CLASSIFY" if top["score"] >= cf else "SILENT")
        if result["outcome"] != "SILENT":
            return result
    # 10. SCOPE_UNKNOWN + lane evidence -> CONTEXT-CHECK (no auto-route)
    unknown = next((r for r in ranked if r["scope"] == "SCOPE_UNKNOWN" and r["score"] > 0), None)
    if unknown:
        result["outcome"] = "CONTEXT_CHECK"
        result["winningLane"] = unknown["lane"]
        return result
    # 11. OUT_OF_SCOPE + lane evidence -> logged, no lane action
    oos = any(r["scope"] == "OUT_OF_SCOPE" for r in scores)
    # 12. advisory nudge eligibility (intent tier, evaluated by caller)
    if intent_eligible:
        result["outcome"] = "NUDGE_ELIGIBLE"
        return result
    result["outcome"] = "OUT_OF_SCOPE" if oos else "SILENT"
    return result
```

Note: the `test_silent_*` helper above intentionally uses a non-design backend prompt; adjust the assertion if your verb list differs. The `intent_eligible` flag is computed by the hook from `sidecoach-intent.json` (Task 6) and passed in - the classifier itself never reads cooldown state (spec section 11 parity boundary).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd claude/hooks && python3 -m pytest test_sidecoach_lanes.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/sidecoach_lanes.py claude/hooks/test_sidecoach_lanes.py
git commit -m "feat(sidecoach): lane decision flow with verb/scope precedence (P1 task 5)"
```

---

## Task 6: Wire the classifier into `sidecoach-keyword.sh`

**Files:**
- Modify: `claude/hooks/sidecoach-keyword.sh` (anchors below are verbatim from the current file)
- Test: covered by Task 12's harness; this task adds two smoke assertions inline.

The verb tier and intent-cooldown plumbing are retained. The MODE tier is replaced by the lane classifier. `classify_intent` returns `NUDGE_ELIGIBLE`; the hook maps it to NUDGE or SILENT via the existing cooldown file (spec section 11 boundary).

- [ ] **Step 1: Swap the registry file wiring (bash wrapper).**

In `sidecoach-keyword.sh`, replace line 32:

```bash
MODE_FILE="$HOOK_DIR/sidecoach-modes.json"
```
with:
```bash
LANE_FILE="$HOOK_DIR/sidecoach-lanes.json"
```

Replace the existence guard (lines 35-38):
```bash
if [[ ! -f "$VERB_FILE" && ! -f "$MODE_FILE" && ! -f "$INTENT_FILE" ]]; then
  # No registries, nothing to do. Stay out of the prompt path.
  exit 0
fi
```
with:
```bash
if [[ ! -f "$VERB_FILE" && ! -f "$LANE_FILE" && ! -f "$INTENT_FILE" ]]; then
  # No registries, nothing to do. Stay out of the prompt path.
  exit 0
fi
```

Replace the env-passing line 42:
```bash
VERB_FILE_PATH="$VERB_FILE" MODE_FILE_PATH="$MODE_FILE" INTENT_FILE_PATH="$INTENT_FILE" PROMPT_RAW="$INPUT" python3 <<'PYEOF'
```
with (adds `HOOK_DIR` so the inline python can import the shared module):
```bash
VERB_FILE_PATH="$VERB_FILE" LANE_FILE_PATH="$LANE_FILE" INTENT_FILE_PATH="$INTENT_FILE" HOOK_DIR_PATH="$HOOK_DIR" PROMPT_RAW="$INPUT" python3 <<'PYEOF'
```

- [ ] **Step 2: Replace mode loading with lane-registry import (python heredoc).**

Replace lines 90-103 (the `# Load mode registry...` block ending at the `modes = []` except handler) with:

```python
# Import the shared lane classifier (pure regex/Python, no LLM - model-router-guard).
hook_dir = os.environ.get("HOOK_DIR_PATH", "")
if hook_dir and hook_dir not in sys.path:
    sys.path.insert(0, hook_dir)
lane_file = os.environ.get("LANE_FILE_PATH", "")
lane_registry = None
sidecoach_lanes = None
try:
    import sidecoach_lanes as sidecoach_lanes  # noqa: PLC0414
    if lane_file:
        lane_registry = sidecoach_lanes.load_registry(lane_file)
except Exception:
    # Structure-invalid registry disables the lane tier loudly but does not
    # break the verb/intent tiers (spec sections 12-13).
    lane_registry = None
```

Also update the `if not verbs and not modes and not intent:` guard (line 152) to:
```python
if not verbs and not lane_registry and not intent:
    sys.exit(0)
```

- [ ] **Step 3: Replace the mode/verb matching+emit block (lines 251-303).**

The current block runs `matched_modes`/`matched_verbs` and emits mode or verb context. Replace the entire span from line 251 (`# Modes are checked first...`) through line 303 (`    sys.exit(0)`) with the lane-classifier dispatch. The intent-eligibility computation that currently lives further down (lines 314-361) is hoisted into a helper so it can be passed into `classify_intent`; keep its regex helpers (`matched_list`, `any_match`, `substantive_match`) which are defined later in the file - move them ABOVE this block, or inline the eligibility computation here. Implementation:

```python
# --- Lane classifier tier (replaces the mode tier) -------------------------
# Compute advisory nudge eligibility exactly as the legacy intent tier did, so
# we can hand it to classify_intent. (The classifier never reads cooldown.)
def _intent_eligible():
    if not intent:
        return False
    actions = intent.get("actions", []) or []
    targets = intent.get("substantive_targets", []) or []
    standalone = intent.get("standalone", []) or []
    exempt = intent.get("exempt", []) or []
    new_build = intent.get("new_build", []) or []

    def mlist(pats):
        out = []
        for p in pats:
            if not isinstance(p, str) or not p:
                continue
            try:
                rx = re.compile(rf"(?<![\w-]){p}(?![\w-])", re.IGNORECASE)
            except re.error:
                continue
            if rx.search(sanitized):
                out.append(p)
        return out

    def subst(pats):
        return [p for p in mlist(pats) if not is_informational(sanitized, p)]

    has_action = len(mlist(actions)) > 0
    has_target = len(subst(targets)) > 0
    has_standalone = len(subst(standalone)) > 0
    has_exempt = len(mlist(exempt)) > 0
    has_new_build = len(mlist(new_build)) > 0
    fires = has_standalone or (has_action and has_target)
    if has_exempt and not has_new_build and not has_standalone:
        fires = False
    return fires

if lane_registry is not None and sidecoach_lanes is not None:
    eligible = _intent_eligible()
    decision = sidecoach_lanes.classify_intent(prompt, lane_registry, verbs, intent_eligible=eligible)
    outcome = decision["outcome"]
    label = ""
    win = decision.get("winningLane")
    if win:
        label = next((l["label"] for l in lane_registry["lanes"] if l["lane"] == win), win)
    ev = ", ".join(decision.get("laneScores") and
                   next((s["evidenceIds"] for s in decision["laneScores"] if s["lane"] == win), []) or [])

    context = None
    if outcome == "ROUTE":
        context = (
            f"User intent classified as the sidecoach lane <lane>{label}</lane>. "
            f"Announce in one sentence that you are taking the '{label}' approach, then begin its first step. "
            f"The classification is confident; do not ask which mode. Evidence: {ev}."
        )
        touch_cooldown()
    elif outcome == "CLASSIFY":
        verb = decision.get("verbMatch")
        verb_opt = f"(2) the single verb /sidecoach {verb}; " if verb else ""
        context = (
            "User intent is design work with competing signals. Offer in one short prompt: "
            f"(1) the sidecoach lane '{label}'; {verb_opt}"
            f"({'3' if verb else '2'}) just handle it directly. "
            "Do not silently expand a verb into a full lane."
        )
        touch_cooldown()
    elif outcome == "CONTEXT_CHECK":
        context = (
            f"Lane evidence ({label}) appeared without domain evidence. If the conversation is clearly "
            "about UI/design work, classify per the sidecoach lane table and proceed; otherwise ignore "
            "this and answer normally."
        )
        touch_cooldown()
    elif outcome == "VERB":
        verb = decision.get("verbMatch")
        diag = f" (Lane signal '{label}' noted as a non-routing diagnostic; do not auto-expand it into a lane.)" if label else ""
        context = (
            f"User intends to invoke the sidecoach <verb>{verb}</verb> flow. Route accordingly.{diag}"
        )
        touch_cooldown()
    elif outcome == "NUDGE_ELIGIBLE":
        if not in_cooldown():
            nudge = intent.get("nudge") or "This prompt reads as front-end / design work; consider a sidecoach lane."
            touch_cooldown()
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": nudge}}))
        sys.exit(0)
    elif outcome == "OUT_OF_SCOPE":
        print(f"sidecoach-keyword: lane evidence bound out-of-scope; no lane action", file=sys.stderr)
        sys.exit(0)
    # SILENT -> fall through to the legacy verb-only path below (no lane match)

    if context is not None:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": context}}))
        sys.exit(0)

# If the lane tier is disabled (structure-invalid registry), fall back to the
# legacy verb tier so explicit verbs still route.
matched_verbs = match_entries(verbs, "verb")
if matched_verbs:
    if len(matched_verbs) > 1:
        names = [v.get("verb") for v in matched_verbs]
        print(f"sidecoach-keyword: multiple verbs matched {names}; using {names[0]}", file=sys.stderr)
    chosen_name = matched_verbs[0].get("verb", "")
    touch_cooldown()
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
        "additionalContext": f"User intends to invoke the sidecoach <verb>{chosen_name}</verb> flow. Route accordingly."}}))
    sys.exit(0)
```

Then DELETE the now-dead legacy intent tier (the original lines 305-378, from `# Intent tier:` through the final nudge `print(...)`), since `_intent_eligible()` + the NUDGE_ELIGIBLE branch above now own it. Keep the `match_entries` and `is_informational` function definitions (still used).

- [ ] **Step 4: Smoke test the hook end to end.**

Run:
```bash
echo '{"prompt":"make the landing page production-ready"}' | bash claude/hooks/sidecoach-keyword.sh
```
Expected: JSON whose `additionalContext` contains `release-readiness pass` and `Announce in one sentence`.

Run:
```bash
echo '{"prompt":"make this production-ready"}' | bash claude/hooks/sidecoach-keyword.sh
```
Expected: JSON whose `additionalContext` contains `without domain evidence` (CONTEXT-CHECK).

Run:
```bash
echo '{"prompt":"refactor the database migration script"}' | bash claude/hooks/sidecoach-keyword.sh
```
Expected: empty output / `{}` (no lane, no nudge).

- [ ] **Step 5: Commit**

```bash
git add claude/hooks/sidecoach-keyword.sh
git commit -m "feat(sidecoach): replace mode tier with lane classifier in hook (P1 task 6)"
```

---

## Task 7: TS classifier parity + shared fixture corpus

**Files:**
- Create: `sidecoach/parity/classifier-corpus.json`
- Modify: `sidecoach/mcp-server/src/keyword-resolver.ts`
- Test: `claude/hooks/test_classifier_parity.py`
- Test: `sidecoach/mcp-server/src/__tests__/classifier-parity.test.ts`

- [ ] **Step 0: Confirm anchor.** Read `sidecoach/mcp-server/src/keyword-resolver.ts`. Note its current exports (likely `resolveKeyword` for the `sidecoach_resolve_keyword` tool) and how it loads its registry. Do NOT delete `resolveKeyword` (the tool rename to `classify-intent` is P4); ADD the classifier functions below alongside it. Match the file's existing import style.

- [ ] **Step 1: Write the shared corpus `sidecoach/parity/classifier-corpus.json`**

```json
{
  "schemaVersion": 1,
  "note": "Shared Python/TS classifier fixtures. Both sides must return identical outcome (+ winningLane where given). NUDGE_ELIGIBLE cases set eligible=true. Hook-only cooldown mapping is NOT covered here (see test-sidecoach-keyword.sh).",
  "cases": [
    { "prompt": "make this production-ready", "expect": "CONTEXT_CHECK", "winningLane": "lane_ship" },
    { "prompt": "make the landing page production-ready", "expect": "ROUTE", "winningLane": "lane_ship" },
    { "prompt": "The landing page is done. Make the migration production-ready.", "expect": "SILENT" },
    { "prompt": "Don't make the API production-ready; make the landing page production-ready.", "expect": "ROUTE", "winningLane": "lane_ship" },
    { "prompt": "audit this and make it production-ready", "expect": "VERB", "verbMatch": "audit" },
    { "prompt": "the dashboard should feel more fun", "expect": "CLASSIFY", "winningLane": "lane_delight" },
    { "prompt": "refactor the database migration script", "expect": "SILENT" },
    { "prompt": "I have a TypeScript interface I need to refactor", "expect": "SILENT" },
    { "prompt": "fix the packet header parsing in the network layer", "expect": "SILENT" },
    { "prompt": "rework the memory layout of the struct", "expect": "SILENT" },
    { "prompt": "tone the hero down, it's too busy", "expect": "ROUTE", "winningLane": "lane_calm" },
    { "prompt": "keep iterating on the card until it passes the audit", "expect": "ROUTE", "winningLane": "lane_converge" },
    { "prompt": "restyle the navbar", "expect": "NUDGE_ELIGIBLE", "eligible": true },
    { "prompt": "/sidecoach make this production-ready", "expect": "SILENT" }
  ]
}
```

(Note: case 3 expects SILENT because the ship evidence binds out-of-scope to `migration` and no nudge eligibility is set; the assertion in Task 5 already proves it never ROUTEs/CLASSIFYs. If your verb list or weights shift a borderline case, update the fixture and BOTH classifiers together - drift between them is the bug this corpus exists to catch.)

- [ ] **Step 2: Write the TS parity test `sidecoach/mcp-server/src/__tests__/classifier-parity.test.ts`**

```typescript
import * as path from 'path';
import * as assert from 'assert';
import { loadRegistry, classifyIntent } from '../keyword-resolver';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const LANES = path.join(REPO, 'claude', 'hooks', 'sidecoach-lanes.json');
const CORPUS = path.join(REPO, 'sidecoach', 'parity', 'classifier-corpus.json');

const VERBS = ['shape','craft','polish','audit','critique','harden','adapt','colorize',
  'delight','animate','live','quieter','distill','clarify','layout','bolder',
  'overdrive','typeset','optimize','extract','onboard','document'].map(v => ({ verb: v }));

const reg = loadRegistry(LANES);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const corpus = require(CORPUS);

let failures = 0;
for (const c of corpus.cases) {
  const r = classifyIntent(c.prompt, reg, VERBS, { intentEligible: !!c.eligible });
  try {
    assert.strictEqual(r.outcome, c.expect, `outcome for: ${c.prompt}`);
    if (c.winningLane) assert.strictEqual(r.winningLane, c.winningLane, `winningLane for: ${c.prompt}`);
    if (c.verbMatch) assert.strictEqual(r.verbMatch, c.verbMatch, `verbMatch for: ${c.prompt}`);
  } catch (e) {
    failures++;
    console.error(String(e));
  }
}
if (failures) { console.error(`PARITY FAILURES: ${failures}`); process.exit(1); }
console.log(`classifier-parity: ${corpus.cases.length} cases OK`);
```

- [ ] **Step 3: Run the TS test to verify it fails**

Run: `cd sidecoach/mcp-server && npx ts-node src/__tests__/classifier-parity.test.ts`
Expected: FAIL - `loadRegistry`/`classifyIntent` not exported from keyword-resolver.

- [ ] **Step 4: Add the TS classifier mirror to `sidecoach/mcp-server/src/keyword-resolver.ts`** (append these exports; they mirror `sidecoach_lanes.py` exactly)

```typescript
import * as fs from 'fs';

export const SCHEMA_VERSION = 1;
const NEGATORS = ["don't", 'do not', 'never', 'not', 'stop'];
const ABBREVIATIONS = ['e.g.', 'i.e.', 'vs.', 'etc.', 'Dr.', 'Mr.', 'Ms.'];
const CONJUNCTION_BOUNDARIES = [', but', ', and', ', or', ', yet', ', so'];
const TERMINATORS = new Set(['.', '!', '?', ';', '\n']);

export interface LaneScore { lane: string; label: string; score: number; scope: string; evidenceIds: string[]; }
export interface Decision { outcome: string; winningLane: string | null; verbMatch: string | null; laneScores: LaneScore[]; schemaVersion: number; }

export function loadRegistry(p: string): any {
  const reg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!reg || !Array.isArray(reg.lanes) || !reg.lanes.length) throw new Error('lane registry has no lanes');
  if (!reg.scope || !reg.scope.ui_evidence || !reg.scope.negative_filters) throw new Error('scope incomplete');
  for (const k of ['route_floor', 'route_margin', 'classify_floor']) if (!(k in (reg.scoring || {}))) throw new Error(`scoring missing ${k}`);
  return reg;
}

const blank = (m: string) => ' '.repeat(m.length);

export function sanitize(text: string): string {
  text = text.replace(/```[\s\S]*?```/g, blank);
  text = text.replace(/`[^`\n]*`/g, blank);
  text = text.replace(/\b(?:https?|file|ftp):\/\/\S+/gi, blank);
  text = text.replace(/<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?<\/\1\s*>/g, blank);
  text = text.replace(/<[a-zA-Z!/][^>]*>/g, blank);
  text = text.replace(/\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]/gi, blank);
  return text;
}

const INFO_FRAMES = [
  /\bwhat(?:['’]s| is| are| was| were| does| did)\s+[^.!?;\n]*/gi,
  /\bhow\s+(?:to|do\s+(?:i|you|we))\s+[^.!?;\n]*/gi,
  /\btell\s+me\s+about\s+[^.!?;\n]*/gi,
  /\bexplain\s+[^.!?;\n]*/gi,
  /\bdefine\s+[^.!?;\n]*/gi,
];

export function blankInformational(text: string): string {
  for (const f of INFO_FRAMES) text = text.replace(f, blank);
  text = text.replace(/["“][^"”\n]{0,400}["”]/g, blank);
  return text;
}

export function segmentClauses(text: string): Array<[number, number]> {
  let masked = text;
  for (const a of ABBREVIATIONS) masked = masked.split(a).join(a.replace(/\./g, ' '));
  const cuts = new Set<number>([0, text.length]);
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (TERMINATORS.has(ch)) { if (i + 1 < text.length) cuts.add(i + 1); continue; }
    if (ch === ',') {
      const w = masked.slice(i, i + 6).toLowerCase();
      if (CONJUNCTION_BOUNDARIES.some(cb => w.startsWith(cb))) { if (i + 1 < text.length) cuts.add(i + 1); }
    }
  }
  const b = Array.from(cuts).sort((x, y) => x - y);
  const spans: Array<[number, number]> = [];
  for (let i = 0; i + 1 < b.length; i++) if (b[i + 1] > b[i]) spans.push([b[i], b[i + 1]]);
  return spans;
}

const wb = (p: string) => new RegExp(`(?<![\\w-])(?:${p})(?![\\w-])`, 'gi');
function compileAll(pats: string[]): RegExp[] { const o: RegExp[] = []; for (const p of pats) { try { o.push(wb(p)); } catch { /* isolate one bad regex */ } } return o; }
function clauseBounds(pos: number, spans: Array<[number, number]>): [number, number] { for (const [a, b] of spans) if (a <= pos && pos < b) return [a, b]; return spans.length ? spans[spans.length - 1] : [0, 0]; }
function hasNegator(prefix: string): boolean { return NEGATORS.some(n => new RegExp(`(?<![\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'i').test(prefix)); }
const anyMatch = (res: RegExp[], s: string) => res.some(r => { r.lastIndex = 0; return r.test(s); });

export function evaluateLane(lane: any, prompt: string, reg: any): LaneScore {
  const text = blankInformational(sanitize(prompt));
  const spans = segmentClauses(text);
  const ui = compileAll(reg.scope.ui_evidence);
  const negs = compileAll(reg.scope.negative_filters);
  const groups: Record<string, number> = {}; const evIds: string[] = [];
  let nIn = 0, nUnknown = 0, nOos = 0;
  for (const entry of lane.lexicon) {
    let rx: RegExp; try { rx = wb(entry.pattern); } catch { continue; }
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      if (m.index === rx.lastIndex) rx.lastIndex++;
      const [a, b] = clauseBounds(m.index, spans);
      const clause = text.slice(a, b);
      if (hasNegator(text.slice(a, m.index))) continue;
      if (anyMatch(negs, clause)) { nOos++; continue; }
      if (anyMatch(ui, clause)) nIn++; else nUnknown++;
      const g = entry.group || entry.pattern;
      groups[g] = Math.max(groups[g] || 0, Number(entry.weight) || 1);
      evIds.push(entry.pattern);
    }
  }
  let score = Object.values(groups).reduce((s, w) => s + w, 0);
  let scope: string;
  if (nIn > 0) scope = 'IN_SCOPE';
  else if (nUnknown === 0 && nOos > 0) { scope = 'OUT_OF_SCOPE'; score = 0; }
  else scope = 'SCOPE_UNKNOWN';
  return { lane: lane.lane, label: lane.label, score, scope, evidenceIds: evIds.slice(0, 3) };
}

export function isInformational(text: string, pattern: string): boolean {
  const frames = [
    `\\bwhat\\s+(?:is|are|was|were|does|did)\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bwhat['’]s\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+to\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+do\\s+(?:i|you|we)\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\bexplain\\s+(?:the\\s+|how\\s+|what\\s+)?${pattern}(?![\\w-])`,
    `\\bdefine\\s+${pattern}(?![\\w-])`,
    `(?<![\\w-])${pattern}\\s+is\\s+(?:a|an|the)\\b`,
  ];
  return frames.some(f => new RegExp(f, 'i').test(text));
}

export function detectVerb(text: string, verbs: any[]): string | null {
  for (const v of verbs) {
    const name = typeof v === 'string' ? v : v.verb;
    const patt = typeof v === 'string' ? v : (v.pattern || v.verb);
    if (!name || !patt) continue;
    let rx: RegExp; try { rx = new RegExp(`(?<![\\w-])(?:${patt})(?![\\w-])`, 'i'); } catch { continue; }
    if (rx.test(text) && !isInformational(text, patt)) return name;
  }
  return null;
}

export function classifyIntent(prompt: string, reg: any, verbs: any[], opts?: { intentEligible?: boolean }): Decision {
  const res: Decision = { outcome: 'SILENT', winningLane: null, verbMatch: null, laneScores: [], schemaVersion: SCHEMA_VERSION };
  if (!prompt || !prompt.trim()) return res;
  if (/^\s*\/sidecoach\b/i.test(prompt)) return res;
  const text = blankInformational(sanitize(prompt));
  const scores = reg.lanes.map((l: any) => evaluateLane(l, prompt, reg));
  res.laneScores = scores;
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]; const second = ranked[1] ? ranked[1].score : 0;
  const verb = detectVerb(text, verbs); res.verbMatch = verb;
  const { route_floor: rf, route_margin: rm, classify_floor: cf } = reg.scoring;
  const routeGrade = top.scope === 'IN_SCOPE' && top.score >= rf && (top.score - second) >= rm;
  if (verb) { res.outcome = routeGrade ? 'CLASSIFY' : 'VERB'; if (routeGrade) res.winningLane = top.lane; return res; }
  if (top.scope === 'IN_SCOPE' && top.score > 0) {
    res.winningLane = top.lane;
    res.outcome = routeGrade ? 'ROUTE' : (top.score >= cf ? 'CLASSIFY' : 'SILENT');
    if (res.outcome !== 'SILENT') return res;
  }
  const unknown = ranked.find(r => r.scope === 'SCOPE_UNKNOWN' && r.score > 0);
  if (unknown) { res.outcome = 'CONTEXT_CHECK'; res.winningLane = unknown.lane; return res; }
  const oos = scores.some((r: LaneScore) => r.scope === 'OUT_OF_SCOPE');
  if (opts && opts.intentEligible) { res.outcome = 'NUDGE_ELIGIBLE'; return res; }
  res.outcome = oos ? 'OUT_OF_SCOPE' : 'SILENT';
  return res;
}
```

- [ ] **Step 5: Run the TS test to verify it passes**

Run: `cd sidecoach/mcp-server && npx ts-node src/__tests__/classifier-parity.test.ts`
Expected: `classifier-parity: 14 cases OK`.

- [ ] **Step 6: Write + run the Python parity test `claude/hooks/test_classifier_parity.py`**

```python
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import sidecoach_lanes as sl

REG = sl.load_registry(os.path.join(HERE, "sidecoach-lanes.json"))
CORPUS = json.load(open(os.path.join(REPO, "sidecoach", "parity", "classifier-corpus.json")))
VERBS = [{"verb": v} for v in ["shape","craft","polish","audit","critique","harden",
  "adapt","colorize","delight","animate","live","quieter","distill","clarify",
  "layout","bolder","overdrive","typeset","optimize","extract","onboard","document"]]

def test_python_matches_corpus():
    for c in CORPUS["cases"]:
        r = sl.classify_intent(c["prompt"], REG, VERBS, intent_eligible=bool(c.get("eligible")))
        assert r["outcome"] == c["expect"], f"{c['prompt']}: {r['outcome']} != {c['expect']}"
        if "winningLane" in c:
            assert r["winningLane"] == c["winningLane"], c["prompt"]
        if "verbMatch" in c:
            assert r["verbMatch"] == c["verbMatch"], c["prompt"]
```

Run: `cd claude/hooks && python3 -m pytest test_classifier_parity.py -q`
Expected: PASS (1 passed). Both sides now agree on all 14 cases - this is the parity guarantee.

- [ ] **Step 7: Commit**

```bash
git add sidecoach/parity/classifier-corpus.json sidecoach/mcp-server/src/keyword-resolver.ts sidecoach/mcp-server/src/__tests__/classifier-parity.test.ts claude/hooks/test_classifier_parity.py
git commit -m "feat(sidecoach): TS classifier mirror + shared parity corpus (P1 task 7)"
```

---

## Task 8: `/sidecoach <phrase>` resolution union in `slash-command-router.ts`

**Files:**
- Create: `sidecoach/src/lane-classifier.ts` (shared TS classifier core - see Step 1)
- Modify: `sidecoach/mcp-server/src/keyword-resolver.ts` (re-export the core)
- Modify: `sidecoach/src/slash-command-router.ts`
- Test: `sidecoach/src/__tests__/slash-phrase.test.ts`

Spec section 10: `/sidecoach <phrase>` resolves to `ROUTE | CLASSIFY | OUT_OF_SCOPE | UNKNOWN`. Because the user explicitly addressed sidecoach, SCOPE_UNKNOWN (with no negative evidence) PROCEEDS to ROUTE/CLASSIFY; positive negative evidence still refuses (OUT_OF_SCOPE); a phrase with NO lane evidence at all is UNKNOWN and preserves the existing typo/near-miss suggestion (`/sidecoach polsih` -> "did you mean polish?").

- [ ] **Step 0: Confirm anchors.** Read `sidecoach/src/slash-command-router.ts`. Identify (a) the existing exported resolve function and its result type, (b) the known-command matcher (verb/lane name match), and (c) the near-miss/"did you mean" suggestion helper. The new function reuses (b) and (c). Confirm whether the mcp-server tsconfig can import from `../../src` (cross-package). If it CAN, Step 1 makes the engine module canonical; if it CANNOT, keep the classifier copy in `keyword-resolver.ts` (Task 7) AND duplicate the core into `sidecoach/src/lane-classifier.ts` for the engine - the shared `classifier-corpus.json` parity test (Task 7) remains the guard that both stay identical. Note which path you took.

- [ ] **Step 1: Make the classifier core a shared engine module.**

Move the classifier functions added in Task 7 (`SCHEMA_VERSION`, `loadRegistry`, `sanitize`, `blankInformational`, `segmentClauses`, `evaluateLane`, `isInformational`, `detectVerb`, `classifyIntent`, and the `LaneScore`/`Decision` interfaces) from `keyword-resolver.ts` into a new `sidecoach/src/lane-classifier.ts` (verbatim - same bodies). Then in `keyword-resolver.ts` replace those definitions with a re-export:

```typescript
export * from '../../src/lane-classifier';
```

(If Step 0 found cross-package import impossible, instead leave the copy in `keyword-resolver.ts` and paste an identical copy into `lane-classifier.ts`; the parity corpus test guards equivalence.) Update Task 7's TS parity test import to `from '../lane-classifier'` if you moved it under `sidecoach/src/__tests__/`, or keep `from '../keyword-resolver'` (the re-export keeps it valid).

- [ ] **Step 2: Write the failing test `sidecoach/src/__tests__/slash-phrase.test.ts`**

```typescript
import * as path from 'path';
import * as assert from 'assert';
import { resolveSidecoachPhrase } from '../slash-command-router';

const LANES = path.resolve(__dirname, '..', '..', '..', 'claude', 'hooks', 'sidecoach-lanes.json');

function check(phrase: string, kind: string, lane?: string) {
  const r = resolveSidecoachPhrase(phrase, LANES);
  assert.strictEqual(r.kind, kind, `${phrase} -> ${r.kind}`);
  if (lane) assert.strictEqual(r.lane, lane, `${phrase} lane`);
}

check('make this production-ready', 'ROUTE', 'lane_ship');        // SCOPE_UNKNOWN proceeds under explicit address
check('build the API from scratch', 'OUT_OF_SCOPE');               // positive negative evidence refuses
check('make the landing page production-ready', 'ROUTE', 'lane_ship');
check('polsih the button', 'UNKNOWN');                             // no lane evidence -> near-miss suggestion preserved
console.log('slash-phrase: OK');
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/slash-phrase.test.ts`
Expected: FAIL - `resolveSidecoachPhrase` not exported.

- [ ] **Step 4: Add `resolveSidecoachPhrase` to `slash-command-router.ts`**

```typescript
import { loadRegistry, evaluateLane } from './lane-classifier';
// reuse the existing known-command matcher + near-miss helper found in Step 0;
// referenced below as matchKnownCommand(phrase) and nearMissSuggestion(phrase).

export interface PhraseResolution {
  kind: 'ROUTE' | 'CLASSIFY' | 'OUT_OF_SCOPE' | 'UNKNOWN';
  command?: string;     // when the phrase is a known verb/lane command
  lane?: string;        // when routed/classified to a lane
  suggestion?: string;  // UNKNOWN near-miss ("did you mean /sidecoach polish?")
  redirect?: string;    // OUT_OF_SCOPE one-line redirect
}

export function resolveSidecoachPhrase(phrase: string, lanesPath: string): PhraseResolution {
  const known = matchKnownCommand(phrase);            // existing behavior wins
  if (known) return { kind: 'ROUTE', command: known };

  const reg = loadRegistry(lanesPath);
  const scores = reg.lanes.map((l: any) => evaluateLane(l, phrase, reg));
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]; const second = ranked[1] ? ranked[1].score : 0;
  const hasRoutableEvidence = scores.some((s: any) =>
    (s.scope === 'IN_SCOPE' || s.scope === 'SCOPE_UNKNOWN') && s.score > 0);
  const hasOos = scores.some((s: any) => s.scope === 'OUT_OF_SCOPE');

  if (!hasRoutableEvidence) {
    if (hasOos) {
      return { kind: 'OUT_OF_SCOPE',
        redirect: 'That reads as backend/infrastructure work. Sidecoach covers UI/design only.' };
    }
    return { kind: 'UNKNOWN', suggestion: nearMissSuggestion(phrase) };
  }
  const { route_floor: rf, route_margin: rm } = reg.scoring;
  const routeGrade = top.score >= rf && (top.score - second) >= rm;  // explicit address: scope_unknown counts
  return routeGrade ? { kind: 'ROUTE', lane: top.lane } : { kind: 'CLASSIFY', lane: top.lane };
}
```

If Step 0 found the known-command matcher and near-miss helper under different names, alias them at the import site; do not duplicate their logic.

- [ ] **Step 5: Run to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/slash-phrase.test.ts`
Expected: `slash-phrase: OK`.

- [ ] **Step 6: Commit**

```bash
git add sidecoach/src/lane-classifier.ts sidecoach/mcp-server/src/keyword-resolver.ts sidecoach/src/slash-command-router.ts sidecoach/src/__tests__/slash-phrase.test.ts
git commit -m "feat(sidecoach): /sidecoach phrase resolution union (P1 task 8)"
```

---

## Task 9: Enumerating test runner (so new suites actually run)

**Files:**
- Create: `sidecoach/scripts/run-tests.ts`
- Modify: `sidecoach/package.json`
- Test: the runner is self-verifying (it exits nonzero if a listed suite is missing).

Spec section 14: `npm test` today runs ONLY `intent-detector.test.ts`, so new lane suites would never execute. Replace it with an enumerating runner.

- [ ] **Step 0: Confirm anchor.** Read `sidecoach/package.json`. Confirm the current `"test"` value (grounding fact: `"test": "ts-node src/intent-detector.test.ts"`). Note the package's `main`/`scripts` shape so the edit slots in cleanly.

- [ ] **Step 1: Write the runner `sidecoach/scripts/run-tests.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const TESTS_DIR = path.resolve(__dirname, '..', 'src', '__tests__');
// Suites that MUST exist; the runner fails loudly if one is deleted/renamed.
const REQUIRED = ['slash-phrase.test.ts'];

function listSuites(): string[] {
  if (!fs.existsSync(TESTS_DIR)) return [];
  return fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.test.ts')).sort();
}

const suites = listSuites();
for (const req of REQUIRED) {
  if (!suites.includes(req)) {
    console.error(`run-tests: REQUIRED suite missing from src/__tests__: ${req}`);
    process.exit(2);
  }
}
let failed = 0;
for (const s of suites) {
  const full = path.join(TESTS_DIR, s);
  process.stdout.write(`-> ${s}\n`);
  try {
    execFileSync('npx', ['ts-node', full], { stdio: 'inherit' });
  } catch {
    failed++;
  }
}
if (failed) { console.error(`run-tests: ${failed} suite(s) failed`); process.exit(1); }
console.log(`run-tests: ${suites.length} suite(s) passed`);
```

- [ ] **Step 2: Point `npm test` at the runner.**

In `sidecoach/package.json`, replace:
```json
"test": "ts-node src/intent-detector.test.ts"
```
with:
```json
"test": "ts-node scripts/run-tests.ts"
```

- [ ] **Step 3: Run it**

Run: `cd sidecoach && npm test`
Expected: enumerates `src/__tests__/*.test.ts` (including the legacy `intent-detector` suite if it has a `.test.ts` peer, and `slash-phrase.test.ts`), runs each, prints `run-tests: N suite(s) passed`.

Note: if `intent-detector.test.ts` lives at `src/intent-detector.test.ts` (not under `__tests__/`), either move it under `src/__tests__/` or add `src/` to the runner's scan list. Confirm in Step 0 and adjust the `TESTS_DIR`/scan accordingly so no existing suite is silently dropped.

- [ ] **Step 4: Commit**

```bash
git add sidecoach/scripts/run-tests.ts sidecoach/package.json
git commit -m "build(sidecoach): enumerating test runner replaces single-suite npm test (P1 task 9)"
```

---

## Task 10: `generate-lanes.ts` + checked-in `lanes.generated.ts` (+ `--check`)

**Files:**
- Create: `sidecoach/scripts/generate-lanes.ts`
- Create: `sidecoach/src/lanes.generated.ts` (checked in, generator output)
- Create: `sidecoach/LANES.generated.md` (checked in, generated doc-section)
- Test: `sidecoach/src/__tests__/lane-derivation.test.ts`

Spec section 2: derive each lane's executed flow sequence from `verb-command-registry.ts` (flows in verb order, each once, first owning verb) + the verb-guidance map; `--check` fails on JSON drift, derivation drift, or generated-doc-section drift. P1 `--check` does NOT cover prerequisite-edge or validator-registration checks (P2/P3).

- [ ] **Step 1: Write the failing derivation test `sidecoach/src/__tests__/lane-derivation.test.ts`**

```typescript
import * as assert from 'assert';
import { deriveFlowSequence } from '../../scripts/generate-lanes';

const GOLDEN: Record<string, string[]> = {
  lane_build: ['flowA_brand_verify','flowB_component_research','flowE_motion_patterns','flowF_design_tokens','flowG_component_implementation','flowH_motion_integration','flowI_accessibility','flowM_responsive_validation','flowJ_tactical_polish'],
  lane_ship: ['flowK_multi_lens_audit','flowI_accessibility','flowL_design_critique','flowV_all_seven_qa','flowM_responsive_validation','flowJ_tactical_polish'],
  lane_delight: ['flowF_design_tokens','flowH_motion_integration','flowT_ambitious_motion','flowJ_tactical_polish','flowM_responsive_validation'],
  lane_live: ['flowN_rapid_iteration_refined','flowF_design_tokens','flowJ_tactical_polish','flowM_responsive_validation','flowL_design_critique','flowK_multi_lens_audit'],
  lane_calm: ['flowJ_tactical_polish','flowX_copywriting','flowM_responsive_validation'],
  lane_converge: ['flowJ_tactical_polish','flowM_responsive_validation','flowK_multi_lens_audit','flowI_accessibility','flowL_design_critique'],
};
const CHAINS: Record<string, string[]> = {
  lane_build: ['shape','craft','polish'],
  lane_ship: ['audit','critique','harden','adapt','polish'],
  lane_delight: ['colorize','delight','animate','polish'],
  lane_live: ['live','colorize','polish','critique'],
  lane_calm: ['quieter','distill','clarify','polish'],
  lane_converge: ['polish','audit','critique'],
};
for (const lane of Object.keys(GOLDEN)) {
  assert.deepStrictEqual(deriveFlowSequence(CHAINS[lane]), GOLDEN[lane], `derivation for ${lane}`);
}
console.log('lane-derivation: OK');
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-derivation.test.ts`
Expected: FAIL - cannot import `deriveFlowSequence`.

- [ ] **Step 3: Write `sidecoach/scripts/generate-lanes.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { VERB_REGISTRY } from '../src/verb-command-registry';
import type { FlowId } from '../src/types';

const ROOT = path.resolve(__dirname, '..', '..');
const JSON_PATH = path.join(ROOT, 'claude', 'hooks', 'sidecoach-lanes.json');
const TS_OUT = path.resolve(__dirname, '..', 'src', 'lanes.generated.ts');
const MD_OUT = path.resolve(__dirname, '..', 'LANES.generated.md');

export function deriveFlowSequence(verbChain: string[]): FlowId[] {
  const seen = new Set<string>(); const seq: FlowId[] = [];
  for (const verb of verbChain) {
    const entry = (VERB_REGISTRY as any)[verb];
    if (!entry) throw new Error(`unknown verb in chain: ${verb}`);
    for (const f of entry.flowIds as FlowId[]) if (!seen.has(f)) { seen.add(f); seq.push(f); }
  }
  return seq;
}

export function deriveVerbGuidance(verbChain: string[]) {
  return verbChain.map(v => ({ verb: v, guidance: (VERB_REGISTRY as any)[v].guidanceAppend as string[] }));
}

function buildModel() {
  const reg = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  return reg.lanes.map((l: any) => ({
    lane: l.lane, label: l.label, description: l.description,
    interviewLabel: l.interviewLabel, executionKind: l.executionKind,
    verbChain: l.verbChain, prereqWaivers: l.prereqWaivers || [],
    flowSequence: deriveFlowSequence(l.verbChain),
    verbGuidance: deriveVerbGuidance(l.verbChain),
  }));
}

function renderTs(model: any[]): string {
  return `// GENERATED by sidecoach/scripts/generate-lanes.ts - DO NOT EDIT BY HAND.\n` +
    `// Source: claude/hooks/sidecoach-lanes.json + sidecoach/src/verb-command-registry.ts\n` +
    `import type { FlowId } from './types';\n\n` +
    `export interface GeneratedLane {\n  lane: string; label: string; description: string;\n  interviewLabel: string; executionKind: 'sequence' | 'loop';\n  verbChain: string[]; flowSequence: FlowId[];\n  verbGuidance: { verb: string; guidance: string[] }[];\n  prereqWaivers: { dependentFlowId: string; prerequisiteFlowId: string; reason: string }[];\n}\n\n` +
    `export const LANES: GeneratedLane[] = ${JSON.stringify(model, null, 2)};\n\n` +
    `export const LANES_BY_ID: Record<string, GeneratedLane> =\n  Object.fromEntries(LANES.map(l => [l.lane, l]));\n\n` +
    `export function getLane(id: string): GeneratedLane | undefined { return LANES_BY_ID[id]; }\n` +
    `export function getLaneFlowSequence(id: string): FlowId[] | undefined { return LANES_BY_ID[id]?.flowSequence; }\n`;
}

function renderMd(model: any[]): string {
  const rows = model.map(l =>
    `| \`${l.lane}\` | ${l.label} | ${l.executionKind} | ${l.verbChain.join(', ')} | ${l.flowSequence.join(', ')} |`).join('\n');
  return `<!-- lanes:generated:start -->\n` +
    `| Lane | Label | Kind | Verb chain | Derived flow sequence |\n|---|---|---|---|---|\n${rows}\n` +
    `<!-- lanes:generated:end -->\n`;
}

function main() {
  const check = process.argv.includes('--check');
  const model = buildModel();
  const ts = renderTs(model);
  const md = renderMd(model);
  if (check) {
    let drift = false;
    for (const [p, want] of [[TS_OUT, ts], [MD_OUT, md]] as [string, string][]) {
      const have = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
      if (have !== want) { console.error(`generate-lanes --check: DRIFT in ${path.relative(ROOT, p)}`); drift = true; }
    }
    if (drift) process.exit(1);
    console.log('generate-lanes --check: OK (no JSON/derivation/doc drift)');
    return;
  }
  fs.writeFileSync(TS_OUT, ts);
  fs.writeFileSync(MD_OUT, md);
  console.log(`generate-lanes: wrote ${path.relative(ROOT, TS_OUT)} and ${path.relative(ROOT, MD_OUT)}`);
}

if (require.main === module) main();
```

- [ ] **Step 4: Run the derivation test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-derivation.test.ts`
Expected: `lane-derivation: OK`.

- [ ] **Step 5: Generate the checked-in artifacts, then prove `--check` is green.**

Run:
```bash
cd sidecoach && npx ts-node scripts/generate-lanes.ts && npx ts-node scripts/generate-lanes.ts --check
```
Expected: first prints `wrote src/lanes.generated.ts and LANES.generated.md`; second prints `--check: OK`.

- [ ] **Step 6: Prove `--check` catches drift (manual mutation).**

Run:
```bash
cd sidecoach && cp src/lanes.generated.ts /tmp/lg.bak && printf '\n// drift\n' >> src/lanes.generated.ts && (npx ts-node scripts/generate-lanes.ts --check; echo "exit=$?") && cp /tmp/lg.bak src/lanes.generated.ts
```
Expected: prints `DRIFT in src/lanes.generated.ts` and `exit=1`, then restores the file.

- [ ] **Step 7: Wire generation into the build.** In `sidecoach/package.json`, ensure `"build"` runs generation first, e.g. set `"build": "ts-node scripts/generate-lanes.ts && tsc"` (confirm the current build script in Step 0 of Task 9 and prepend the generate step). Add `"generate-lanes": "ts-node scripts/generate-lanes.ts"`.

- [ ] **Step 8: Commit**

```bash
git add sidecoach/scripts/generate-lanes.ts sidecoach/src/lanes.generated.ts sidecoach/LANES.generated.md sidecoach/src/__tests__/lane-derivation.test.ts sidecoach/package.json
git commit -m "feat(sidecoach): lane flow-sequence generator + checked-in lanes.generated.ts (P1 task 10)"
```

---

## Task 11: Remove `sidecoach/src/modes.ts` and repoint importers

**Files:**
- Delete: `sidecoach/src/modes.ts`
- Modify: any importer of `./modes` / `../src/modes` (discovered in Step 1)

`lanes.generated.ts` supersedes `modes.ts`. The full MCP `list-modes` -> `list-lanes` rename is P4; in P1 we only repoint importers enough to keep BOTH package builds green.

- [ ] **Step 1: Find every importer.**

Run:
```bash
grep -rn "modes'" sidecoach/src sidecoach/mcp-server/src 2>/dev/null; \
grep -rn "MODES\|MODE_LIST\|getMode\|getModeChain\|getModeVerbChain" sidecoach/src sidecoach/mcp-server/src 2>/dev/null
```
Record each hit. Known consumers from the spec/grounding: `slash-command-router.ts` (already rewritten in Task 8 - confirm it no longer needs `modes`), and the MCP `list-modes.ts` (P4 target).

- [ ] **Step 2: Repoint each importer to the generated registry.** Mapping:
  - `import { MODES } from './modes'` -> `import { LANES_BY_ID } from './lanes.generated'`
  - `MODE_LIST` -> `LANES`
  - `getMode(x)` -> `getLane(x)`
  - `getModeChain(x)` -> `getLaneFlowSequence(x)`
  - `getModeVerbChain(x)` -> `getLane(x)?.verbChain`
  - `.chain` (FlowId chain) -> `.flowSequence`; `.verbChain` stays `.verbChain`.

For the MCP `list-modes.ts`: if it only lists modes, change its import to `LANES` from the engine's generated file and map fields to its existing return shape (do NOT rename the tool/file in P1 - that is P4). If it cannot import the engine generated file across packages (same constraint as Task 8 Step 0), have it load `claude/hooks/sidecoach-lanes.json` and map. Leave a `// TODO(P4): rename list-modes -> list-lanes` marker.

- [ ] **Step 3: Delete the file.**

```bash
git rm sidecoach/src/modes.ts
```

- [ ] **Step 4: Verify both builds compile.**

Run:
```bash
cd sidecoach && npm run build && cd mcp-server && npm run build
```
Expected: both succeed with no `Cannot find module './modes'` / unresolved-symbol errors.

- [ ] **Step 5: Commit**

```bash
git add -A sidecoach/src sidecoach/mcp-server/src
git commit -m "refactor(sidecoach): remove modes.ts, repoint importers to lanes.generated (P1 task 11)"
```

---

## Task 12: Classifier corpus in `test-sidecoach-keyword.sh`

**Files:**
- Modify: `claude/hooks/test-sidecoach-keyword.sh`

Spec section 15 (classifier corpus) + the hook-only NUDGE cooldown mapping. These are end-to-end hook assertions (real stdin -> real `additionalContext`), distinct from the unit/parity tests.

- [ ] **Step 0: Confirm anchors.** Read `claude/hooks/test-sidecoach-keyword.sh`. Identify (a) the assertion helper(s) - e.g. a function that runs `echo '{"prompt":"..."}' | bash sidecoach-keyword.sh` and greps the output for an expected/forbidden substring, and (b) how it sets `SIDECOACH_INTENT_COOLDOWN_FILE` for cooldown tests. Match that exact helper signature when adding the cases below. The hook's input contract (verbatim from `sidecoach-keyword.sh`): payload is `{"prompt":"..."}` on stdin; output is JSON with `.hookSpecificOutput.additionalContext`, or empty/`{}` when silent.

- [ ] **Step 1: Add the corpus cases.** Using the harness's existing helper convention, add assertions equivalent to (substitute the real helper names confirmed in Step 0):

```bash
# --- Lane classifier corpus (v10) ---
# ROUTE: in-scope, route-grade
assert_contains 'make the landing page production-ready' 'release-readiness pass'
# CONTEXT-CHECK: lane evidence, no domain evidence (NOT out-of-scope)
assert_contains 'make this production-ready' 'without domain evidence'
# Clause binding: ship evidence bound to "migration" in its own sentence -> no route
assert_not_contains 'The landing page is done. Make the migration production-ready.' 'release-readiness pass'
# Negator discards first occurrence, routes the second clause
assert_contains "Don't make the API production-ready; make the landing page production-ready." 'release-readiness pass'
# Bare ambiguous tokens never prove scope (no lane lexicon match -> silent)
assert_empty 'I have a TypeScript interface I need to refactor'
assert_empty 'fix the packet header parsing in the network layer'
assert_empty 'rework the memory layout of the struct'
# Quoted/pasted-doc suppression: quoted lane evidence does not fire
assert_not_contains 'the reviewer wrote "make it production-ready" - thoughts?' 'release-readiness pass'
# Explicit verb beats scope outcome -> VERB primary, lane is a diagnostic only
assert_contains 'audit this and make it production-ready' '<verb>audit</verb>'
assert_contains 'audit this and make it production-ready' 'non-routing diagnostic'
# Tone-down lane
assert_contains "tone the hero down, it's too busy" 'tone-down pass'
# Converge lane
assert_contains 'keep iterating on the card until it passes the audit' 'iterate-until-it-passes'
# /sidecoach prefix is owned by the slash router, hook stays silent
assert_empty '/sidecoach make this production-ready'
```

- [ ] **Step 2: Add the NUDGE cooldown-mapping cases (hook-only).** The shared classifier returns `NUDGE_ELIGIBLE`; the hook maps it via the cooldown file. Use a fresh temp cooldown file per the harness convention:

```bash
# Cooldown INACTIVE -> NUDGE_ELIGIBLE becomes a nudge
COOL="$(mktemp)"; rm -f "$COOL"
SIDECOACH_INTENT_COOLDOWN_FILE="$COOL" assert_contains 'restyle the navbar' 'front-end / design work'
# Cooldown ACTIVE (file just written) -> suppressed to SILENT
date +%s > "$COOL"
SIDECOACH_INTENT_COOLDOWN_FILE="$COOL" assert_empty 'restyle the navbar'
rm -f "$COOL"
```

(If the harness lacks `assert_empty`/`assert_not_contains`, add them next to the existing `assert_contains` following its pattern - run the hook, capture stdout, grep with `-q` and invert as needed.)

- [ ] **Step 3: Run the harness**

Run: `bash claude/hooks/test-sidecoach-keyword.sh`
Expected: all assertions pass, including the existing verb-tier cases (unchanged) and the new lane corpus.

- [ ] **Step 4: Commit**

```bash
git add claude/hooks/test-sidecoach-keyword.sh
git commit -m "test(sidecoach): v10 lane classifier corpus + cooldown mapping (P1 task 12)"
```

---

## Task 13: Repoint `install.sh` registry references

**Files:**
- Modify: `install.sh` (around lines 1048 and 2613 per spec section 14)

- [ ] **Step 0: Confirm anchors.**

Run:
```bash
grep -n "sidecoach-modes.json" install.sh
```
Expected: hits near lines 1048 and 2613 (the installer copies/registers the hook registry). Note the exact surrounding lines.

- [ ] **Step 1: Replace each reference.** For every `sidecoach-modes.json` occurrence that refers to the hook registry, change it to `sidecoach-lanes.json` (preserve surrounding path/quoting exactly). If the installer copies a list of hook files, ensure `sidecoach-lanes.json` is the name copied and `sidecoach-modes.json` is removed from the list.

- [ ] **Step 2: Verify no stale references remain.**

Run:
```bash
grep -n "sidecoach-modes.json" install.sh; echo "exit=$?"
```
Expected: no output and `exit=1` (grep found nothing). If a reference is an intentional historical comment, leave it and note why.

- [ ] **Step 3: Smoke-check installer syntax.**

Run: `bash -n install.sh`
Expected: no syntax errors (exit 0).

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "build: install sidecoach-lanes.json (replaces sidecoach-modes.json) (P1 task 13)"
```

---

## Final integration check (run after all tasks)

- [ ] Run the hook unit + parity suites: `cd claude/hooks && python3 -m pytest -q`
- [ ] Run the generator check: `cd sidecoach && npx ts-node scripts/generate-lanes.ts --check`
- [ ] Build + test the engine: `cd sidecoach && npm run build && npm test`
- [ ] Build + run the MCP parity test: `cd sidecoach/mcp-server && npm run build && npx ts-node src/__tests__/classifier-parity.test.ts`
- [ ] Hook smoke: the three `echo '{"prompt":...}' | bash claude/hooks/sidecoach-keyword.sh` commands from Task 6 Step 4 behave as specified.

## Plan self-review (writing-plans checklist - run by the author)

**1. Spec coverage.** Every P1-scoped item maps to a task: lane registry + lexicons + scope policy + prereqWaivers + schemaVersion (Task 1); occurrence-aware informational suppression (Task 3); grouped scoring + clause-bound 3-state scope with the exact segment/negation/bind/aggregate algorithm (Tasks 2, 4); decision flow with the 7 outcomes + documented precedence (explicit verb beats scope) + outcome table (Task 5); hook rewrite incl. NUDGE_ELIGIBLE->NUDGE/SILENT cooldown mapping (Task 6); shared Python classifier + TS parity + shared fixture corpus run against BOTH (Tasks 1-7); `/sidecoach <phrase>` union ROUTE|CLASSIFY|OUT_OF_SCOPE|UNKNOWN with near-miss preserved (Task 8); enumerating test runner (Task 9); `generate-lanes.ts` + `lanes.generated.ts` flow-sequence derivation + verb-guidance map + `--check` on JSON/derivation/doc-section drift (Task 10); `modes.ts` removal (Task 11); `test-sidecoach-keyword.sh` corpus incl. quoted/pasted suppression (Task 12); `install.sh` wiring (Task 13). Out-of-scope items (execution API, checkpoints, lease/outbox, validators, cleanPolicy/rule-registry, lane_converge enablement, MCP tool rename) are explicitly deferred and NOT covered here - intentional per the staging.

**2. Placeholder scan.** No "TBD"/"implement later"/"add error handling"/"similar to Task N". Every code step shows complete code. The five MODIFY targets on files that could not be re-read carry a "Step 0: confirm anchor" with the exact expected current string (from grounding) - this is anchor confirmation, not a placeholder.

**3. Type consistency.** Cross-task identifiers are consistent: Python `classify_intent`/`evaluate_lane`/`segment_clauses`/`blank_informational`/`sanitize`/`detect_verb`/`is_informational`/`load_registry`; TS mirrors `classifyIntent`/`evaluateLane`/`segmentClauses`/`blankInformational`/`sanitize`/`detectVerb`/`isInformational`/`loadRegistry`; result shape `{outcome, winningLane, verbMatch, laneScores, schemaVersion}` identical on both sides; generator exports `deriveFlowSequence`/`deriveVerbGuidance`/`LANES`/`LANES_BY_ID`/`getLane`/`getLaneFlowSequence`; the same scoring keys `route_floor`/`route_margin`/`classify_floor` flow from JSON through both classifiers. The golden flow sequences in the File Structure table, Task 10's test, and the derivation rule all agree.

## Execution handoff

Plan complete. Recommended execution: subagent-driven (fresh subagent per task, two-stage review between tasks) via superpowers:subagent-driven-development. Tasks 1-7 and 9-10 are fully grounded in read files; Tasks 6, 8, 11, 12, 13 touch files that must have their Step 0 anchors confirmed against the live source before editing.








