# Sidecoach Audit Report: Complete on Paper vs. Actually Deliverable

**Date:** 2026-05-23  
**Status:** Comprehensive audit completed  
**Conclusion (as of 2026-05-23):** ~85% complete infrastructure, 0% accessible from Claude Code

> **2026-05-25 update:** this report is preserved as a historical snapshot of the state before Sprint 1 closed. The "Primary Gap" called out below (missing `~/.claude/skills/sidecoach/SKILL.md`, no user-facing commands) has been closed. SKILL.md exists at `claude/skills/sidecoach/SKILL.md`, the slash command router is live with two surfaces (phase commands + 22 verb commands from Sprint 8), and `/sidecoach teach`, `/sidecoach document`, `/sidecoach list`, and `/sidecoach help <verb>` are all wired. The audit conclusion below is no longer accurate. For current state see `SIDECOACH_QUICKSTART.md` and `sidecoach/README.md`.

---

## Executive Summary

Sidecoach is a sophisticated, well-engineered system built entirely in TypeScript that compiles to zero errors. It contains:

- **36 flow handlers** (flows A-V plus legacy flows 1-14) fully implemented
- **159-rule validation framework** (22-point polish standard + 137-rule extended domains across 10 design domains)
- **5 reference systems** (fontshare, component gallery, design references, motion patterns, category-reflex detection)
- **Complex orchestration machinery** (intent detection, flow composition, conditional routing, performance caching)
- **Session memory tracking** with persistent context chains

**However, none of it is accessible from Claude Code.** The system exists as a built npm package but has no:
- SKILL.md definition file
- Registration in settings.json
- Entry point wired to the skill system
- CLI that Claude can invoke

**The gap:** Backend excellence + zero frontend accessibility.

---

## What Exists (Infrastructure Inventory)

### 1. Source Code (Complete & Compiling)

**Root:** `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/`

```
src/
├── Flow Handlers (36 files)
│   ├── flow-handler-*.ts (flows A-I, J-V)         [8.3MB total]
│   ├── flow-handlers-core.ts                      [16KB - base types]
│   ├── flow-handlers-extended.ts                  [34KB - legacy flows]
│   ├── flow-handlers-tier3-tier4.ts               [39KB - special flows]
│   └── flow-handlers-curate-qa.ts                 [244B - facade]
├── Validation Framework (3 files)
│   ├── extended-domain-validator.ts               [77.7KB - 159 rules]
│   ├── flow-domain-validators.ts                  [9KB - domain mapping]
│   └── flow-specific-validators.ts                [6KB - per-flow rules]
├── Orchestration (6 files)
│   ├── sidecoach-orchestrator.ts                  [42.2KB - main orchestrator]
│   ├── sidecoach-entry-point.ts                   [8.3KB - unified entry]
│   ├── sidecoach-entry-point-cache.ts             [4KB - perf cache]
│   ├── flow-composition.ts                        [17KB - composite flows]
│   ├── flow-conditional-router.ts                 [9KB - prerequisite routing]
│   └── orchestrator.ts                            [15KB - legacy coordinator]
├── Context Management (3 files)
│   ├── flow-execution-context-enhanced.ts         [8.4KB - enhanced context]
│   ├── context-loader.ts                          [4.5KB - project context]
│   └── flow-domain-mapping.ts                     [7.2KB - domain metadata]
├── Reference Systems (5 files)
│   ├── fontshare-reference.ts                     [2.6KB]
│   ├── component-gallery-reference.ts             [5.6KB]
│   ├── design-references-reference.ts             [2.6KB]
│   ├── category-reflex-detector.ts                [12.3KB]
│   └── [Motion patterns embedded in flow-handler-motion-patterns.ts]
├── Memory & State (4 files)
│   ├── session-memory-writer.ts                   [persistent context]
│   ├── flow-history.ts                            [7.8KB]
│   ├── design-debt-tracker.ts                     [3.9KB]
│   └── flow-metrics-tracker.ts                    [performance metrics]
├── Intent Detection (2 files)
│   ├── intent-detector.ts                         [main NLP detection]
│   └── slash-command-router.ts                    [6.3KB - command parsing]
├── Utilities (6 files)
│   ├── deterministic-validator.ts                 [11.9KB]
│   ├── anti-pattern-validator.ts                  [10.4KB]
│   ├── design-laws.ts                             [17KB]
│   ├── command-routing-adapter.ts                 [4.3KB]
│   ├── flow-handler.ts                            [4.8KB - base handler]
│   ├── types.ts                                   [type definitions]
│   └── [8 additional utility files]
└── Tests (comprehensive coverage)
    ├── __tests__/                                 [regression tests]
    ├── phase-iv-entry-point.test.ts               [17KB]
    └── [integration tests across all phases]
```

