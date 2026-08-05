/**
 * Environment capture for Justify prompts.
 *
 * Every annotation, manipulation, and prompt the user sends carries the
 * environment it was authored in, so Claude has that context when translating
 * a prompt's parameters into source changes. A change that looks right at
 * 1440x900 on a 2x display can be wrong at 375x812 on 3x, and the browser/OS
 * pair tells the model which CSS quirks are in play.
 *
 * captureEnvironment() reads live browser globals (window/navigator) and is the
 * only browser-coupled export. detectBrowser/detectOS/formatEnvironmentLines are
 * pure and unit-tested against fixed user-agent strings.
 */

import type { EnvironmentInfo } from './types.js';
export type { EnvironmentInfo } from './types.js';

/** Ordered browser probes - the first match wins, so Chromium forks (Edge, Opera)
 *  are checked before the bare "Chrome" token they also contain, and Safari (whose
 *  version lives in `Version/`) is checked after everything that also ships `Safari`. */
export function detectBrowser(ua: string): { name: string; version: string } {
  const probes: Array<{ name: string; re: RegExp }> = [
    { name: 'Edge', re: /Edg(?:e|A|iOS)?\/(\d+)/ },
    { name: 'Opera', re: /(?:OPR|Opera)\/(\d+)/ },
    { name: 'Firefox', re: /(?:Firefox|FxiOS)\/(\d+)/ },
    { name: 'Samsung Internet', re: /SamsungBrowser\/(\d+)/ },
    { name: 'Chrome', re: /(?:Chrome|CriOS|Chromium)\/(\d+)/ },
    { name: 'Safari', re: /Version\/(\d+)[.\d]*\s+(?:Mobile\/\S+\s+)?Safari/ },
  ];
  for (const { name, re } of probes) {
    const m = re.exec(ua);
    if (m) return { name, version: m[1] ?? '' };
  }
  return { name: 'Unknown', version: '' };
}

/** OS family. A caller-supplied platform hint (navigator.userAgentData.platform on
 *  Chromium) is trusted over UA parsing when present; otherwise fall back to the UA
 *  string. iOS/Android are probed before macOS/Linux so mobile UAs are not misread.
 *  maxTouchPoints disambiguates iPadOS in desktop mode, which reports a Macintosh UA
 *  (and platform MacIntel) - a touch-capable "Mac" is really an iPad. */
export function detectOS(ua: string, platformHint?: string, maxTouchPoints?: number): string {
  const touchMac = typeof maxTouchPoints === 'number' && maxTouchPoints > 1;
  if (platformHint && platformHint.trim()) {
    return touchMac && /mac/i.test(platformHint) ? 'iPadOS' : platformHint.trim();
  }
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/(iPhone|iPad|iPod)/.test(ua)) return 'iOS';
  if (/Mac OS X|Macintosh/.test(ua)) return touchMac ? 'iPadOS' : 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

/** Render an EnvironmentInfo as the documented prompt lines. Pure - no globals.
 *  The DPR suffix is shown only when it is not 1, so ordinary displays stay quiet
 *  while retina/HiDPI is called out explicitly. */
export function formatEnvironmentLines(env: EnvironmentInfo): string[] {
  const { width, height, devicePixelRatio } = env.viewport;
  const dprSuffix = devicePixelRatio && devicePixelRatio !== 1 ? ` @${devicePixelRatio}x` : '';
  const lines = [`Viewport: ${width}x${height}${dprSuffix}`];
  const browser = env.browser.version
    ? `${env.browser.name} ${env.browser.version}`
    : env.browser.name;
  lines.push(`Browser: ${browser}`);
  lines.push(`OS: ${env.os}`);
  return lines;
}

/** Read the live browser environment. Guards window/navigator so it is safe to
 *  call under jsdom/node (returns zeroed viewport + Unknown browser there). */
export function captureEnvironment(): EnvironmentInfo {
  const w = typeof window !== 'undefined' ? window : undefined;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';
  const platformHint = (nav as { userAgentData?: { platform?: string } } | undefined)
    ?.userAgentData?.platform;
  return {
    viewport: {
      width: w?.innerWidth ?? 0,
      height: w?.innerHeight ?? 0,
      devicePixelRatio: w?.devicePixelRatio ?? 1,
    },
    browser: detectBrowser(ua),
    os: detectOS(ua, platformHint, nav?.maxTouchPoints),
    userAgent: ua,
  };
}
