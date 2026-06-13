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
