import { describe, it, expect } from 'vitest';
import {
  Toolbar,
  PALETTES,
  resolveTheme,
  readStoredTheme,
  writeStoredTheme,
  readStoredMarkerColor,
  writeStoredMarkerColor,
  type StorageLike,
  type ThemeMode,
} from '../../core/toolbar.js';

// Pure-fake tests only - none of these construct a Toolbar (its constructor
// paints Shadow DOM chrome). We exercise the pure palette resolver, the frozen
// palette values, the guarded localStorage helpers, and the marker-color
// setter/getter (which touch no DOM) on a prototype-only instance.

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    dump: () => Object.fromEntries(map),
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error('storage blocked');
  },
  setItem: () => {
    throw new Error('storage blocked');
  },
};

describe('resolveTheme', () => {
  it('returns the explicit choice regardless of the OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('defers to the OS preference when the choice is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('PALETTES', () => {
  it('dark preserves the pre-theme hardcoded values', () => {
    expect(PALETTES.dark).toEqual({
      surface: '#1a1a1a',
      input: '#252525',
      text: 'rgba(255,255,255,0.85)',
      textDim: 'rgba(255,255,255,0.75)',
      border: 'rgba(255,255,255,0.12)',
      borderSubtle: 'rgba(255,255,255,0.1)',
      hover: 'rgba(255,255,255,0.08)',
    });
  });

  it('light is the brand-informed warm-paper scheme', () => {
    expect(PALETTES.light).toEqual({
      surface: '#F4EFE4',
      input: '#FFFFFF',
      text: 'rgba(26,31,27,0.9)',
      textDim: 'rgba(26,31,27,0.72)',
      border: 'rgba(26,31,27,0.18)',
      borderSubtle: 'rgba(26,31,27,0.12)',
      hover: 'rgba(26,31,27,0.08)',
    });
  });
});

describe('theme persistence', () => {
  it('round-trips a stored theme', () => {
    const store = fakeStorage();
    writeStoredTheme(store, 'light');
    expect(store.dump()['justify.theme']).toBe('light');
    expect(readStoredTheme(store, 'dark')).toBe('light');
  });

  it('falls back when nothing is stored', () => {
    expect(readStoredTheme(fakeStorage(), 'dark')).toBe('dark');
    expect(readStoredTheme(undefined, 'system')).toBe('system');
  });

  it('falls back when the stored value is not a valid theme', () => {
    expect(readStoredTheme(fakeStorage({ 'justify.theme': 'neon' }), 'dark')).toBe('dark');
  });

  it('never throws when storage itself throws', () => {
    expect(readStoredTheme(throwingStorage, 'dark')).toBe('dark');
    expect(() => writeStoredTheme(throwingStorage, 'light')).not.toThrow();
  });

  it('accepts every valid theme value', () => {
    const values: ThemeMode[] = ['light', 'dark', 'system'];
    for (const v of values) {
      expect(readStoredTheme(fakeStorage({ 'justify.theme': v }), 'dark')).toBe(v);
    }
  });
});

describe('marker-color persistence', () => {
  it('round-trips a stored marker color', () => {
    const store = fakeStorage();
    writeStoredMarkerColor(store, '#3B82F6');
    expect(store.dump()['justify.markerColor']).toBe('#3B82F6');
    expect(readStoredMarkerColor(store, '#D97757')).toBe('#3B82F6');
  });

  it('falls back when the stored value is not a 6-digit hex color', () => {
    expect(readStoredMarkerColor(fakeStorage({ 'justify.markerColor': 'blue' }), '#D97757')).toBe('#D97757');
    expect(readStoredMarkerColor(fakeStorage({ 'justify.markerColor': '#FFF' }), '#D97757')).toBe('#D97757');
    expect(readStoredMarkerColor(fakeStorage(), '#D97757')).toBe('#D97757');
  });

  it('never throws when storage itself throws', () => {
    expect(readStoredMarkerColor(throwingStorage, '#D97757')).toBe('#D97757');
    expect(() => writeStoredMarkerColor(throwingStorage, '#DC2618')).not.toThrow();
  });
});

describe('Toolbar marker-color path (no DOM)', () => {
  // Object.create gives us the prototype methods without running the DOM-heavy
  // constructor. setMarkerColor / getMarkerColor / onMarkerColorChange touch no
  // DOM, so they are safe here.
  function makeToolbar(store: StorageLike | undefined, markerColor = '#D97757') {
    const t = Object.create(Toolbar.prototype) as Toolbar;
    (t as any).markerColor = markerColor;
    (t as any).markerColorCallbacks = [];
    (t as any)._storage = store;
    return t;
  }

  it('getMarkerColor reflects the restored value', () => {
    // Mirrors the constructor: this.markerColor = readStoredMarkerColor(...).
    const store = fakeStorage({ 'justify.markerColor': '#DC2618' });
    const restored = readStoredMarkerColor(store, '#D97757');
    const t = makeToolbar(store, restored);
    expect(t.getMarkerColor()).toBe('#DC2618');
  });

  it('setMarkerColor updates the getter, fires callbacks, and persists', () => {
    const store = fakeStorage();
    const t = makeToolbar(store);
    const seen: string[] = [];
    t.onMarkerColorChange((c: string) => seen.push(c));

    t.setMarkerColor('#3B82F6');

    expect(t.getMarkerColor()).toBe('#3B82F6');
    expect(seen).toEqual(['#3B82F6']);
    expect(store.dump()['justify.markerColor']).toBe('#3B82F6');
  });

  it('fires every registered callback in order', () => {
    const t = makeToolbar(undefined);
    const order: string[] = [];
    t.onMarkerColorChange(() => order.push('a'));
    t.onMarkerColorChange(() => order.push('b'));

    t.setMarkerColor('#DC2618');

    expect(order).toEqual(['a', 'b']);
  });

  it('setMarkerColor does not throw when no storage is available', () => {
    const t = makeToolbar(undefined);
    expect(() => t.setMarkerColor('#3B82F6')).not.toThrow();
    expect(t.getMarkerColor()).toBe('#3B82F6');
  });
});
