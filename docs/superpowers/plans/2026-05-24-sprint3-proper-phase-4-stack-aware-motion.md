# Sprint 3 Proper (Phase 4): Stack-Aware Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `flow-handler-motion-integration` emit framework-appropriate GSAP loading + cleanup code based on the project's detected tech stack, expanding detection to cover Angular + WordPress + Drupal + HubSpot alongside the existing SPA frameworks.

**Architecture:** Two new pieces and one extended file. (1) `project-context.ts` gains `detectStackFromFilesystem(projectPath)` which runs before the existing `package.json` sniff and looks for top-level CMS/Angular markers (wp-config.php, theme.json, composer.json with drupal/*, angular.json) with strict priority ordering. (2) A new pure-data module `motion-stack-idioms.ts` ships 11 `MotionIdiom` records keyed by framework, each with a loading pattern + cleanup pattern + a real GSAP code snippet for that stack. (3) `flow-handler-motion-integration.ts` reads the framework from enriched context, looks up the idiom, and appends a "Stack-specific implementation" block to its guidance plus a `'template'` artifact.

**Tech Stack:** TypeScript, Node 18+, `npx ts-node` for tests, no new runtime dependencies. The GSAP snippets themselves reference common GSAP 3.x APIs (`gsap.from`, `gsap.context`, `useGSAP` from `@gsap/react`).

**Branch:** `main` (Sprint 2 and Sprint 3 prep already merged here). Per the established pattern, commits land directly on local `main`; not pushed to origin until the user decides.

**Hook awareness (carry forward from every prior sprint):**
1. `npx ts-node ...test.ts` sets `~/.claude/.needs-verification`. Use the FOUR-bash-call commit pattern: (a) edit memory, (b) `rm -f ~/.claude/.needs-verification`, (c) edit memory AGAIN, (d) commit.
2. Always pass absolute `cd /Users/spare3/Documents/Github/claude-dotfiles` in commit calls.
3. Never `git add -A` or `git add .` (working tree has dirty `dist/*`, `test-site-1/*`, etc.).
4. If commit fails complaining about memory-dirty, edit memory once more and retry.

---

## File Structure

**New files (4):**

| File | Responsibility |
|------|----------------|
| `sidecoach/src/motion-stack-idioms.ts` | Pure-data module: 11 `MotionIdiom` records (one per framework value) + `getMotionIdiom()` accessor with `unknown` -> `vanilla` fallback. No I/O. |
| `sidecoach/src/__tests__/sprint3-motion-stack-detection.test.ts` | Detection unit test - creates temp project dirs with various CMS markers, asserts `detectTechStack(tempPath).framework` returns the expected value. |
| `sidecoach/src/__tests__/sprint3-motion-stack-idioms.test.ts` | Data module unit test - asserts every framework value in the union resolves to a non-null record with populated fields and stack-specific keywords in the snippet. |
| `sidecoach/src/__tests__/sprint3-motion-stack-integration.test.ts` | Handler integration test - instantiates `FlowHMotionIntegrationHandler` with two stack contexts (drupal, wordpress), asserts each result's guidance contains the right snippet + the `'template'` artifact is present. |

**Modified files (3):**

| File | Change |
|------|--------|
| `sidecoach/src/project-context.ts` | Extend `TechStack.framework` union to add `'angular' \| 'wordpress' \| 'drupal' \| 'hubspot'`. Add `detectStackFromFilesystem(projectPath)` helper. Wire it into `detectTechStack` BEFORE the existing package.json sniff. |
| `sidecoach/src/flow-handler-motion-integration.ts` | Import `getMotionIdiom`. Inside `execute()`, after the existing guidance literal, append a `Stack-specific implementation (framework=...)` block + push a `'template'`-typed artifact named `Motion code template: <framework>`. |
| `.claude/memory/MEMORY.md` | Add a single Sprint 3 proper close-out index entry (in T4). |

---

## Task 1: Extend TechStack.framework + detectStackFromFilesystem

**Files:**
- Modify: `sidecoach/src/project-context.ts`
- Create: `sidecoach/src/__tests__/sprint3-motion-stack-detection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint3-motion-stack-detection.test.ts`:

```typescript
import { detectTechStack } from '../project-context';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sprint3-stack-'));
}

(() => {
  // Angular detection: angular.json at root
  const angularDir = makeTmpDir();
  fs.writeFileSync(path.join(angularDir, 'angular.json'), '{"projects":{}}');
  assertEq(detectTechStack(angularDir).framework, 'angular', 'angular.json detects as angular');

  // WordPress detection via wp-config.php
  const wpDir = makeTmpDir();
  fs.writeFileSync(path.join(wpDir, 'wp-config.php'), '<?php // WP config\n');
  assertEq(detectTechStack(wpDir).framework, 'wordpress', 'wp-config.php detects as wordpress');

  // WordPress detection via style.css with theme header
  const wpThemeDir = makeTmpDir();
  fs.writeFileSync(
    path.join(wpThemeDir, 'style.css'),
    '/*\nTheme Name: Yes And Theme\nAuthor: Yes And\n*/\n'
  );
  assertEq(detectTechStack(wpThemeDir).framework, 'wordpress', 'style.css with Theme Name detects as wordpress');

  // Drupal detection via composer.json with drupal/* requirement
  const drupalDir = makeTmpDir();
  fs.writeFileSync(
    path.join(drupalDir, 'composer.json'),
    JSON.stringify({ require: { 'drupal/core': '^10.0' } })
  );
  assertEq(detectTechStack(drupalDir).framework, 'drupal', 'composer.json with drupal/core detects as drupal');

  // Drupal detection via top-level *.info.yml
  const drupalInfoDir = makeTmpDir();
  fs.writeFileSync(path.join(drupalInfoDir, 'mymodule.info.yml'), 'name: Test Module\ntype: module\n');
  assertEq(detectTechStack(drupalInfoDir).framework, 'drupal', '*.info.yml detects as drupal');

  // HubSpot detection via theme.json with cms field
  const hubspotDir = makeTmpDir();
  fs.writeFileSync(
    path.join(hubspotDir, 'theme.json'),
    JSON.stringify({ cms: 'hubspot', template_types: ['page'] })
  );
  assertEq(detectTechStack(hubspotDir).framework, 'hubspot', 'theme.json with HubSpot cms field detects as hubspot');

  // HubSpot detection via hubl_modules/ dir
  const hubspotModulesDir = makeTmpDir();
  fs.mkdirSync(path.join(hubspotModulesDir, 'hubl_modules'));
  assertEq(detectTechStack(hubspotModulesDir).framework, 'hubspot', 'hubl_modules/ detects as hubspot');

  // PRIORITY: CMS detection wins over package.json sniff
  const priorityDir = makeTmpDir();
  fs.writeFileSync(path.join(priorityDir, 'wp-config.php'), '<?php\n');
  fs.writeFileSync(
    path.join(priorityDir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0' } })
  );
  assertEq(detectTechStack(priorityDir).framework, 'wordpress', 'wp-config.php + react package.json -> wordpress (CMS priority)');

  // PRIORITY: angular.json wins over package.json sniff
  const angularPriorityDir = makeTmpDir();
  fs.writeFileSync(path.join(angularPriorityDir, 'angular.json'), '{}');
  fs.writeFileSync(
    path.join(angularPriorityDir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0' } })
  );
  assertEq(detectTechStack(angularPriorityDir).framework, 'angular', 'angular.json + react package.json -> angular');

  // FALLBACK: empty dir returns vanilla (existing behavior preserved)
  const emptyDir = makeTmpDir();
  assertEq(detectTechStack(emptyDir).framework, 'vanilla', 'empty dir -> vanilla fallback');

  // FALLBACK: package.json without CMS marker still detects react
  const reactOnlyDir = makeTmpDir();
  fs.writeFileSync(
    path.join(reactOnlyDir, 'package.json'),
    JSON.stringify({ dependencies: { react: '^18.0.0' } })
  );
  assertEq(detectTechStack(reactOnlyDir).framework, 'react', 'package.json with react and no CMS -> react');

  console.log('sprint3-motion-stack-detection PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint3-motion-stack-detection.test.ts 2>&1 | head -10
```

Expected: FAIL on the first angular assertion - `detectTechStack` does not yet recognize `angular.json`, so it falls through to the package.json sniff which returns `'vanilla'` for an empty package-less dir. The test exits with code 1 on the FIRST failed assertion.

- [ ] **Step 3: Extend the `TechStack.framework` union**

In `sidecoach/src/project-context.ts`, find the `TechStack` interface (around line 178-184):

Old:
```typescript
export interface TechStack {
  framework: 'react' | 'next' | 'vue' | 'svelte' | 'astro' | 'remix' | 'vanilla' | 'unknown';
  hasAnimationLib: boolean;
  animationLib?: 'gsap' | 'framer-motion' | 'motion' | 'lenis' | 'anime' | null;
  hasTypescript: boolean;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
}
```

New:
```typescript
export interface TechStack {
  framework:
    | 'react'
    | 'next'
    | 'vue'
    | 'svelte'
    | 'astro'
    | 'remix'
    | 'angular'
    | 'wordpress'
    | 'drupal'
    | 'hubspot'
    | 'vanilla'
    | 'unknown';
  hasAnimationLib: boolean;
  animationLib?: 'gsap' | 'framer-motion' | 'motion' | 'lenis' | 'anime' | null;
  hasTypescript: boolean;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
}
```

- [ ] **Step 4: Add the `detectStackFromFilesystem` helper**

Still in `sidecoach/src/project-context.ts`, ABOVE the existing `detectTechStack` function (around line 186), add:

```typescript
/**
 * Detect CMS / Angular projects by sniffing the project root for marker files.
 * Runs BEFORE the package.json sniff inside detectTechStack so CMS markers
 * win over a package.json that may also be present (e.g. a WordPress project
 * with @wordpress/scripts for Gutenberg block work).
 *
 * Returns null if no CMS / Angular marker is found - the caller should then
 * fall through to the existing package.json detection.
 */
export function detectStackFromFilesystem(
  projectPath: string
): 'angular' | 'wordpress' | 'drupal' | 'hubspot' | null {
  // 1. Angular: angular.json at root
  if (fs.existsSync(path.join(projectPath, 'angular.json'))) {
    return 'angular';
  }

  // 2. WordPress: wp-config.php OR style.css with `Theme Name:` theme header
  if (fs.existsSync(path.join(projectPath, 'wp-config.php'))) {
    return 'wordpress';
  }
  const stylePath = path.join(projectPath, 'style.css');
  if (fs.existsSync(stylePath)) {
    try {
      const header = fs.readFileSync(stylePath, 'utf8').split('\n').slice(0, 50).join('\n');
      if (/^\s*Theme Name:\s*\S/m.test(header)) {
        return 'wordpress';
      }
    } catch {
      // unreadable style.css - ignore and continue
    }
  }

  // 3. Drupal: composer.json with drupal/* requirement OR any top-level *.info.yml
  const composerPath = path.join(projectPath, 'composer.json');
  if (fs.existsSync(composerPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerPath, 'utf8'));
      const allReqs = { ...(composer.require || {}), ...(composer['require-dev'] || {}) };
      if (Object.keys(allReqs).some((k) => k.startsWith('drupal/'))) {
        return 'drupal';
      }
    } catch {
      // malformed composer.json - ignore and continue
    }
  }
  try {
    const entries = fs.readdirSync(projectPath);
    if (entries.some((e) => e.endsWith('.info.yml'))) {
      return 'drupal';
    }
  } catch {
    // unreadable dir - ignore
  }

  // 4. HubSpot: theme.json with HubSpot fields OR hubl_modules/ OR hs-config* file
  const themePath = path.join(projectPath, 'theme.json');
  if (fs.existsSync(themePath)) {
    try {
      const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
      if (
        theme.cms === 'hubspot' ||
        Array.isArray(theme.template_types) ||
        theme.label !== undefined
      ) {
        return 'hubspot';
      }
    } catch {
      // malformed theme.json - ignore and continue
    }
  }
  if (fs.existsSync(path.join(projectPath, 'hubl_modules'))) {
    return 'hubspot';
  }
  try {
    const entries = fs.readdirSync(projectPath);
    if (entries.some((e) => /^hs-config/.test(e))) {
      return 'hubspot';
    }
  } catch {
    // unreadable dir - already handled above
  }

  return null;
}
```

- [ ] **Step 5: Wire `detectStackFromFilesystem` into `detectTechStack`**

In `sidecoach/src/project-context.ts`, find the existing `detectTechStack` function (starts around line 186). After it reads `package.json` but BEFORE the framework variable assignments, call the filesystem detector and short-circuit if it returns non-null.

Current shape (around lines 186-220):
```typescript
export function detectTechStack(projectPath: string): TechStack {
  const pkgPath = path.join(projectPath, 'package.json');
  let pkg: any = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return { framework: 'vanilla', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' };
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  let framework: TechStack['framework'] = 'vanilla';
  if (deps['next']) framework = 'next';
  else if (deps['@remix-run/react'] || deps['remix']) framework = 'remix';
  else if (deps['astro']) framework = 'astro';
  else if (deps['svelte']) framework = 'svelte';
  else if (deps['vue']) framework = 'vue';
  else if (deps['react']) framework = 'react';
  // ... rest of function
```

The behavior we need:
1. If `detectStackFromFilesystem` returns a CMS/Angular marker, that wins (skip package.json detection but still record `hasTypescript`, `animationLib`, etc.).
2. If `package.json` is missing AND filesystem detection finds nothing, return vanilla.
3. If `package.json` is missing BUT filesystem detection finds a CMS, use the CMS framework but default the other fields.

Replace the function body's opening:

```typescript
export function detectTechStack(projectPath: string): TechStack {
  // CMS / Angular detection first - these markers take priority over package.json
  // because CMS projects often have a package.json for build tooling (e.g. WordPress
  // with @wordpress/scripts for Gutenberg) but the actual runtime framework is the CMS.
  const fsFramework = detectStackFromFilesystem(projectPath);

  const pkgPath = path.join(projectPath, 'package.json');
  let pkg: any = {};
  let pkgExists = true;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    pkgExists = false;
  }

  // If no package.json AND no CMS marker, fall back to vanilla.
  if (!pkgExists && !fsFramework) {
    return { framework: 'vanilla', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' };
  }

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // Resolve framework: CMS detection wins; otherwise package.json sniff.
  let framework: TechStack['framework'];
  if (fsFramework) {
    framework = fsFramework;
  } else if (deps['next']) framework = 'next';
  else if (deps['@remix-run/react'] || deps['remix']) framework = 'remix';
  else if (deps['astro']) framework = 'astro';
  else if (deps['svelte']) framework = 'svelte';
  else if (deps['vue']) framework = 'vue';
  else if (deps['react']) framework = 'react';
  else framework = 'vanilla';

  // ... rest of function unchanged (animationLib, packageManager, hasTypescript)
```

The "rest of function unchanged" means: keep the existing `animationLib` detection block, `hasTypescript` check, and `packageManager` detection block exactly as they currently are. Only the framework-detection section is rewritten.

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint3-motion-stack-detection.test.ts
```

Expected:
- tsc exit 0
- Test prints `sprint3-motion-stack-detection PASS`

If any assertion fails, the test stdout names the specific case. Investigate before forcing the test to pass.

- [ ] **Step 7: Commit (FOUR-bash-call pattern)**

Bash call A: Edit `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-24_sprint3_proper_execution.md` (create if absent with frontmatter `name: session-2026-05-24-sprint3-proper-execution`, `description: ...`, `type: project`). Append:

```
- T1: extended TechStack.framework union to 12 values (added angular, wordpress, drupal, hubspot). Added detectStackFromFilesystem() helper with priority-ordered marker sniffing. Wired into detectTechStack so CMS markers win over package.json. 12 detection assertions pass.
```

If the file doesn't exist, create it with this frontmatter:

```
---
name: session-2026-05-24-sprint3-proper-execution
description: Sprint 3 proper execution log - Phase 4 stack-aware motion. Implements the spec at docs/superpowers/specs/2026-05-24-sidecoach-phase-4-stack-aware-motion-design.md.
type: project
relates_to: [session_2026-05-24_sprint3_proper_design.md, session_2026-05-24_sprint3_prep_closed.md]
---

Human collaborator: Jonah.

## Execution log

```

Then add the T1 line above.

Bash call B: `rm -f ~/.claude/.needs-verification`

Bash call C: Edit the memory file AGAIN (one more line, e.g. `- T1 commit retry: re-touching memory after rm flag-clear.`).

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/project-context.ts sidecoach/src/__tests__/sprint3-motion-stack-detection.test.ts .claude/memory/session_2026-05-24_sprint3_proper_execution.md && git commit -m "feat(sidecoach): detect Angular + WordPress + Drupal + HubSpot stacks via filesystem markers (Phase 4 T1)"
```

---

## Task 2: Build motion-stack-idioms.ts

**Files:**
- Create: `sidecoach/src/motion-stack-idioms.ts`
- Test: `sidecoach/src/__tests__/sprint3-motion-stack-idioms.test.ts`

11 `MotionIdiom` records (one per framework value in the union; `unknown` resolves to `vanilla` via the accessor).

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint3-motion-stack-idioms.test.ts`:

```typescript
import { getMotionIdiom, MotionIdiom } from '../motion-stack-idioms';
import { TechStack } from '../project-context';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(() => {
  // Every framework value must resolve to a non-null record.
  const allFrameworks: TechStack['framework'][] = [
    'react', 'next', 'remix',
    'vue', 'svelte', 'astro',
    'angular',
    'wordpress', 'drupal', 'hubspot',
    'vanilla', 'unknown',
  ];

  for (const fw of allFrameworks) {
    const idiom = getMotionIdiom(fw);
    assertTrue(idiom != null, `${fw} resolves to non-null idiom`);
    assertTrue(idiom.loadingPattern.length > 0, `${fw} has non-empty loadingPattern`);
    assertTrue(idiom.cleanupPattern.length > 0, `${fw} has non-empty cleanupPattern`);
    assertTrue(idiom.scopeBoundary.length > 0, `${fw} has non-empty scopeBoundary`);
    assertTrue(idiom.exampleSnippet.length > 0, `${fw} has non-empty exampleSnippet`);
    assertTrue(Array.isArray(idiom.notes), `${fw} has notes array`);
  }

  // 'unknown' resolves to the same content as 'vanilla' (fallback semantics).
  const unknownIdiom = getMotionIdiom('unknown');
  const vanillaIdiom = getMotionIdiom('vanilla');
  assertTrue(
    unknownIdiom.exampleSnippet === vanillaIdiom.exampleSnippet,
    'unknown idiom falls back to vanilla content'
  );

  // Stack-specific keyword spot-checks - snippets must look like the framework they claim to be.
  const wp = getMotionIdiom('wordpress');
  assertTrue(
    /wp_enqueue_script|jQuery|\$\(function/.test(wp.exampleSnippet),
    `wordpress snippet contains wp_enqueue_script / jQuery / $(function: ${wp.exampleSnippet.slice(0, 80)}`
  );

  const drupal = getMotionIdiom('drupal');
  assertTrue(
    /Drupal\.behaviors/.test(drupal.exampleSnippet),
    `drupal snippet contains Drupal.behaviors: ${drupal.exampleSnippet.slice(0, 80)}`
  );

  const angular = getMotionIdiom('angular');
  assertTrue(
    /@Component|ngOnInit|ngOnDestroy/.test(angular.exampleSnippet),
    `angular snippet contains @Component / ngOnInit / ngOnDestroy: ${angular.exampleSnippet.slice(0, 80)}`
  );

  const react = getMotionIdiom('react');
  assertTrue(
    /useGSAP|@gsap\/react/.test(react.exampleSnippet),
    `react snippet uses useGSAP: ${react.exampleSnippet.slice(0, 80)}`
  );

  const hubspot = getMotionIdiom('hubspot');
  assertTrue(
    /pagehide|gsap\.context/.test(hubspot.exampleSnippet),
    `hubspot snippet has pagehide cleanup or gsap.context: ${hubspot.exampleSnippet.slice(0, 80)}`
  );

  const svelte = getMotionIdiom('svelte');
  assertTrue(
    /onMount/.test(svelte.exampleSnippet),
    `svelte snippet uses onMount: ${svelte.exampleSnippet.slice(0, 80)}`
  );

  const vue = getMotionIdiom('vue');
  assertTrue(
    /onBeforeUnmount|onMounted/.test(vue.exampleSnippet),
    `vue snippet uses onMounted/onBeforeUnmount: ${vue.exampleSnippet.slice(0, 80)}`
  );

  const astro = getMotionIdiom('astro');
  assertTrue(
    /astro:before-swap|<script>/.test(astro.exampleSnippet),
    `astro snippet has astro:before-swap or <script>: ${astro.exampleSnippet.slice(0, 80)}`
  );

  const vanilla = getMotionIdiom('vanilla');
  assertTrue(
    /DOMContentLoaded|<script src=/.test(vanilla.exampleSnippet),
    `vanilla snippet has DOMContentLoaded or <script src=: ${vanilla.exampleSnippet.slice(0, 80)}`
  );

  console.log('sprint3-motion-stack-idioms PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint3-motion-stack-idioms.test.ts 2>&1 | head -5
```

Expected: FAIL - "Cannot find module '../motion-stack-idioms'".

- [ ] **Step 3: Write the data module**

Create `sidecoach/src/motion-stack-idioms.ts`:

```typescript
// Per-framework GSAP loading + cleanup idioms.
// Pure data + accessor. No I/O.
//
// Each framework value in TechStack.framework has its own MotionIdiom record.
// 'unknown' resolves to the vanilla idiom via the accessor's fallback.

import { TechStack } from './project-context';

export interface MotionIdiom {
  framework: TechStack['framework'];
  loadingPattern: string;
  cleanupPattern: string;
  scopeBoundary: string;
  exampleSnippet: string;
  notes: string[];
}

// Shared snippet for react/next/remix - all use the @gsap/react useGSAP hook.
const REACT_LIKE_SNIPPET = `import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

export function HeroReveal() {
  const containerRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from('.headline', {
      y: 40,
      opacity: 0,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.08,
    });
  }, { scope: containerRef });
  return <div ref={containerRef}>{/* ... */}</div>;
}`;

const REACT_LIKE_NOTES = [
  '@gsap/react provides useGSAP which auto-disposes the GSAP context on unmount',
  'scope option restricts selectors to the ref - safer than global selectors',
];

const VANILLA_SNIPPET = `<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script>
  let ctx;
  document.addEventListener('DOMContentLoaded', () => {
    ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,
      });
    });
  });
  window.addEventListener('beforeunload', () => ctx?.revert());