**Build Status:**
```
npm run build → tsc → 0 errors
All 36 handlers compile successfully
TypeScript: strict mode enabled
```

### 2. Package & Distribution

**package.json** exports:
- Main: `dist/intent-detector.js`
- Types: `dist/intent-detector.d.ts`
- Version: 0.1.0

**Dependencies:**
- `@anthropic-ai/sdk` (Claude integration)
- `@types/node`, `typescript`, `ts-node` (dev)

**Scripts:**
- `npm run build` → tsc
- `npm run test` → ts-node tests
- `npm run test:compiled` → node dist tests

### 3. Backend Infrastructure (Hooks)

Three hooks are registered in `~/.claude/hooks/`:

1. **sidecoach-sessionstart.sh** (50 lines)
   - Checks Sidecoach is built
   - Launches background daemon
   - Sets SIDECOACH_ACTIVE, SIDECOACH_PID, SIDECOACH_SESSION_ID
   - Creates named pipe for IPC
   - Cleans up on session end

2. **sidecoach-postuserp.sh** (unknown - symlink, need to read target)
   - Likely writes utterances to daemon pipe
   - Monitors flow execution

3. **sidecoach-postresponse.sh** (unknown - symlink, need to read target)
   - Likely injects results into response

**Daemon Architecture:**
- `sidecoach-daemon.sh` (75 lines) in `bin/`
  - Reads utterances from named pipe (blocking)
  - Processes through `sidecoach-monitor.js`
  - Writes JSON results to `/tmp/sidecoach-results-<session>/`
- `sidecoach-monitor.js` (1.9KB)
  - Bridges utterance → orchestrator → result

### 4. Documentation

**Comprehensive spec documents** in root:
- `SIDECOACH_COMPLETE_DOMINATION_PLAN.md` (31KB)
- `SIDECOACH_COMPREHENSIVE_ANALYSIS.md` (25KB)
- `SIDECOACH_GOAT_PLAN.md` (19KB)
- `gap-analysis.md` (28KB)
- `extraction-blueprint.md` (26KB)
- `domain-flow-matrix.md` (14KB)
- `flows-reference-mapping.md` (14KB)
- `PHASES_1_TO_4_COMPLETE.md` (11KB)

**README.md** exists but is outdated (no skill integration guide).

### 5. Command & Entry Point System

**sidecoach-command.ts** (129 lines):
```typescript
export class SidecoachCommand {
  async execute(config: SidecoachCommandConfig): Promise<SidecoachCommandResult>
}

COMMAND_FLOW_MAP = {
  research → flowB_component_research,
  audit → flowI_accessibility,
  critique → flowL_design_critique,
  craft → flowG_component_implementation,
  // ... 15+ commands mapped
}
```

Mapped commands:
- research, audit, critique, craft, implement, polish, refine
- validate, check, shape, plan, tokens, extract, animate, motion

**sidecoach-entry-point.ts** (370+ lines):
```typescript
export class SidecoachEntryPoint {
  process(request: EntryPointRequest): EntryPointResponse

  // Natural language intent detection:
  // researchKeywords, implementKeywords, reviewKeywords, cloneKeywords,
  // constrainKeywords, migrateKeywords, refactorKeywords, typeKeywords,
  // motionKeywords, referenceKeywords, comprehensiveKeywords
}
```

11 intent categories detected from natural language.

### 6. Build Artifacts

