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


# --- Task 2: clause segmentation ---

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


def test_conjunction_boundary_is_word_not_prefix():
    # Regression: a comma followed by a word that merely STARTS with a
    # conjunction (", butter" starts with ", but") must NOT split. Only the
    # conjunction WORD (", and " here, followed by a non-word char) splits.
    text = "add salt, butter, and pepper to the gradient"
    spans = sl.segment_clauses(text)
    clauses = [text[a:b] for a, b in spans]
    # ", butter" did NOT split -> "salt, butter" stays inside one clause
    assert any("salt, butter" in c for c in clauses)
    # ", and" DID split -> a clause begins with "and pepper"
    assert any(c.strip().startswith("and pepper") for c in clauses)
    # exactly one split (the ", and"), so two clauses
    assert len(spans) == 2
    # still length-preserving
    assert "".join(text[a:b] for a, b in spans) == text
    # do not over-correct: a real ", and " still splits on its own
    assert len(sl.segment_clauses("ship it, and call it done")) == 2


# --- Task 3: sanitize + occurrence-aware informational blanking ---

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


# --- Task 3 adversarial edges (carry the prefix-collision lesson: a boundary
# that could over-consume real intent). The quoted-span frame is the analogue. ---

def test_blank_informational_quote_does_not_eat_following_intent():
    # the quoted span is blanked, but real intent AFTER the closing quote survives
    t = 'the brief said "make it production-ready" - now polish the hero from scratch'
    out = sl.blank_informational(t)
    assert "production-ready" not in out            # quoted evidence blanked
    assert "polish the hero from scratch" in out    # intent after the close survives
    assert len(out) == len(t)


def test_blank_informational_unclosed_quote_preserves_intent():
    # an opening quote with no close must NOT blank real downstream intent to EOL.
    # The protected token sits AFTER the opening quote, so a blank-to-EOL bug
    # would wrongly eat it - making this a real guard (token before the quote
    # would survive even a buggy impl and prove nothing).
    t = 'the memo said "ship it then polish the hero from scratch'
    out = sl.blank_informational(t)
    assert "polish the hero from scratch" in out    # survives: the quote never closes
    assert len(out) == len(t)


def test_sanitize_length_preserving_on_combined_regions():
    # code fence + inline code + URL + XML + transcript marker in one string;
    # every region blanked, real trailing intent survives, offsets preserved.
    t = ("check `code` and ```\nblock\n``` at https://x.io/y?z=1 "
         '<div class="x">body</div> [TURN 12: paste] then polish the hero')
    out = sl.sanitize(t)
    assert len(out) == len(t)
    for gone in ("code", "block", "x.io", "body", "TURN 12"):
        assert gone not in out, f"{gone!r} should be stripped"
    assert "polish the hero" in out                 # real intent outside regions survives


# --- Task 4: grouped-evidence scoring + clause-bound 3-state scope ---

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


# --- Task 4 adversarial edges (carry the lesson: test what the spec calls out) ---

def test_bare_ui_noun_does_not_prove_scope_but_qualified_does():
    # bare interface/header/layout are NOT in the registry's ui_evidence ->
    # an in-clause lexicon hit with only a bare noun is SCOPE_UNKNOWN, not IN_SCOPE
    for bare in ("interface", "header", "layout"):
        r = _eval(f"make the {bare} production-ready", "lane_ship")
        assert r["scope"] == "SCOPE_UNKNOWN", f"bare {bare!r} must not prove scope"
    # the qualified phrases ARE ui_evidence -> IN_SCOPE
    for qualified in ("user interface", "page header", "page layout"):
        r = _eval(f"make the {qualified} production-ready", "lane_ship")
        assert r["scope"] == "IN_SCOPE", f"{qualified!r} must prove scope"


def test_negator_alone_discards_to_not_in_scope():
    # a single negated occurrence with no other hit -> truly discarded:
    # NOT IN_SCOPE and zero score (guards the pure-discard path, not the
    # "a later clause saved it" path covered above)
    r = _eval("don't make the landing page production-ready", "lane_ship")
    assert r["scope"] != "IN_SCOPE"
    assert r["score"] == 0


if __name__ == "__main__":
    try:
        import pytest
    except ImportError:
        pytest = None
    if pytest is not None:
        raise SystemExit(pytest.main([__file__, "-q"]))
    # Fallback when pytest is not installed: run test_* functions directly so
    # the suite stays runnable on a bare Python 3 (matches the hook runtime,
    # which is pure stdlib - no third-party deps, per model-router-guard).
    import types
    passed = failed = 0
    for _name, _fn in sorted(globals().items()):
        if _name.startswith("test_") and isinstance(_fn, types.FunctionType):
            try:
                _fn()
            except Exception as _exc:  # noqa: BLE001 - report every failure
                failed += 1
                print(f"FAIL {_name}: {type(_exc).__name__}: {_exc}")
            else:
                passed += 1
                print(f"PASS {_name}")
    print(f"\n{passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)