</script>`;

const IDIOMS: Record<TechStack['framework'], MotionIdiom> = {
  react: {
    framework: 'react',
    loadingPattern: 'npm install gsap @gsap/react; import useGSAP from @gsap/react inside the component',
    cleanupPattern: 'useGSAP auto-disposes the underlying gsap.context on unmount',
    scopeBoundary: 'component unmount',
    exampleSnippet: REACT_LIKE_SNIPPET,
    notes: REACT_LIKE_NOTES,
  },
  next: {
    framework: 'next',
    loadingPattern: 'npm install gsap @gsap/react; import useGSAP inside a client component ("use client")',
    cleanupPattern: 'useGSAP auto-disposes on unmount; ensure SSR-safe by gating on a client component',
    scopeBoundary: 'client component unmount',
    exampleSnippet: REACT_LIKE_SNIPPET,
    notes: [
      ...REACT_LIKE_NOTES,
      'Animations require a "use client" component - server components cannot use refs or effects',
    ],
  },
  remix: {
    framework: 'remix',
    loadingPattern: 'npm install gsap @gsap/react; import useGSAP inside the route component',
    cleanupPattern: 'useGSAP auto-disposes on route change / unmount',
    scopeBoundary: 'route component unmount',
    exampleSnippet: REACT_LIKE_SNIPPET,
    notes: REACT_LIKE_NOTES,
  },
  vue: {
    framework: 'vue',
    loadingPattern: 'npm install gsap; import in <script setup>; create gsap.context() inside onMounted',
    cleanupPattern: 'onBeforeUnmount + ctx.revert() disposes the context',
    scopeBoundary: 'component unmount',
    exampleSnippet: `<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import gsap from 'gsap';

