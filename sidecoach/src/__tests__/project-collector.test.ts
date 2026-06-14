// sidecoach/src/__tests__/project-collector.test.ts
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { collectFromPath, collect, CollectionAbortedError } from '../validators/project-collector';
import { sourceKindsForEvidence } from '../product-rule-types';

function mkproj(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'p4a2-collector-'));
}

async function run() {
  // 1. a Sass-only project is discovered as scss, inspected, and usable by css-rule coverage
  {
    const dir = mkproj();
    fs.writeFileSync(path.join(dir, 'styles.scss'), '.btn:active { transform: scale(0.96); }');
    const c = await collectFromPath(dir);
    const scss = c.files.find((f) => f.path === 'styles.scss');
    if (!scss || scss.sourceKind !== 'scss') throw new Error('scss file must be discovered as scss');
    if (!c.inspectedFiles.includes('styles.scss')) throw new Error('scss file must be inspected');
    if (scss.cssText.trim().length === 0) throw new Error('scss file must carry css text');
    if (!sourceKindsForEvidence(['css-rule']).includes('scss')) throw new Error('scss must be a css-rule-compatible source kind');
    if (!scss.evidenceKindsPresent.includes('scss')) throw new Error('scss evidenceKindsPresent must include scss');
  }

  // 2. a mixed .css + .md project reports .css inspected and .md unsupported
  {
    const dir = mkproj();
    fs.writeFileSync(path.join(dir, 'a.css'), '.x { color: red; }');
    fs.writeFileSync(path.join(dir, 'README.md'), '# hi');
    const c = await collectFromPath(dir);
    if (!c.inspectedFiles.includes('a.css')) throw new Error('.css must be inspected');
    if (!c.unsupportedFiles.includes('README.md')) throw new Error('.md must be unsupported');
    const md = c.discovered.find((d) => d.path === 'README.md');
    if (!md || md.outcome !== 'unsupported' || md.sourceKind !== 'extension:.md') throw new Error('.md must record the matrix-derived unsupported extension kind');
  }

  // 3. an oversized supported file remains discovered and skipped (not inspected)
  {
    const dir = mkproj();
    fs.writeFileSync(path.join(dir, 'big.css'), 'a'.repeat(2 * 1024 * 1024 + 16));
    fs.writeFileSync(path.join(dir, 'small.css'), '.y { color: blue; }');
    const c = await collectFromPath(dir);
    if (c.files.some((f) => f.path === 'big.css')) throw new Error('oversized file must not be read into files');
    const big = c.discovered.find((d) => d.path === 'big.css');
    if (!big || big.outcome !== 'oversized') throw new Error('oversized supported file must stay discovered with outcome oversized');
    if (!c.skippedFiles.includes('big.css')) throw new Error('oversized file must appear in skippedFiles');
    if (!c.inspectedFiles.includes('small.css')) throw new Error('the small css file must still be inspected');
  }

  // 4. a read-failure seam records unreadable (not silently dropped)
  if (!(typeof process.getuid === 'function' && process.getuid() === 0)) {
    const dir = mkproj();
    const locked = path.join(dir, 'locked.css');
    fs.writeFileSync(locked, '.z { color: green; }');
    fs.chmodSync(locked, 0o000);
    try {
      const c = await collectFromPath(dir);
      const rec = c.discovered.find((d) => d.path === 'locked.css');
      if (!rec || rec.outcome !== 'unreadable') throw new Error('a read-failure must be recorded unreadable, never dropped');
      if (!c.unreadableFiles.includes('locked.css')) throw new Error('unreadable file must appear in unreadableFiles');
    } finally {
      fs.chmodSync(locked, 0o644);
    }
  }

  // 5. a missing/unreadable root throws (validator-level collection failure)
  {
    let threw = false;
    try { await collectFromPath(path.join(os.tmpdir(), 'p4a2-does-not-exist-' + process.pid)); }
    catch { threw = true; }
    if (!threw) throw new Error('a missing root must throw');
  }

  // 6. cooperative async collection: a slow MULTI-FILE collection must YIELD to the
  //    event loop (a concurrent timer keeps firing) and abort PROMPTLY on signal. The
  //    abort is fired by the timer itself, so a synchronous (blocking) collector would
  //    never let the timer fire, never abort, and fail this test - the precise red.
  {
    const dir = mkproj();
    for (let i = 0; i < 500; i++) fs.writeFileSync(path.join(dir, `f${i}.css`), `.c${i} { color: red; transition: opacity 1s; }`);
    let ticks = 0;
    const ac = new AbortController();
    const timer = setInterval(() => { ticks++; if (ticks === 2) ac.abort(); }, 1);
    let aborted = false;
    try { await collect({ projectPath: dir }, ac.signal); }
    catch (e) { aborted = e instanceof CollectionAbortedError; }
    finally { clearInterval(timer); }
    if (ticks < 2) throw new Error('a slow multi-file collection must yield to the event loop so the timer can fire');
    if (!aborted) throw new Error('a slow multi-file collection must abort promptly on signal');
  }

  console.log('project-collector: OK');
}
run();
