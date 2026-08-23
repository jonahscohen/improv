import { describe, it, expect } from 'vitest';
import { normalizeEntry, normalizeEntriesInPlace } from '../../core/normalize-entry';

// Regression for the blank-panel crash (Jonah 2026-08-22): a response landed a prose
// STRING in `changes` via the unvalidated /respond path, and the panel's `(changes ||
// []).map(...)` threw because a string is truthy - aborting render() and blanking the
// whole Review panel (no rows, no clear bar, dead Back button). Codex review then
// flagged two more: object identity must be preserved (the host mutates+persists the
// same entry object), and well-typed arrays can still hold junk elements.

describe('normalizeEntry (pure) - coerce non-array fields', () => {
  it('flattens a STRING in changes to [] (the exact field that crashed)', () => {
    const out = normalizeEntry({
      promptId: 'p1',
      summary: 'deferred',
      changes: 'No change made - deferred, unverifiable in automation.',
    });
    expect(Array.isArray(out.changes)).toBe(true);
    expect(out.changes).toEqual([]);
    expect(() => (out.changes as unknown[]).map(() => 1)).not.toThrow();
  });

  it('flattens non-array diffs / filesChanged / targetSelectors to []', () => {
    const out = normalizeEntry({
      promptId: 'p1',
      changes: 'x',
      diffs: 'nope' as unknown,
      filesChanged: 42 as unknown,
      targetSelectors: { a: 1 } as unknown,
    });
    expect(out.changes).toEqual([]);
    expect(out.diffs).toEqual([]);
    expect(out.filesChanged).toEqual([]);
    expect(out.targetSelectors).toEqual([]);
  });

  it('drops JUNK ELEMENTS from otherwise-array fields (Codex finding 2)', () => {
    const out = normalizeEntry({
      promptId: 'p1',
      changes: [null, { selector: '.a', property: 'color' }, 'oops'] as unknown[],
      filesChanged: ['a.css', 42, null] as unknown[],
      targetSelectors: ['#hero', 7] as unknown[],
      // 'prose' (not object), {hunks:'no'} (hunks not array), {hunks:[]} (no file
      // string - would throw on file.split in the detail view) all dropped.
      diffs: ['prose', { file: 'a.css', hunks: [] }, { file: 'b', hunks: 'no' }, { hunks: [] }] as unknown[],
    });
    expect(out.changes).toEqual([{ selector: '.a', property: 'color' }]);
    expect(out.filesChanged).toEqual(['a.css']);
    expect(out.targetSelectors).toEqual(['#hero']);
    expect(out.diffs).toEqual([{ file: 'a.css', hunks: [] }]);
    // the shapes consumers dereference must not throw
    expect(() => (out.changes as any[]).map(c => c.selector)).not.toThrow();
    expect(() => (out.filesChanged as any[]).map(f => f.split('.'))).not.toThrow();
    expect(() => (out.diffs as any[]).forEach(d => d.hunks.forEach(() => {}))).not.toThrow();
  });

  it('leaves valid arrays intact and preserves other fields', () => {
    const changes = [{ selector: '.a', property: 'color', oldValue: 'x', newValue: 'y' }];
    const out = normalizeEntry({
      promptId: 'p1', summary: 'real', status: 'completed', reviewed: false,
      changes, filesChanged: ['a.css'],
    });
    expect(out.changes).toEqual(changes);
    expect(out.filesChanged).toEqual(['a.css']);
    expect(out.summary).toBe('real');
    expect(out.status).toBe('completed');
    expect(out.reviewed).toBe(false);
  });

  it('missing optional fields stay missing; missing changes becomes []', () => {
    const out = normalizeEntry({ promptId: 'p1' });
    expect(out.changes).toEqual([]);
    expect('diffs' in out).toBe(false);
    expect('filesChanged' in out).toBe(false);
    expect('targetSelectors' in out).toBe(false);
  });

  it('returns a COPY (pure) - the source object is untouched', () => {
    const src = { promptId: 'p1', changes: 'bad' as unknown };
    const out = normalizeEntry(src);
    expect(out).not.toBe(src);
    expect(src.changes).toBe('bad'); // source not mutated
    expect(out.changes).toEqual([]);
  });
});

describe('normalizeEntriesInPlace - identity-preserving (Codex finding 1)', () => {
  it('mutates each entry in place and returns the SAME array and object refs', () => {
    const a = { promptId: 'a', changes: [{ selector: '.x' }], reviewed: false };
    const b = { promptId: 'b', changes: 'prose that would crash render' as unknown, reviewed: false };
    const list = [a, b];
    const out = normalizeEntriesInPlace(list);
    expect(out).toBe(list); // same array
    expect(out[0]).toBe(a); // same object refs - the host persists these
    expect(out[1]).toBe(b);
    expect(b.changes).toEqual([]); // coerced in place on the shared object
  });

  it('the host mutate-then-persist contract survives: setting reviewed on the panel entry is visible to the shared history object', () => {
    const shared = { promptId: 'p1', changes: 'bad' as unknown, reviewed: false };
    const history = [shared];
    const panelEntries = normalizeEntriesInPlace(history);
    // simulate Mark Done mutating the panel's entry
    (panelEntries[0] as any).reviewed = true;
    // the host filters ITS history object by reviewed (Clear All Completed)
    expect(history.filter(e => e.reviewed)).toHaveLength(1);
  });

  it('one bad entry never affects the others', () => {
    const out = normalizeEntriesInPlace([
      { promptId: 'a', changes: [{ selector: '.x' }] },
      { promptId: 'b', changes: 'prose' as unknown },
      { promptId: 'c', changes: [] },
    ]);
    expect(out.every(e => Array.isArray(e.changes))).toBe(true);
    expect(() => out.forEach(e => (e.changes as unknown[]).map(() => 0))).not.toThrow();
  });

  it('a non-array argument yields []', () => {
    expect(normalizeEntriesInPlace(undefined as unknown as [])).toEqual([]);
  });
});