const containerRef = ref<HTMLElement | null>(null);
let ctx: gsap.Context | null = null;

onMounted(() => {
  ctx = gsap.context(() => {
    gsap.from('.headline', {
      y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
    });
  }, containerRef.value!);
});

onBeforeUnmount(() => {
  ctx?.revert();
});
</script>

<template>
  <div ref="containerRef"><!-- ... --></div>
</template>`,
    notes: [
      'Pass the ref element as the gsap.context() scope to restrict selectors',
      'ctx.revert() reverses every transform GSAP applied - safe to call multiple times',
    ],
  },
  svelte: {
    framework: 'svelte',
    loadingPattern: 'npm install gsap; import in <script>; create gsap.context() inside onMount',
    cleanupPattern: 'onMount returns a cleanup function that calls ctx.revert()',
    scopeBoundary: 'component unmount',
    exampleSnippet: `<script lang="ts">
  import { onMount } from 'svelte';
  import gsap from 'gsap';
  let container: HTMLElement;

  onMount(() => {
    const ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    }, container);
    return () => ctx.revert();
  });
</script>

<div bind:this={container}><!-- ... --></div>`,
    notes: [
      'onMount returning a function is the canonical Svelte cleanup pattern',
      'Pass the bound element as gsap.context() scope for safe selectors',
    ],
  },
  astro: {
    framework: 'astro',
    loadingPattern: 'Add a <script> block (client-side); import gsap. For client islands, use the framework-specific idiom instead.',
    cleanupPattern: 'Listen for astro:before-swap (View Transitions) and call ctx.revert() before navigation',
    scopeBoundary: 'page navigation (View Transitions)',
    exampleSnippet: `---
