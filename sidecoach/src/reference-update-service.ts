// Reference Update Service
//
// On-demand updater for the five bundled reference systems (component-gallery,
// design-references, fontshare, icon-source, motion-reference). This is the local,
// user-owned counterpart to a hosted reference catalog: the bundles live on disk,
// the user owns them, and an update MERGES an upstream refresh into the local copy
// WITHOUT clobbering the user's own captured references.
//
// TWO-LOCATION MODEL
//   upstream  - the canonical bundles that ship with sidecoach (repo `bundles/`,
//               resolved relative to this module). Read-only source of truth,
//               versioned via `metadata.version` + `versions.changelog`.
//   local     - the user-owned, writable copy a project actually consumes
//               (default `~/.claude/sidecoach/reference-bundles/`). This is what
//               carries the user's merged captures forward across refreshes.
//   captures  - the real `/curate` catalog at `~/.claude/design-references/`
//               (`<slug>/ref.md` with YAML frontmatter). Folded into the
//               design-references bundle's `userCaptured` map on apply.
//
// GUARANTEES
//   - check() is a pure read: it never writes. It compares local vs upstream by
//     version AND by a content hash (so a same-version-but-drifted local reads as
//     stale), and reports how many user captures would be preserved.
//   - apply() is fail-closed and atomic per system: it builds the merged bundle in
//     memory, validates it, writes to a temp file, then renames into place. A read,
//     parse, or validation failure leaves the local bundle BYTE-UNCHANGED - never a
//     partial or corrupt write.
//   - The merge is union-preserving: captures already present on the local copy AND
//     captures scanned from the curate catalog both survive an upstream refresh. A
//     user capture is never lost.
//
// This module does NO network I/O and starts NO scheduler. "Update" means "refresh
// the local copy from the bundles that shipped with this install, on request."

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// The five bundled reference systems. Names match the bundle filenames
// (`<name>.json`) in both the upstream and local directories.
export const REFERENCE_SYSTEMS = [
  'component-gallery',
  'design-references',
  'fontshare',
  'icon-source',
  'motion-reference',
] as const;

export type ReferenceSystemName = (typeof REFERENCE_SYSTEMS)[number];

// Per-system required top-level keys, checked in addition to metadata. A bundle that
// is missing its required keys is treated as invalid and is never written to local.
const REQUIRED_KEYS: Record<ReferenceSystemName, [string, string]> = {
  'component-gallery': ['interactionStates', 'components'],
  'design-references': ['colorPalettes', 'spatialSystems'],
  fontshare: ['fontCategories', 'useCases'],
  'icon-source': ['libraries', 'categories'],
  'motion-reference': ['easingCurves', 'motionPatterns'],
};

export type CheckStatus = 'current' | 'stale' | 'not-installed' | 'error';
export type ApplyStatus = 'installed' | 'refreshed' | 'unchanged' | 'failed';
export type ErrorClass = 'upstream' | 'validation' | 'io';

export interface CheckResult {
  system: ReferenceSystemName;
  status: CheckStatus;
  localVersion: string | null;
  upstreamVersion: string | null;
  // Why an update is (or is not) available: 'version' (upstream version differs),
  // 'content' (same version, content drifted), 'missing-local', or an error message.
  reason: string;
  // How many user captures the local copy currently carries plus how many the curate
  // catalog would contribute - i.e. the captures an apply would preserve/merge.
  userCaptures: number;
}

export interface ApplyResult {
  system: ReferenceSystemName;
  status: ApplyStatus;
  previousVersion: string | null;
  newVersion: string | null;
  mergedUserCaptures: number;
  bytesWritten: number;
  error?: string;
  errorClass?: ErrorClass;
}

export interface DesignMdUpdate {
  updated: boolean;
  path: string;
  reason: string; // 'written' | 'no-design-md' | 'no-installed-systems' | 'unchanged' | ...
  // True only for an actual read/write FAILURE (not a legitimate skip). The CLI maps
  // this to a nonzero io exit so a swallowed DESIGN.md error is never a silent success.
  failed: boolean;
}

