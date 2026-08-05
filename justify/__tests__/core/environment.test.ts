import { describe, it, expect } from 'vitest';
import {
  detectBrowser,
  detectOS,
  formatEnvironmentLines,
  type EnvironmentInfo,
} from '../../core/environment.js';

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  firefoxWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  edgeWin:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

describe('detectBrowser', () => {
  it('reads Chrome and its major version', () => {
    expect(detectBrowser(UA.chromeMac)).toEqual({ name: 'Chrome', version: '131' });
  });

  it('reads Safari from the Version/ token, not the Safari build number', () => {
    expect(detectBrowser(UA.safariMac)).toEqual({ name: 'Safari', version: '17' });
  });

  it('reads Firefox', () => {
    expect(detectBrowser(UA.firefoxWin)).toEqual({ name: 'Firefox', version: '124' });
  });

  it('reads Edge before the Chrome token it also carries', () => {
    expect(detectBrowser(UA.edgeWin)).toEqual({ name: 'Edge', version: '131' });
  });

  it('reads Chrome-on-Android as Chrome, not Safari', () => {
    expect(detectBrowser(UA.chromeAndroid)).toEqual({ name: 'Chrome', version: '131' });
  });

  it('falls back to Unknown on an unparseable UA', () => {
    expect(detectBrowser('some-crawler/1.0')).toEqual({ name: 'Unknown', version: '' });
  });
});

describe('detectOS', () => {
  it('trusts the client-hints platform hint over UA parsing', () => {
    expect(detectOS(UA.chromeMac, 'macOS')).toBe('macOS');
    expect(detectOS(UA.firefoxWin, 'Windows')).toBe('Windows');
  });

  it('parses macOS from the UA when no hint is given', () => {
    expect(detectOS(UA.chromeMac)).toBe('macOS');
  });

  it('parses Windows', () => {
    expect(detectOS(UA.firefoxWin)).toBe('Windows');
  });

  it('parses iOS before macOS on an iPhone UA', () => {
    expect(detectOS(UA.safariIphone)).toBe('iOS');
  });

  it('parses Android before Linux on an Android UA', () => {
    expect(detectOS(UA.chromeAndroid)).toBe('Android');
  });

  it('falls back to Unknown when nothing matches', () => {
    expect(detectOS('some-crawler/1.0')).toBe('Unknown');
  });

  it('classifies a touch-capable Macintosh UA (iPadOS desktop mode) as iPadOS', () => {
    const ipadDesktop =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    expect(detectOS(ipadDesktop, undefined, 5)).toBe('iPadOS');
  });

  it('keeps a real Mac (no touch) as macOS', () => {
    expect(detectOS(UA.chromeMac, undefined, 0)).toBe('macOS');
    expect(detectOS(UA.chromeMac, undefined, undefined)).toBe('macOS');
  });

  it('corrects a macOS platform hint to iPadOS when the device is touch-capable', () => {
    expect(detectOS(UA.chromeMac, 'macOS', 5)).toBe('iPadOS');
  });
});

describe('formatEnvironmentLines', () => {
  const base: EnvironmentInfo = {
    viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
    browser: { name: 'Chrome', version: '131' },
    os: 'macOS',
    userAgent: UA.chromeMac,
  };

  it('documents viewport with the retina DPR suffix, browser, and OS', () => {
    expect(formatEnvironmentLines(base)).toEqual([
      'Viewport: 1440x900 @2x',
      'Browser: Chrome 131',
      'OS: macOS',
    ]);
  });

  it('omits the DPR suffix on a 1x display', () => {
    const env = { ...base, viewport: { width: 1024, height: 768, devicePixelRatio: 1 } };
    expect(formatEnvironmentLines(env)[0]).toBe('Viewport: 1024x768');
  });

  it('shows a fractional DPR verbatim', () => {
    const env = { ...base, viewport: { width: 1280, height: 720, devicePixelRatio: 1.5 } };
    expect(formatEnvironmentLines(env)[0]).toBe('Viewport: 1280x720 @1.5x');
  });

  it('drops the version token when the version is empty', () => {
    const env = { ...base, browser: { name: 'Unknown', version: '' } };
    expect(formatEnvironmentLines(env)[1]).toBe('Browser: Unknown');
  });
});
