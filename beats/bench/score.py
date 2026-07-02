#!/usr/bin/env python3
"""score.py - score the beats retrieval engine against the recall benchmark.

Stage 3 of the beats next-evolution plan. This scorer never trusts the engine's
own claims: it drives the PUBLIC `beats.py search` CLI (a subprocess, not an
import) exactly as a cold session would, and applies benchmark.json's scoring
contract to the returned ranking.

Layered gates before any query runs (fail-loud, distinct exit codes):
  1. `validate.py` must exit 0 (schema / mapping / corpus integrity).
  2. the machine-derived marked-stale set comes from `validate.py --stale-set`
     (scorers MUST consume it, never re-derive it).
  3. the compiled artifacts must be FRESH: `beats.py verify` must be green; a
     stale index (exit 6) is recompiled and re-verified; a broken one (exit 4)
     is fatal.

Scoring (benchmark.json `scoring` block + bench/README.md):
  - every phrasing (question + each paraphrase) is one independent query;
  - mode 'any': HIT if >= 1 answer in top_n; satisfaction rank = best answer;
  - mode 'all': HIT if every answer in top_n; satisfaction rank = worst answer;
  - a query is a MISS if any stale beat ranks strictly above the satisfaction
    rank. Stale = the machine-derived set UNION the case's own `stale` list.
  - HARD invariant: no machine-derived stale beat may appear ANYWHERE in any
    result page. Supersession resolution guarantees this; a leak is an engine
    bug and aborts scoring with exit 4.

EXIT CODES
  0  pass  - hit rate >= scoring.pass_rate
  1  under - hit rate < scoring.pass_rate
  2  benchmark invalid (validate.py failed, or benchmark.json unloadable)
  4  engine / artifact broken (broken db, search failure, or a stale leak)
  6  could not get a fresh compile
"""

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent


def eprint(msg):
    print(msg, file=sys.stderr)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def tail(text, limit=800):
    text = (text or "").strip()
    return text if len(text) <= limit else text[-limit:]


def ensure_fresh(beats_path, common):
    """Return 0 when the compiled artifacts are fresh, else a scorer exit code.

    verify green -> 0. verify stale (6) -> recompile + re-verify. verify broken
    (4) or any other non-zero -> broken (4). A failed recompile that is an
    artifact error -> 4; otherwise could-not-get-fresh -> 6. `common` carries the
    benchmark-DERIVED --corpus (never a user override) so beats.py verifies and
    searches exactly the corpus validate.py read from benchmark.json.
    """
    v = run([sys.executable, str(beats_path), "verify", *common])
    if v.returncode == 0:
        return 0
    if v.returncode == 6:
        c = run([sys.executable, str(beats_path), "compile", *common])
        if c.returncode == 4:
            eprint("ENGINE BROKEN: recompile hit an artifact error (exit 4):")
            eprint(tail(c.stderr))
            return 4
        if c.returncode != 0:
            eprint(f"COULD NOT GET FRESH: recompile failed (exit {c.returncode}):")
            eprint(tail(c.stderr))
            return 6
        v2 = run([sys.executable, str(beats_path), "verify", *common])
        if v2.returncode == 4:
            eprint("ENGINE BROKEN: verify reports a broken artifact after recompile (exit 4):")
            eprint(tail(v2.stderr))
            return 4
        if v2.returncode != 0:
            eprint(f"COULD NOT GET FRESH: still not fresh after recompile "
                   f"(verify exit {v2.returncode}):")
            eprint(tail(v2.stderr))
            return 6
        return 0
    if v.returncode == 4:
        eprint("ENGINE BROKEN: beats.py verify reports a broken artifact (exit 4):")
        eprint(tail(v.stderr))
        return 4
    eprint(f"ENGINE BROKEN: beats.py verify returned unexpected exit {v.returncode}:")
    eprint(tail(v.stderr))
    return 4


def score_query(beats_path, phrasing, top_n, common):
    """Run one query through the public CLI. Returns (results, error, lexical).
    On any failure `results` is None and `error` is a printable string. `lexical`
    is True when the engine fell back to lexical-only for this query (it printed
    a VECTORS ABSENT warning), so the scorer can report the run's mode. `common`
    (the benchmark-derived --corpus) precedes `--`; `--` then guards a phrasing
    that starts with '-' from being parsed as an option."""
    r = run([sys.executable, str(beats_path), "search", "--json",
             "--top", str(top_n), *common, "--", phrasing])
    lexical = "VECTORS ABSENT" in (r.stderr or "")
    if r.returncode != 0:
        return None, f"search exited {r.returncode}: {tail(r.stderr)}", lexical
    try:
        return json.loads(r.stdout), None, lexical
    except json.JSONDecodeError as exc:
        return None, f"search JSON parse failed: {exc}: {tail(r.stdout, 400)}", lexical