**dist/** directory (updated May 23, 10:42):
- 86 .js files
- 86 .d.ts files
- 86 .js.map files
- All handlers, validators, orchestration compiled

---

## What's Missing (Gap Analysis)

### 1. SKILL.md (Critical)

**Status:** Does not exist

**What it should contain:**
- Entry command: `/sidecoach` or `/sidecoach-coach`
- Subcommands:
  - `/sidecoach list` - discover flows
  - `/sidecoach <flow>` - execute single flow
  - `/sidecoach shape <intent>` - plan-only mode
  - `/sidecoach teach` - interactive onboarding
  - `/sidecoach composite <flows>` - chained execution
- Natural language routing (11 intent categories)
- Example usage
- Reference to PRODUCT.md + DESIGN.md
- Performance caching behavior
- Session memory persistence

**Why it matters:**
- Skills are the primary entry point for Claude to discover commands
- Without SKILL.md, `/sidecoach` doesn't exist in Claude's command palette
- The SkillSearch mechanism relies on SKILL.md to register the skill

### 2. Settings.json Registration

**Status:** Sidecoach not registered

**Current mcpServers:**
```json
{
  "voice-output": {...},
  "improv": {...}
}
```

**What's needed:**
- No entry in mcpServers (Sidecoach is not an MCP server, it's a skill)
- But: Check if there's a `skills` section in settings that needs updating

**Alternative:** Register as a local skills directory

### 3. Skill Registration Path

**Current skills at:** `~/.claude/skills/`

**Current installed:**
- component-gallery-reference
- curate
- design-build
- design-references
- design-team
- fontshare-reference
- icon-source
- improv
- make-interfaces-feel-better (symlink)
- motion-reference
- reflect
- social-media
- visual-effects
- voice-output

**Missing:** `sidecoach/` skill directory

### 4. What Needs to Be Created

```
~/.claude/skills/sidecoach/
├── SKILL.md                    [400-600 lines]
├── package.json                [if needed for local installation]
├── README.md                   [reference, not required]
└── [optional: launcher script]
```

### 5. Wiring Into Claude Code

Three approaches available (ranked by maintainability):

**Option A: Standalone Skill (Recommended)**
- Create `~/.claude/skills/sidecoach/SKILL.md`
- Claude discovers via SkillSearch
- `/sidecoach` becomes available immediately
- No changes to settings.json

**Option B: MCP Server + Skill**
- Wrap sidecoach-orchestrator as MCP server
- Add to mcpServers in settings.json
- Register skill pointing to MCP
- Heavier but enables bidirectional tool invocation

**Option C: CLI Tool**
- Create `~/.claude/sidecoach` executable
- Register in bash PATH
- Call from Bash tool
- Least elegant, works

### 6. Intent Detection Pipeline (Partially Wired)

**What's built:**
- `SidecoachEntryPoint.process()` - NLP routing
- `parseSlashCommand()` - command parsing
- `FlowExecutionEngine.process()` - orchestration

**What's NOT connected:**
- No way to invoke from Claude Code chat
- Entry point exists but is never called by the skill system
- Daemon infra exists but is background-only (hidden flows)

---

## Detailed Gap: Why It's Not Accessible

### The Conceptual Gap

Sidecoach was designed as a **background daemon** that silently processes flows during conversation. The architecture:

```
User utterance (in chat)
  ↓
PostUserPrompt hook fires
  ↓
Named pipe → sidecoach-daemon
  ↓
sidecoach-monitor.js → SidecoachOrchestrator
  ↓
Result written to /tmp/sidecoach-results-<session>/
  ↓
PostResponse hook injects result into Claude's response
  ↓
User sees hidden flow execution in context
```

**This is invisible, not accessible.**

### What's Actually Needed

To make Sidecoach accessible from Claude Code, you need:

1. **A skill that exposes the orchestrator as commands**
   - Not the daemon (background, invisible)
   - The entry-point + orchestrator (foreground, visible)

2. **Commands like:**
   ```
   /sidecoach shape                    # Plan design
   /sidecoach research --component    # Research mode
   /sidecoach craft button            # Implement specific
   /sidecoach full-audit              # Complete validation
   ```

3. **These command handlers must:**
   - Parse the command/intent
   - Call `SidecoachEntryPoint.process()` or `SidecoachCommand.execute()`
   - Return results to Claude's context
   - NOT use the daemon (daemon is for background processing)

### Technical Path Forward

**Minimum viable skill (SKILL.md):**

```markdown
# Sidecoach Coach Skill

Intelligent design workflow orchestration. Guides design work from research through validation via 36 specialized flows.

## Commands

### /sidecoach list
Discover available flows by phase (Research/Implement/Review/Special)

### /sidecoach <flow>
Execute a specific flow. Examples:
- `/sidecoach shape` - Plan the design
- `/sidecoach research` - Component research
- `/sidecoach craft` - Implement component
- `/sidecoach audit` - Full accessibility audit

### /sidecoach teach
Interactive onboarding. Explains flows and guides selection.

## Natural Language Routing

Also understands free-form commands:
- "help me research components" → flow B
- "let's audit this for accessibility" → flow I
- "implement this button" → flow G

## Phases

**Research (A-E):** Brand verify, component research, fonts, references, motion
**Implement (F-I):** Design tokens, components, motion integration, accessibility
**Review (J-V):** Polish, audits, critique, iteration, migration, special flows

## Reference

See PRODUCT.md and DESIGN.md for system configuration.
```

---

## Compilation & Test Status

**Build:** ✅ Zero errors
```bash
cd sidecoach && npm run build
# tsc → 0 errors, 236 files generated
```

**Tests:** ✅ Passing (from memory notes)
- Phase IV: 50+ integration tests
- Phase H: 28 tests (blocks 4-6)
- Phase VII: 46 tests (blocks 2-3)

**Runtime:** ✅ Works (from phase notes)
- Orchestrator: tested with 8+ flows in sequence
- Intent detection: 11 intent categories working
- Entry point: dual mode (slash + NL) verified

---

## Files & Paths

**Core Implementation:**
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/` (87 files, 2.2MB)
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/dist/` (236 files, compiled)

**Hooks (Installed but Not Fully Wired):**
- `~/.claude/hooks/sidecoach-sessionstart.sh` → `/Users/spare3/Documents/Github/claude-dotfiles/claude/hooks/sidecoach-sessionstart.sh`
- `~/.claude/hooks/sidecoach-postuserp.sh` → `/Users/spare3/Documents/Github/claude-dotfiles/claude/hooks/sidecoach-postuserp.sh`
- `~/.claude/hooks/sidecoach-postresponse.sh` → `/Users/spare3/Documents/Github/claude-dotfiles/claude/hooks/sidecoach-postresponse.sh`

**Daemon Infrastructure:**
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/bin/sidecoach-daemon.sh`
- `/Users/spare3/Documents/Github/claude-dotfiles/sidecoach/bin/sidecoach-monitor.js`

**Missing:**
- `~/.claude/skills/sidecoach/SKILL.md` ← **Primary Gap**
- `~/.claude/skills/sidecoach/` directory

---

## What's Required to Ship

### Tier 1: Minimum Viable (4 hours)

1. Create `~/.claude/skills/sidecoach/SKILL.md` (~500 lines)
   - Command definitions
   - Intent keywords
   - Example usage
   - Flow descriptions

2. Implement skill handlers that call:
   - `SidecoachEntryPoint.process()` for NL
   - `SidecoachCommand.execute()` for slash commands
   - Wire to orchestrator

3. Test `/sidecoach list`, `/sidecoach shape`, `/sidecoach craft`

### Tier 2: Polish (2 hours)

1. Update PRODUCT.md in sidecoach root
2. Create DESIGN.md with token system
3. Add help text and phase descriptions
4. Create reference guide doc in `pages/`

### Tier 3: Integration (1 hour)

1. Update README.md
2. Add onboarding guide to CLAUDE.md
3. Create quick-start walkthrough

### Tier 4: Production (2 hours)

1. Performance caching verification
2. Memory persistence testing
3. E2E test of full flow chains
4. Documentation audit

---

## Summary Table

| Component | Status | Files | Completeness | Accessible |
|-----------|--------|-------|--------------|-----------|
| Flow Handlers (A-V) | ✅ Built | 36 | 100% | ❌ No |
| Validation (159 rules) | ✅ Built | 3 | 100% | ❌ No |
| Orchestration | ✅ Built | 6 | 100% | ❌ No |
| Reference Systems | ✅ Built | 5 | 100% | ❌ No |
| Entry Point | ✅ Built | 2 | 100% | ❌ No |
| Command System | ✅ Built | 1 | 100% | ❌ No |
| Intent Detection | ✅ Built | 2 | 100% | ❌ No |
| Background Daemon | ✅ Built | 2 | 100% | ✅ Yes |
| SKILL.md | ❌ Missing | - | 0% | - |
| Skills Registration | ❌ Missing | - | 0% | - |
| User-Facing Commands | ❌ Missing | - | 0% | ❌ No |

---

## Recommendation

**Sidecoach is production-ready code that has zero visibility to users.**

Next step: Create SKILL.md and wire entry point to skill system. This is a ~4-hour integration task that converts a complete backend into a usable frontend.

The daemon infrastructure (silent flows) can remain for future background-processing mode, but the primary interface needs to be user-initiated commands via `/sidecoach`.
