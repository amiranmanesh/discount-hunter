#!/usr/bin/env node
/**
 * Generates (and optionally builds) the Safari target.
 *
 * Safari is the one browser that cannot install a zip: an extension has to be
 * embedded in a macOS app and distributed through the App Store. Apple's
 * `safari-web-extension-converter` wraps the Chromium package in exactly such an
 * app, so there is no second source tree to maintain — the Xcode project is a
 * build artifact, regenerated on demand and kept out of git.
 *
 *   node scripts/safari.mjs            generate safari/ from dist/chrome
 *   node scripts/safari.mjs --build    also compile it (unsigned)
 *   node scripts/safari.mjs --open     open the project in Xcode
 *
 * Requires macOS with Xcode installed. Publishing additionally requires
 * membership of the Apple Developer Program; see docs/BROWSER-SUPPORT.md.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const resolve = (...parts) => path.join(root, ...parts);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const APP_NAME = option('app-name', 'Discount Hunter');
/**
 * The converter derives the app's bundle id from the app name and the
 * extension's from this value. Xcode then refuses to embed the extension unless
 * its id is prefixed by the app's, so the last component has to match the app
 * name with spaces replaced by hyphens.
 */
const BUNDLE_ID = option('bundle-id', 'com.github.amiranmanesh.Discount-Hunter');
const SOURCE = resolve('dist/chrome');
const OUT_DIR = resolve('safari');

async function main() {
  if (process.platform !== 'darwin') {
    throw new Error('The Safari target can only be generated on macOS.');
  }
  if (!existsSync(SOURCE)) {
    throw new Error('dist/chrome is missing — run `npm run build` first.');
  }

  try {
    await execFileAsync('xcrun', ['--find', 'safari-web-extension-converter']);
  } catch {
    throw new Error(
      'safari-web-extension-converter not found. Install Xcode and run `xcode-select --install`.',
    );
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const { stdout } = await execFileAsync('xcrun', [
    'safari-web-extension-converter',
    SOURCE,
    '--project-location',
    OUT_DIR,
    '--app-name',
    APP_NAME,
    '--bundle-identifier',
    BUNDLE_ID,
    '--macos-only',
    '--no-open',
    '--no-prompt',
    '--force',
  ]);
  process.stdout.write(stdout);
  console.log(`✓ safari → ${path.relative(root, OUT_DIR)}`);

  const project = path.join(OUT_DIR, APP_NAME, `${APP_NAME}.xcodeproj`);

  if (flag('build')) {
    console.log('· compiling (unsigned)');
    await execFileAsync('xcodebuild', [
      '-project',
      project,
      '-scheme',
      APP_NAME,
      '-configuration',
      'Release',
      'CODE_SIGNING_ALLOWED=NO',
      'build',
    ]);
    console.log('✓ built');
  }

  if (flag('open')) await execFileAsync('open', [project]);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
