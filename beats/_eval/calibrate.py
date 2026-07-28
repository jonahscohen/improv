#!/usr/bin/env python3
"""Re-derive the beats abstention threshold from the committed evaluation set.

The threshold shipped in beats.py is a NUMBER, and this is the script that
produces it. Run it to check the number, to argue with the rule that produced
it, or to re-derive it after the corpus changes.

    python3 beats/_eval/calibrate.py                 # calibration set only
    python3 beats/_eval/calibrate.py --held-out      # add the held-out set
    python3 beats/_eval/calibrate.py --json          # machine-readable

The rule is fixed in PREREGISTRATION.md and is NOT a free parameter here:
T = the highest threshold whose false-abstention rate on the calibration set's
answerable questions stays at or below FA_BUDGET, placed at the midpoint between
the two adjacent positive order statistics that bracket it.

EXIT CODES (fail loud, never silent success):
  0  calibration completed and every assertion held
  2  usage error, or a committed eval file is missing/unparseable
  3  compiled index missing, unreadable, or carries no vectors
  4  VECTOR HALF DEAD - the embedder did not answer, so no cosine can be
     computed and no cosine threshold can be calibrated. This is NEVER
     downgraded to a warning: a silently lexical-only run would produce a
     confident-looking but meaningless threshold.
  5  eval set internally inconsistent (question/label mismatch, or a label
     naming a beat file that does not exist in the corpus)
"""

import argparse
import importlib.util
import json
import os
import sqlite3
import struct
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
BEATS_DIR = EVAL_DIR.parent
REPO = BEATS_DIR.parent
CORPUS = REPO / ".claude" / "memory"
DB_PATH = BEATS_DIR / ".build" / "beats.db"

FA_BUDGET = 0.05        # pre-registered false-abstention budget (see PREREGISTRATION.md)


def die(code, msg):
    print(f"CALIBRATION FAILED: {msg}", file=sys.stderr)
    sys.exit(code)


