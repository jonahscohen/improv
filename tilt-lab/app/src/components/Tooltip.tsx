import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

export type TooltipPlacement = 'bottom' | 'top' | 'left';

interface TooltipProps {
  /** The text shown in the styled tooltip. */
  label: ReactNode;
  /** Where the tooltip sits relative to its trigger. Default: bottom. */
  placement?: TooltipPlacement;
  /** Hover open delay in ms. Default 0 - shows instantly like Justify; the
   * fade-in is a CSS transition on mount, not a delayed mount. Pass a positive
   * value to reintroduce a hover delay. */
  delay?: number;
  /** The trigger element to wrap (a single button/control). */
  children: ReactNode;
}

/** Gap between trigger and tooltip, and the viewport safe-margin for clamping. */
const GAP = 6;
const MARGIN = 8;

/**
 * Input-modality tracker - the testable stand-in for `:focus-visible`. A tooltip
 * should open on keyboard focus but NOT on the focus a mouse click incidentally
 * gives a button. We track the last interaction at the document level: a keydown
 * arms keyboard mode, a pointerdown disarms it. Default armed so programmatic /
 * test focus is treated as keyboard (the conservative, accessible default).
 */
let hadKeyboardEvent = true;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', () => {
    hadKeyboardEvent = true;
  }, true);
  document.addEventListener('pointerdown', () => {
    hadKeyboardEvent = false;
  }, true);
}

interface Coords {
  top: number;
  left: number;
}

export function Tooltip({ label, placement = 'bottom', delay = 0, children }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const raf = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  // Entrance gate: the tip mounts at opacity 0 + a small translateY offset, then
  // flips to `visible` on the next animation frame so the CSS opacity+transform
  // transition actually runs (matching Justify's mount-then-show fade-in). State,
  // not a delayed mount - the label is in the DOM the instant the tip opens.
  const [visible, setVisible] = useState(false);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
    setVisible(false);
  }, [clearTimer]);

  const showNow = useCallback(() => {
    clearTimer();
    setOpen(true);
  }, [clearTimer]);

  const showDelayed = useCallback(() => {
    clearTimer();
    if (delay > 0) {
      timer.current = setTimeout(() => setOpen(true), delay);
    } else {
      setOpen(true);
    }
  }, [clearTimer, delay]);

  // Position once visible: measure the trigger + the tooltip, place per the
  // requested edge, then clamp inside the viewport so far-right/edge triggers
  // (e.g. Copy config) never clip. Runs before paint to avoid a flash at 0,0.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;

    const r = trigger.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;
    if (placement === 'top') {
      top = r.top - th - GAP;
      left = r.left + r.width / 2 - tw / 2;
    } else if (placement === 'left') {
      top = r.top + r.height / 2 - th / 2;
      left = r.left - tw - GAP;
    } else {
      // bottom (default)
      top = r.bottom + GAP;
      left = r.left + r.width / 2 - tw / 2;
    }

    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - tw - MARGIN));
    top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - th - MARGIN));

    setCoords({ top, left });
  }, [open, placement, label]);

  // Entrance: once positioned, flip to `visible` on the next frame so the tip
  // transitions from opacity 0 + translateY offset to opacity 1 + translateY 0
  // (Justify's 120ms fade-in). Running it a frame after the positioned mount
  // guarantees the browser paints the start state, so the transition is seen.
  useEffect(() => {
    if (!open || !coords) return;
    raf.current = requestAnimationFrame(() => setVisible(true));
    return () => {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };
  }, [open, coords]);

  // Reposition-or-dismiss on scroll/resize: the trigger may have moved, and a
  // fixed tooltip would otherwise float in a stale spot. Cheapest correct move
  // is to close it; the user re-hovers if they still want it.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open, hide]);

  useEffect(
    () => () => {
      clearTimer();
      if (raf.current != null) cancelAnimationFrame(raf.current);
    },
    [clearTimer],
  );

  // Hover uses mouse events (not pointer events): automated browser input and
  // some input paths emit mouseenter/leave but never pointerenter, so a pointer-
  // based trigger would silently never open. mouseenter is the conventional,
  // reliably-firing tooltip trigger.
  const onMouseEnter = useCallback(() => showDelayed(), [showDelayed]);
  const onMouseLeave = useCallback(() => hide(), [hide]);
  const onFocus = useCallback(() => {
    if (hadKeyboardEvent) showNow();
  }, [showNow]);
  const onBlur = useCallback(() => hide(), [hide]);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    },
    [hide],
  );

  return (
    <span
      ref={triggerRef}
      className="tooltip-trigger"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocus}
      onBlurCapture={onBlur}
      onKeyDown={onKeyDown}
    >
      {children}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            className={visible ? 'tooltip tooltip--visible' : 'tooltip'}
            aria-hidden="true"
            data-placement={placement}
            style={
              coords
                ? { top: coords.top, left: coords.left }
                : { top: 0, left: 0, visibility: 'hidden' }
            }
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
