// cmux NODE_OPTIONS restore shim (recreated 2026-06-11 after macOS temp cleanup).
// Strips the self-referential --require of this file from NODE_OPTIONS so child
// node processes stop depending on this temp path, preserves all other flags
// (notably --max-old-space-size), and never throws - a preload failure here
// would take down every node invocation in the session.
try {
  const SELF = 'restore-node-options.cjs';
  const toks = (process.env.NODE_OPTIONS || '').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.includes(SELF)) continue; // --require=<this file>, or a bare path token
    if ((t === '--require' || t === '-r') && toks[i + 1] && toks[i + 1].includes(SELF)) {
      i++; // skip the flag and its argument together
      continue;
    }
    out.push(t);
  }
  const cleaned = out.join(' ');
  if (cleaned !== (process.env.NODE_OPTIONS || '')) process.env.NODE_OPTIONS = cleaned;
} catch (e) {
  // never throw from a preload
}
