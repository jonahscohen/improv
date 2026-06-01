import { splitHexAlpha, combineHexAlpha, toCssRgba } from '../../../../runtime/color';
import './ColorField.css';

export interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * ColorField - a swatch + alpha fader + hex label.
 *
 * The native <input type="color"> only edits 6-digit RGB, so transparency is
 * carried separately: an alpha slider drives the A channel and the value is
 * emitted as #rrggbbaa (or plain #rrggbb when fully opaque). The visible swatch
 * is an alpha-aware preview over a checkerboard, with the native picker overlaid
 * invisibly on top so it stays clickable and keyboard/screen-reader accessible.
 */
export function ColorField({ value, onChange, ariaLabel }: ColorFieldProps) {
  const { rgb, alpha } = splitHexAlpha(value);
  const setRgb = (next: string) => onChange(combineHexAlpha(next, alpha));
  const setAlpha = (a: number) => onChange(combineHexAlpha(rgb, a));

  return (
    <span className="tl-colorfield">
      <span className="tl-colorfield__swatch-wrap">
        <span
          className="tl-colorfield__preview"
          style={{ background: toCssRgba(value) }}
          aria-hidden="true"
        />
        <input
          className="tl-colorfield__swatch"
          type="color"
          aria-label={ariaLabel}
          value={rgb}
          onChange={(e) => setRgb(e.target.value)}
        />
      </span>
      <input
        className="tl-colorfield__alpha"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={alpha}
        aria-label={`${ariaLabel} alpha`}
        style={{ ['--cf-color' as string]: rgb }}
        onChange={(e) => setAlpha(Number(e.target.value))}
      />
      <span className="tl-colorfield__hex">{value}</span>
    </span>
  );
}
