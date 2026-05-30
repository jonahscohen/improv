import { useEffect, useRef, useState } from 'react';
import './Slider.css';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

/**
 * Range slider with a styled track + accent fill + thumb and a tabular numeric
 * readout. The readout is a pro-tool scrubber: drag it horizontally to adjust
 * (left=down, right=up), double-click to type an exact value, or focus it and
 * use arrow keys. Hold Shift on any of those paths for 10x larger steps. Every
 * path funnels through the same clamp+step+onChange as the range input, so the
 * result is identical regardless of how the value was entered.
 *
 * a11y: the range input remains the canonical accessible control (it keeps the
 * ariaLabel and native semantics). The scrubber is a sighted-pointer/keyboard
 * augmentation layered on top.
 */
export function Slider({ value, min = 0, max = 1, step = 0.01, onChange, ariaLabel }: SliderProps) {
  const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
  const num = Number.isFinite(value) ? value : min;
  const span = max - min;
  const pct = span > 0 ? ((num - min) / span) * 100 : 0;

  const scrubRef = useRef<HTMLSpanElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);
  const editingRef = useRef(false);
  const prevEditing = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Clamp to [min,max] and snap to the nearest step (relative to min), killing
  // floating-point noise so 0.1 + 0.2 reads as 0.3.
  const quantize = (v: number): number => {
    const clamped = Math.min(max, Math.max(min, v));
    const steps = step > 0 ? Math.round((clamped - min) / step) : 0;
    const snapped = step > 0 ? min + steps * step : clamped;
    const bounded = Math.min(max, Math.max(min, snapped));
    return Number(bounded.toFixed(10));
  };

  const emit = (v: number) => onChange(quantize(v));

  // --- Scrub (pointer drag on the readout) -------------------------------
  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    scrubRef.current?.focus();
    dragRef.current = { startX: e.clientX, startValue: num };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const PX_PER_STEP = 4; // travel needed to move one step
    const mult = e.shiftKey ? 10 : 1;
    const stepsMoved = Math.round((e.clientX - drag.startX) / PX_PER_STEP);
    emit(drag.startValue + stepsMoved * step * mult);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // --- Keyboard nudge (arrows when the readout is focused) ---------------
  const onScrubKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    const mult = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      emit(num + step * mult);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      emit(num - step * mult);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      startEditing();
    }
  };

  // --- Type-to-edit (double-click the readout) ---------------------------
  const startEditing = () => {
    setDraft(num.toFixed(decimals));
    editingRef.current = true;
    setEditing(true);
  };

  const finishEdit = (commit: boolean) => {
    if (!editingRef.current) return;
    editingRef.current = false;
    if (commit) {
      const parsed = Number(draft);
      if (Number.isFinite(parsed) && draft.trim() !== '') emit(parsed);
    }
    setEditing(false);
  };

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEdit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finishEdit(false);
    }
  };

  // Return focus to the scrubber only when closing an edit that was actually
  // open (never on initial mount, which would steal focus to the last-mounted
  // slider). Opening focus + select-all is handled by the edit input's own
  // autoFocus + onFocus so the selection survives the double-click mouseup
  // (a select() in this effect can be cleared by the browser's caret placement
  // that follows the dblclick).
  useEffect(() => {
    if (!editing && prevEditing.current) {
      scrubRef.current?.focus();
    }
    prevEditing.current = editing;
    // Only react to the open/close transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  return (
    <span className="tl-slider">
      <input
        className="tl-slider__input"
        aria-label={ariaLabel}
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        // expose fill percentage to CSS so the track shows progress
        style={{ ['--tl-slider-pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {editing ? (
        <input
          ref={editRef}
          className="tl-slider__edit"
          aria-label={`${ariaLabel} exact value`}
          type="text"
          inputMode="decimal"
          // autoFocus + select-all on focus: entering edit mode selects the
          // existing value so the first keystroke replaces it (Figma/TD
          // convention), instead of merging into the old digits.
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={onEditKeyDown}
          onBlur={() => finishEdit(true)}
        />
      ) : (
        <span
          ref={scrubRef}
          className="tl-slider__value"
          tabIndex={0}
          title="Drag to adjust. Double-click to type. Arrow keys to nudge (Shift = 10x)."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={startEditing}
          onKeyDown={onScrubKeyDown}
        >
          {num.toFixed(decimals)}
        </span>
      )}
    </span>
  );
}