export interface UpdateServiceOptions {
  // Read-only canonical bundles. Defaults to the repo `bundles/` dir next to `dist/`.
  upstreamDir?: string;
  // Writable user-owned copy. Defaults to ~/.claude/sidecoach/reference-bundles.
  localDir?: string;
  // The /curate catalog. Defaults to ~/.claude/design-references.
  capturesDir?: string;
  // DESIGN.md to stamp with installed versions. Defaults to <cwd>/DESIGN.md; only
  // touched when the file already exists (never created).
  designMdPath?: string;
}

// A parsed curate-catalog capture. Mirrors the DesignReference shape produced by
// reference-data.ts's loadDesignReferences(), keyed by slug in the bundle.
export interface CapturedReference {
  id: string;
  title: string;
  category: string;
  patterns: string[];
  feel: string[];
  source: string;
  url: string;
  saved: string;
  description: string;
}

const START_MARKER = '<!-- sidecoach:reference-bundles:start -->';
const END_MARKER = '<!-- sidecoach:reference-bundles:end -->';

export class ReferenceUpdateService {
  private upstreamDir: string;
  private localDir: string;
  private capturesDir: string;
  private designMdPath: string;

  constructor(options: UpdateServiceOptions = {}) {
    this.upstreamDir =
      options.upstreamDir ?? path.resolve(__dirname, '..', 'bundles');
    this.localDir =
      options.localDir ??
      path.join(os.homedir(), '.claude', 'sidecoach', 'reference-bundles');
    this.capturesDir =
      options.capturesDir ?? path.join(os.homedir(), '.claude', 'design-references');
    this.designMdPath =
      options.designMdPath ?? path.join(process.cwd(), 'DESIGN.md');
  }

  getPaths(): { upstreamDir: string; localDir: string; capturesDir: string; designMdPath: string } {
    return {
      upstreamDir: this.upstreamDir,
      localDir: this.localDir,
      capturesDir: this.capturesDir,
      designMdPath: this.designMdPath,
    };
  }

  // ----- CHECK (pure read; never writes) -----------------------------------

  check(): CheckResult[] {
    const catalog = this.scanCaptures();
    return REFERENCE_SYSTEMS.map((system) => this.checkSystem(system, catalog));
  }

  private checkSystem(
    system: ReferenceSystemName,
    catalog: Record<string, CapturedReference>
  ): CheckResult {
    let upstream: any;
    try {
      upstream = this.readBundle(this.upstreamPath(system));
    } catch (err) {
      // A broken upstream is an error the caller must see, not a silent "current".
      return {
        system,
        status: 'error',
        localVersion: null,
        upstreamVersion: null,
        reason: `upstream unreadable: ${errMsg(err)}`,
        userCaptures: 0,
      };
    }
    const upstreamVersion = bundleVersion(upstream);

    const localExists = fs.existsSync(this.localPath(system));
    if (!localExists) {
      return {
        system,
        status: 'not-installed',
        localVersion: null,
        upstreamVersion,
        reason: 'missing-local',
        userCaptures: this.captureCountFor(system, null, catalog),
      };
    }

    let local: any;
    try {
      local = this.readBundle(this.localPath(system));
    } catch (err) {
      // A corrupt local copy is stale by definition - an apply would replace it.
      return {
        system,
        status: 'stale',
        localVersion: null,
        upstreamVersion,
        reason: `local unreadable: ${errMsg(err)}`,
        userCaptures: this.captureCountFor(system, null, catalog),
      };
    }

    const localVersion = bundleVersion(local);
    const userCaptures = this.captureCountFor(system, local, catalog);

    if (localVersion !== upstreamVersion) {
      return { system, status: 'stale', localVersion, upstreamVersion, reason: 'version', userCaptures };
    }
    if (contentHash(local) !== contentHash(upstream)) {
      return { system, status: 'stale', localVersion, upstreamVersion, reason: 'content', userCaptures };
    }
    return { system, status: 'current', localVersion, upstreamVersion, reason: 'up-to-date', userCaptures };
  }

  // ----- APPLY (fail-closed, atomic per system) ----------------------------

