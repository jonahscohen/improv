import type { Manifest, LayerRole, ParamSpec, ParamType, Redistribution } from './types';

const LAYER_ROLES: LayerRole[] = ['background', 'midground', 'pointer', 'post'];
const PARAM_TYPES: ParamType[] = ['range', 'color', 'toggle', 'select'];
const REDIST: Redistribution[] = ['ok', 'personal-only', 'reimplemented'];

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`manifest.${key} must be a non-empty string`);
  }
  return v;
}

function validateParam(raw: unknown, i: number): ParamSpec {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`manifest.params[${i}] must be an object`);
  }
  const p = raw as Record<string, unknown>;
  const name = reqString(p, 'name');
  const type = p.type as ParamType;
  if (!PARAM_TYPES.includes(type)) {
    throw new Error(`manifest.params[${i}].type "${String(type)}" is invalid`);
  }
  if (!('default' in p)) {
    throw new Error(`manifest.params[${i}] (${name}) must have a default`);
  }
  return {
    name,
    type,
    default: p.default,
    min: typeof p.min === 'number' ? p.min : undefined,
    max: typeof p.max === 'number' ? p.max : undefined,
    step: typeof p.step === 'number' ? p.step : undefined,
    options: Array.isArray(p.options) ? (p.options as string[]) : undefined,
  };
}

export function validateManifest(raw: unknown): Manifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('manifest must be an object');
  }
  const o = raw as Record<string, unknown>;
  const layerRole = o.layerRole as LayerRole;
  if (!LAYER_ROLES.includes(layerRole)) {
    throw new Error(`manifest.layerRole "${String(layerRole)}" is invalid`);
  }
  const redistribution = o.redistribution as Redistribution;
  if (!REDIST.includes(redistribution)) {
    throw new Error(`manifest.redistribution "${String(redistribution)}" is invalid`);
  }
  const params = Array.isArray(o.params) ? o.params.map(validateParam) : [];
  return {
    id: reqString(o, 'id'),
    name: reqString(o, 'name'),
    category: reqString(o, 'category'),
    layerRole,
    params,
    requiredAssets: Array.isArray(o.requiredAssets) ? (o.requiredAssets as string[]) : [],
    origin: reqString(o, 'origin'),
    license: reqString(o, 'license'),
    attribution: reqString(o, 'attribution'),
    redistribution,
    tags: Array.isArray(o.tags) ? (o.tags as string[]) : [],
  };
}
