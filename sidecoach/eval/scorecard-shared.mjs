/**
 * Shared scorecard-collection invariants used by BOTH scorecard-collect.mjs (writes + --resume) and
 * scorecard-mapping.mjs (validates before reading). Keeping the version, the content hash, and the
 * record-completeness predicate in ONE place guarantees collect and mapping can never disagree about what
 * counts as a usable cache record (Codex item-8 pass2 #2).
 */
import { createHash } from 'node:crypto';

// Bump when the cache-record schema or a detector invocation changes; a record from an older version is
// treated as incomplete (re-run by collect, rejected by mapping), so neither ever mixes stale + fresh.
export const COLLECTOR_VERSION = 3; // v3: objective/subjective decoupled into separate subprocesses (+sidecoachObjectiveAvailable)

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// A cache record is COMPLETE iff it is from THIS collector version, matches the current page content hash,
// and carries the full both-tool schema (availability booleans, findings arrays, per-tool wall-times).
export function isCompleteRecord(rec, corpusSha) {
  return !!rec
    && rec.collectorVersion === COLLECTOR_VERSION
    && rec.corpusSha === corpusSha
    && typeof rec.sidecoachAvailable === 'boolean' && typeof rec.oracleAvailable === 'boolean'
    // v3: both per-source availability bits + per-source timings required (Codex review: schema integrity should
    // match the collector's written record, not just the one field the scorer happens to read).
    && typeof rec.sidecoachObjectiveAvailable === 'boolean' && typeof rec.sidecoachSubjectiveAvailable === 'boolean'
    && typeof rec.sidecoachObjectiveMs === 'number' && typeof rec.sidecoachSubjectiveMs === 'number'
    && Array.isArray(rec.sidecoach) && Array.isArray(rec.oracle)
    && typeof rec.sidecoachMs === 'number' && typeof rec.oracleMs === 'number';
}
