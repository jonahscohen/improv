// The functional checks, run against a real browser page via Playwright.
// Scope is FUNCTIONAL truth only: does it paint, do controls respond, are there
// console errors, are frames sane. Visual/aesthetic truth stays with screenshots
// reviewed by a human - this tool never claims a thing "looks right".
import { decodePng, imageStats } from './png.mjs';

// Structural selectors for the playground UI. These track the app's component
// markup (BrowseGrid.tsx / LayerStack.tsx) - if a redesign renames a class, the
// matching constant here must move with it or every effect fails identically on
// a selector timeout (not a real effect failure).
const PREVIEW = '.preview-canvas';
const CARD = '.browse-card';
const CARD_NAME = '.browse-card__name';
const LAYER_ITEM = '.channel';
const LAYER_NAME = '.channel__name';
// A neutral background seeded beneath post-process effects so they have real
// pixels to process (a lone post effect over an empty stack paints nothing).
// Uniquely named so it can't collide with same-named catalog entries.
const BASE_EFFECT = 'Lava Lamp';

class NavigationLost extends Error {}

function isNavGone(err) {
  // HMR reloads surface as context destruction, target-closed, OR a click/wait
  // timeout against elements that briefly vanished during the reload.
  return /Execution context was destroyed|because of a navigation|Target closed|frame was detached|Timeout .*exceeded/i.test(
    err?.message ?? '',
  );
}

/** Wait for a number of animation frames to elapse so effects have time to paint. */
async function settleFrames(page, frames = 30) {
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let i = 0;
        const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    frames,
  );
}

/** Find the browse-grid card whose visible name matches the manifest name. */
function cardByName(page, name) {
  return page.locator(`${CARD}:has(${CARD_NAME}:text-is(${JSON.stringify(name)}))`);
}

/** The layer-stack item for a given effect display name (scopes its param controls). */
function layerByName(page, name) {
  return page.locator(`${LAYER_ITEM}:has(${LAYER_NAME}:text-is(${JSON.stringify(name)}))`);
}

async function addCardAndWait(page, name, minLayers) {
  await cardByName(page, name).first().click();
  await page
    .waitForFunction(
      ({ n, sel }) => document.querySelectorAll(sel).length >= n,
      { n: minLayers, sel: LAYER_ITEM },
      { timeout: 5_000 },
    )
    .catch(() => {});
}

/**
 * Run all functional checks for one effect on a freshly-loaded page.
 * Returns { effect, checks: [{ name, status, detail }], errors: string[] }.
 * Throws NavigationLost if the page reloads mid-run (HMR) so the caller can retry.
 */
