# Sidecoach Command to Flow Mapping

Complete mapping of all slash commands to flows they execute.

## Research Phase Commands

### /sidecoach research
- Primary flows: flowA_brand_verify, flowB_component_research, flowC_font_research, flowD_reference_inspiration, flowE_motion_patterns
- Legacy flows: flow4_explore_discovery, flow7_design_component
- Purpose: Foundational research and exploration
- Total flows: 7

## Implement Phase Commands

### /sidecoach implement
- Primary flows: flowF_design_tokens, flowG_component_implementation, flowH_motion_integration, flowI_accessibility
- Legacy flows: flow9_accessible, flow10_implement_design, flow11_extract_tokens
- Purpose: Implementation and execution
- Total flows: 7

### /sidecoach rapid
- Primary flows: flowN_rapid_iteration_refined
- Legacy flows: flow13_rapid_iteration
- Purpose: Rapid iteration with live browser (Endow) or token-based variants
- Endow detection: Checks ENDOW_AVAILABLE environment variable
- Max iterations: 10 rounds with screenshot capture
- Total flows: 2

## Review Phase Commands

### /sidecoach review
- Primary flows: flowJ_tactical_polish, flowK_multi_lens_audit, flowL_design_critique, flowM_responsive_validation, flowN_rapid_iteration_refined
- Legacy flows: flow2_polish_enhance, flow3_audit_page, flow5_review_qa, flow12_responsive_review, flow13_rapid_iteration
- Purpose: Polish, audit, critique, and validation
- Total flows: 10

### /sidecoach comprehensive
- Primary flows: flowV_all_seven_qa
- Purpose: Seven-dimension quality assurance triad (audit/critique/polish)
- Total flows: 1

## Special Phase Commands

### /sidecoach clone
- Primary flows: flowO_clone_match_special
- Legacy flows: flow1_clone_match
- Purpose: Clone/steal design or component to match reference
- Total flows: 2

### /sidecoach constrain
- Primary flows: flowP_constraint_design_special
- Legacy flows: flow6_constraint_design
- Purpose: Design with constraints (system, brand, technical)
- Total flows: 2

### /sidecoach migrate
- Primary flows: flowQ_migration_special
- Legacy flows: flow14_migration
- Purpose: Migrate design or implementation across versions
- Total flows: 2

### /sidecoach refactor
- Primary flows: flowR_layout_optimization
- Legacy flows: flow8_refactor_layout
- Purpose: Refactor layout, structure, organization
- Total flows: 2

### /sidecoach type
- Primary flows: flowS_typography_excellence
- Purpose: Optimize typography and text rendering
- Total flows: 1

### /sidecoach motion
- Primary flows: flowT_ambitious_motion
- Purpose: Design ambitious motion and animation
- Total flows: 1

### /sidecoach reference
- Primary flows: flowU_curate
- Purpose: Curate and organize design references
- Total flows: 1

### /sidecoach teach
- Purpose: Interactive setup wizard to generate PRODUCT.md with design strategy
- Implementation: TeachCommandHandler (special command, no flows)
- Fields: user group, design type (brand/product), brand personality, anti-references, strategic principles
- Total flows: 0 (generates PRODUCT.md)

### /sidecoach list
- Purpose: Show all available commands grouped by phase
- Output: Grouped by Research/Implement/Review/Special phases with descriptions and flow counts
- Total flows: 0 (display command)

## Interactive Menu

### /sidecoach (empty input or no args)
- Displays interactive menu with all 13 commands
- Numbered entries (1-13) grouped by workflow phase
- Instructions for selecting command or using slash syntax
- Total commands visible: 13

## Flow Chain Execution

All commands execute as flow chains through the orchestrator:

1. **Route determination**: Slash command match → flow chain selection
2. **Flow A mandatory**: Brand verification runs first (gate for all flows)
3. **Sequential execution**: Flows execute in order defined by SLASH_COMMANDS mapping
4. **Optional chaining**: Follow-up flows recommended based on orchestrator intelligence
5. **Memory recording**: Each flow execution recorded with results and metadata
6. **Session persistence**: Flow history and memory written at session end

## Legacy vs Primary Flows

- Primary flows (flowA-flowV): Current generation with memory tracking and metadata
- Legacy flows (flow1-flow14): Previous implementation, maintained for backward compatibility
- Migration path: Commands route to both primary and legacy to ensure coverage

## Command Resolution

- `/sidecoach <command>`: Explicit routing via parseSlashCommand()
- `/<command>`: Shorthand routed to /sidecoach <command>
- Empty input: Interactive menu shown
- Unknown command: Error returned with suggestion to run /sidecoach list

## Entry Points

1. **Slash commands**: `/sidecoach <command> [args]`
2. **Interactive menu**: `/sidecoach` or empty input
3. **Intent detection**: Natural language processed by intent detector (fallback)

---

Generated documentation for Phase 3 Task 12.
Last updated: 2026-05-23
