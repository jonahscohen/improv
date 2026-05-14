---
name: Improv changes panel - markDone isolation and Undo Done button
description: Fixed markDone to only mark first unreviewed entry; added Undo Done button for reviewed entries
type: project
---

## Changes

- Fixed `setOnDone` callback in ImprovCore (index.ts) to use `find()` instead of `for` loop - only marks the FIRST unreviewed entry matching the promptId, not all matches
- Added `onUndoDoneCallback` property and `setOnUndoDone` setter to ChangesPanel (changes-panel.ts)
- Added "Undo Done" button in render() for reviewed entries (else block after the `!entry.reviewed` check)
- Wired `setOnUndoDone` in ImprovCore: finds first reviewed entry matching promptId, sets reviewed=false, persists to localStorage, updates badge, re-syncs panel

## Files touched

- improv/core/changes-panel.ts
- improv/core/index.ts

Collaborator: Jonah
