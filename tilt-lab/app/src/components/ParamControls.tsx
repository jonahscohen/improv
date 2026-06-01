import { useMemo } from 'react';
import type { ParamSpec, Marker } from '../../../runtime/types';
import { Slider, Switch, Select, ColorField, FileDrop, TextField, MarkerListEditor } from './controls';
import './ParamControls.css';

interface Props {
  specs: ParamSpec[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/** Above this param count a flat wall of controls is decluttered into
 *  collapsible groups (e.g. aurora's 25 params, fluid's 15). */
const GROUP_THRESHOLD = 8;

interface Group {
  key: string;
  label: string;
  specs: ParamSpec[];
}

/**
 * Derive a grouping key from a camelCase param name: the leading run up to the
 * first internal uppercase letter. layer1Color/layer1Speed -> "layer1";
 * skyColor1/skyBlend2 -> "sky"; movementX/movementY -> "movement"; speed -> "speed".
 */
function groupKeyOf(name: string): string {
  let i = 1;
  while (i < name.length && !(name[i] >= 'A' && name[i] <= 'Z')) i++;
  return name.slice(0, i);
}

/** "layer1" -> "Layer 1", "sky" -> "Sky", "movement" -> "Movement". */
function humanizeGroup(key: string): string {
  const m = key.match(/^([a-zA-Z]+)(\d*)$/);
  const word = m ? m[1] : key;
  const num = m ? m[2] : '';
  const cap = word.charAt(0).toUpperCase() + word.slice(1);
  return num ? `${cap} ${num}` : cap;
}

/**
 * Bucket specs by grouping key. Multi-member keys become their own sections
 * (in first-appearance order); singletons fold into a leading "General" group.
 */
function buildGroups(specs: ParamSpec[]): Group[] {
  const buckets = new Map<string, ParamSpec[]>();
  for (const spec of specs) {
    const key = groupKeyOf(spec.name);
    const arr = buckets.get(key);
    if (arr) arr.push(spec);
    else buckets.set(key, [spec]);
  }

  const general: ParamSpec[] = [];
  const sections: Group[] = [];
  for (const [key, arr] of buckets) {
    if (arr.length >= 2) sections.push({ key, label: humanizeGroup(key), specs: arr });
    else general.push(arr[0]);
  }

  const result: Group[] = [];
  if (general.length) result.push({ key: '__general', label: 'General', specs: general });
  result.push(...sections);
  return result;
}

export function ParamControls({ specs, values, onChange }: Props) {
  const groups = useMemo(() => buildGroups(specs), [specs]);
  // Only group when there is genuine clutter AND a real multi-member section to
  // collapse - otherwise a single accordion box adds chrome without decluttering.
  const grouped =
    specs.length > GROUP_THRESHOLD && groups.some((g) => g.key !== '__general');

  const control = (spec: ParamSpec) => {
    const value = values[spec.name];
    switch (spec.type) {
      case 'range':
        return (
          <Slider
            value={Number(value)}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            onChange={(v) => onChange(spec.name, v)}
            ariaLabel={spec.name}
          />
        );
      case 'toggle':
        return (
          <Switch
            checked={Boolean(value)}
            onChange={(v) => onChange(spec.name, v)}
            ariaLabel={spec.name}
          />
        );
      case 'color':
        return (
          <ColorField
            value={String(value)}
            onChange={(v) => onChange(spec.name, v)}
            ariaLabel={spec.name}
          />
        );
      case 'file':
        return (
          <FileDrop
            onChange={(url) => onChange(spec.name, url)}
            accept="image/*,video/*"
            ariaLabel={spec.label ?? spec.name}
            placeholder={spec.placeholder}
          />
        );
      case 'text':
        return (
          <TextField
            value={value == null ? '' : String(value)}
            placeholder={spec.placeholder}
            maxLength={spec.maxLength}
            onChange={(v) => onChange(spec.name, v)}
            ariaLabel={spec.name}
          />
        );
      case 'marker-list':
        return (
          <MarkerListEditor
            value={Array.isArray(value) ? (value as Marker[]) : []}
            onChange={(v) => onChange(spec.name, v)}
            ariaLabel={spec.name}
          />
        );
      case 'select':
      default:
        return (
          <Select
            value={String(value)}
            options={spec.options ?? []}
            onChange={(v) => onChange(spec.name, v)}
            ariaLabel={spec.name}
          />
        );
    }
  };

  const row = (spec: ParamSpec) => (
    <div key={spec.name} className="param-controls__row">
      <span className="param-controls__name">{spec.label ?? spec.name}</span>
      {control(spec)}
    </div>
  );

  if (!grouped) {
    return <div className="param-controls">{specs.map(row)}</div>;
  }

  return (
    <div className="param-controls param-controls--grouped">
      {groups.map((group, i) => (
        <details key={group.key} className="param-group" open={i === 0}>
          <summary className="param-group__summary">
            <span className="param-group__title">{group.label}</span>
            <span className="param-group__count">{group.specs.length}</span>
          </summary>
          <div className="param-group__body">{group.specs.map(row)}</div>
        </details>
      ))}
    </div>
  );
}
