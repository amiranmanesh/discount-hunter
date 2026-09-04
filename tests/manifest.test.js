import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TARGETS, buildManifest, serialize } from '../scripts/manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const committed = readFileSync(path.join(root, 'extension/manifest.json'), 'utf8');
const manifest = buildManifest('chrome', pkg.version);

describe('extension/manifest.json', () => {
  it('matches what scripts/manifest.mjs generates', () => {
    // Regenerate with `npm run manifest` when this fails.
    expect(committed).toBe(serialize(manifest));
  });

  it('carries the package version', () => {
    expect(JSON.parse(committed).version).toBe(pkg.version);
  });
});

describe('manifest contents', () => {
  it('is Manifest V3 with a module service worker', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' });
    expect(manifest.minimum_chrome_version).toBe('111');
  });

  it('asks for no permission beyond the two it documents', () => {
    // Every other capability comes from `runtime` or the declared content
    // scripts, neither of which needs a permission entry.
    expect(manifest.permissions).toEqual(['storage', 'tabs']);
  });

  it('reaches only the two shopping platforms', () => {
    for (const pattern of manifest.host_permissions) {
      expect(pattern).toMatch(
        /^https:\/\/(svc\.snapp\.market|snapp\.market|api\.digikalajet\.ir|www\.digikalajet\.com)\/\*$/,
      );
    }
  });

  it('points at files that exist', () => {
    const files = [
      manifest.action.default_popup,
      ...Object.values(manifest.icons),
      ...manifest.content_scripts.flatMap((entry) => entry.js),
      manifest.background.service_worker,
    ];
    for (const file of files) {
      expect(existsSync(path.join(root, 'extension', file)), file).toBe(true);
    }
  });

  it('ships a locale for the declared default_locale', () => {
    expect(existsSync(path.join(root, 'extension/_locales', manifest.default_locale))).toBe(true);
  });

  it('rejects an unknown build target', () => {
    expect(() => buildManifest('safari', '1.0.0')).toThrow('Unknown target');
    expect(TARGETS).toEqual(['chrome', 'firefox']);
  });
});

describe('the Firefox target', () => {
  const firefox = buildManifest('firefox', pkg.version);

  it('runs the background as an event page, not a service worker', () => {
    // Firefox's support for module background scripts is too recent to depend
    // on, so the Firefox build ships a bundled classic script.
    expect(firefox.background).toEqual({ scripts: ['background.js'] });
    expect(firefox.background.type).toBeUndefined();
  });

  it('carries a stable add-on id for AMO', () => {
    expect(firefox.browser_specific_settings.gecko.id).toMatch(/^\{[0-9a-f-]{36}\}$/);
    expect(firefox.browser_specific_settings.gecko.strict_min_version).toBe('121.0');
  });

  it('declares Android support', () => {
    expect(firefox.browser_specific_settings.gecko_android.strict_min_version).toBe('121.0');
  });

  it('declares what it collects, as AMO requires', () => {
    expect(firefox.browser_specific_settings.gecko.data_collection_permissions.required).toEqual([
      'locationInfo',
      'authenticationInfo',
    ]);
  });

  it('shares everything else with the Chrome build', () => {
    const strip = ({
      background: _b,
      browser_specific_settings: _s,
      minimum_chrome_version: _m,
      ...rest
    }) => rest;
    expect(strip(firefox)).toEqual(strip(manifest));
  });
});
