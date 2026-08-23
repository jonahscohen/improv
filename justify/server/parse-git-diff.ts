// Parse raw `git diff` output into the per-file hunk shape the Review panel renders
// (Jonah 2026-08-22). This is the server-side twin of the python parser in
// cli/justify-done.sh: the daemon now captures a per-task baseline and computes the
// diff itself in emitResponse, so a real line-by-line diff reaches the panel WITHOUT
// depending on the agent (or justify-done) to pass one. Kept byte-compatible with
// the panel's FileDiff/DiffHunk/DiffLine types.

export interface DiffLine { t: ' ' | '-' | '+'; oldNo: number | null; newNo: number | null; text: string; }
export interface DiffHunk { oldStart: number; newStart: number; header: string; lines: DiffLine[]; }
export interface FileDiff { file: string; hunks: DiffHunk[]; }

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

export function parseGitDiff(text: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  let cur: FileDiff | null = null;
  let oldNo = 0;
  let newNo = 0;
  let hunk: DiffHunk | null = null;

  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git')) {
      cur = { file: '', hunks: [] };
      diffs.push(cur);
      hunk = null;
      continue;
    }
    if (cur === null) continue;
    if (raw.startsWith('+++ ')) {
      let p = raw.slice(4).trim();
      if (p.startsWith('b/')) p = p.slice(2);
      if (p !== '/dev/null') cur.file = p; // the new-side path wins when present
      continue;
    }
    if (raw.startsWith('--- ')) {
      // Fallback filename for a DELETION, whose +++ is /dev/null. git emits --- before
      // +++, so this sets the name and +++ overrides it for a normal edit; a deletion
      // keeps this old-side path instead of being dropped for having no filename.
      let p = raw.slice(4).trim();
      if (p.startsWith('a/')) p = p.slice(2);
      if (p !== '/dev/null' && !cur.file) cur.file = p;
      continue;
    }
    const m = HUNK_RE.exec(raw);
    if (m) {
      oldNo = parseInt(m[1], 10);
      newNo = parseInt(m[2], 10);
      hunk = { oldStart: oldNo, newStart: newNo, header: m[3].trim(), lines: [] };
      cur.hunks.push(hunk);
      continue;
    }
    if (hunk === null) continue;
    if (raw.startsWith('+')) {
      hunk.lines.push({ t: '+', oldNo: null, newNo, text: raw.slice(1) });
      newNo += 1;
    } else if (raw.startsWith('-')) {
      hunk.lines.push({ t: '-', oldNo, newNo: null, text: raw.slice(1) });
      oldNo += 1;
    } else if (raw.startsWith(' ')) {
      hunk.lines.push({ t: ' ', oldNo, newNo, text: raw.slice(1) });
      oldNo += 1;
      newNo += 1;
    }
    // '\ No newline at end of file' and other markers are ignored
  }

  // Only real per-file diffs with a resolved filename and at least one hunk.
  return diffs.filter(d => d.file && d.hunks.length > 0);
}
