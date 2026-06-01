export interface PointerPos {
  x: number;
  y: number;
}

/** A discrete press/release event captured during a frame (canvas-relative). */
export interface PointerEventPos {
  x: number;
  y: number;
}

/** Everything that happened to the pointer during one frame, consumed once. */
export interface PointerFrame {
  /** Accumulated wheel delta (vertical) since the last frame; 0 if none. */
  wheel: number;
  /** Press (pointerdown / touchstart) events since the last frame. */
  downs: PointerEventPos[];
  /** Release (pointerup) events since the last frame. */
  ups: PointerEventPos[];
}

/**
 * Tracks pointer position + pressed state relative to a host element, and
 * queues the discrete press/release/wheel events that occurred during a frame.
 * Pointer Events unify mouse + touch + pen, so this is interaction-complete:
 * hover (down=false), drag (down=true), click (down/up edges), and scroll.
 * The Compositor reads position()/isDown() and drains consumeFrame() once per
 * frame, then dispatches to every effect.
 */
export class PointerTracker {
  private pos: PointerPos = { x: 0, y: 0 };
  private down = false;
  private wheel = 0;
  private downs: PointerEventPos[] = [];
  private ups: PointerEventPos[] = [];

  private rel(e: MouseEvent): PointerPos {
    const rect = this.host.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onMove = (e: Event) => {
    this.pos = this.rel(e as MouseEvent);
  };

  private onDown = (e: Event) => {
    const p = this.rel(e as MouseEvent);
    this.pos = p;
    this.down = true;
    this.downs.push({ x: p.x, y: p.y });
  };

  private onUp = (e: Event) => {
    const p = this.rel(e as MouseEvent);
    this.pos = p;
    this.down = false;
    this.ups.push({ x: p.x, y: p.y });
  };

  private onCancel = () => {
    this.down = false;
  };

  private onWheel = (e: Event) => {
    const we = e as WheelEvent;
    // Capture scroll into the effect rather than the page (the preview is a
    // stage, not a scroll region). Effects that ignore wheel just never read it.
    we.preventDefault();
    this.wheel += we.deltaY;
    this.pos = this.rel(we);
  };

  constructor(private host: HTMLElement) {
    host.addEventListener('pointermove', this.onMove);
    host.addEventListener('pointerdown', this.onDown);
    // up/cancel on window so a drag that ends outside the host still releases.
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    host.addEventListener('wheel', this.onWheel, { passive: false });
  }

  position(): PointerPos {
    return this.pos;
  }

  isDown(): boolean {
    return this.down;
  }

  /** Drain and reset the per-frame event accumulators (call once per frame). */
  consumeFrame(): PointerFrame {
    const frame: PointerFrame = { wheel: this.wheel, downs: this.downs, ups: this.ups };
    this.wheel = 0;
    this.downs = [];
    this.ups = [];
    return frame;
  }

  dispose(): void {
    this.host.removeEventListener('pointermove', this.onMove);
    this.host.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    this.host.removeEventListener('wheel', this.onWheel);
  }
}
