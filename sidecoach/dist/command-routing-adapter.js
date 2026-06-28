"use strict";
// Command routing adapter layer
// Bridges slash commands to orchestrator flows with preprocessing and post-processing
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandRoutingAdapter = void 0;
const slash_command_router_1 = require("./slash-command-router");
class CommandRoutingAdapter {
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    async route(request) {
        const { utterance, context } = request;
        // Parse command
        const match = (0, slash_command_router_1.parseSlashCommand)(utterance);
        if (!match.isCommand) {
            return {
                isCommand: false,
            };
        }
        const command = match.command;
        if (!command) {
            return {
                isCommand: false,
            };
        }
        // Preprocess command (validate, normalize args)
        const preprocessed = this.preprocessCommand(command, match.target || '');
        if (preprocessed.error) {
            return {
                isCommand: true,
                command,
                error: preprocessed.error,
            };
        }
        // Route through orchestrator
        try {
            const result = await this.orchestrator.process(preprocessed.utterance, context);
            // Post-process result (enrich, format)
            const enriched = this.enrichResult(result, command);
            return {
                isCommand: true,
                command: match.command,
                result: enriched,
            };
        }
        catch (error) {
            return {
                isCommand: true,
                command: match.command,
                error: error instanceof Error ? error.message : 'Unknown routing error',
            };
        }
    }
    preprocessCommand(command, target) {
        // Validate command exists
        const commands = { ...(0, slash_command_router_1.getAvailableCommands)(), ...(0, slash_command_router_1.getVerbCommandInfo)() };
        if (!commands[command]) {
            return {
                utterance: '',
                error: `Unknown command: /${command}`,
            };
        }
        // Reconstruct utterance for orchestrator
        const utterance = target ? `/sidecoach ${command} ${target}` : `/sidecoach ${command}`;
        return { utterance };
    }
    enrichResult(result, command) {
        // Add command metadata to result
        const commands = { ...(0, slash_command_router_1.getAvailableCommands)(), ...(0, slash_command_router_1.getVerbCommandInfo)() };
        const commandInfo = commands[command];
        if (commandInfo) {
            // Prepend command info to guidance
            const enrichedGuidance = [
                `Command: /sidecoach ${command}`,
                `Phase: ${commandInfo.phase}`,
                `Description: ${commandInfo.description}`,
                `Flows: ${commandInfo.flows.length}`,
                '---',
                ...(result.guidance || []),
            ];
            return {
                ...result,
                guidance: enrichedGuidance,
            };
        }
        return result;
    }
    // Helper method: check if command is known
    isKnownCommand(command) {
        const commands = { ...(0, slash_command_router_1.getAvailableCommands)(), ...(0, slash_command_router_1.getVerbCommandInfo)() };
        return !!commands[command];
    }
    // Helper method: get all commands for a phase
    getCommandsForPhase(phase) {
        const byPhase = (0, slash_command_router_1.getCommandsByPhase)();
        return byPhase[phase]?.commands || [];
    }
    // Helper method: validate command args
    validateCommandArgs(command, args) {
        // Command-specific validation rules
        const validationRules = {
            teach: () => true, // teach requires no args
            list: () => true, // list requires no args
            rapid: (args) => args.length > 0, // rapid requires target component
            reference: (args) => args.length > 0, // reference requires URL or name
        };
        const validator = validationRules[command];
        if (validator && !validator(args)) {
            return {
                valid: false,
                message: `Command /${command} requires arguments`,
            };
        }
        return { valid: true };
    }
}
exports.CommandRoutingAdapter = CommandRoutingAdapter;
//# sourceMappingURL=command-routing-adapter.js.map