// HeroReveal.astro
---
<div class="hero"><!-- ... --></div>

<script>
  import gsap from 'gsap';
  let ctx: gsap.Context;
  function init() {
    ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    });
  }
  init();
  // View Transitions API cleanup
  document.addEventListener('astro:before-swap', () => ctx?.revert());
</script>`,
    notes: [
      'Without View Transitions, the script runs once on initial page load - no cleanup needed',
      'For React/Vue/Svelte islands inside Astro, use that framework\'s motion idiom instead',
    ],
  },
  angular: {
    framework: 'angular',
    loadingPattern: 'npm install gsap; inject ElementRef in the component; use gsap.context() manually (no canonical useGSAP wrapper for Angular)',
    cleanupPattern: 'ngOnDestroy + ctx.revert() disposes the context',
    scopeBoundary: 'component destroy',
    exampleSnippet: `import { Component, ElementRef, OnInit, OnDestroy } from '@angular/core';
import gsap from 'gsap';

@Component({
  selector: 'app-hero-reveal',
  template: '<div #container><!-- ... --></div>',
})
export class HeroRevealComponent implements OnInit, OnDestroy {
  private ctx: gsap.Context | null = null;
  constructor(private host: ElementRef<HTMLElement>) {}
  ngOnInit() {
    this.ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    }, this.host.nativeElement);
  }
  ngOnDestroy() {
    this.ctx?.revert();
  }
}`,
    notes: [
      'No canonical useGSAP for Angular - the lifecycle wrapper is hand-rolled',
      'Pass host.nativeElement as gsap.context() scope to restrict selectors to this component',
    ],
  },
  wordpress: {
    framework: 'wordpress',
    loadingPattern: 'wp_enqueue_script in functions.php to load GSAP from CDN; wrap theme JS in jQuery noConflict',
    cleanupPattern: '$(window).on("beforeunload", () => ctx.revert()) handles page unload',
    scopeBoundary: 'page lifecycle',
    exampleSnippet: `// In functions.php (theme or child theme):
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_script(
    'gsap',
    'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
    [],
    '3.12.5',
    true
  );
  wp_enqueue_script(
    'theme-motion',
    get_stylesheet_directory_uri() . '/assets/js/motion.js',
    ['gsap', 'jquery'],
    wp_get_theme()->get('Version'),
    true
  );
});