  // Installs/refreshes the requested systems (default: every stale or not-installed
  // one). Each system is independent: a failure on one leaves its local copy
  // unchanged and does not abort the others. DESIGN.md is stamped once at the end
  // with whatever is installed after the run.
  apply(opts: { systems?: ReferenceSystemName[]; onlyStale?: boolean; stampDesignMd?: boolean } = {}): {
    results: ApplyResult[];
    designMd: DesignMdUpdate;
  } {
    const catalog = this.scanCaptures();
    const onlyStale = opts.onlyStale ?? true;
    const stampDesignMd = opts.stampDesignMd ?? true;

    let targets: ReferenceSystemName[];
    if (opts.systems && opts.systems.length) {
      targets = opts.systems;
    } else if (onlyStale) {
      // Include 'error' systems (e.g. a broken upstream) so they surface as a failed
      // apply and a nonzero exit, rather than being silently dropped from the run.
      targets = this.check()
        .filter((c) => c.status === 'stale' || c.status === 'not-installed' || c.status === 'error')
        .map((c) => c.system);
    } else {
      targets = [...REFERENCE_SYSTEMS];
    }

    const results = targets.map((system) => this.applySystem(system, catalog));

    // Stamp DESIGN.md only if at least one system was actually written (or already
    // installed) - a run that failed everything must not rewrite the doc.
    const anyWritten = results.some((r) => r.status === 'installed' || r.status === 'refreshed');
    const designMd: DesignMdUpdate =
      stampDesignMd && anyWritten
        ? this.updateDesignMd()
        : {
            updated: false,
            path: this.designMdPath,
            reason: stampDesignMd ? 'no-write-this-run' : 'disabled',
            failed: false,
          };

    return { results, designMd };
  }

  private applySystem(
    system: ReferenceSystemName,
    catalog: Record<string, CapturedReference>
  ): ApplyResult {
    const localPath = this.localPath(system);
    const localExisted = fs.existsSync(localPath);

    // 1. Read upstream (the "fetch"). Failure here = upstream error, local untouched.
    let upstream: any;
    try {
      upstream = this.readBundle(this.upstreamPath(system));
    } catch (err) {
      return this.failure(system, 'upstream', err, localExisted ? this.safeVersion(localPath) : null);
    }

    // 2. Read the existing local copy (if any) to carry its captures forward. If a
    //    present local copy cannot be parsed, REFUSE to overwrite it: it may hold
    //    captures not in the catalog, and a blind replace would silently lose them.
    //    Fail closed - leave the file byte-unchanged and report an io error.
    let existingLocal: any = null;
    if (localExisted) {
      try {
        existingLocal = this.readBundle(localPath);
      } catch (err) {
        return this.failure(
          system,
          'io',
          new Error(`local copy unreadable; refusing to overwrite (would risk losing captures): ${errMsg(err)}`),
          null
        );
      }
    }
    const previousVersion = existingLocal ? bundleVersion(existingLocal) : null;

    // 3. Build the merged bundle in memory (union-preserving captures).
    const { merged, mergedCount } = mergeBundle(system, upstream, existingLocal, catalog);

    // 4. Validate BEFORE writing. Invalid merge = validation error, local untouched.
    if (!validateBundle(merged, system)) {
      return this.failure(
        system,
        'validation',
        new Error('merged bundle failed structural validation'),
        previousVersion
      );
    }

    // 5. Short-circuit: if local already byte-matches what we would write, do nothing.
    const serialized = JSON.stringify(merged, null, 2) + '\n';
    if (localExisted && existingLocal && fileMatches(localPath, serialized)) {
      return {
        system,
        status: 'unchanged',
        previousVersion,
        newVersion: bundleVersion(merged),
        mergedUserCaptures: mergedCount,
        bytesWritten: 0,
      };
    }

    // 6. Atomic write (temp + rename). Failure = io error, local untouched.
    try {
      this.ensureLocalDir();
      atomicWrite(localPath, serialized);
    } catch (err) {
      return this.failure(system, 'io', err, previousVersion);
    }

    return {
      system,
      status: localExisted ? 'refreshed' : 'installed',
      previousVersion,
      newVersion: bundleVersion(merged),
      mergedUserCaptures: mergedCount,
      bytesWritten: Buffer.byteLength(serialized),
    };
  }

  private failure(
    system: ReferenceSystemName,
    errorClass: ErrorClass,
    err: unknown,
    previousVersion: string | null
  ): ApplyResult {
    return {
      system,
      status: 'failed',
      previousVersion,
      newVersion: previousVersion,
      mergedUserCaptures: 0,
      bytesWritten: 0,
      error: errMsg(err),
      errorClass,
    };
  }

