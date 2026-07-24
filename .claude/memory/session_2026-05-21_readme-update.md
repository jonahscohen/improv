---
name: Sidecoach v3 README Updated
description: Updated README.md to document 36 flows, 5 core systems, tier structure, and v3 architecture
type: project
---

## README.md Complete Rewrite

Updated from outdated "14 flows" documentation to comprehensive v3 guide covering:

### Updated Sections

1. **Title & Intro**
   - Changed from "Invisible Workflow Automation" to "Design System Guardian"
   - Clarified v3's phase-gating and flow chaining model
   - Explained prerequisite enforcement and progression

2. **Architecture Section**
   - Documented 5 new core systems:
     - DeterministicValidator (hard-blocking gates)
     - RegressionDetector (output degradation detection)
     - ProjectPersonaEngine (async LLM persona extraction)
     - DesignDebtTracker (persistent debt logging)
     - OracleDetectBridge (npx oracle detect integration)
   - Explained gate rules for each tier

3. **The 36 Flows**
   - Tier 1 (A-E): Strategy & Research
   - Tier 2 (F-I): Build
   - Tier 3 (J-P): Polish  
   - Tier 4/5 (Q-T): Specialized
   - Special (U-V): Curate & All-Seven QA
   - Legacy (1-14): Original flows
   - Each with trigger patterns and purpose

4. **Flow Execution Description**
   - Updated to reflect tier progression
   - Prerequisite enforcement flow
   - Regression detection
   - Design debt tracking

5. **Deployment & Testing**
   - Updated quick start for v3
   - Testing examples for all 36 flows
   - Handler registration in orchestrator

### Files Modified
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/README.md` - Complete rewrite

### Status: ✓ Complete
README now accurately reflects Sidecoach v3 architecture, all 36 flows, and 5 core systems. Ready for user reference and onboarding.
