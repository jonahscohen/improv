---
name: Installer bucket browser Task 1 - validated data file + test scaffold
description: browser-tree.json (single source of truth) + test-component-browser.sh built TDD; ported verbatim from the clickable prototype
type: project
relates_to: [decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 1 of the installer bucket-browser build. Worktree `installer-bucket-browser`, branch `feat/installer-bucket-browser`.

Built two files (TDD: failing test -> data -> passing test):

- `claude/hooks/test-component-browser.sh` - unit tests the bucket-tree data: (1) valid JSON, (2) every install.sh KEY lands in a bucket member set (completeness), (3) every hook named in the tree has a description. Written verbatim from the task spec.
- `claude/hooks/browser-tree.json` - the single source of truth for the browser. Ported the prototype's four JS objects (`T`, `HOOK_DESC`, `CLUSTERS`, `HOOKS`) into JSON. 11 buckets in prototype order (Foundation, Beats, Sidecoach, Justify, Tilt-lab, Lotus, Design Tools, Guardrails, Voice & chat, Dev surface, Personal); `section` core vs more from the prototype `featured:1` flag; `personal:true` on Personal. `hook_desc` carries all 55 HOOK_DESC entries verbatim.

Verification (all green):
- `bash claude/hooks/test-component-browser.sh` -> 3 passed, 0 failed.
- Independent cross-check script vs the prototype: HOOK_DESC 55/55 verbatim match; bucket order exact; all 19 hook-owning nodes' hook lists match CLUSTERS/HOOKS; cluster tag/desc auto-gen templates (`the N <c> hooks` / `The N hooks in the <c> cluster.`) and compHooks templates (`The N hooks <comp> installs. Toggle any on or off.`) match; every bucket/leaf tag+desc string appears verbatim in the prototype source.
- `bash -n` on the test script clean.

Key decision (case-mismatch resolution):
- The completeness test extracts install.sh KEYS case-sensitively and requires each (minus `skills`) to appear as a member `key`. Four CORE buckets are single install-components whose install keys are lowercase (`sidecoach`, `justify`, `tilt-lab`, `lotus`) while the prototype `T` displayed them capitalized.
- Why: a data file that drives `install.sh --only <key>` must key components by their real install key, not a display name (the prototype used display names as object keys only because it was a throwaway visual demo). So `key` = lowercase install key for those four; added a `label` field ("Sidecoach", "Justify", "Tilt-lab", "Lotus") to preserve the capitalized display for downstream renderers.
- How: minimal deviation - only those four buckets carry `label`; grouping buckets (Foundation, Beats, Design Tools, Guardrails, Voice & chat, Dev surface, Personal) keep their display name as `key` (they are not install keys, so no conflict) and members already use lowercase install keys.
- Downstream contract for later tasks: display name = `label` if present else `key`; the machine/install key is always `key`.

Committed only the two task files (browser-tree.json + test-component-browser.sh); install.sh and all other files untouched per the task scope.

Files touched:
- claude/hooks/browser-tree.json (new)
- claude/hooks/test-component-browser.sh (new)
