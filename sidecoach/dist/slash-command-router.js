"use strict";
// Slash command routing layer
// Maps user commands directly to flows, bypassing intent detection
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSlashCommand = parseSlashCommand;
exports.getAvailableCommands = getAvailableCommands;
exports.getVerbCommandInfo = getVerbCommandInfo;
exports.getCommandsByPhase = getCommandsByPhase;
const verb_command_registry_1 = require("./verb-command-registry");
// T-0015 (2026-05-28): legacy flow1..flow14 IDs removed from verb routing.
// Duplicates were folded into their lettered canonicals (see CHEATSHEET.md);
// flow4/flow7 are now flowY_explore_discovery / flowZ_design_component.
const SLASH_COMMANDS = {
    research: ['flowA_brand_verify', 'flowB_component_research', 'flowC_font_research', 'flowD_reference_inspiration', 'flowE_motion_patterns', 'flowY_explore_discovery', 'flowZ_design_component'],
    craft: ['flowF_design_tokens', 'flowG_component_implementation', 'flowH_motion_integration', 'flowI_accessibility'],
    implement: ['flowF_design_tokens', 'flowG_component_implementation', 'flowH_motion_integration', 'flowI_accessibility'],
    review: ['flowJ_tactical_polish', 'flowK_multi_lens_audit', 'flowL_design_critique', 'flowM_responsive_validation', 'flowN_rapid_iteration_refined'],
    clone: ['flowO_clone_match_special'],
    constrain: ['flowP_constraint_design_special'],
    migrate: ['flowQ_migration_special'],
    refactor: ['flowR_layout_optimization'],
    type: ['flowS_typography_excellence'],
    motion: ['flowT_ambitious_motion'],
    reference: ['flowU_curate'],
    comprehensive: ['flowV_all_seven_qa'],
    teach: [],
    rapid: ['flowN_rapid_iteration_refined'],
    list: [],
};
function parseSlashCommand(utterance) {
    const trimmed = utterance.trim();
    // Check if starts with /sidecoach or just /
    // Supports both /sidecoach command:target and /sidecoach command target
    const match = trimmed.match(/^\/(?:sidecoach\s+)?(\w+)(?::([\w-]+)|\s+(.*))?$/i);
    if (!match) {
        return {
            isCommand: false,
            flowIds: [],
            reason: 'Not a slash command',
        };
    }
    const command = match[1].toLowerCase();
    const colonTarget = match[2]?.trim() || '';
    const spaceTarget = match[3]?.trim() || '';
    const target = colonTarget || spaceTarget;
    if (command === 'list') {
        return {
            isCommand: true,
            command,
            flowIds: [],
            target,
            reason: 'List all available flows',
        };
    }
    // Support composite flow commands: /sidecoach composite:composite_research_to_impl or /sidecoach composite composite_research_to_impl
    if (command === 'composite') {
        return {
            isCommand: true,
            command: 'composite',
            flowIds: [],
            target,
            reason: target ? `Routed to composite flow: ${target}` : 'Composite flow command (no target specified)',
        };
    }
    // Sprint 8 T8: /sidecoach help <verb> command - returns details from registry.
    // Matched BEFORE the verb registry branch because 'help' is not itself a
    // verb in VERB_REGISTRY; the verb is the target.
    if (command === 'help') {
        return {
            isCommand: true,
            command: 'help',
            flowIds: [],
            target,
            reason: target ? `Help for ${target}` : 'Help (no target)',
        };
    }
    // Sprint 8: verb-based commands (parallel to phase-based SLASH_COMMANDS)
    const verbEntry = (0, verb_command_registry_1.getVerbEntry)(command);
    if (verbEntry) {
        return {
            isCommand: true,
            command,
            flowIds: verbEntry.flowIds,
            target,
            reason: `Routed to ${command} (verb-parity) - ${verbEntry.description}`,
        };
    }
    const flowIds = SLASH_COMMANDS[command];
    if (!flowIds) {
        return {
            isCommand: false,
            flowIds: [],
            reason: `Unknown command: /${command}`,
        };
    }
    return {
        isCommand: true,
        command,
        flowIds,
        target,
        reason: `Routed to ${command} flow chain (${flowIds.length} flows)`,
    };
}
function getAvailableCommands() {
    return {
        research: {
            description: 'Research phase: explore design foundations, references, patterns',
            flows: ['Brand Verify', 'Component Research', 'Font Research', 'Design References', 'Motion Patterns', 'Explore Discovery', 'Design Component'],
            phase: 'Research',
        },
        implement: {
            description: 'Implementation phase: build tokens, components, interactions, accessibility',
            flows: ['Design Tokens', 'Component Implementation', 'Motion Integration', 'Accessibility', 'Make Accessible', 'Implement from Design', 'Extract Tokens'],
            phase: 'Implement',
        },
        review: {
            description: 'Review phase: polish, audit, critique, validate responsive and iteration',
            flows: ['Tactical Polish', 'Multi-Lens Audit', 'Design Critique', 'Responsive Validation', 'Rapid Iteration Refined', 'Polish & Enhance', 'Audit Page', 'Review QA', 'Responsive Review', 'Rapid Iteration'],
            phase: 'Review',
        },
        clone: {
            description: 'Clone existing design or component to match reference',
            flows: ['Clone Match (Special)', 'Clone Match'],
            phase: 'Special',
        },
        constrain: {
            description: 'Design with constraints (system, brand, technical)',
            flows: ['Constraint Design (Special)', 'Constraint Design'],
            phase: 'Special',
        },
        migrate: {
            description: 'Migrate design or implementation across versions or systems',
            flows: ['Migration (Special)', 'Migration'],
            phase: 'Special',
        },
        refactor: {
            description: 'Refactor layout, structure, or organization',
            flows: ['Layout Optimization', 'Refactor Layout'],
            phase: 'Special',
        },
        type: {
            description: 'Optimize typography and text rendering',
            flows: ['Typography Excellence'],
            phase: 'Special',
        },
        motion: {
            description: 'Design ambitious motion and animation',
            flows: ['Ambitious Motion'],
            phase: 'Special',
        },
        reference: {
            description: 'Curate and organize design references',
            flows: ['Curate References'],
            phase: 'Special',
        },
        comprehensive: {
            description: 'Run comprehensive quality assurance across all seven dimensions',
            flows: ['All Seven QA'],
            phase: 'Review',
        },
        teach: {
            description: 'Interactive setup wizard to generate PRODUCT.md with design strategy',
            flows: [],
            phase: 'Special',
        },
        rapid: {
            description: 'Live browser iteration with Endow or token-based variations',
            flows: ['Rapid Iteration Refined', 'Rapid Iteration'],
            phase: 'Review',
        },
        list: {
            description: 'Show all available flows and commands',
            flows: [],
            phase: 'Special',
        },
    };
}
/**
 * Sprint 8 T8: returns CommandInfo for all 22 verb commands from the
 * registry, so the list-handler can show both phase commands and verbs in a
 * single grouped output.
 */
function getVerbCommandInfo() {
    const out = {};
    for (const [verb, entry] of Object.entries(verb_command_registry_1.VERB_REGISTRY)) {
        out[verb] = {
            description: entry.description,
            flows: entry.flowIds.map((f) => f),
            phase: 'Special',
        };
    }
    return out;
}
function getCommandsByPhase() {
    const commands = getAvailableCommands();
    const byPhase = {
        Research: { commands: [] },
        Implement: { commands: [] },
        Review: { commands: [] },
        Special: { commands: [] },
    };
    for (const [cmd, info] of Object.entries(commands)) {
        if (cmd !== 'list') {
            byPhase[info.phase].commands.push({
                command: cmd,
                description: info.description,
                flowCount: info.flows.length,
            });
        }
    }
    return byPhase;
}
//# sourceMappingURL=slash-command-router.js.map