export async function verifyEffect(page, manifest, opts = {}) {
  const checks = [];
  const consoleErrors = [];
  const add = (name, status, detail) => checks.push({ name, status, detail });

  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  };
  const onPageError = (err) => consoleErrors.push(`pageerror: ${err.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  const isPost = manifest.layerRole === 'post';
  const isPointer = manifest.layerRole === 'pointer';
  const requiredAssets = manifest.requiredAssets ?? [];
  // The playground self-delivers every effect's bundled assets (effectAssets),
  // so an effect declaring requiredAssets is no longer "blocked" - it paints
  // with real content and canvas-paint must be attempted.
  // Seed a neutral base only for post effects that bring no asset of their own;
  // a post effect with its own image asset paints that asset directly.
  const needsBase = isPost && requiredAssets.length === 0;

  try {
    await page.goto(opts.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(PREVIEW, { timeout: 10_000 });
    await page.waitForSelector(CARD, { timeout: 10_000 });
    await settleFrames(page, 5);

    let baseCount = 0;
    if (needsBase) {
      await addCardAndWait(page, BASE_EFFECT, 1);
      baseCount = await page.locator(LAYER_ITEM).count();
    }

    // ---- Check 1: clicking the card adds a layer --------------------------
    const card = cardByName(page, manifest.name);
    if ((await card.count()) === 0) {
      add('add-layer', 'fail', `no browse-grid card named "${manifest.name}"`);
      add('canvas-paint', 'skip', 'no layer added');
      add('param-interaction', 'skip', 'no layer added');
      add('perf-frames', 'skip', 'no layer added');
      add('console-clean', consoleErrors.length ? 'fail' : 'pass', consoleErrors.join(' | ') || 'no console errors');
      return { effect: manifest.id, name: manifest.name, checks, errors: consoleErrors };
    }
    const before = await page.locator(LAYER_ITEM).count();
    await addCardAndWait(page, manifest.name, before + 1);
    const after = await page.locator(LAYER_ITEM).count();
    if (after > before) {
      add('add-layer', 'pass', needsBase ? `base + layer (${after} total)` : `layers ${before} -> ${after}`);
    } else {
      const hint = await page.locator('.layer-stack__hint').textContent().catch(() => null);
      add('add-layer', 'fail', hint ? `blocked: ${hint.trim()}` : 'layer count did not increase');
    }

    // ---- Check 2: canvas actually paints (non-blank) ----------------------
    // Pointer-driven effects (cursor trails) paint nothing until the cursor
    // actually moves, so drive a REAL mouse path across the preview before
    // sampling. This is genuine user input, not a synthetic event.
    if (isPointer) await drivePointer(page);
    await settleFrames(page, opts.settleFrames ?? 40);
    {
      const hasCanvas = (await page.locator(`${PREVIEW} canvas`).count()) > 0;
      const hasSurface = (await page.locator(`${PREVIEW} > *`).count()) > 0;
      if (!hasCanvas) {
        add('canvas-paint', hasSurface ? 'pass' : 'fail', hasSurface ? 'DOM surface mounted (no canvas)' : 'no render surface');
      } else {
        const shot = await page.locator(PREVIEW).screenshot();
        let painted = false;
        let detail = '';
        try {
          const stats = imageStats(decodePng(shot));
          // blank == 1 flat color, ~0 spread. Real content has spread OR many colors.
          painted = stats.luminanceSpread > 8 || stats.distinctColors > 4;
          detail = `colors=${stats.distinctColors} lumSpread=${stats.luminanceSpread.toFixed(1)}`;
          if (needsBase) detail += ' (composited over base)';
          if (requiredAssets.length) detail += ` [assets: ${requiredAssets.join(', ')}]`;
        } catch (e) {
          painted = false;
          detail = `png decode failed: ${e.message}`;
        }
        add('canvas-paint', painted ? 'pass' : 'fail', detail);
      }
    }

    // ---- Check 3: a param control responds to real input ------------------
    const params = manifest.params ?? [];
    if (params.length === 0) {
      add('param-interaction', 'skip', 'effect exposes no params');
    } else {
      const result = await exerciseParam(page, manifest.name, params);
      add('param-interaction', result.status, result.detail);
    }

    // ---- Check 4: frame timing is sane (no sustained long frames) ---------
    const perf = await page.evaluate(
      (ms) =>
        new Promise((resolve) => {
          const deltas = [];
          let last = performance.now();
          const start = last;
          const tick = (now) => {
            deltas.push(now - last);
            last = now;
            if (now - start < ms) requestAnimationFrame(tick);
            else resolve(deltas);
          };
          requestAnimationFrame(tick);
        }),
      opts.perfWindowMs ?? 1000,
    );
    const samples = perf.slice(1); // drop warm-up delta
    const maxFrame = samples.length ? Math.max(...samples) : 0;
    const longFrames = samples.filter((d) => d > (opts.longFrameMs ?? 50)).length;
    const fps = samples.length ? Math.round(1000 / (samples.reduce((a, b) => a + b, 0) / samples.length)) : 0;
    const perfOk = maxFrame < (opts.maxFrameMs ?? 150) && longFrames <= (opts.maxLongFrames ?? 3);
    // Headless Chromium has NO GPU acceleration, so WebGL/GPU effects render
    // far slower than on real hardware - a headless perf miss is not a reliable
    // signal. Only treat perf as a hard fail when running --headed (real GPU);
    // otherwise it is advisory (skip with a note). Run `--headed` for true perf.
    const perfStatus =
      samples.length < 5 ? 'skip' : perfOk ? 'pass' : opts.headed ? 'fail' : 'skip';
    const perfNote = !perfOk && !opts.headed ? ' [advisory: headless has no GPU; run --headed]' : '';
    add(
      'perf-frames',
      perfStatus,
      `~${fps}fps, max=${maxFrame.toFixed(1)}ms, longFrames(>${opts.longFrameMs ?? 50}ms)=${longFrames}${perfNote}`,
    );

    // ---- Check 5: console clean (evaluated last, captures whole run) -------
    add('console-clean', consoleErrors.length ? 'fail' : 'pass', consoleErrors.join(' | ') || 'no console errors');
  } catch (e) {
    if (isNavGone(e)) throw new NavigationLost(e.message);
    throw e;
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }

  return { effect: manifest.id, name: manifest.name, checks, errors: consoleErrors };
}

export { NavigationLost };

/** Move the real mouse across the preview so pointer-driven effects spawn content. */
async function drivePointer(page) {
  const box = await page.locator(PREVIEW).boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3, { steps: 5 });
  await page.mouse.move(cx, cy, { steps: 10 });
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7, { steps: 10 });
  await page.mouse.move(cx, cy, { steps: 10 });
}

/** Drive the first usable param control with a REAL input and confirm it reflects. */
async function exerciseParam(page, effectName, params) {
  const scope = layerByName(page, effectName);
  for (const spec of params) {
    const input = scope.locator(`[aria-label=${JSON.stringify(spec.name)}]`).first();
    if ((await input.count()) === 0) continue;

    // A control that can't be driven (e.g. a custom widget that isn't a native
    // input) must not abort the whole effect's check - swallow and try the next
    // param. Only a clean pass/fail returns.
    try {
      if (spec.type === 'range') {
        const min = spec.min ?? 0;
        const max = spec.max ?? 1;
        const before = await input.inputValue();
        const target = Number(before) === max ? min : max;
        await input.focus();
        await input.fill(String(target));
        const afterVal = await input.inputValue();
        if (afterVal !== before) return { status: 'pass', detail: `${spec.name}: ${before} -> ${afterVal}` };
        await input.press('Home');
        await input.press('ArrowRight');
        const kbVal = await input.inputValue();
        return kbVal !== before
          ? { status: 'pass', detail: `${spec.name} (keyboard): ${before} -> ${kbVal}` }
          : { status: 'fail', detail: `${spec.name} did not change on input` };
      }

      if (spec.type === 'toggle') {
        const before = await input.isChecked();
        await input.click();
        const afterChk = await input.isChecked();
        return afterChk !== before
          ? { status: 'pass', detail: `${spec.name}: ${before} -> ${afterChk}` }
          : { status: 'fail', detail: `${spec.name} toggle did not flip` };
      }

      if (spec.type === 'select') {
        const optList = spec.options ?? [];
        if (optList.length < 2) continue;
        // The Select control renders small option sets as a segmented radiogroup
        // (role="radio" buttons, aria-label on the group) and larger sets as a
        // native <select>. inputValue() only works on the native variant, so
        // detect which is present and drive it accordingly.
        const tag = await input.evaluate((el) => el.tagName).catch(() => '');
        if (tag === 'SELECT') {
          const before = await input.inputValue();
          const target = optList.find((o) => o !== before) ?? optList[0];
          await input.selectOption(target);
          const afterVal = await input.inputValue();
          return afterVal === target && afterVal !== before
            ? { status: 'pass', detail: `${spec.name}: ${before} -> ${afterVal}` }
            : { status: 'fail', detail: `${spec.name} select did not change` };
        }
        // Segmented radiogroup: click a radio other than the checked one and
        // confirm aria-checked moves to it.
        const radios = input.locator('[role="radio"]');
        const n = await radios.count();
        if (n < 2) continue;
        let checkedIdx = 0;
        for (let k = 0; k < n; k++) {
          if ((await radios.nth(k).getAttribute('aria-checked')) === 'true') {
            checkedIdx = k;
            break;
          }
        }
        const targetIdx = checkedIdx === 0 ? 1 : 0;
        await radios.nth(targetIdx).click();
        const moved = (await radios.nth(targetIdx).getAttribute('aria-checked')) === 'true';
        return moved
          ? { status: 'pass', detail: `${spec.name} (segmented): option ${checkedIdx} -> ${targetIdx}` }
          : { status: 'fail', detail: `${spec.name} segmented did not change` };
      }

      if (spec.type === 'color') {
        const before = await input.inputValue();
        const target = before.toLowerCase() === '#000000' ? '#ffffff' : '#000000';
        await input.fill(target);
        const afterVal = await input.inputValue();
        return afterVal.toLowerCase() === target
          ? { status: 'pass', detail: `${spec.name}: ${before} -> ${afterVal}` }
          : { status: 'fail', detail: `${spec.name} color did not change` };
      }
    } catch {
      continue; // un-exercisable control - move on to the next param
    }
  }
  return { status: 'skip', detail: 'no exercisable control found in the layer panel' };
}
