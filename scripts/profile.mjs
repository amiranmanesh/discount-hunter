/**
 * Shared helpers for the driven-browser scripts.
 *
 * Chrome caches an unpacked extension's compiled code and service worker inside
 * the profile. Copying a signed-in profile therefore copies yesterday's
 * extension with it, and the browser silently runs the old code — which cost
 * this project an afternoon of chasing a bug that was already fixed. Every
 * script that seeds a profile strips that cache first.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Profile subdirectories that hold extension code, state or compiled caches. */
const EXTENSION_CACHE = [
  'Default/Service Worker',
  'Default/Code Cache',
  'Default/Extension State',
  'Default/Extension Rules',
  'Default/Extension Scripts',
  'Default/Local Extension Settings',
  'Default/Managed Extension Settings',
  'Default/Sync Extension Settings',
  'Default/GPUCache',
];

export function stripExtensionCache(profileDir) {
  for (const relative of EXTENSION_CACHE) {
    fs.rmSync(path.join(profileDir, relative), { recursive: true, force: true });
  }
}

/** Copies `seed` to `target`, minus the singleton locks and the extension cache. */
export function seedProfile(seed, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(seed, target, { recursive: true });
  for (const entry of fs.readdirSync(target)) {
    if (entry.startsWith('Singleton')) fs.rmSync(path.join(target, entry), { force: true });
  }
  stripExtensionCache(target);
  return target;
}
