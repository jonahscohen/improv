import { describe, it, expect } from 'vitest';
import { parseGitDiff } from '../../server/parse-git-diff.js';

// The server-side git-diff parser (Jonah 2026-08-22) that lets the daemon compute a
// real line-by-line diff for the Review panel. Kept byte-compatible with the panel's
// FileDiff/DiffHunk/DiffLine shapes and with the python parser in justify-done.sh.

const SAMPLE = `diff --git a/style.css b/style.css
index 91067cb..aed3ba9 100644
--- a/style.css
+++ b/style.css
@@ -1,4 +1,4 @@
 .dot {
-  background: #ffffff;
+  background: #f5c518;
   opacity: 1;
 }`;

describe('parseGitDiff', () => {
  it('parses one file with a hunk into typed +/-/context lines with line numbers', () => {
    const diffs = parseGitDiff(SAMPLE);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('style.css');
    expect(diffs[0].hunks).toHaveLength(1);
    const h = diffs[0].hunks[0];
    expect(h.oldStart).toBe(1);
    expect(h.newStart).toBe(1);
    const kinds = h.lines.map(l => l.t).join('');
    expect(kinds).toBe(' -+  '); // context, removal, addition, then two context lines
    const del = h.lines.find(l => l.t === '-')!;
    const add = h.lines.find(l => l.t === '+')!;
    expect(del.text).toBe('  background: #ffffff;');
    expect(del.oldNo).toBe(2);
    expect(del.newNo).toBeNull();
    expect(add.text).toBe('  background: #f5c518;');
    expect(add.newNo).toBe(2);
    expect(add.oldNo).toBeNull();
  });

  it('parses multiple files', () => {
    const two = `diff --git a/a.css b/a.css
--- a/a.css
+++ b/a.css
@@ -1 +1 @@
-a
+b
diff --git a/b.css b/b.css
--- a/b.css
+++ b/b.css
@@ -1 +1 @@
-c
+d`;
    const diffs = parseGitDiff(two);
    expect(diffs.map(d => d.file)).toEqual(['a.css', 'b.css']);
  });

  it('drops a file with no resolved name or no hunks', () => {
    // a diff header with no +++/@@ (e.g. a pure mode change) yields nothing
    expect(parseGitDiff('diff --git a/x b/x\nold mode 100644\nnew mode 100755')).toEqual([]);
  });

  it('empty input yields []', () => {
    expect(parseGitDiff('')).toEqual([]);
  });

  it('handles a DELETION diff (--- a/old, +++ /dev/null) via the old-side name', () => {
    const del = `diff --git a/old.css b/old.css
deleted file mode 100644
--- a/old.css
+++ /dev/null
@@ -1,2 +0,0 @@
-.old {}
-/* gone */`;
    const diffs = parseGitDiff(del);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('old.css');
    expect(diffs[0].hunks[0].lines.every(l => l.t === '-')).toBe(true);
  });

  it('handles a new-file diff (+++ b/new, --- /dev/null)', () => {
    const nf = `diff --git a/new.css b/new.css
new file mode 100644
--- /dev/null
+++ b/new.css
@@ -0,0 +1,2 @@
+.new {}
+/* x */`;
    const diffs = parseGitDiff(nf);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].file).toBe('new.css');
    expect(diffs[0].hunks[0].lines.every(l => l.t === '+')).toBe(true);
  });
});
