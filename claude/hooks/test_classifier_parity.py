import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
# hooks live at <repo>/claude/hooks, so the repo root is two levels up (the
# plan's single ".." assumed a flat <repo>/hooks layout - corrected here).
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
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


if __name__ == "__main__":
    try:
        import pytest
    except ImportError:
        pytest = None
    if pytest is not None:
        raise SystemExit(pytest.main([__file__, "-q"]))
    # Fallback when pytest is not installed: run test_* functions directly so
    # the suite stays runnable on a bare Python 3 (matches the hook runtime).
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
                print(f"PASS {_name} ({len(CORPUS['cases'])} cases)")
    print(f"\n{passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)
