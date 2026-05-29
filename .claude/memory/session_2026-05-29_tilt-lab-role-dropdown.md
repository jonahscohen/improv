---
name: tilt-lab role filter -> dropdown
description: Replaced the BrowseGrid role-filter pill row (all/background/midground/pointer/post) with the Select primitive (5 options -> styled native dropdown), per Jonah's screenshot request. Chrome-verified filtering.
type: project
relates_to: [session_2026-05-29_tilt-lab-taste-DONE.md]
---

Collaborator: Jonah. 2026-05-29. Screenshot feedback: the role filter "should be a dropdown."

Change: BrowseGrid.tsx role filter pills -> `<Select value={role ?? 'all'} options={['all',...ROLES]} onChange={v => setRole(v==='all'?null:v as LayerRole)} ariaLabel="Filter by role" />`. 5 options (>4) so the Select primitive renders its styled native dropdown. Frees the second pill row -> more cards visible.
Verify: tsc clean, BrowseGrid 3/3 tests pass. Chrome: dropdown shows "all"; selecting "post" filtered to the 4 POST effects + count -> "4 EFFECTS"; focus ring present.
Minor: old `.browse-grid__roles button` pill CSS in global styles.css now dead (wrapper kept) - cleanup with the other dead-CSS sweep.

## Files
- app/src/components/BrowseGrid.tsx
