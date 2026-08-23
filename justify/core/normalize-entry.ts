// Coerce a Review-panel entry's array-typed fields to real, safe-to-render arrays
// (Jonah 2026-08-22). Pure (no DOM, no `this`) so the coercion is unit-testable.
//
// A response can reach the panel with an array field holding a NON-array value. The
// headless POST /respond path is not schema-validated (unlike the justify_respond MCP
// tool, whose zod schema forces `changes` to an array), so an agent that writes a
// prose note into `changes` - e.g. "No change made - deferred." - instead of a
// structured list lands a STRING in that field. Every consumer in the panel calls
// .map / .length / .filter on `changes`, `diffs`, `filesChanged`, and
// `targetSelectors`, and the `x || []` guard those consumers use only rescues
// null/undefined: a truthy string passes straight through and the first `.map`
// throws. That exception aborts render() midway, which clears the list and then
// bails - leaving the ENTIRE panel blank (no rows, no clear bar, a dead Back
// button). Coercing at the ingest boundary means one malformed entry can never take
// down the whole list.
//
// Two layers, because the same path can also send a well-typed ARRAY holding junk
// ELEMENTS (changes: [null], filesChanged: [42], diffs: ["prose"]): render then
// throws on `c.selector` / `f.split(...)` / `d.hunks`. So we drop elements the
// consumers cannot handle, not just non-array containers.

export interface EntryArrays {
  changes?: unknown;
  diffs?: unknown;
  filesChanged?: unknown;
  targetSelectors?: unknown;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// Mutates `entry` IN PLACE and returns the same reference. Identity matters: the
// Review panel shares its entry objects with the host's change history - Mark
// Done/Undo set entry.reviewed and the host persists that SAME object, and Clear
// All Completed filters the history by reviewed - so the panel must never swap in
// clones (Finding 1, Codex review 2026-08-22).
function coerceArrayFields<T extends EntryArrays>(entry: T): T {
  const e = entry as unknown as Record<string, unknown>;
  // `changes` is required by every consumer and its elements are dereferenced
  // (c.selector / c.property), so drop non-object elements too.
  e.changes = Array.isArray(e.changes) ? e.changes.filter(isObject) : [];
  // Optional: a missing field stays missing; a present one is flattened to a clean
  // array. filesChanged/targetSelectors are string lists (f.split, selector use);
  // diffs elements are dereferenced as d.hunks, which must itself be an array.
  if ('diffs' in e) {
    // A diff element must have a string `file` (the detail view does file.split) and
    // an array `hunks` (it iterates them) - drop any that would throw in the panel.
    // The daemon's computed diffs always satisfy this; this guards a malformed
    // EXPLICIT diffs array passed straight through /respond.
    e.diffs = Array.isArray(e.diffs)
      ? e.diffs.filter(d => isObject(d)
          && typeof (d as Record<string, unknown>).file === 'string'
          && Array.isArray((d as Record<string, unknown>).hunks))
      : [];
  }
  if ('filesChanged' in e) {
    e.filesChanged = Array.isArray(e.filesChanged) ? e.filesChanged.filter(f => typeof f === 'string') : [];
  }
  if ('targetSelectors' in e) {
    e.targetSelectors = Array.isArray(e.targetSelectors) ? e.targetSelectors.filter(s => typeof s === 'string') : [];
  }
  return entry;
}

// Pure: returns a normalized COPY. Safe when the caller owns a fresh object that is
// about to BECOME the canonical record (e.g. a transport response pushed onto the
// host's change history) - nothing else holds a reference to the original, so no
// identity is broken by the clone.
export function normalizeEntry<T extends EntryArrays>(entry: T): T {
  return coerceArrayFields({ ...entry } as T);
}

// In place: coerce each entry WITHOUT cloning, preserving object identity. Use this
// where the entries are already the shared/canonical objects (the panel's show()).
export function normalizeEntriesInPlace<T extends EntryArrays>(entries: T[]): T[] {
  if (!Array.isArray(entries)) return [];
  for (const e of entries) coerceArrayFields(e);
  return entries;
}
