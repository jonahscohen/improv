import { describe, it, expect, beforeEach } from 'vitest';
import { PreviewEngine } from '../../core/preview-engine';

describe('PreviewEngine', () => {
  let engine: PreviewEngine;

  beforeEach(() => {
    engine = new PreviewEngine();
  });

  it('tracks changes by selector + property', () => {
    engine.applyChange('.btn', 'padding', '16px');
    engine.applyChange('.card', 'color', 'red');
    expect(engine.getChanges()).toHaveLength(2);
  });

  it('overwrites same selector + property', () => {
    engine.applyChange('.btn', 'padding', '8px');
    engine.applyChange('.btn', 'padding', '16px');
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].newValue).toBe('16px');
  });

  it('removes a specific change', () => {
    engine.applyChange('.btn', 'padding', '16px');
    engine.applyChange('.card', 'color', 'red');
    engine.removeChange('.btn', 'padding');
    const changes = engine.getChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].selector).toBe('.card');
  });

  it('clears all changes', () => {
    engine.applyChange('.btn', 'padding', '16px');
    engine.applyChange('.card', 'color', 'red');
    engine.clearAll();
    expect(engine.getChanges()).toHaveLength(0);
  });

  it('generates CSS rules with !important', () => {
    engine.applyChange('.btn', 'padding', '16px');
    const css = engine.generateCSS();
    expect(css).toContain('.btn');
    expect(css).toContain('!important');
  });

  it('generates unique rule per selector', () => {
    engine.applyChange('.btn', 'padding', '16px');
    engine.applyChange('.btn', 'color', 'red');
    engine.applyChange('.card', 'margin', '8px');
    const css = engine.generateCSS();
    const btnMatches = css.match(/\.btn\s*\{/g) ?? [];
    const cardMatches = css.match(/\.card\s*\{/g) ?? [];
    expect(btnMatches).toHaveLength(1);
    expect(cardMatches).toHaveLength(1);
  });
});