// In assets/js/motion.js:
(function ($) {
  let ctx;
  $(function () {
    ctx = gsap.context(() => {
      gsap.from('.headline', {
        y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
      });
    });
  });
  $(window).on('beforeunload', () => ctx?.revert());
})(jQuery);`,
    notes: [
      'WordPress ships jQuery in noConflict mode - always wrap theme JS in the (function ($) {})(jQuery) IIFE',
      'enqueueing in the footer (5th arg `true`) prevents render-blocking',
      'For Gutenberg block editor work, prefer the react idiom inside the block component',
    ],
  },
  drupal: {
    framework: 'drupal',
    loadingPattern: 'Declare in MODULE.libraries.yml with GSAP as external CDN dep; in JS use Drupal.behaviors.X = { attach, detach }',
    cleanupPattern: 'detach() runs ctx.revert() - also fires when AJAX content is removed',
    scopeBoundary: 'behavior detach (works on AJAX-loaded content too)',
    exampleSnippet: `# In MODULE.libraries.yml:
hero_motion:
  version: 1.x
  js:
    js/hero-motion.js: {}
  dependencies:
    - core/drupalSettings
    - core/once
  external:
    - https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js

// In js/hero-motion.js:
(function (Drupal, once) {
  Drupal.behaviors.heroMotion = {
    attach: function (context) {
      once('hero-motion', '.hero', context).forEach((el) => {
        const ctx = gsap.context(() => {
          gsap.from(el.querySelector('.headline'), {
            y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
          });
        }, el);
        el._heroMotionCtx = ctx;
      });
    },
    detach: function (context, settings, trigger) {
      if (trigger !== 'unload') return;
      context.querySelectorAll('.hero').forEach((el) => el._heroMotionCtx?.revert());
    },
  };
})(Drupal, once);`,
    notes: [
      'once() prevents re-attaching to the same element on subsequent AJAX cycles',
      'detach fires on Drupal AJAX content removal too, not just page navigation',
      'Storing ctx on the DOM element (el._heroMotionCtx) lets detach find it cleanly',
    ],
  },
  hubspot: {
    framework: 'hubspot',
    loadingPattern: 'Load GSAP via CDN ESM import (no jQuery dep on HubSpot); use gsap.context() in the module JS field',
    cleanupPattern: 'window.addEventListener("pagehide", () => ctx.revert(), { once: true })',
    scopeBoundary: 'page lifecycle',
    exampleSnippet: `// In your module's js field (module.js):
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3/+esm';

const ctx = gsap.context(() => {
  gsap.from('.headline', {
    y: 40, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08,
  });
}, document.querySelector('.hero'));

window.addEventListener('pagehide', () => ctx.revert(), { once: true });`,
    notes: [
      'HubSpot does not include jQuery by default - use vanilla querySelector instead',
      'pagehide fires more reliably than beforeunload on mobile Safari',
      'For multiple modules on the same page, scope each gsap.context() to its own root selector',
    ],
  },
  vanilla: {
    framework: 'vanilla',
    loadingPattern: '<script src=...> tag for GSAP from CDN, then DOMContentLoaded listener for the animation code',
    cleanupPattern: 'beforeunload handler calls ctx.revert()',
    scopeBoundary: 'page lifecycle',
    exampleSnippet: VANILLA_SNIPPET,
    notes: [
      'For ES module setups, import gsap from a bundler entry point instead of a script tag',
      'gsap.context() is optional for a single one-shot animation - it shines when multiple animations share lifecycle',
    ],
  },
  unknown: {
    framework: 'unknown',
    loadingPattern: '<script src=...> tag for GSAP from CDN, then DOMContentLoaded listener for the animation code',
    cleanupPattern: 'beforeunload handler calls ctx.revert()',
    scopeBoundary: 'page lifecycle (unknown stack - falling back to vanilla)',
    exampleSnippet: VANILLA_SNIPPET,
    notes: [
      'Stack could not be detected from filesystem or package.json - using vanilla as the safe default',
      'For an ES module setup, import gsap from a bundler entry point instead',
    ],
  },
};

export function getMotionIdiom(framework: TechStack['framework']): MotionIdiom {
  return IDIOMS[framework] ?? IDIOMS.vanilla;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint3-motion-stack-idioms.test.ts
```

Expected:
- tsc exit 0
- Test prints `sprint3-motion-stack-idioms PASS`

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

Bash call A: Edit `.claude/memory/session_2026-05-24_sprint3_proper_execution.md`. Append:

