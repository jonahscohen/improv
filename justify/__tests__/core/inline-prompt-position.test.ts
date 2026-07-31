import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InlinePrompt, clampPromptLeft } from '../../core/prompt/inline-prompt.js';

// show() positioning contract: the input sits below the selection unless that
// would run past the viewport bottom (reserving room for the button row that
// appears while typing) - then it flips ABOVE the selection (aboveY = the
// selection's top edge), and as a last resort clamps inside the viewport.
// Pure fakes - the logic only writes style properties and reads offsetHeight.

function makePrompt(containerHeight = 40) {
  const p = Object.create(InlinePrompt.prototype) as InlinePrompt;
  (p as any).input = {
    style: { setProperty: () => {} },
    value: '',
    focus: () => {},
  };
  (p as any).container = {
    style: {} as Record<string, string>,
    offsetHeight: containerHeight,
  };
  return p;
}

function stubViewport(innerHeight: number) {
  vi.stubGlobal('window', { innerHeight });
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    cb();
    return 0;
  });
}

describe('InlinePrompt.show viewport flip', () => {
  beforeEach(() => {
    stubViewport(800);
  });

  it('keeps the input below the selection when there is room', () => {
    const p = makePrompt();
    p.show(100, 200, 100);
    expect((p as any).container.style.top).toBe('200px');
  });

  it('flips above the selection when the below position would bleed off-viewport', () => {
    const p = makePrompt();
    // y 760 + h 40 + reserve 28 = 828 > 800 - 8 -> flip to aboveY 700 - 40 - 12
    p.show(100, 760, 700);
    expect((p as any).container.style.top).toBe('648px');
  });

  it('flips even when the below position only hugs the bottom edge (button-row reserve)', () => {
    stubViewport(850);
    const p = makePrompt();
    // The regression case: 807 + 40 fits "on screen" but leaves no room for
    // the button row. 807 + 40 + 28 = 875 > 842 -> flip to 790 - 52 = 738.
    p.show(100, 807, 790);
    expect((p as any).container.style.top).toBe('738px');
  });

  it('clamps inside the viewport when no aboveY is provided', () => {
    const p = makePrompt();
    // flip target = innerHeight 800 - 40 - 12 = 748
    p.show(100, 760);
    expect((p as any).container.style.top).toBe('748px');
  });

  it('clamps to the bottom margin when there is no room above either', () => {
    const p = makePrompt();
    // aboveY 30 -> flipped -22 < margin -> clamp to 800 - 40 - 8 = 752
    p.show(100, 760, 30);
    expect((p as any).container.style.top).toBe('752px');
  });

  it('remains visible after positioning', () => {
    const p = makePrompt();
    p.show(100, 200, 100);
    expect((p as any).container.style.visibility).toBe('visible');
    expect((p as any).container.style.display).toBe('flex');
    expect(p.visible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Horizontal protection. Reported by Jonah 2026-07-31 with a screenshot: the
// prompt bleeding off the right edge, its left corner clipped. The vertical axis
// had clampPromptTop applied at all three writers of container.top; nothing
// clamped container.left, and callers derive x by centring a 300px input on the
// selection (rect.left + rect.width/2 - 150), so a selection near either edge
// pushes the panel off-screen.
describe('clampPromptLeft', () => {
  const W = 388; // 300px input + two 36px buttons + two 8px gaps

  const at = (vw: number) => {
    vi.stubGlobal('window', { innerWidth: vw, innerHeight: 800 });
  };

  it('leaves a comfortably-placed prompt where it is', () => {
    at(1440);
    expect(clampPromptLeft(400, W)).toBe(400);
  });

  it('pulls a negative x back to the margin', () => {
    at(1440);
    expect(clampPromptLeft(-120, W)).toBe(8);
  });

  it('pulls an overflowing x back to the right margin', () => {
    at(1440);
    expect(clampPromptLeft(1300, W)).toBe(1440 - W - 8);
  });

  it('handles the reported case: a narrow viewport with the panel past the edge', () => {
    at(646);
    expect(clampPromptLeft(620, W)).toBe(646 - W - 8);
  });

  it('sits flush at the margin when the panel is wider than the viewport', () => {
    // Clamping alone cannot save this; the container's max-width shrinks the input.
    at(360);
    expect(clampPromptLeft(500, W)).toBe(8);
  });

  it('never leaves the viewport, for any position at any width', () => {
    for (let vw = 200; vw <= 2000; vw += 7) {
      at(vw);
      for (let x = -500; x <= vw + 500; x += 13) {
        const left = clampPromptLeft(x, W);
        expect(left).toBeGreaterThanOrEqual(8);
        if (vw - W - 8 > 8) expect(left + W).toBeLessThanOrEqual(vw - 8);
      }
    }
  });
});
