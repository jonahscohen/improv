// One-shot loader for the registries the MCP server presents.
//
// Per DESIGN.md section 6, registries load ONCE at startup. We never re-read
// them per request - that would open a TOCTOU race during deploys, and
// sidecoach development is local enough that "restart to refresh" is a fair
// cost. Each load failure logs a warning and produces a `null` slot; the
// affected tool returns DOWNSTREAM_UNAVAILABLE per call, but the server
// stays alive and other tools keep working.
//
// All paths are relative to the dotfiles repo root via the resolved package
// directory. The resolution walks up from the built dist/ location, which is
// stable across `npm run build` and direct ts-node execution.

import * as fs from 'fs';
import * as path from 'path';

// Imports use the parent's compiled dist/ rather than its source files.
// This decouples mcp-server's build from the parent's build state and keeps
// the mcp-server's tsconfig rootDir clean. Prerequisite: parent must be
// built (`cd sidecoach && npm run build`) before mcp-server builds.
import { flows as FLOW_DEFINITIONS, getFlow } from '../../dist/flows';
import { MODE_LIST, getMode } from '../../dist/modes';
import { FLOW_MODELS } from '../../dist/model-routing';
import type { FlowId } from '../../dist/types';

import type { Logger } from './logger';

// ---------------------------------------------------------------------------
// Resolved registry paths
// ---------------------------------------------------------------------------

/**
 * Resolve the dotfiles repo root from this file's location. The MCP server
 * sits two levels below the repo root regardless of whether we are running
 * compiled (dist/) or ts-node (src/).
 */
export function resolveRepoRoot(): string {
  // __dirname is .../sidecoach/mcp-server/{src,dist}. Walk up to dotfiles root.
  return path.resolve(__dirname, '..', '..', '..');
}

export function resolveVerbsJsonPath(): string {
  return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-verbs.json');
}

export function resolveModesJsonPath(): string {
  return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-modes.json');
}

export function resolveCheatsheetPath(): string {
  return path.join(
    resolveRepoRoot(),
    'claude',
    'skills',
    'sidecoach',
    'CHEATSHEET.md',
  );
}

// ---------------------------------------------------------------------------
// Verb registry
// ---------------------------------------------------------------------------

export interface VerbEntry {
  verb: string;
  pattern: string;
  phase: string;
  description: string;
  oneLineExplanation: string;
}

export interface VerbRegistry {
  verbs: VerbEntry[];
  meta?: Record<string, unknown>;
}

