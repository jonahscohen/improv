---
name: Cleaned test-pollution lane sessions from the real flow-history (backed up + verified)
description: removed the 20 temp-path test sessions (lane:lane_build:* entries) that the unisolated mcp-server lane tests wrote into the real ~/.claude/sidecoach-flow-history.json before the HOME-isolation fix; backed up first, surgically removed only pure-test temp sessions, verified the real default session (18 genuine flows) intact + zero lane pollution
type: project
relates_to: [session_2026-06-14_mcp-test-flow-history-pollution.md, session_2026-06-14_p4b2-COMPLETE.md]
---

Took up Jonah's standing offer to clean the test pollution from the real
~/.claude/sidecoach-flow-history.json (the entries the unisolated mcp-server lane
tests wrote before the P4b-2 HOME-isolation fix).

**Inspection (21 top-level sessions):**
- 1 LEGIT: `default` - 18 genuine flows (flowA_brand_verify ... flowX_copywriting),
  0 lane: entries, no laneFencing. The user's real history.
- 20 TEST-POLLUTION: all keyed by /private/var/folders/.../T/{lane-ru,mcp-ru,
  mcp-ru2,p4d-lane-proj}-* temp paths, each containing ONLY lane:lane_build:shape
  (a couple also :craft) + laneFencing. No mixed sessions.

**Action (safe + verified):**
1. Backup: ~/.claude/sidecoach-flow-history.json.bak-pre-lane-cleanup-20260615-004341
   (1404593 bytes, the full pre-cleanup file).
2. Surgical removal (atomic tmp+rename, validated before replace): dropped the 20
   temp-path sessions whose flows were ALL lane:-prefixed; defensively stripped any
   stray lane: flow/flowSequence/laneFencing from KEPT sessions (no-op - default had
   none).
3. Verified: valid JSON; sessions 21 -> 1 (default only); default's 18 flows intact;
   lane: pollution remaining ANYWHERE = 0 (structured scan + raw grep both 0). File
   1404593 -> 1371636 bytes.

If anything looks off, the backup restores the exact prior state.

Collaborator: Jonah.
