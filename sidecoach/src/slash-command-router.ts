// Slash command routing layer
// Maps user commands directly to flows, bypassing intent detection

import { FlowId } from './types';
import { getVerbEntry, VERB_REGISTRY } from './verb-command-registry';
import { loadRegistry, evaluateLane } from './lane-classifier';

export interface CommandMatch {
  isCommand: boolean;
  command?: string;
  flowIds: FlowId[];
  target?: string;
  reason: string;
}

// T-0015 (2026-05-28): legacy flow1..flow14 IDs removed from verb routing.
// Duplicates were folded into their lettered canonicals (see CHEATSHEET.md);
// flow4/flow7 are now flowY_explore_discovery / flowZ_design_component.
const SLASH_COMMANDS: Record<string, FlowId[]> = {
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

export function parseSlashCommand(utterance: string): CommandMatch {
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
  const verbEntry = getVerbEntry(command);
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

export interface CommandInfo {
  description: string;
  flows: string[];
  phase: 'Research' | 'Implement' | 'Review' | 'Special';
}

export interface CommandsByPhase {
  [phase: string]: {
    commands: Array<{ command: string; description: string; flowCount: number }>;
  };
}

export function getAvailableCommands(): Record<string, CommandInfo> {
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
      description: 'Live browser iteration with Justify or token-based variations',
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
export function getVerbCommandInfo(): Record<string, CommandInfo> {
  const out: Record<string, CommandInfo> = {};
  for (const [verb, entry] of Object.entries(VERB_REGISTRY)) {
    out[verb] = {
      description: entry.description,
      flows: entry.flowIds.map((f) => f as string),
      phase: 'Special',
    };
  }
  return out;
}

export function getCommandsByPhase(): CommandsByPhase {
  const commands = getAvailableCommands();
  const byPhase: CommandsByPhase = {
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

// ===========================================================================
// /sidecoach <phrase> resolution union (P1, spec section 10)
//
// ROUTE | CLASSIFY | OUT_OF_SCOPE | UNKNOWN. Because the user explicitly
// addressed sidecoach, a SCOPE_UNKNOWN lane (no negative evidence) PROCEEDS to
// ROUTE/CLASSIFY; positive negative evidence still refuses (OUT_OF_SCOPE); a
// phrase with NO lane evidence at all is UNKNOWN and returns a typo/near-miss
// suggestion. The near-miss machinery (matchKnownCommand / levenshtein /
// nearMissSuggestion) is NET-NEW - none existed before this task.
// ===========================================================================

export interface PhraseResolution {
  kind: 'ROUTE' | 'CLASSIFY' | 'OUT_OF_SCOPE' | 'UNKNOWN';
  command?: string;     // when the phrase is a known verb/phase command
  lane?: string;        // when routed/classified to a lane
  suggestion?: string;  // UNKNOWN near-miss ("did you mean /sidecoach polish?")
  redirect?: string;    // OUT_OF_SCOPE one-line redirect
}

// First word of the phrase (the bit a user would type as a command), lowercased.
function firstToken(phrase: string): string {
  const m = phrase.trim().match(/^([a-z][\w-]*)/i);
  return m ? m[1].toLowerCase() : '';
}

// Known command vocabulary = the 22 verb-registry keys + the phase SLASH_COMMANDS
// keys. Lanes are reached by the classifier (evaluateLane), not by name here.
function knownCommandNames(): string[] {
  return [...Object.keys(VERB_REGISTRY), ...Object.keys(SLASH_COMMANDS)];
}

// Exact known-command fast path: if the phrase opens with a known verb/phase
// command, treat it as a direct command (the user typed a real command word).
function matchKnownCommand(phrase: string): string | null {
  const tok = firstToken(phrase);
  if (!tok) return null;
  if (getVerbEntry(tok)) return tok;
  if (Object.prototype.hasOwnProperty.call(SLASH_COMMANDS, tok)) return tok;
  return null;
}

// Standard iterative Levenshtein edit distance (two-row, O(m*n) time, O(n) space).
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(
        row[j] + 1,                                   // deletion
        row[j - 1] + 1,                               // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),       // substitution
      );
      prev = tmp;
    }
  }
  return row[n];
}

// Closest known command/verb/lane-label to the phrase's first token, returned
// only when it is a plausible typo (<= 2 edits). undefined means "no good guess".
function nearMissSuggestion(phrase: string, laneLabels: string[] = []): string | undefined {
  const tok = firstToken(phrase);
  if (!tok) return undefined;
  const candidates = [...knownCommandNames(), ...laneLabels];
  let best: string | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = levenshtein(tok, c.toLowerCase());
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  if (best !== undefined && bestDist <= 2) return `did you mean /sidecoach ${best}?`;
  return undefined;
}

export function resolveSidecoachPhrase(phrase: string, lanesPath: string): PhraseResolution {
  const known = matchKnownCommand(phrase);            // a typed command word wins outright
  if (known) return { kind: 'ROUTE', command: known };

  const reg = loadRegistry(lanesPath);
  const scores = reg.lanes.map((l: any) => evaluateLane(l, phrase, reg));
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const top = ranked[0]; const second = ranked[1] ? ranked[1].score : 0;
  const hasRoutableEvidence = scores.some((s: any) =>
    (s.scope === 'IN_SCOPE' || s.scope === 'SCOPE_UNKNOWN') && s.score > 0);
  const hasOos = scores.some((s: any) => s.scope === 'OUT_OF_SCOPE');

  if (!hasRoutableEvidence) {
    if (hasOos) {
      return { kind: 'OUT_OF_SCOPE',
        redirect: 'That reads as backend/infrastructure work. Sidecoach covers UI/design only.' };
    }
    // No lane evidence at all -> typo guess over verbs/phase commands/lane labels.
    return { kind: 'UNKNOWN', suggestion: nearMissSuggestion(phrase, reg.lanes.map((l: any) => l.label)) };
  }
  const { route_floor: rf, route_margin: rm } = reg.scoring;
  const routeGrade = top.score >= rf && (top.score - second) >= rm;  // explicit address: scope_unknown counts
  return routeGrade ? { kind: 'ROUTE', lane: top.lane } : { kind: 'CLASSIFY', lane: top.lane };
}
