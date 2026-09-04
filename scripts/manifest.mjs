#!/usr/bin/env node
/**
 * Single source of truth for the extension manifest.
 *
 * `extension/manifest.json` is generated from here and committed so that
 * "Load unpacked → extension/" keeps working without a build step; CI checks the
 * committed copy still matches (`npm run manifest` then `git diff --exit-code`).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const resolve = (...parts) => path.join(root, ...parts);

export const TARGETS = ['chrome', 'firefox'];

/** Add-on id on addons.mozilla.org. Must stay stable across releases. */
export const GECKO_ID = '{7a1c3d6e-4f28-4d2b-9a5c-0e6b1c8f2d31}';

const ICON_SIZES = [16, 32, 48, 128];
const icons = Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/icon-${size}.png`]));

export function buildManifest(target, version) {
  if (!TARGETS.includes(target)) throw new Error(`Unknown target "${target}"`);

  const manifest = {
    manifest_version: 3,
    name: 'شکارچی تخفیف — Discount Hunter',
    version,
    description:
      'بیشترین تخفیف نارنجی اسنپ‌مارکت و شگفت‌انگیز دیجی‌کالا جت را در فروشگاه‌های اطراف پیدا کن.',
    default_locale: 'fa',

    // `storage` keeps the location, the filters and the cached result; `tabs`
    // opens the store you picked. Reading the Snapp Market session needs no
    // `scripting` permission — the content script is declared below and talks
    // back over `runtime.sendMessage`.
    permissions: ['storage', 'tabs'],
    host_permissions: [
      'https://svc.snapp.market/*',
      'https://snapp.market/*',
      'https://api.digikalajet.ir/*',
      'https://www.digikalajet.com/*',
    ],

    action: {
      default_title: 'شکارچی تخفیف',
      default_popup: 'popup/popup.html',
      default_icon: icons,
    },
    icons,
    content_scripts: [
      {
        matches: ['https://snapp.market/*'],
        js: ['content/snapp-session.js'],
        run_at: 'document_idle',
      },
      {
        matches: ['https://www.digikalajet.com/*'],
        js: ['content/jet-session.js'],
        run_at: 'document_idle',
      },
    ],
  };

  if (target === 'chrome') {
    // The extension is plain ES modules that Chrome loads directly.
    manifest.background = { service_worker: 'background.js', type: 'module' };
    manifest.minimum_chrome_version = '111';
  } else {
    // Firefox runs the background as an event page, and its support for module
    // background scripts is too recent to rely on — so the Firefox build ships a
    // bundled classic script instead (see scripts/build.mjs).
    manifest.background = { scripts: ['background.js'] };
    manifest.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '121.0',
        // AMO requires an explicit consent declaration. The extension queries
        // Snapp Market and Digikala Jet with the user's own session and stores
        // nothing off-device, so the honest answer is the two categories below.
        data_collection_permissions: { required: ['locationInfo', 'authenticationInfo'] },
      },
      // Nothing here is desktop-specific: the UI is a popup and two content
      // scripts.
      gecko_android: { strict_min_version: '121.0' },
    };
  }

  return manifest;
}

export async function readVersion() {
  const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  return pkg.version;
}

export function serialize(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = await readVersion();
  const manifest = serialize(buildManifest('chrome', version));
  if (process.argv.includes('--write')) {
    await writeFile(resolve('extension/manifest.json'), manifest);
    console.log(`✓ extension/manifest.json (v${version})`);
  } else {
    process.stdout.write(manifest);
  }
}
