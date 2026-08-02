#!/usr/bin/env python3
"""Assemble the installer GUI manifest.

argv[1] = path to browser-tree.json (structure, already JSON).
stdin   = {"state": {path: "none|partial|active"}, "components": {key: {...}}, "personal": bool}
stdout  = {"buckets": [...], "components": {...}, "state": {...}, "meta": {...}}

Pure: reads inputs, writes JSON, no side effects. The bash caller computes state
(needs the runtime probe) and dumps component metadata; python owns all escaping.
"""
import json, sys

def main():
    with open(sys.argv[1]) as f:
        tree = json.load(f)
    payload = json.load(sys.stdin)
    personal = bool(payload.get("personal"))

    buckets = []
    for b in tree.get("buckets", []):
        if b.get("personal") and not personal:
            continue
        buckets.append({
            "key": b["key"],
            "label": b.get("label", b["key"]),
            "tag": b.get("tag", ""),
            "desc": b.get("desc", ""),
            # A product-level blurb, distinct from desc's install mechanics. Only
            # a single-component bucket needs it: a group's own desc already
            # reads as this intro, since its members carry the install-specific
            # text separately (see Beats vs "memory").
            "intro": b.get("intro", ""),
            "section": b.get("section", ""),
            "members": b.get("members", []),
        })

    print(json.dumps({
        "buckets": buckets,
        # Hook explanations live in the tree beside the ownership map. They were
        # assembled but never forwarded, so every hook row rendered blank.
        "hook_desc": tree.get("hook_desc", {}),
        "components": payload.get("components", {}),
        "state": payload.get("state", {}),
        "meta": {"personal": personal},
    }))

if __name__ == "__main__":
    main()
