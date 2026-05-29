import type { ParamSpec } from '../../../runtime/types';

interface Props {
  specs: ParamSpec[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function ParamControls({ specs, values, onChange }: Props) {
  return (
    <div className="param-controls">
      {specs.map((spec) => {
        const value = values[spec.name];
        if (spec.type === 'range') {
          return (
            <label key={spec.name} className="param-controls__row">
              <span>{spec.name}</span>
              <input
                aria-label={spec.name}
                type="range"
                min={spec.min ?? 0}
                max={spec.max ?? 1}
                step={spec.step ?? 0.01}
                value={Number(value)}
                onChange={(e) => onChange(spec.name, Number(e.target.value))}
              />
            </label>
          );
        }
        if (spec.type === 'color') {
          return (
            <label key={spec.name} className="param-controls__row">
              <span>{spec.name}</span>
              <input
                aria-label={spec.name}
                type="color"
                value={String(value)}
                onChange={(e) => onChange(spec.name, e.target.value)}
              />
            </label>
          );
        }
        if (spec.type === 'toggle') {
          return (
            <label key={spec.name} className="param-controls__row">
              <span>{spec.name}</span>
              <input
                aria-label={spec.name}
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(spec.name, e.target.checked)}
              />
            </label>
          );
        }
        return (
          <label key={spec.name} className="param-controls__row">
            <span>{spec.name}</span>
            <select
              aria-label={spec.name}
              value={String(value)}
              onChange={(e) => onChange(spec.name, e.target.value)}
            >
              {(spec.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