  // ----- DESIGN.md stamp (idempotent, comment-bracketed) --------------------

  // Records the versions of the currently-installed local bundles in a managed block
  // bracketed by HTML comment markers. It uses a bold label + table rather than a
  // `##` heading so it does not add a section to a Google-spec DESIGN.md body. Only
  // runs when DESIGN.md already exists; never creates it.
  private updateDesignMd(): DesignMdUpdate {
    const p = this.designMdPath;
    if (!fs.existsSync(p)) {
      return { updated: false, path: p, reason: 'no-design-md', failed: false };
    }

    const installed = this.installedVersions();
    if (!installed.length) {
      return { updated: false, path: p, reason: 'no-installed-systems', failed: false };
    }

    const rows = installed.map((e) => `| ${e.system} | ${e.version} | ${today()} |`).join('\n');
    const block = [
      START_MARKER,
      '**Reference bundles** (managed by sidecoach-refs - do not edit by hand)',
      '',
      '| System | Version | Installed |',
      '| --- | --- | --- |',
      rows,
      END_MARKER,
    ].join('\n');

    let content: string;
    try {
      content = fs.readFileSync(p, 'utf-8');
    } catch (err) {
      return { updated: false, path: p, reason: `read failed: ${errMsg(err)}`, failed: true };
    }

    let next: string;
    const start = content.indexOf(START_MARKER);
    const end = content.indexOf(END_MARKER);
    if (start !== -1 && end !== -1 && end > start) {
      next = content.slice(0, start) + block + content.slice(end + END_MARKER.length);
    } else {
      const sep = content.endsWith('\n') ? '\n' : '\n\n';
      next = content + sep + block + '\n';
    }

    if (next === content) {
      return { updated: false, path: p, reason: 'unchanged', failed: false };
    }
    try {
      atomicWrite(p, next);
    } catch (err) {
      return { updated: false, path: p, reason: `write failed: ${errMsg(err)}`, failed: true };
    }
    return { updated: true, path: p, reason: 'written', failed: false };
  }

  private installedVersions(): { system: ReferenceSystemName; version: string }[] {
    const out: { system: ReferenceSystemName; version: string }[] = [];
    for (const system of REFERENCE_SYSTEMS) {
      const lp = this.localPath(system);
      if (!fs.existsSync(lp)) continue;
      try {
        out.push({ system, version: bundleVersion(this.readBundle(lp)) });
      } catch {
        // Skip a corrupt local copy from the stamp.
      }
    }
    return out;
  }

  // ----- Captures (the real /curate catalog) --------------------------------

  // Scans ~/.claude/design-references/<slug>/ref.md and parses the YAML frontmatter
  // into CapturedReference records keyed by slug. Soft-fails per entry so one
  // malformed ref.md never sinks the scan. Mirrors reference-data.ts parsing.
  private scanCaptures(): Record<string, CapturedReference> {
    const out: Record<string, CapturedReference> = {};
    if (!fs.existsSync(this.capturesDir)) return out;

    let folders: string[];
    try {
      folders = fs.readdirSync(this.capturesDir);
    } catch {
      return out;
    }

    for (const folder of folders) {
      if (folder.startsWith('.') || folder.startsWith('_')) continue; // skip _vocab, dotdirs
      const refPath = path.join(this.capturesDir, folder, 'ref.md');
      let content: string;
      try {
        if (!fs.statSync(path.join(this.capturesDir, folder)).isDirectory()) continue;
        if (!fs.existsSync(refPath)) continue;
        content = fs.readFileSync(refPath, 'utf-8');
      } catch {
        continue;
      }
      const parsed = parseCaptureRef(folder, content);
      if (parsed) out[folder] = parsed;
    }
    return out;
  }

  // Count of captures an apply would preserve for a system: existing local captures
  // unioned with catalog captures (design-references only). Mirrors mergeBundle.
  private captureCountFor(
    system: ReferenceSystemName,
    local: any,
    catalog: Record<string, CapturedReference>
  ): number {
    const keys = new Set<string>();
    if (local && local.userCaptured && typeof local.userCaptured === 'object') {
      for (const k of Object.keys(local.userCaptured)) keys.add(k);
    }
    if (system === 'design-references') {
      for (const k of Object.keys(catalog)) keys.add(k);
    }
    return keys.size;
  }

