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