export function loadVerbRegistry(logger: Logger): VerbRegistry | null {
  const filePath = resolveVerbsJsonPath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.verbs)) {
      logger.warn('verbs registry shape unexpected', { path: filePath });
      return null;
    }
    const verbs: VerbEntry[] = parsed.verbs
      .filter((v: unknown) => typeof v === 'object' && v !== null)
      .map((v: any) => ({
        verb: String(v.verb ?? ''),
        pattern: String(v.pattern ?? v.verb ?? ''),
        phase: String(v.phase ?? ''),
        description: String(v.description ?? ''),
        oneLineExplanation: String(v.oneLineExplanation ?? v.description ?? ''),
      }))
      .filter((v: VerbEntry) => v.verb.length > 0);
    return { verbs, meta: parsed._meta };
  } catch (err) {
    logger.warn('failed to load verbs registry', {
      path: filePath,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mode registry (mirrors sidecoach-modes.json for the hook + modes.ts in TS)
// ---------------------------------------------------------------------------

export interface ModeEntry {
  mode: string;
  pattern: string;
  description: string;
  oneLineExplanation: string;
  chain: string[];
}

export interface ModeRegistry {
  modes: ModeEntry[];
  meta?: Record<string, unknown>;
}

export function loadModeRegistry(logger: Logger): ModeRegistry | null {
  const filePath = resolveModesJsonPath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.modes)) {
      logger.warn('modes registry shape unexpected', { path: filePath });
      return null;
    }
    const modes: ModeEntry[] = parsed.modes
      .filter((m: unknown) => typeof m === 'object' && m !== null)
      .map((m: any) => ({
        mode: String(m.mode ?? ''),
        pattern: String(m.pattern ?? m.mode ?? ''),
        description: String(m.description ?? ''),
        oneLineExplanation: String(m.oneLineExplanation ?? m.description ?? ''),
        chain: Array.isArray(m.chain) ? m.chain.map((c: unknown) => String(c)) : [],
      }))
      .filter((m: ModeEntry) => m.mode.length > 0);
    return { modes, meta: parsed._meta };
  } catch (err) {
    logger.warn('failed to load modes registry', {
      path: filePath,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Flow registry (in-process import from flows.ts)
// ---------------------------------------------------------------------------

export interface FlowSummary {
  id: string;
  name: string;
  description: string;
  tier: number | null;
  modelConfig?: {
    minTier: string;
    preferredTier: string;
    rationale: string;
  };
}

/**
 * Derive a flow's tier from its position in the registry. The flows.ts file
 * orders entries by tier with comment markers; we approximate by scanning
 * the array for tier boundaries. Best-effort - returns null if unknown.
 */
function tierForFlowId(flowId: string): number | null {
  // Letter-coded flows: A-E = tier 1, F-I = tier 2, J-N = tier 3, O-Q = tier 4,
  // R-T = tier 5, U/V special, W-X = tier 6. Number-coded = legacy (treat as 0).
  const letter = flowId.match(/^flow([A-Z])_/);
  if (letter) {
    const code = letter[1].charCodeAt(0);
    if (code >= 65 && code <= 69) return 1;       // A-E
    if (code >= 70 && code <= 73) return 2;       // F-I
    if (code >= 74 && code <= 78) return 3;       // J-N
    if (code >= 79 && code <= 81) return 4;       // O-Q
    if (code >= 82 && code <= 84) return 5;       // R-T
    if (code === 85 || code === 86) return 0;     // U-V (special)
    if (code >= 87 && code <= 88) return 6;       // W-X
  }
  if (/^flow\d+_/.test(flowId)) return 0;         // legacy
  return null;
}

export function loadFlowRegistry(logger: Logger): FlowSummary[] {
  try {
    const summaries: FlowSummary[] = FLOW_DEFINITIONS.map((f) => {
      const modelConfig = FLOW_MODELS[f.id as FlowId];
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        tier: tierForFlowId(f.id),
        modelConfig: modelConfig
          ? {
              minTier: modelConfig.minTier,
              preferredTier: modelConfig.preferredTier,
              rationale: modelConfig.rationale,
            }
          : undefined,
      };
    });
    return summaries;
  } catch (err) {
    logger.warn('failed to derive flow registry', {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export function getFlowById(flowId: string): {
  id: string;
  name: string;
  description: string;
  triggers: any;
  modelConfig?: { minTier: string; preferredTier: string; rationale: string };
  tier: number | null;
} | null {
  const f = getFlow(flowId as FlowId);
  if (!f) return null;
  const modelConfig = FLOW_MODELS[f.id as FlowId];
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    triggers: f.triggers,
    tier: tierForFlowId(f.id),
    modelConfig: modelConfig
      ? {
          minTier: modelConfig.minTier,
          preferredTier: modelConfig.preferredTier,
          rationale: modelConfig.rationale,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Modes via the TS module (fallback when modes.json is missing)
// ---------------------------------------------------------------------------

export function loadModesViaTs(): ModeEntry[] {
  return MODE_LIST.map((m) => ({
    mode: m.name,
    pattern: m.name,
    description: m.description,
    oneLineExplanation: m.oneLineExplanation,
    chain: m.verbChain,
  }));
}

export function getModeByName(name: string): ModeEntry | null {
  const m = getMode(name);
  if (!m) return null;
  return {
    mode: m.name,
    pattern: m.name,
    description: m.description,
    oneLineExplanation: m.oneLineExplanation,
    chain: m.verbChain,
  };
}

// ---------------------------------------------------------------------------
// Cheatsheet load
// ---------------------------------------------------------------------------

export interface CheatsheetContent {
  raw: string;
  sourcePath: string;
}

export function loadCheatsheet(logger: Logger): CheatsheetContent | null {
  const filePath = resolveCheatsheetPath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return { raw, sourcePath: filePath };
  } catch (err) {
    logger.warn('failed to load cheatsheet', {
      path: filePath,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cumulative registry bundle
// ---------------------------------------------------------------------------

export interface RegistryBundle {
  verbs: VerbRegistry | null;
  modes: ModeRegistry | null;
  flows: FlowSummary[];
  cheatsheet: CheatsheetContent | null;
}

export function loadAllRegistries(logger: Logger): RegistryBundle {
  const verbs = loadVerbRegistry(logger);
  const modesFromJson = loadModeRegistry(logger);
  const flows = loadFlowRegistry(logger);
  const cheatsheet = loadCheatsheet(logger);

  // Fall back to the TS modes module if the JSON file is missing - we still
  // have the TS-side source of truth available in-process.
  const modes = modesFromJson ?? {
    modes: loadModesViaTs(),
    meta: { _source: 'modes.ts fallback (modes.json unavailable)' },
  };

  logger.info('registries loaded', {
    verbCount: verbs?.verbs.length ?? 0,
    modeCount: modes.modes.length,
    flowCount: flows.length,
    cheatsheetLoaded: cheatsheet !== null,
  });

  return { verbs, modes, flows, cheatsheet };
}