```
- T2: built motion-stack-idioms.ts with 11 MotionIdiom records (one per framework value in the 12-value union; unknown resolves to vanilla via the accessor). react/next/remix share the useGSAP snippet via a constant; vue/svelte/astro/angular/wordpress/drupal/hubspot/vanilla each have their own. All snippets reference real GSAP 3.x APIs. 12 assertions pass (every framework resolves to a non-null record, stack-specific keywords present per stack).
```

Bash call B: `rm -f ~/.claude/.needs-verification`

Bash call C: Edit memory AGAIN (`- T2 commit retry: re-touching memory after rm flag-clear.`).

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/motion-stack-idioms.ts sidecoach/src/__tests__/sprint3-motion-stack-idioms.test.ts .claude/memory/session_2026-05-24_sprint3_proper_execution.md && git commit -m "feat(sidecoach): motion-stack-idioms catalog with 11 framework-specific GSAP patterns (Phase 4 T2)"
```

---

## Task 3: Update flow-handler-motion-integration to emit stack-specific block

**Files:**
- Modify: `sidecoach/src/flow-handler-motion-integration.ts`
- Test: `sidecoach/src/__tests__/sprint3-motion-stack-integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint3-motion-stack-integration.test.ts`:

```typescript
import { FlowHMotionIntegrationHandler } from '../flow-handler-motion-integration';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const handler = new FlowHMotionIntegrationHandler();

  // Test 1: Drupal context emits Drupal.behaviors snippet
  const drupalResult = await handler.execute({
    utterance: 'add motion',
    projectContext: { register: 'product', product: {}, design: {} },
    metadata: {
      techStack: { framework: 'drupal', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' },
    },
  } as any);

  assertTrue(drupalResult.status === 'success', 'drupal execute success');
  const drupalGuidance = (drupalResult.guidance || []).join('\n');
  assertTrue(
    /Stack-specific implementation \(framework=drupal\)/.test(drupalGuidance),
    'drupal guidance includes Stack-specific header'
  );
  assertTrue(
    /Drupal\.behaviors/.test(drupalGuidance),
    'drupal guidance includes Drupal.behaviors snippet content'
  );
  const drupalArtifacts = drupalResult.artifacts || [];
  assertTrue(
    drupalArtifacts.some(
      (a) => a.type === 'template' && a.name === 'Motion code template: drupal'
    ),
    'drupal result has Motion code template artifact'
  );

  // Test 2: WordPress context emits wp_enqueue + jQuery snippet
  const wpResult = await handler.execute({
    utterance: 'add motion',
    projectContext: { register: 'brand', product: {}, design: {} },
    metadata: {
      techStack: { framework: 'wordpress', hasAnimationLib: false, hasTypescript: false, packageManager: 'unknown' },
    },
  } as any);

  assertTrue(wpResult.status === 'success', 'wordpress execute success');
  const wpGuidance = (wpResult.guidance || []).join('\n');
  assertTrue(
    /Stack-specific implementation \(framework=wordpress\)/.test(wpGuidance),
    'wordpress guidance includes Stack-specific header'
  );
  assertTrue(
    /wp_enqueue_script/.test(wpGuidance),
    'wordpress guidance includes wp_enqueue_script snippet content'
  );
  assertTrue(
    (wpResult.artifacts || []).some(
      (a) => a.type === 'template' && a.name === 'Motion code template: wordpress'
    ),
    'wordpress result has Motion code template artifact'
  );

  // Test 3: Missing techStack falls back to vanilla (no crash)
  const fallbackResult = await handler.execute({
    utterance: 'add motion',
    projectContext: { register: 'brand', product: {}, design: {} },
    metadata: {},
  } as any);

  assertTrue(fallbackResult.status === 'success', 'fallback execute success');
  const fallbackGuidance = (fallbackResult.guidance || []).join('\n');
  assertTrue(
    /Stack-specific implementation \(framework=unknown\)/.test(fallbackGuidance) ||
      /Stack-specific implementation \(framework=vanilla\)/.test(fallbackGuidance),
    'fallback guidance still includes Stack-specific header'
  );
  assertTrue(
    /DOMContentLoaded|<script src=/.test(fallbackGuidance),
    'fallback guidance falls back to vanilla snippet content'
  );

  console.log('sprint3-motion-stack-integration PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint3-motion-stack-integration.test.ts 2>&1 | head -10
```

Expected: FAIL with `drupal guidance includes Stack-specific header` because the handler doesn't emit that block yet.

- [ ] **Step 3: Wire `getMotionIdiom` into the handler**

In `sidecoach/src/flow-handler-motion-integration.ts`:

At the top, add (near the other imports):

```typescript
import { getMotionIdiom } from './motion-stack-idioms';
```

Inside the `execute()` method, find the `const guidance = [` literal (around line 188). The existing guidance is built up in that literal, including the DESIGN.md citation lines from Sprint 2 T12. AFTER the `const guidance = [...]` declaration (i.e. after the closing `]` of that literal) but BEFORE the `const checklist = ...` line, append the stack-specific block:

```typescript
      // Phase 4: Stack-specific GSAP loading + cleanup idiom.
      // Reads detected framework from enriched context (techStack injected by
      // enrichContextForHandler). Falls back to 'unknown' which the accessor
      // resolves to the vanilla idiom - so this block always emits something
      // useful even when techStack is missing.
      const framework =
        ((context.metadata as any)?.techStack?.framework as
          | 'react' | 'next' | 'vue' | 'svelte' | 'astro' | 'remix'
          | 'angular' | 'wordpress' | 'drupal' | 'hubspot'
          | 'vanilla' | 'unknown'
          | undefined) ?? 'unknown';
      const idiom = getMotionIdiom(framework);
      guidance.push(
        '',
        `Stack-specific implementation (framework=${framework}):`,
        `- Loading: ${idiom.loadingPattern}`,
        `- Cleanup: ${idiom.cleanupPattern}`,
        `- Scope boundary: ${idiom.scopeBoundary}`,
        '',
        'Example:',
        ...idiom.exampleSnippet.split('\n').map((l) => '  ' + l)
      );
      idiom.notes.forEach((n) => guidance.push(`- Note: ${n}`));
```

Then, find the `return { ... artifacts: [...] }` block at the bottom of `execute()`. The existing artifacts array (if any) is built in that block. Add a new artifact push BEFORE the return, OR inline into the existing artifacts array. Concrete approach - look for the `artifacts:` field in the return object, and add the new template artifact to it.

If the existing return looks like:
```typescript
        artifacts: [
          this.createArtifact('reference', 'Motion Domain Rules', ...),
          // ... existing artifacts
        ],
```

Change it to:
```typescript
        artifacts: [
          this.createArtifact(
            'template',
            `Motion code template: ${framework}`,
            idiom.exampleSnippet,
            `${framework} idiom for GSAP loading + cleanup`
          ),
          this.createArtifact('reference', 'Motion Domain Rules', ...),
          // ... existing artifacts
        ],
```

If the existing artifacts array is built using an intermediate variable (e.g. `const artifacts = [...]; return { ..., artifacts }`), modify that intermediate variable instead - prepend or append the new artifact to it.

The exact placement depends on the current handler shape. Read `sidecoach/src/flow-handler-motion-integration.ts:188-260` (the body of execute()) once before editing to confirm the artifact-building shape, then make the minimal addition.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint3-motion-stack-integration.test.ts
```

Expected:
- tsc exit 0
- Test prints `sprint3-motion-stack-integration PASS`

If the test fails on the "fallback" assertion, the fallback resolution may need adjustment - either the `framework` variable resolves to 'unknown' but the accessor returns the 'vanilla' record (which has `framework: 'vanilla'` in its data). The test allows BOTH `framework=unknown` AND `framework=vanilla` in the guidance header to handle this case. If a different framework value shows up in the header, investigate before adjusting the test.

- [ ] **Step 5: Run the full Sprint 1 + 2 + 3-prep + 3-proper-so-far suite**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && \
  npx ts-node src/__tests__/sprint1-integration.test.ts && \
  npx ts-node src/__tests__/design-md-parser.test.ts && \
  npx ts-node src/__tests__/icon-source-reference-paths.test.ts && \
  npx ts-node src/__tests__/project-drift-detector.test.ts && \
  npx ts-node src/__tests__/taste-validator-observer-race.test.ts && \
  npx ts-node src/__tests__/intent-detector-tiebreak.test.ts && \
  npx ts-node src/__tests__/landing-composition-data.test.ts && \
  npx ts-node src/__tests__/flow-handler-landing-composition.test.ts && \
  npx ts-node src/__tests__/copywriting-templates.test.ts && \
  npx ts-node src/__tests__/flow-handler-copywriting.test.ts && \
  npx ts-node src/__tests__/flow-composition-craft-landing.test.ts && \
  npx ts-node src/__tests__/sprint2-orchestrator-getHandlers.test.ts && \
  npx ts-node src/__tests__/sprint2-context-loader-typing.test.ts && \
  npx ts-node src/__tests__/sprint2-rolling-citations.test.ts && \
  npx ts-node src/__tests__/sprint2-integration.test.ts && \
  npx ts-node src/__tests__/sprint3-brand-verify-null-register.test.ts && \
  npx ts-node src/__tests__/sprint3-orchestrator-enrich-before-canexecute.test.ts && \
  npx ts-node src/__tests__/sprint3-process-path.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-detection.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-idioms.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-integration.test.ts
```

Expected: every test prints PASS. Total exit 0. The most likely regression risk is `sprint2-rolling-citations.test.ts` because that test ALSO calls `FlowHMotionIntegrationHandler.execute(...)` - the new stack-specific block adds lines to the guidance array but does not remove any existing lines, so the citation regex assertions in that test should still hold. If they don't, the stack-specific block is overwriting rather than appending - re-check Step 3.

- [ ] **Step 6: Commit (FOUR-bash-call pattern)**

Bash call A: Edit `.claude/memory/session_2026-05-24_sprint3_proper_execution.md`. Append:

```
- T3: FlowHMotionIntegrationHandler now emits a Stack-specific implementation block in its guidance + a 'template' artifact named "Motion code template: <framework>". Reads framework from context.metadata.techStack.framework; falls back to unknown -> vanilla via getMotionIdiom. All 21 tests across Sprint 1 + 2 + 3-prep + 3-proper-so-far green.
```

Bash call B: `rm -f ~/.claude/.needs-verification`

Bash call C: Edit memory AGAIN (`- T3 commit retry: re-touching memory after rm flag-clear.`).

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/flow-handler-motion-integration.ts sidecoach/src/__tests__/sprint3-motion-stack-integration.test.ts .claude/memory/session_2026-05-24_sprint3_proper_execution.md && git commit -m "feat(sidecoach): flow-handler-motion-integration emits stack-specific GSAP idiom in guidance + artifact (Phase 4 T3)"
```

---

## Task 4: Sprint 3 proper close - full suite + sprint-close memory + MEMORY.md

**Files:**
- Create: `.claude/memory/session_2026-05-24_sprint3_proper_closed.md`
- Modify: `.claude/memory/MEMORY.md`

- [ ] **Step 1: Run the full 21-test suite one more time to confirm everything's still green**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && \
  npx ts-node src/__tests__/sprint1-integration.test.ts && \
  npx ts-node src/__tests__/design-md-parser.test.ts && \
  npx ts-node src/__tests__/icon-source-reference-paths.test.ts && \
  npx ts-node src/__tests__/project-drift-detector.test.ts && \
  npx ts-node src/__tests__/taste-validator-observer-race.test.ts && \
  npx ts-node src/__tests__/intent-detector-tiebreak.test.ts && \
  npx ts-node src/__tests__/landing-composition-data.test.ts && \
  npx ts-node src/__tests__/flow-handler-landing-composition.test.ts && \
  npx ts-node src/__tests__/copywriting-templates.test.ts && \
  npx ts-node src/__tests__/flow-handler-copywriting.test.ts && \
  npx ts-node src/__tests__/flow-composition-craft-landing.test.ts && \
  npx ts-node src/__tests__/sprint2-orchestrator-getHandlers.test.ts && \
  npx ts-node src/__tests__/sprint2-context-loader-typing.test.ts && \
  npx ts-node src/__tests__/sprint2-rolling-citations.test.ts && \
  npx ts-node src/__tests__/sprint2-integration.test.ts && \
  npx ts-node src/__tests__/sprint3-brand-verify-null-register.test.ts && \
  npx ts-node src/__tests__/sprint3-orchestrator-enrich-before-canexecute.test.ts && \
  npx ts-node src/__tests__/sprint3-process-path.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-detection.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-idioms.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-integration.test.ts
```

All 21 must pass. If any fails, STOP and report BLOCKED with the failing test name + stdout.

- [ ] **Step 2: Verify build**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Must exit 0.

- [ ] **Step 3: Write the sprint-close memory**

Create `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-24_sprint3_proper_closed.md`:

```markdown
---
name: session-2026-05-24-sprint3-proper-closed
description: Sprint 3 proper (Phase 4 stack-aware motion) closed. 3 commits shipped expanding Sidecoach motion guidance to Yes&'s actual stack mix - WordPress, Drupal, HubSpot, Angular, plus all SPA frameworks. 21/21 tests green.
type: project
relates_to: [session_2026-05-24_sprint3_proper_design.md, session_2026-05-24_sprint3_prep_closed.md, session_2026-05-24_sprint2_closed.md]
---

Human collaborator: Jonah.

## What this sprint landed

3 task commits on `main` (substitute actual SHAs from `git log --oneline`):

- T1 (commit ...): `project-context.ts` - extended `TechStack.framework` union to 12 values (added angular, wordpress, drupal, hubspot). New `detectStackFromFilesystem()` helper sniffs CMS markers in priority order (angular.json > wp-config.php / style.css theme header > composer.json with drupal/* / *.info.yml > theme.json with cms field / hubl_modules/ / hs-config*). CMS detection wins over package.json sniff so projects with both (e.g., WordPress with @wordpress/scripts) register as the CMS, not React.
- T2 (commit ...): `motion-stack-idioms.ts` - new pure-data module with 11 `MotionIdiom` records (one per framework value; unknown resolves to vanilla via the accessor). react/next/remix share a useGSAP snippet via a constant; vue/svelte/astro/angular/wordpress/drupal/hubspot/vanilla each have stack-specific snippets. WordPress idiom shows wp_enqueue + jQuery noConflict; Drupal shows Drupal.behaviors attach/detach with once(); HubSpot shows ESM import + pagehide cleanup; Angular shows ngOnInit/ngOnDestroy with gsap.context().
- T3 (commit ...): `flow-handler-motion-integration.ts` - reads `context.metadata.techStack.framework`, looks up the idiom via `getMotionIdiom()`, appends a "Stack-specific implementation (framework=...)" block to guidance, pushes a `'template'`-typed artifact named "Motion code template: <framework>". Falls back to vanilla idiom when techStack is missing - no crash path.

## Test count

Sprint 1 + Sprint 2 + Sprint 3 prep + Sprint 3 proper: **21 distinct test files, all green.** Zero TypeScript errors.

## Spec-driven scope notes

- The spec at `docs/superpowers/specs/2026-05-24-sidecoach-phase-4-stack-aware-motion-design.md` originally listed 4 tasks. The plan collapsed to 3 implementation tasks + 1 close-out (this one) since T1's detection and T2's data module can ship before T3 consumes them.
- Two snippets (HubSpot, Angular) were flagged for spot-check during brainstorming. Jonah approved the spec including the caveats. They ship per spec; real-engagement use will surface adjustments.

## Out of scope (filed for future sprints / rolling work)

- Mixed-stack monorepo handling (e.g., a WordPress site that ALSO has a separate React app under `apps/`).
- Multi-stack composite recommendations when multiple markers are present at root.
- Gutenberg block editor work (React inside WordPress) - flowH emits the WordPress idiom for WordPress projects today.
- flowW / flowX intent-detector wiring (deferred from Sprint 3 prep close memory).
- Snippet accuracy verification for Astro/Vue/Svelte in real engagements.
- Rolling citation pattern: 4 of ~25+ handlers cite DESIGN.md. Continue in spare-cycle commits.

## Local main state

After this commit, local `main` has rolled forward an additional N commits (substitute actual count from `git rev-list --count origin/main..HEAD`). Not pushed to origin. Push timing remains Jonah's call.
```

After writing the file, edit it to substitute the actual commit SHAs from `git log --oneline ~main..HEAD` (or `git log --oneline -10` and pick the T1/T2/T3 commits by message).

- [ ] **Step 4: Update MEMORY.md index**

Edit `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/MEMORY.md`. Add ONE line as the new first entry (above the existing `Sprint 3 prep closed` entry):

```
- [Sprint 3 proper closed (2026-05-24)](session_2026-05-24_sprint3_proper_closed.md): Phase 4 stack-aware motion shipped - 11 framework idioms (vanilla/react/next/remix/vue/svelte/astro/angular/wordpress/drupal/hubspot), detection priority for CMS markers over package.json, flow-handler-motion-integration emits stack-specific block + template artifact. 21/21 tests green.
```

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

Bash call A: Edit `.claude/memory/session_2026-05-24_sprint3_proper_execution.md`. Append:

```
- T4: full 21-test suite green, tsc clean. Wrote session_2026-05-24_sprint3_proper_closed.md with 3 task summary + out-of-scope list + main-ahead-of-origin note. Added MEMORY.md index entry. Sprint 3 proper (Phase 4) is now closed.
```

Bash call B: `rm -f ~/.claude/.needs-verification`

Bash call C: Edit memory AGAIN (`- T4 commit retry: re-touching memory after rm flag-clear.`).

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add .claude/memory/session_2026-05-24_sprint3_proper_closed.md .claude/memory/session_2026-05-24_sprint3_proper_execution.md .claude/memory/MEMORY.md && git commit -m "docs(memory): close Sprint 3 proper (Phase 4 stack-aware motion)"
```

---

## Verification (end of sprint)

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git log --oneline 086c93c..HEAD
```

Expected: 4 new commits since Sprint 3 prep close. Each with the `feat(sidecoach):` or `docs(memory):` prefix.

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && node -e "
const { detectTechStack } = require('./dist/project-context');
console.log('framework type extension:', JSON.stringify(Object.keys({})));
" || npm run build
```

If `dist/` is stale, `npm run build` rebuilds. The verification is for development convenience; the canonical proof is the test suite.

---

## Files produced (summary)

**New files (4):**
- `sidecoach/src/motion-stack-idioms.ts`
- `sidecoach/src/__tests__/sprint3-motion-stack-detection.test.ts`
- `sidecoach/src/__tests__/sprint3-motion-stack-idioms.test.ts`
- `sidecoach/src/__tests__/sprint3-motion-stack-integration.test.ts`

**Modified files (3):**
- `sidecoach/src/project-context.ts` (framework union + detection helper)
- `sidecoach/src/flow-handler-motion-integration.ts` (consume idioms, emit stack-specific block + artifact)
- `.claude/memory/MEMORY.md` (index update)

**New memory files (3):**
- `.claude/memory/session_2026-05-24_sprint3_proper_execution.md` (execution log)
- `.claude/memory/session_2026-05-24_sprint3_proper_closed.md` (sprint close memory)
- (the T11 deferral and Sprint 3 prep closed memories already exist; no new follow-ups created in this sprint)

---

## Roadmap for subsequent sprints (unchanged from misty-jingling-plum)

- **Sprint 4** = Phase 5: graded validation + build report (~10 tasks).
- **Sprint 5** = Phase 6: checkpoint mechanism + intent disambiguation UI (~8 tasks).
- **Rolling** = continue adopting DESIGN.md citation pattern (currently 4 of ~25+ handlers).
- **Followup**: wire flowW/flowX into intent-detector.ts detector list (deferred from Sprint 3 prep).
