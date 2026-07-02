#!/usr/bin/env python3
"""Validate benchmark.json against the live beats corpus.

Fail-loud contract (per the zero-failure execution bar):
  exit 0 - benchmark valid
  exit 1 - schema or mapping error (details on stderr)
  exit 2 - corpus directory not found

Never prints a success line unless every check passed. Unreadable beat
files (anywhere in the corpus), unmarked-stale entries without an
explicit per-case allowance, and path escapes are ERRORS, not warnings
(folded from the 2026-07-02 Codex reviews of this stage, rounds 1-2).

--stale-set: after a fully green validation, print the machine-derived
marked-stale set (every corpus beat with superseded_by frontmatter) as
JSON to stdout. Scorers MUST consume this shared set to enforce the
benchmark's global_stale_rule instead of re-deriving it.
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
MIN_CASES = 30

REQUIRED_CASE_FIELDS = ("id", "topic", "question", "answers", "stale", "notes")
OPTIONAL_CASE_FIELDS = ("mode", "paraphrases", "unmarked_stale_ok")
REQUIRED_SCORING_FIELDS = (
    "unit", "top_n", "pass_rate", "hit_rule",
    "global_stale_rule", "tie_rule", "cutover_rule",
)
FILENAME_RE = re.compile(r"^[A-Za-z0-9._-]+\.md$")


class Report:
    def __init__(self):
        self.errors = []

    def error(self, msg):
        self.errors.append(msg)


def read_superseded_by(path: Path, report: Report, label: str) -> str:
    """Return the superseded_by value from a beat's frontmatter, '' if unset.

    Tolerates BOM and CRLF, and both scalar and YAML block-list forms:
        superseded_by: file.md
        superseded_by: [file.md]
        superseded_by:
          - file.md
    An unreadable file is an ERROR (fail loud), reported and treated as ''.
    """
    try:
        text = path.read_text(encoding="utf-8-sig", errors="strict")
    except (OSError, UnicodeError) as exc:
        report.error(f"{label}: cannot read beat {path.name}: {exc}")
        return ""
    text = text.replace("\r\n", "\n")
    match = re.match(r"\A---\n(.*?)\n---", text, re.DOTALL)
    if not match:
        return ""
    lines = match.group(1).splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"superseded_by:\s*(.*?)\s*$", line)
        if not m:
            continue
        value = m.group(1).strip()
        if value in ("", "[]", "~", "null"):
            # Scalar empty; check for a YAML block list on following lines.
            for follow in lines[i + 1:]:
                fm = re.match(r"\s+-\s*(\S.*?)\s*$", follow)
                if fm:
                    return fm.group(1).strip("'\"")
                if follow.strip():
                    break
            return ""
        return value.strip("[]'\" ")
    return ""


def check_filename(name, cid: str, report: Report) -> bool:
    if not isinstance(name, str) or not FILENAME_RE.match(name):
        report.error(
            f"{cid}: invalid beat filename {name!r} "
            "(basename only, .md, no separators or traversal)"
        )
        return False
    return True


def require_str(case: dict, field: str, cid: str, report: Report):
    value = case.get(field)
    if not isinstance(value, str) or not value.strip():
        report.error(f"{cid}: field '{field}' must be a non-empty string")


def unique_list_of_str(value, field: str, cid: str, report: Report) -> list:
    if not isinstance(value, list) or any(not isinstance(v, str) for v in value):
        report.error(f"{cid}: field '{field}' must be a list of strings")
        return []
    if len(set(value)) != len(value):
        report.error(f"{cid}: field '{field}' contains duplicates")
    return value


def main() -> int:
    report = Report()

    bench_path = HERE / "benchmark.json"
    try:
        bench = json.loads(bench_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot load {bench_path}: {exc}", file=sys.stderr)
        return 1
    if not isinstance(bench, dict):
        print("ERROR: benchmark.json top level must be an object", file=sys.stderr)
        return 1

    def strict_int(value):
        return isinstance(value, int) and not isinstance(value, bool)

    if not strict_int(bench.get("version")):
        report.error("top-level 'version' must be an integer")
    if not isinstance(bench.get("created"), str):
        report.error("top-level 'created' must be a string date")

    corpus_field = bench.get("corpus")
    if not isinstance(corpus_field, str) or corpus_field.startswith(("/", "~")) or ".." in corpus_field:
        print(f"ERROR: 'corpus' must be a repo-relative path without traversal, got {corpus_field!r}", file=sys.stderr)
        return 1
    corpus = (REPO / corpus_field).resolve()
    if not corpus.is_dir():
        print(f"ERROR: corpus directory not found: {corpus}", file=sys.stderr)
        return 2
    if REPO.resolve() not in corpus.parents:
        print(f"ERROR: corpus resolves outside the repo: {corpus}", file=sys.stderr)
        return 1

    scoring = bench.get("scoring")
    if not isinstance(scoring, dict):
        report.error("'scoring' must be an object")
        scoring = {}
    for field in REQUIRED_SCORING_FIELDS:
        if field not in scoring:
            report.error(f"scoring: missing field '{field}'")
    if not (strict_int(scoring.get("top_n")) and scoring.get("top_n", 0) > 0):
        report.error("scoring.top_n must be a positive integer")
    pass_rate = scoring.get("pass_rate")
    if not (isinstance(pass_rate, (int, float)) and not isinstance(pass_rate, bool) and 0 < pass_rate <= 1):
        report.error("scoring.pass_rate must be in (0, 1]")

    # Corpus-wide frontmatter scan: the global_stale_rule is enforced from
    # this derived set, so every corpus beat must be readable and parseable.
    marked_stale = {}
    corpus_names = set()
    for beat in sorted(corpus.glob("*.md")):
        corpus_names.add(beat.name)
        superseder = read_superseded_by(beat, report, "corpus-scan")
        if superseder:
            marked_stale[beat.name] = superseder

    # Corpus supersession hygiene: search resolves superseded_by chains at
    # query time and the scorer's stale-leak assertion assumes every chain
    # reaches an existing, unmarked head. A dangling target or a cycle would
    # make a stale beat its own resolution target, so both are corpus ERRORS
    # (escalated from the 2026-07-02 stage-3 Codex reviews).
    for name, target in sorted(marked_stale.items()):
        if target not in corpus_names:
            report.error(
                f"corpus-hygiene: {name} has superseded_by pointing at "
                f"nonexistent beat {target}"
            )
    reported_cycles = set()
    for name in sorted(marked_stale):
        chain = [name]
        cur = name
        while cur in marked_stale and marked_stale[cur] in corpus_names:
            cur = marked_stale[cur]
            if cur in chain:
                cycle = frozenset(chain[chain.index(cur):] + [cur])
                if cycle not in reported_cycles:
                    reported_cycles.add(cycle)
                    report.error(
                        "corpus-hygiene: superseded_by cycle: "
                        + " -> ".join(chain[chain.index(cur):] + [cur])
                    )
                break
            chain.append(cur)

    cases = bench.get("cases")
    if not isinstance(cases, list):
        print("ERROR: 'cases' must be a list", file=sys.stderr)
        return 1
    if len(cases) < MIN_CASES:
        report.error(f"only {len(cases)} cases; minimum is {MIN_CASES}")

    seen_ids = set()
    query_count = 0
    for case in cases:
        if not isinstance(case, dict):
            report.error(f"case is not an object: {case!r}")
            continue
        cid = case.get("id", "<missing id>")
        if not isinstance(cid, str):
            report.error(f"case id must be a string, got {cid!r}")
            cid = repr(cid)
        for field in REQUIRED_CASE_FIELDS:
            if field not in case:
                report.error(f"{cid}: missing field '{field}'")
        for field in case:
            if field not in REQUIRED_CASE_FIELDS + OPTIONAL_CASE_FIELDS:
                report.error(f"{cid}: unknown field '{field}'")
        for field in ("id", "topic", "question", "notes"):
            require_str(case, field, cid, report)
        if cid in seen_ids:
            report.error(f"duplicate case id: {cid}")
        seen_ids.add(cid)

        mode = case.get("mode", "any")
        if mode not in ("any", "all"):
            report.error(f"{cid}: mode must be 'any' or 'all', got {mode!r}")
        if "unmarked_stale_ok" in case and not isinstance(case["unmarked_stale_ok"], bool):
            report.error(f"{cid}: unmarked_stale_ok must be a boolean")

        answers = unique_list_of_str(case.get("answers", []), "answers", cid, report)
        stale = unique_list_of_str(case.get("stale", []), "stale", cid, report)
        paraphrases = unique_list_of_str(case.get("paraphrases", []), "paraphrases", cid, report) if "paraphrases" in case else []
        if any(not isinstance(p, str) or not p.strip() for p in paraphrases):
            report.error(f"{cid}: paraphrases must be non-empty strings")
        query_count += 1 + len(paraphrases)

        if not answers:
            report.error(f"{cid}: no answers listed")
        overlap = set(answers) & set(stale)
        if overlap:
            report.error(f"{cid}: files in both answers and stale: {sorted(overlap)}")
        if isinstance(scoring.get("top_n"), int) and mode == "all" and len(answers) > scoring["top_n"]:
            report.error(f"{cid}: mode 'all' with more answers than top_n can never hit")

        for name in answers + stale:
            if not check_filename(name, cid, report):
                continue
            beat = corpus / name
            if not beat.is_file():
                report.error(f"{cid}: referenced beat does not exist: {name}")
                continue
            superseder = marked_stale.get(name, "")
            if name in answers and superseder:
                report.error(
                    f"{cid}: answer beat {name} is superseded by {superseder}; "
                    "a superseded beat cannot be a current-truth answer"
                )
            if name in stale and not superseder and not case.get("unmarked_stale_ok"):
                report.error(
                    f"{cid}: stale beat {name} has no superseded_by marker; "
                    "set unmarked_stale_ok: true if this is a deliberate unmarked-stale trap"
                )

    if report.errors:
        for e in report.errors:
            print(f"ERROR: {e}", file=sys.stderr)
        print(f"FAIL: {len(report.errors)} error(s)", file=sys.stderr)
        return 1

    if "--stale-set" in sys.argv:
        print(json.dumps(marked_stale, indent=2, sort_keys=True))
        return 0

    print(
        f"OK: {len(cases)} cases / {query_count} scored queries valid against {corpus} "
        f"(top_n={scoring.get('top_n')}, bar={scoring.get('pass_rate')}, "
        f"{len(marked_stale)} marked-stale corpus beats)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