def main():
    ap = argparse.ArgumentParser(
        description="Score the beats retrieval engine against the recall benchmark."
    )
    ap.add_argument("--benchmark", default=None,
                    help="benchmark tree locator (default: alongside this script). "
                         "validate.py is taken from its dir, beats.py from the parent, "
                         "and the SCORED file is always validate.py's sibling benchmark.json. "
                         "There is deliberately no corpus/build override: beats.py uses its "
                         "own defaults, the same corpus validate.py reads, so nothing diverges.")
    args = ap.parse_args()

    bench_arg = Path(args.benchmark).resolve() if args.benchmark else HERE / "benchmark.json"
    validate_path = bench_arg.parent / "validate.py"
    beats_path = bench_arg.parent.parent / "beats.py"
    # validate.py is hardcoded to read its OWN sibling benchmark.json, so the
    # scorer must load exactly that file - never a divergent --benchmark path -
    # or it could score one benchmark while validate.py checked another (a wrong
    # stale-set, or a scored file that was never validated). --benchmark only
    # locates the tree; the file that is scored is always validate.py's sibling.
    bench_path = validate_path.parent / "benchmark.json"

    try:
        bench = json.loads(bench_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        eprint(f"BENCHMARK INVALID: cannot load {bench_path}: {exc}")
        return 2
    if not isinstance(bench, dict):
        eprint("BENCHMARK INVALID: top level must be an object")
        return 2

    scoring = bench.get("scoring")
    if not isinstance(scoring, dict):
        eprint("BENCHMARK INVALID: 'scoring' must be an object")
        return 2
    top_n = scoring.get("top_n")
    pass_rate = scoring.get("pass_rate")
    if not (isinstance(top_n, int) and not isinstance(top_n, bool) and top_n > 0):
        eprint(f"BENCHMARK INVALID: scoring.top_n must be a positive integer, got {top_n!r}")
        return 2
    if not (isinstance(pass_rate, (int, float)) and not isinstance(pass_rate, bool)
            and 0 < pass_rate <= 1):
        eprint(f"BENCHMARK INVALID: scoring.pass_rate must be in (0, 1], got {pass_rate!r}")
        return 2
    cases = bench.get("cases")
    if not isinstance(cases, list) or not cases:
        eprint("BENCHMARK INVALID: 'cases' must be a non-empty list")
        return 2

    # Gate 1: structural validation must pass before we trust any mapping.
    v = run([sys.executable, str(validate_path)])
    if v.returncode != 0:
        eprint(f"BENCHMARK INVALID: validate.py failed (exit {v.returncode}); "
               "scorer will not run against an invalid benchmark:")
        eprint(tail(v.stderr) or tail(v.stdout))
        return 2

    # Gate 2: consume the machine-derived marked-stale set (do NOT re-derive it).
    s = run([sys.executable, str(validate_path), "--stale-set"])
    if s.returncode != 0:
        eprint(f"BENCHMARK INVALID: could not obtain --stale-set (exit {s.returncode}):")
        eprint(tail(s.stderr) or tail(s.stdout))
        return 2
    try:
        machine_stale = set(json.loads(s.stdout).keys())
    except (json.JSONDecodeError, AttributeError) as exc:
        eprint(f"BENCHMARK INVALID: --stale-set output not a JSON object: {exc}")
        return 2

    # Gate 3: require a fresh compile. Derive --corpus from the benchmark's OWN
    # `corpus` field, resolved the way validate.py resolves it (repo-relative,
    # repo = validate.py's grandparent). This is NOT a user override: it forces
    # beats.py verify/compile/search onto exactly the corpus validate.py checked,
    # even when the benchmark declares a non-default corpus. validate.py already
    # passed, so the field is a safe repo-relative path.
    # Mirror validate.py's own resolution EXACTLY: its HERE is the bench dir and
    # its REPO is HERE.parent.parent, so repo is two levels above the bench dir.
    repo = validate_path.parent.parent.parent
    corpus_path = (repo / bench.get("corpus", ".claude/memory")).resolve()
    common = ["--corpus", str(corpus_path)]
    rc = ensure_fresh(beats_path, common)
    if rc != 0:
        return rc

    total = 0
    hits = 0
    lexical_queries = 0
    topic_total = defaultdict(int)
    topic_hits = defaultdict(int)
    lines = []

    for case in cases:
        cid = case.get("id", "<no id>")
        topic = case.get("topic", "<no topic>")
        answers = case.get("answers", [])
        mode = case.get("mode", "any")
        case_stale = set(case.get("stale", []))
        stale_for_case = machine_stale | case_stale
        phrasings = [case.get("question", "")] + list(case.get("paraphrases", []))

        for idx, phrasing in enumerate(phrasings):
            total += 1
            topic_total[topic] += 1

            results, error, lexical = score_query(beats_path, phrasing, top_n, common)
            if lexical:
                lexical_queries += 1
            if results is None:
                eprint(f"ENGINE BROKEN: {cid}[{idx}] {phrasing!r}: {error}")
                return 4
            if not isinstance(results, list):
                eprint(f"ENGINE BROKEN: search returned a non-list JSON payload "
                       f"for {cid}[{idx}]: {type(results).__name__}")
                return 4

            rankmap = {}
            for item in results:
                # A malformed result item is an engine bug (exit 4), never an
                # uncaught traceback that would exit 1 and masquerade as "under bar".
                if not (isinstance(item, dict)
                        and isinstance(item.get("filename"), str)
                        and isinstance(item.get("rank"), int)
                        and not isinstance(item.get("rank"), bool)):
                    eprint(f"ENGINE BROKEN: malformed search result item for "
                           f"{cid}[{idx}]: {item!r}")
                    return 4
                fn = item["filename"]
                rk = item["rank"]
                if fn not in rankmap or rk < rankmap[fn]:
                    rankmap[fn] = rk

            # The scorer catches broken search output, it does not score it: the
            # benchmark forbids ties, so ranks must be a strict 1..N permutation
            # over unique filenames, and the page must honor --top (an engine that
            # over-returns could let a rank-50 answer count as a top_n hit). All
            # of these are engine bugs (exit 4), not a scoreable page.
            if len(results) > top_n:
                eprint(f"ENGINE BROKEN: search returned {len(results)} results for "
                       f"--top {top_n} on {cid}[{idx}]")
                return 4
            filenames = [item["filename"] for item in results]
            if len(set(filenames)) != len(filenames):
                eprint(f"ENGINE BROKEN: duplicate filenames in search results "
                       f"for {cid}[{idx}]: {filenames}")
                return 4
            if sorted(item["rank"] for item in results) != list(range(1, len(results) + 1)):
                eprint(f"ENGINE BROKEN: search ranks are not a strict 1..N ranking "
                       f"for {cid}[{idx}]: {[item['rank'] for item in results]}")
                return 4

            # HARD invariant: supersession resolution must keep every
            # machine-derived stale beat out of every result page.
            leaked = sorted(machine_stale & set(rankmap))
            if leaked:
                eprint(f"ENGINE BUG: machine-derived stale beat(s) leaked into results "
                       f"for {cid}[{idx}]: {leaked}. Supersession resolution must "
                       "guarantee this never happens.")
                return 4

            present = [a for a in answers if a in rankmap]
            if mode == "all":
                satisfied = bool(answers) and len(present) == len(answers)
                sat_rank = max(rankmap[a] for a in answers) if satisfied else None
            else:
                satisfied = bool(present)
                sat_rank = min(rankmap[a] for a in present) if satisfied else None

            miss_reason = None
            if not satisfied:
                miss_reason = (f"answer condition (mode {mode}) not met: "
                               f"present={present} of {answers}")
            else:
                offending = sorted(
                    (rankmap[f], f) for f in rankmap
                    if f in stale_for_case and rankmap[f] < sat_rank
                )
                if offending:
                    miss_reason = (f"stale beat(s) ranked above satisfaction rank "
                                   f"{sat_rank}: {offending}")

            if miss_reason is None:
                hits += 1
                topic_hits[topic] += 1
                lines.append(f"PASS {cid}[{idx}] {topic}")
            else:
                returned = [item["filename"] for item in results]
                lines.append(
                    f"MISS {cid}[{idx}] {topic} :: {miss_reason} :: "
                    f"returned={returned}"
                )

    for line in lines:
        print(line)

    rate = hits / total if total else 0.0
    if lexical_queries == 0:
        mode = "hybrid (lexical + vector RRF)"
    elif lexical_queries == total:
        mode = "lexical-only (no vectors / embedder unreachable)"
    else:
        mode = f"DEGRADED - {lexical_queries}/{total} queries fell back to lexical-only"
    print()
    print(f"MODE: {mode}")
    if lexical_queries:
        print("NOTE: the 90% gate is only meaningful in full hybrid mode; "
              "vectors were missing for at least one query above.")
    print(f"SCORE: {hits}/{total} queries hit = {rate:.4f} (bar {pass_rate})")
    print("per-topic:")
    for topic in sorted(topic_total):
        print(f"  {topic:<24} {topic_hits[topic]}/{topic_total[topic]}")

    bar = "#" * int(round(rate * 40))
    print(f"[{bar:<40}] {rate:.1%}")

    if rate >= pass_rate:
        print(f"OK: hit rate {rate:.4f} >= bar {pass_rate}")
        return 0
    eprint(f"UNDER BAR: hit rate {rate:.4f} < bar {pass_rate}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
