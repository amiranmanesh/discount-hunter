#!/usr/bin/env node
/**
 * Builds the shippable package.
 *
 * The extension is plain ES modules that Chrome loads directly, so there is
 * nothing to bundle: the build copies `extension/` into `dist/<target>/`, writes
 * the manifest with the version from package.json, and optionally zips it for
 * the store. `extension/` stays loadable unpacked for day-to-day work.
 */
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';
import esbuild from 'esbuild';
import { TARGETS, buildManifest, readVersion, serialize } from './manifest.mjs';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const resolve = (...parts) => path.join(root, ...parts);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const watchMode = flag('watch');
const zip = flag('zip');
const requested = option('target', 'all');
const targets = requested === 'all' ? [...TARGETS] : [requested];

for (const target of targets) {
  if (!TARGETS.includes(target)) {
    console.error(`Unknown target "${target}". Expected one of: ${TARGETS.join(', ')}`);
    process.exit(1);
  }
}

/** Everything under extension/ ships, except the generated manifest. */
const SOURCE_DIR = resolve('extension');

async function ensureIcons() {
  if (existsSync(resolve('extension/icons/icon-128.png'))) return;
  console.log('· icons missing, generating them');
  await execFileAsync(process.execPath, [resolve('scripts/gen-icons.mjs')]);
}

async function buildTarget(target, version) {
  const outdir = resolve('dist', target);
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  for (const entry of await readdir(SOURCE_DIR)) {
    if (entry === 'manifest.json' || entry.startsWith('.')) continue;
    await cp(path.join(SOURCE_DIR, entry), path.join(outdir, entry), { recursive: true });
  }

  if (target === 'firefox') {
    // Firefox runs the background as an event page and its support for module
    // background scripts is too recent to depend on, so the whole worker is
    // bundled into one classic script. Everything else — content scripts and the
    // popup — already works as-is on both engines.
    await esbuild.build({
      entryPoints: [resolve('extension/background.js')],
      outfile: path.join(outdir, 'background.js'),
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['firefox121'],
      legalComments: 'none',
      logLevel: 'warning',
      allowOverwrite: true,
    });
  }

  await writeFile(path.join(outdir, 'manifest.json'), serialize(buildManifest(target, version)));
  console.log(`✓ ${target} → dist/${target}`);
}

/**
 * Zips without a dependency by shelling out to the system `zip`.
 *
 * The Chrome Web Store rejects an archive that nests the extension in a folder
 * and warns about every dotfile in it, so the archive is built from inside
 * `dist/<target>` with `-X` (no extra attributes, no `__MACOSX/`) and dotfiles
 * excluded. Never repackage a build with Finder's "Compress" — it does both of
 * the things this guards against.
 */
async function zipTarget(target, version) {
  const releaseDir = resolve('release');
  await mkdir(releaseDir, { recursive: true });
  const archive = path.join(releaseDir, `discount-hunter-${version}-${target}.zip`);
  await rm(archive, { force: true });
  await execFileAsync('zip', ['-r', '-q', '-X', archive, '.', '-x', '.*', '*/.*'], {
    cwd: resolve('dist', target),
  });
  await assertPackagedForStores(archive);
  console.log(`✓ ${target} → ${path.relative(root, archive)}`);
}

/** Fails the build rather than shipping an archive the store would reject. */
async function assertPackagedForStores(archive) {
  const { stdout } = await execFileAsync('unzip', ['-Z1', archive]);
  const entries = stdout.split('\n').filter(Boolean);
  if (!entries.includes('manifest.json')) {
    throw new Error(`${path.basename(archive)}: manifest.json is not at the archive root`);
  }
  const hidden = entries.filter((entry) => entry.split('/').some((part) => part.startsWith('.')));
  if (hidden.length > 0) {
    throw new Error(`${path.basename(archive)}: hidden files in the archive: ${hidden.join(', ')}`);
  }
}

async function main() {
  await ensureIcons();
  const version = await readVersion();
  for (const target of targets) await buildTarget(target, version);

  if (zip) {
    for (const target of targets) await zipTarget(target, version);
  }

  if (!watchMode) return;

  console.log('· watching extension/ for changes (ctrl-c to stop)');
  let pending = null;
  watch(SOURCE_DIR, { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(async () => {
      try {
        for (const target of targets) await buildTarget(target, version);
      } catch (error) {
        console.error(error.message);
      }
    }, 120);
  });
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
