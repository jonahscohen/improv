---
name: sidecoach_intent_ambiguity_issue
description: Intent detection returns equal-confidence matches without tie-breaking; orchestrator doesn't use recommendation field when ambiguous
type: feedback
relates_to: [session_2026-05-22_orchestrator_debugging.md]
supersedes: []
superseded_by: []
---

## Issue: Intent Detection Ambiguity Without Tie-Breaking

**Symptom:** Running `/sidecoach audit http://localhost:8766/` returns ambiguous candidates instead of executing. Both `flowK_multi_lens_audit` and `flow3_audit_page` match at exactly 0.85 confidence.

**Root Cause:** 
1. Intent detector returns `DisambiguationResult` with `isAmbiguous=true` and a `recommendation` field (the top-confidence match)
2. Orchestrator checks ambiguity at line 659 and short-circuits with "Please clarify" response
3. Never reaches line 674 where it would use the recommendation field
4. System requires explicit user clarification even when a clear recommendation exists

**Code Pattern (sidecoach-orchestrator.ts line 659-672):**
```typescript
if ((detection as DisambiguationResult).isAmbiguous && !(detection as MatchResult).flowId) {
  // Returns ambiguous candidates WITHOUT using recommendation
  return { success: false, message: 'Your request could match multiple flows. Please clarify.' };
}
```

**Flow Detector Confidence Clash:**
- `flowK_multi_lens_audit`: matches 'audit', 'technical', 'comprehensive' → 0.85
- `flow3_audit_page`: matches 'audit' → 0.85
- Both are equally weighted on the 'audit' keyword despite additional specificity

**User Impact:** Cannot invoke audits via natural language without explicit disambiguation even when intent is clear (recommendation exists but is ignored).

**Status:** Known issue from 2026-05-22 debugging session; affects interactive command routing. Not yet resolved. Workaround: must choose between flows explicitly or use very specific utterances that trigger only one detector.

**How to apply:** When running Sidecoach audits, expect ambiguity and be prepared to pick from listed candidates. The system will not auto-select the top recommendation.
