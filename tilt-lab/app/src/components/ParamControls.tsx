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
          const step = spec.step ?? 0.01;
          const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
          const num = Number(value);
          return (
            <label key={spec.name} className="param-controls__row">
              <span>{spec.name}</span>
              <span className="param-controls__range">
                <input
                  aria-label={spec.name}
                  type="range"
                  min={spec.min ?? 0}
                  max={spec.max ?? 1}
                  step={step}
                  value={num}
                  onChange={(e) => onChange(spec.name, Number(e.target.value))}
                />
                <output className="param-controls__value">{num.toFixed(decimals)}</output>
              </span>
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
        if (spec.type === 'file') {
          return (
            <label key={spec.name} className="param-controls__row">
              <span>{spec.name}</span>
              <input
                aria-label={spec.name}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onChange(spec.name, URL.createObjectURL(file));
                }}
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