def load_beats_module():
    spec = importlib.util.spec_from_file_location("beatsmod", BEATS_DIR / "beats.py")
    if spec is None or spec.loader is None:
        die(2, f"cannot import {BEATS_DIR / 'beats.py'}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_json(path, code=2):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        # UnicodeDecodeError is explicitly included: a committed eval file that is
        # not valid UTF-8 is an unreadable eval file, and must land on this
        # tool's documented code rather than tracebacking out as exit 1.
        die(code, f"{path}: {exc}")


class Signals:
    """Computes top_cos for a query against the compiled index.

    Deliberately mirrors beats.py's own retrieval path (same sanitize_query,
    same INDEX_FILES exclusion, same cosine) rather than shelling out to
    `search`, because `search` does not print the cosine.
    """

    def __init__(self, beats):
        self.B = beats
        if not DB_PATH.exists():
            die(3, f"no compiled index at {DB_PATH} - run `beats.py compile`")
        try:
            self.con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
            row = self.con.execute(
                "SELECT embed_dim, vectors_present, embed_model, corpus_hash "
                "FROM meta").fetchone()
            self.existing = {r[0] for r in
                             self.con.execute("SELECT filename FROM beats").fetchall()}
            self.vec_rows = self.con.execute(
                "SELECT filename, dim, vec FROM beats_vec").fetchall()
        except sqlite3.Error as exc:
            die(3, f"index unreadable: {exc}")
        if not row or not row[1] or not self.vec_rows:
            die(3, "compiled index carries no vectors - abstention needs the vector half")

        # A threshold read off a stale, partial, or wrong-model index is a
        # confident number describing a setup nobody is running. Every one of
        # these is a hard stop, never a warning.
        dim_val = row[0]
        if not isinstance(dim_val, int) or isinstance(dim_val, bool) or dim_val <= 0:
            die(3, f"meta.embed_dim is not a positive integer: {dim_val!r}")
        self.dim = dim_val

        # Vector table must cover the beats table exactly - a partial beats_vec
        # would silently calibrate against a subset of the corpus.
        vec_names = {r[0] for r in self.vec_rows}
        if len(self.vec_rows) != len(self.existing) or vec_names != self.existing:
            die(3, f"beats_vec desynced with beats (vec {len(self.vec_rows)}, "
                   f"beats {len(self.existing)}, names match "
                   f"{vec_names == self.existing})")

        # The stored model AND the live query-time model must both be the one the
        # threshold is meant for; a same-width different model yields cross-space
        # cosines that look fine and mean nothing.
        stored_model = row[2] if isinstance(row[2], str) else ""
        if stored_model != beats.ABSTAIN_MODEL:
            die(3, f"index was compiled with {stored_model!r}, not the calibrated "
                   f"{beats.ABSTAIN_MODEL!r}")
        if beats.EMBED_MODEL != beats.ABSTAIN_MODEL:
            die(4, f"query embedder is {beats.EMBED_MODEL!r}, not the calibrated "
                   f"{beats.ABSTAIN_MODEL!r}; cosines would be cross-space")
        if self.dim != beats.ABSTAIN_DIM:
            die(3, f"index dim {self.dim} != calibrated dim {beats.ABSTAIN_DIM}")

        # Freshness: calibrating against an index that no longer matches the
        # corpus produces a threshold for a corpus that does not exist.
        current = beats.compute_corpus_hash(CORPUS)
        if current is None:
            die(3, f"could not hash the corpus at {CORPUS} to confirm freshness")
        if current != row[3]:
            die(3, "compiled index is STALE vs the corpus on disk - run "
                   "`beats.py compile` before calibrating")

    def top_cos(self, query):
        qvec = self.B.embed_text(query)
        if qvec is None:
            die(4, "VECTORS ABSENT: embedder unreachable "
                   f"({self.B.embed_text.last_error or 'no response'}); "
                   "a cosine threshold cannot be calibrated lexical-only")
        if len(qvec) != self.dim:
            die(4, f"VECTORS ABSENT: query dim {len(qvec)} != index dim {self.dim}")
        best = None
        for filename, dim, blob in self.vec_rows:
            if filename in self.B.INDEX_FILES or filename not in self.existing:
                continue
            if dim != self.dim or not isinstance(blob, (bytes, bytearray)) \
                    or len(blob) != self.dim * 4:
                die(3, f"corrupt stored vector for {filename}")
            sim = self.B.cosine_unit(qvec, struct.unpack(f"<{self.dim}f", blob))
            if best is None or sim > best:
                best = sim
        if best is None:
            # Every row skipped means nothing was actually compared; returning a
            # sentinel like -1.0 would score as "abstain" on every case and look
            # like a spectacular result.
            die(3, "no comparable vectors in the index (every row was skipped)")
        return best


def check_shape(questions, labels, tag):
    """Validate eval-file structure up front, so a malformed set exits 5 rather
    than tracebacking out with exit 1 and no failure class."""
    if not isinstance(questions, list) or not isinstance(labels, list):
        die(5, f"{tag}: questions and labels must both be JSON arrays")
    qids, lids = [], []
    for q in questions:
        if not isinstance(q, dict) or "id" not in q or "q" not in q:
            die(5, f"{tag}: question entry is not an object with id and q: {q!r}")
        # ids must be STRINGS: an unhashable or mixed-type id would blow up the
        # dedupe/set/sorted diagnostics below with a TypeError and escape as
        # exit 1 instead of landing on this tool's eval-set failure class.
        if not isinstance(q["id"], str) or not q["id"].strip():
            die(5, f"{tag}: question id must be a non-empty string: {q['id']!r}")
        if not isinstance(q["q"], str) or not q["q"].strip():
            die(5, f"{tag}: question {q['id']!r} has an empty or non-string q")
        qids.append(q["id"])
    for l in labels:
        if not isinstance(l, dict) or "id" not in l or "answers" not in l:
            die(5, f"{tag}: label entry is not an object with id and answers: {l!r}")
        if not isinstance(l["id"], str) or not l["id"].strip():
            die(5, f"{tag}: label id must be a non-empty string: {l['id']!r}")
        if not isinstance(l["answers"], list) \
                or not all(isinstance(a, str) for a in l["answers"]):
            die(5, f"{tag}: label {l['id']!r} answers must be a list of filenames")
        lids.append(l["id"])
    for name, ids in (("question", qids), ("label", lids)):
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            die(5, f"{tag}: duplicate {name} ids: {sorted(dupes)}")
    if set(qids) != set(lids):
        die(5, f"{tag}: question ids and label ids differ "
               f"(only in questions: {sorted(set(qids) - set(lids))}; "
               f"only in labels: {sorted(set(lids) - set(qids))})")


def check_labels(cases):
    """A label naming a beat that does not exist is a broken eval set, not a miss."""
    on_disk = {p.name for p in CORPUS.glob("*.md")}
    for c in cases:
        for fn in c["answers"]:
            if fn not in on_disk:
                die(5, f"{c['id']} labels a non-existent beat: {fn}")


def rates(cases, T):
    pos = [c for c in cases if c["answerable"]]
    neg = [c for c in cases if not c["answerable"]]
    fa = [c["id"] for c in pos if c["top_cos"] < T]
    ca = [c["id"] for c in neg if c["top_cos"] < T]
    return {
        "n_answerable": len(pos), "n_unanswerable": len(neg),
        "false_abstentions": len(fa), "correct_abstentions": len(ca),
        "false_abstention_rate": len(fa) / len(pos) if pos else None,
        "correct_abstention_rate": len(ca) / len(neg) if neg else None,
        "false_abstention_ids": fa, "correct_abstention_ids": ca,
    }


def derive_T(cases):
    """The pre-registered rule. Not a free parameter."""
    pos = sorted(c["top_cos"] for c in cases if c["answerable"])
    if len(pos) < 2:
        die(5, "need at least 2 answerable cases to place a threshold")
    budget = int(FA_BUDGET * len(pos))
    lo = pos[budget - 1] if budget >= 1 else 0.0
    hi = pos[budget]
    return round((lo + hi) / 2, 4), budget, lo, hi


def auc(cases, key="top_cos"):
    pos = [c[key] for c in cases if c["answerable"]]
    neg = [c[key] for c in cases if not c["answerable"]]
    if not pos or not neg:
        return None
    w = sum(1 for p in pos for n in neg if p > n)
    t = sum(1 for p in pos for n in neg if p == n)
    return (w + 0.5 * t) / (len(pos) * len(neg))


def loo_cv(cases):
    """Leave-one-out CV: re-derive T without the held-out case, then score it.

    With samples this small a threshold read off the same data it was fitted to
    means little. LOO re-runs the WHOLE rule per fold, so the reported rates are
    not the rates of a threshold that already saw the case it is judging.
    """
    fa = fa_n = ca = ca_n = 0
    for i, case in enumerate(cases):
        rest = cases[:i] + cases[i + 1:]
        if sum(1 for c in rest if c["answerable"]) < 2:
            continue
        T, _, _, _ = derive_T(rest)
        if case["answerable"]:
            fa_n += 1
            fa += case["top_cos"] < T
        else:
            ca_n += 1
            ca += case["top_cos"] < T
    return {"false_abstention_rate": fa / fa_n if fa_n else None,
            "correct_abstention_rate": ca / ca_n if ca_n else None,
            "n_answerable": fa_n, "n_unanswerable": ca_n}


def build_cases(sig, questions, labels_by_id):
    cases = []
    for q in questions:
        if q["id"] not in labels_by_id:
            die(5, f"question {q['id']} has no label")
        answers = labels_by_id[q["id"]]
        cases.append({"id": q["id"], "q": q["q"], "answers": answers,
                      "answerable": len(answers) > 0,
                      "top_cos": sig.top_cos(q["q"])})
    return cases


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--held-out", action="store_true",
                    help="also score the held-out set (heldout_questions/labels.json)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--build", default=None,
                    help="override the build dir (default: beats/.build). Exists so "
                         "the fail-loud paths can be exercised against a mutated copy "
                         "of the index instead of the live one.")
    args = ap.parse_args()

    global DB_PATH
    if args.build:
        DB_PATH = Path(args.build).resolve() / "beats.db"

    beats = load_beats_module()
    if os.environ.get("BEATS_EMBED_STUB"):
        die(4, "BEATS_EMBED_STUB is set - the stub embedder cannot calibrate a "
               "real threshold; unset it and run against the real embedder")
    sig = Signals(beats)

    questions = load_json(EVAL_DIR / "questions.json")
    labels = load_json(EVAL_DIR / "labels.json")
    check_shape(questions, labels, "calibration set")
    if len(questions) != len(labels):
        die(5, f"{len(questions)} questions but {len(labels)} labels")
    by_id = {l["id"]: l["answers"] for l in labels}
    cal = build_cases(sig, questions, by_id)
    check_labels(cal)

    T, budget, lo, hi = derive_T(cal)
    out = {"threshold": T, "fa_budget": FA_BUDGET, "budget_cases": budget,
           "bracketing_order_stats": [lo, hi],
           "calibration": rates(cal, T), "calibration_auc": auc(cal)}

    pooled = list(cal)
    hq = EVAL_DIR / "heldout_questions.json"
    hl = EVAL_DIR / "heldout_labels.json"
    if args.held_out:
        if not hq.exists() or not hl.exists():
            die(2, f"--held-out needs {hq.name} and {hl.name}")
        hqs = load_json(hq)
        hls = load_json(hl)
        check_shape(hqs, hls, "held-out set")
        overlap = {q["id"] for q in hqs} & {q["id"] for q in questions}
        if overlap:
            die(5, f"held-out set shares ids with the calibration set: "
                   f"{sorted(overlap)} - the held-out set must be disjoint")
        h_by_id = {l["id"]: l["answers"] for l in hls}
        held = build_cases(sig, hqs, h_by_id)
        check_labels(held)
        out["held_out"] = rates(held, T)
        out["held_out_auc"] = auc(held)
        pooled += held
        out["pooled"] = rates(pooled, T)
        out["pooled_auc"] = auc(pooled)
        out["pooled_loo_cv"] = loo_cv(pooled)

        # Label sensitivity. An independent reviewer disputed three NONE labels as
        # "answerable by recency/aggregation" rather than genuinely unanswerable.
        # That is a definitional call, and it moves the headline in BOTH directions
        # (fewer negatives to catch, more positives to wrongly abstain on), so the
        # rates are reported under both readings instead of one being picked.
        cpath = EVAL_DIR / "contested_labels.json"
        if cpath.exists():
            cdoc = load_json(cpath)
            if not isinstance(cdoc, dict) or not isinstance(cdoc.get("contested"), list):
                die(5, f"{cpath.name}: expected an object with a 'contested' array")
            contested = set()
            for c in cdoc["contested"]:
                if not isinstance(c, dict) or "id" not in c:
                    die(5, f"{cpath.name}: contested entry lacks an id: {c!r}")
                if not isinstance(c["id"], str) or not c["id"].strip():
                    die(5, f"{cpath.name}: contested id must be a non-empty "
                           f"string: {c['id']!r}")
                contested.add(c["id"])
            known = {c["id"] for c in pooled}
            unknown = contested - known
            if unknown:
                die(5, f"{cpath.name} names ids absent from the eval set: "
                       f"{sorted(unknown)}")
            flipped = [dict(c, answerable=True) if c["id"] in contested else c
                       for c in pooled]
            out["contested_ids"] = sorted(contested)
            out["pooled_reviewer_reading"] = rates(flipped, T)
            out["pooled_reviewer_reading_auc"] = auc(flipped)

    if args.json:
        print(json.dumps(out, indent=1))
        return 0

    print(f"threshold T = {T}")
    print(f"  rule: highest T with false-abstention <= {FA_BUDGET:.0%} "
          f"({budget}/{out['calibration']['n_answerable']} cases), midpoint of "
          f"[{lo:.4f}, {hi:.4f}]")
    for name in ("calibration", "held_out", "pooled"):
        r = out.get(name)
        if not r:
            continue
        a = out.get(f"{name}_auc")
        print(f"\n{name.upper()}  (n={r['n_answerable']} answerable, "
              f"{r['n_unanswerable']} unanswerable, AUC={a:.3f})" if a is not None
              else f"\n{name.upper()}")
        print(f"  false abstention   {r['false_abstentions']}/{r['n_answerable']} "
              f"= {r['false_abstention_rate']:.1%}   (the cost)  {r['false_abstention_ids']}")
        print(f"  correct abstention {r['correct_abstentions']}/{r['n_unanswerable']} "
              f"= {r['correct_abstention_rate']:.1%}   (the benefit) "
              f"{r['correct_abstention_ids']}")
    if "pooled_reviewer_reading" in out:
        r = out["pooled_reviewer_reading"]
        print(f"\nPOOLED under the REVIEWER's reading of the contested labels "
              f"({', '.join(out['contested_ids'])} counted as ANSWERABLE)")
        print(f"  (n={r['n_answerable']} answerable, {r['n_unanswerable']} unanswerable, "
              f"AUC={out['pooled_reviewer_reading_auc']:.3f})")
        print(f"  false abstention   {r['false_abstentions']}/{r['n_answerable']} "
              f"= {r['false_abstention_rate']:.1%}   (the cost)")
        print(f"  correct abstention {r['correct_abstentions']}/{r['n_unanswerable']} "
              f"= {r['correct_abstention_rate']:.1%}   (the benefit)")
    if "pooled_loo_cv" in out:
        c = out["pooled_loo_cv"]
        print(f"\nPOOLED LEAVE-ONE-OUT CV (threshold re-derived per fold)")
        print(f"  false abstention   {c['false_abstention_rate']:.1%} "
              f"(n={c['n_answerable']})")
        print(f"  correct abstention {c['correct_abstention_rate']:.1%} "
              f"(n={c['n_unanswerable']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
