# Sidecoach Quickstart

> **Historical note:** earlier drafts of this file described Sidecoach as "invisible" infrastructure with no user-facing commands. That stance was retired during Sprint 1. Sidecoach is now a slash-command-driven orchestrator with two parallel command surfaces. The intent detector still routes natural-language utterances through the same engine, but slash commands are the supported primary interface.

## What Is Sidecoach?

Sidecoach is the design orchestration engine wired into this Claude Code installation. It chains 36 flows across research, build, and review phases, enforces prerequisites at phase boundaries, and writes session memory entries so the next call starts with full context.

Two slash command surfaces share the same flow chains:

- **Phase commands** - sidecoach native vocabulary (`research`, `craft`, `review`, plus special-case verbs `clone`, `constrain`, `migrate`, `refactor`, `type`, `motion`, `reference`, `comprehensive`, `rapid`).
- **Verb commands (22)** - mirror the verb vocabulary 1:1, route through the same flow chains, then the orchestrator appends the canonical section names verbatim plus sidecoach's parity-plus extensions (BuildReport, taste validation, polish-standard domain grades, category-reflex detector, memory entry).

Two additional commands cover setup:

- `/sidecoach teach [brief]` - brief-driven hybrid setup. Parses what the brief contains, asks targeted questions only for the gaps, writes PRODUCT.md. Refuses to overwrite a real existing PRODUCT.md unless `forceOverwrite` is set.
- `/sidecoach document` - scans project HTML/CSS, writes Google-spec DESIGN.md (YAML token frontmatter + six-section markdown body in canonical order).

Plus discovery:

- `/sidecoach list` - shows every command grouped by phase (phase commands and the 22 verbs in one output).
- `/sidecoach help <verb>` - registry detail for any specific verb: description, phase, skill reference path, flow chain, parity checklist, sidecoach parity-plus additions.

Natural language still works ("Help me design a button"); the intent detector routes free-form utterances to the same flow chains.

## Status: Sprint 8 complete

| Sprint | Highlight | Status |
|---|---|---|
| 1 | Core flow architecture, slash command router, session memory | Complete |
| 2-4 | Reference systems, validators, BuildReport, phase chaining | Complete |
| 5-7 | Flow handlers A-V, composite flows, conditional routing | Complete |
| 8 | 22 verb commands + teach v2 + document + list/help | Complete |

Code status: TypeScript compiles cleanly. `sprint8-verb-parity` 197/197 PASS.

## Current State

**Shipped:**
- 36 flow handlers across research, build, review, and special phases (flows A-V + legacy 1-14).
- 22 verb commands in `VERB_REGISTRY` (`src/verb-command-registry.ts`), routed by `parseSlashCommand` in `src/slash-command-router.ts`.
- Brief-driven `/sidecoach teach` (`src/teach-command-handler-v2.ts`).
- Google-spec `/sidecoach document` (`src/document-command-handler.ts`).
- `/sidecoach list` showing phase commands + verbs in one grouped output.
- `/sidecoach help <verb>` showing per-verb registry detail.
- Session memory writes wired through the orchestrator (`SessionMemoryWriter.persistSessionMemory`).
- Reference systems: fontshare, component gallery, design references, motion patterns, category-reflex detector.
- 159-rule validation framework (22-point Polish Standard + 137-rule extended domains).

## How It Works

```typescript
// FlowExecutionEngine.process(utterance) - single entry point for slash + NL.

const commandMatch = parseSlashCommand(utterance);
// Slash path: commandMatch.command set, flowIds populated from the registry or phase table.
// NL path: commandMatch.isCommand=false, IntentDetector runs and returns a flowIds array.

for (const flowId of flowIds) {
  validatePrerequisites(flowId);              // phase gate + Tier 2+ DESIGN.md gate, etc.
  const result = await runFlow(flowId, context);
  recordFlowExecution(result);                // FlowHistory persists across calls
  flowResults.push(result);
}

// For the 22 verbs, append the registry's guidanceAppend + parityChecklist +
// parityPlus content so the response speaks in the verb voice (sections like
// "Design System Discovery", "Pre-Polish Assessment") while still carrying sidecoach's
// extensions (polish-standard domain grade, taste validation, BuildReport, memory).
const entry = getVerbEntry(commandMatch.command);
if (entry) chainGuidance.push(...buildVerbGuidanceAppend(commandMatch.command));
```

The user picks the interface that fits the moment: slash for intentional invocation, natural language for unscripted descriptions.

## Flow Dependency Graph (10 Flows)

```
flowA (brand verify) <- foundation
  |-> flowB (components)
  |-> flowC (fonts)
  |-> flowD (references)
  |-> flowE (motion)
      |
    flowF (design tokens) <- gating point
      |-> flowG (implement)
      |-> flowH (motion integration)
      |-> flowI (accessibility)
            |
          flowJ (polish)
```

Each arrow is automatic. No user action required.

## Architecture

`FlowExecutionEngine` (in `src/sidecoach-orchestrator.ts`) is the single entry point. It owns:

| Surface | Purpose |
|---|---|
| `parseSlashCommand` (router) | Routes slash commands. Handles `list`, `composite:<name>`, `help <verb>`, the 22 verbs (via `VERB_REGISTRY`), then phase commands (via `SLASH_COMMANDS`). |
| Intent detector | Routes natural-language utterances when `commandMatch.isCommand` is false. |
| `validatePrerequisites(flowId)` | Hard-blocks at phase gates (PRODUCT.md required, DESIGN.md for Tier 2+, etc.). |
| Flow loop | Iterates the routed flow IDs, runs each, records to `FlowHistory`, accumulates results. |
| `buildVerbGuidanceAppend(command)` | For the 22 verbs, appends the canonical section names + sidecoach's parity-plus tokens to the response. |
| `SessionMemoryWriter.persistSessionMemory()` | Writes the audit trail at session end. |

## Key Files

| File | Purpose |
|---|---|
| `src/sidecoach-orchestrator.ts` | FlowExecutionEngine, list/help/teach/document dispatch, parity-append wiring |
| `src/slash-command-router.ts` | `parseSlashCommand`, `getAvailableCommands`, `getVerbCommandInfo`, `getCommandsByPhase` |
| `src/verb-command-registry.ts` | `VERB_REGISTRY` with the 22 verbs (description, flowIds, guidanceAppend, parityChecklist, parityPlus, skillRefPath) |
| `src/teach-command-handler-v2.ts` | Brief-driven PRODUCT.md generation |
| `src/document-command-handler.ts` | Google-spec DESIGN.md generation from project HTML/CSS |
| `src/flow-history.ts` | Cross-call session persistence |
| `src/extended-domain-validator.ts` | 159-rule validation framework |

---

Status: production ready. Two slash command surfaces shipped; natural-language intent detection still available as a peer interface; `sprint8-verb-parity` 197/197 PASS; tsc clean.
