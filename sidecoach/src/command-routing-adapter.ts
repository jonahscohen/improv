// Command routing adapter layer
// Bridges slash commands to orchestrator flows with preprocessing and post-processing

import { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { parseSlashCommand, getAvailableCommands, getCommandsByPhase, getVerbCommandInfo } from './slash-command-router';
import { FlowExecutionEngine, SidecoachResult } from './sidecoach-orchestrator';

export interface CommandRouteRequest {
  utterance: string;
  context: Partial<FlowExecutionContext>;
}

export interface CommandRouteResponse {
  isCommand: boolean;
  command?: string;
  result?: SidecoachResult;
  error?: string;
}

export class CommandRoutingAdapter {
  private orchestrator: FlowExecutionEngine;

  constructor(orchestrator: FlowExecutionEngine) {
    this.orchestrator = orchestrator;
  }

  async route(request: CommandRouteRequest): Promise<CommandRouteResponse> {
    const { utterance, context } = request;

    // Parse command
    const match = parseSlashCommand(utterance);

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
      const result = await this.orchestrator.process(
        preprocessed.utterance,
        context
      );

      // Post-process result (enrich, format)
      const enriched = this.enrichResult(result, command);

      return {
        isCommand: true,
        command: match.command,
        result: enriched,
      };
    } catch (error) {
      return {
        isCommand: true,
        command: match.command,
        error: error instanceof Error ? error.message : 'Unknown routing error',
      };
    }
  }

  private preprocessCommand(command: string, target: string): { utterance: string; error?: string } {
    // Validate command exists
    const commands = { ...getAvailableCommands(), ...getVerbCommandInfo() };
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

  private enrichResult(result: SidecoachResult, command: string): SidecoachResult {
    // Add command metadata to result
    const commands = { ...getAvailableCommands(), ...getVerbCommandInfo() };
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
  isKnownCommand(command: string): boolean {
    const commands = { ...getAvailableCommands(), ...getVerbCommandInfo() };
    return !!commands[command];
  }

  // Helper method: get all commands for a phase
  getCommandsForPhase(phase: 'Research' | 'Implement' | 'Review' | 'Special'): Array<{ command: string; description: string }> {
    const byPhase = getCommandsByPhase();
    return byPhase[phase]?.commands || [];
  }

  // Helper method: validate command args
  validateCommandArgs(command: string, args: string): { valid: boolean; message?: string } {
    // Command-specific validation rules
    const validationRules: Record<string, (args: string) => boolean> = {
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
