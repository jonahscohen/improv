import { describe, it, expect, beforeEach } from 'vitest';
import { AnnotationStore } from '../../core/annotate/annotation-store.js';

describe('AnnotationStore', () => {
  let store: AnnotationStore;

  beforeEach(() => {
    store = new AnnotationStore();
  });

  it('adds annotations with auto IDs', () => {
    store.add({
      elementSelector: '.btn',
      comment: 'Button looks off',
      intent: 'fix',
      severity: 'important',
    });
    expect(store.count()).toBe(1);
    const ann = store.getAll()[0];
    expect(ann.id).toBeDefined();
  });

  it('filters by status', () => {
    store.add({
      elementSelector: '.btn',
      comment: 'First annotation',
      intent: 'fix',
      severity: 'blocking',
    });
    store.add({
      elementSelector: '.card',
      comment: 'Second annotation',
      intent: 'change',
      severity: 'suggestion',
    });
    const firstId = store.getAll()[0].id;
    store.resolve(firstId);
    expect(store.getPending()).toHaveLength(1);
  });

  it('clears all', () => {
    store.add({
      elementSelector: '.nav',
      comment: 'Nav spacing issue',
      intent: 'question',
      severity: 'suggestion',
    });
    store.clear();
    expect(store.count()).toBe(0);
  });

  it('persists the captured environment on the annotation', () => {
    const environment = {
      viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
      browser: { name: 'Chrome', version: '131' },
      os: 'macOS',
      userAgent: 'ua',
    };
    store.add({
      elementSelector: '.btn',
      comment: 'Button looks off',
      intent: 'fix',
      severity: 'important',
      environment,
    });
    expect(store.getAll()[0].environment).toEqual(environment);
  });
});