  // ----- path + io helpers --------------------------------------------------

  private upstreamPath(system: ReferenceSystemName): string {
    return path.join(this.upstreamDir, `${system}.json`);
  }

  private localPath(system: ReferenceSystemName): string {
    return path.join(this.localDir, `${system}.json`);
  }

  private readBundle(filePath: string): any {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private safeVersion(filePath: string): string | null {
    try {
      return bundleVersion(this.readBundle(filePath));
    } catch {
      return null;
    }
  }

  private ensureLocalDir(): void {
    fs.mkdirSync(this.localDir, { recursive: true });
  }
}

// ----- pure helpers ---------------------------------------------------------

function bundleVersion(bundle: any): string {
  return (
    (bundle && bundle.metadata && bundle.metadata.version) ||
    (bundle && bundle.versions && bundle.versions.current) ||
    '0.0.0'
  );
}

// Stable stringify (sorted keys) so the content hash is deterministic regardless of
// key order. Excludes the local-only `userCaptured` map so a captured local copy is
// not reported as content-drifted from a capture-free upstream.
function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function contentHash(bundle: any): string {
  const { userCaptured, ...rest } = bundle && typeof bundle === 'object' ? bundle : {};
  void userCaptured;
  return crypto.createHash('sha256').update(stableStringify(rest)).digest('hex');
}

// Union-preserving merge: fresh upstream content + (existing local captures UNION
// curate-catalog captures). Catalog wins on slug conflict (it is the fresher source
// of truth for a capture). A user capture present in either source always survives.
export function mergeBundle(
  system: ReferenceSystemName,
  upstream: any,
  existingLocal: any,
  catalog: Record<string, CapturedReference>
): { merged: any; mergedCount: number } {
  const merged = deepClone(upstream);

  const captured: Record<string, any> = {};
  if (existingLocal && existingLocal.userCaptured && typeof existingLocal.userCaptured === 'object') {
    Object.assign(captured, existingLocal.userCaptured);
  }
  if (system === 'design-references') {
    for (const [slug, rec] of Object.entries(catalog)) {
      captured[slug] = rec;
    }
  }

  const count = Object.keys(captured).length;
  if (count > 0) {
    merged.userCaptured = captured;
  }
  return { merged, mergedCount: count };
}

export function validateBundle(data: any, system: ReferenceSystemName): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.metadata || !data.metadata.name || !data.metadata.version) return false;
  const req = REQUIRED_KEYS[system];
  if (!req) return false;
  return req.every((key) => key in data && data[key] != null);
}

// Parse a curate ref.md into a CapturedReference. Frontmatter is `key: value` with
// `patterns`/`feel` as `[a, b, c]` lists and quoted strings for title/source/url.
function parseCaptureRef(slug: string, content: string): CapturedReference | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatter, body] = match;
  const meta: Record<string, any> = {};

  for (const line of frontmatter.split('\n')) {
    if (!line.trim() || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (key === 'patterns' || key === 'feel') {
      meta[key] = value
        .replace(/[[\]]/g, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      meta[key] = value.replace(/^"(.*)"$/, '$1');
    }
  }

  return {
    id: slug,
    title: meta.title || 'Untitled',
    category: meta.category || 'reference',
    patterns: meta.patterns || [],
    feel: meta.feel || [],
    source: meta.source || '',
    url: meta.url || '',
    saved: meta.saved || '',
    description: (body || '').trim(),
  };
}

// Atomic write: temp file in the same directory + rename. rename(2) is atomic on
// POSIX within a filesystem, so a reader never observes a half-written bundle and a
// crash mid-write leaves the previous file intact.
function atomicWrite(finalPath: string, data: string): void {
  const dir = path.dirname(finalPath);
  const tmp = path.join(
    dir,
    `.${path.basename(finalPath)}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
  );
  try {
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, finalPath);
  } catch (err) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
}

function fileMatches(filePath: string, content: string): boolean {
  try {
    return fs.readFileSync(filePath, 'utf-8') === content;
  } catch {
    return false;
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}
