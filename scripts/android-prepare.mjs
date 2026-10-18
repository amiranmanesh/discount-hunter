#!/usr/bin/env node
/**
 * Assembles what the Android APK needs to run the whole app on the phone:
 *
 *   1. `android/app/src/main/assets/server-bundle.zip`
 *        the Next.js standalone output + `.next/static` + `public/` + the
 *        bootstrap that starts it — one zip, unpacked to the app's files dir
 *        by ServerService on first launch (or when versionCode changes).
 *        Written with node:zlib (deflate, stored entries) so the build needs
 *        no zip/tar tool — a Windows box may only have an MSYS tar that
 *        chokes on drive-letter paths.
 *   2. `android/app/src/main/jniLibs/<abi>/libnode.so`
 *        the Android (Bionic) build of Node.js, one per ABI. It ships as a
 *        jniLib because Android only lets an app exec binaries from its
 *        native-libs dir; the .so name is a filename, the file is the real
 *        `node` executable. Cached under scripts/vendor/; downloaded from
 *        github.com/Delusions6515/node-android-build when absent.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ANDROID = path.join(ROOT, 'android', 'app', 'src', 'main');
const VENDOR = path.join(HERE, 'vendor');

const NODE_VERSION = '26.7.0';
const NODE_BUILDS = {
  // Where the prepare cache reads them from, keyed by ABI.
  'arm64-v8a': {
    cache: process.env.DH_NODE_ARM64 || '',
    url: `https://github.com/Delusions6515/node-android-build/releases/download/node-android-arm64-26/node-android-arm64-${NODE_VERSION}.tar.xz`,
    member: `nodejs-v${NODE_VERSION}-android-arm64/bin/node`,
  },
  x86_64: {
    cache: process.env.DH_NODE_X64 || '',
    url: 'https://github.com/Delussions6515/node-android-build/releases/download/node-android-x64-26/node-android-x64-26.7.0.tar.xz',
    member: `nodejs-v${NODE_VERSION}-android-x64/bin/node`,
  },
};

function log(...a) {
  console.log('[android:prepare]', ...a);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const get = (u) =>
      https
        .get(u, { headers: { 'User-Agent': 'discount-hunter-build' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return get(res.headers.location);
          }
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          const out = fs.createWriteStream(dest);
          res.pipe(out);
          out.on('finish', () => out.close(() => resolve(dest)));
          out.on('error', reject);
        })
        .on('error', reject);
    get(url);
  });
}

async function nodeBinaryFor(abi) {
  const spec = NODE_BUILDS[abi];
  const out = path.join(ANDROID, 'jniLibs', abi, 'libnode.so');
  // The stamp lives outside jniLibs: AGP only wants .so files in there.
  const stamp = path.join(VENDOR, `libnode-${abi}.version`);
  if (fs.existsSync(out) && fs.readFileSync(stamp, 'utf8').trim() === NODE_VERSION) {
    log(`libnode.so ${abi}: cached (v${NODE_VERSION})`);
    return out;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  let src = spec.cache && fs.existsSync(spec.cache) ? spec.cache : '';
  if (!src) {
    const cached = path.join(VENDOR, `node-android-${abi}-${NODE_VERSION}`, 'bin', 'node');
    if (fs.existsSync(cached)) {
      src = cached;
    } else {
      log(`libnode.so ${abi}: downloading Node ${NODE_VERSION} for Android…`);
      fs.mkdirSync(VENDOR, { recursive: true });
      const tar = path.join(VENDOR, `node-android-${abi}-${NODE_VERSION}.tar.xz`);
      await download(spec.url, tar);
      fs.mkdirSync(path.dirname(cached), { recursive: true });
      // Relative paths + cwd: MSYS tar reads any `C:\`-style argument as a
      // remote-host spec ("Cannot connect to C:"), and it is the only tar on
      // many Windows boxes.
      execFileSync(
        'tar',
        ['xJf', path.basename(tar), '--strip-components=2', spec.member],
        { cwd: VENDOR, stdio: 'inherit' },
      );
      fs.rmSync(tar, { force: true });
      src = cached;
    }
  }
  fs.copyFileSync(src, out);
  fs.mkdirSync(VENDOR, { recursive: true });
  fs.writeFileSync(stamp, NODE_VERSION);
  log(`libnode.so ${abi}: ${out} (${(fs.statSync(out).size / 1048576).toFixed(0)} MB)`);
  return out;
}

/* --- minimal zip writer (deflate) -------------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function walkFiles(root, prefix = '', out = []) {
  for (const ent of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const abs = path.join(root, ent.name);
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      out.push({ dir: true, name: rel + '/' });
      walkFiles(abs, rel, out);
    } else if (ent.isFile()) {
      out.push({ dir: false, name: rel, abs });
    }
  }
  return out;
}

/**
 * Zip per APPNOTE 4.5, deflate method, no data descriptors — Java's
 * ZipInputStream reads it with no extra requirements.
 */
function zipDir(srcDir, zipPath) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of walkFiles(srcDir)) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const crc = file.dir ? 0 : crc32((file.data = fs.readFileSync(file.abs)));
    const comp = file.dir ? Buffer.alloc(0) : zlib.deflateRawSync(file.data, { level: 9 });
    const size = file.dir ? 0 : file.data.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(file.dir ? 0 : 8, 8); // method
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    chunks.push(lh, nameBuf, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(file.dir ? 0 : 8, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(file.dir ? 0x10 : 0, 38); // directory attr
    ch.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([ch, nameBuf]));

    offset += lh.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  fs.writeFileSync(zipPath, Buffer.concat([...chunks, centralBuf, eocd]));
}

function assembleBundle() {
  const standalone = path.join(ROOT, '.next', 'standalone');
  if (!fs.existsSync(path.join(standalone, 'server.js'))) {
    console.error('run `npm run build` first: no .next/standalone output found');
    process.exit(1);
  }
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-server-bundle-'));
  try {
    fs.cpSync(standalone, stage, { recursive: true });
    fs.cpSync(path.join(ROOT, '.next', 'static'), path.join(stage, '.next', 'static'), {
      recursive: true,
    });
    fs.cpSync(path.join(ROOT, 'public'), path.join(stage, 'public'), { recursive: true });
    fs.copyFileSync(
      path.join(ROOT, 'android-server', 'bootstrap.js'),
      path.join(stage, 'bootstrap.js'),
    );

    const assets = path.join(ANDROID, 'assets');
    fs.mkdirSync(assets, { recursive: true });
    const zip = path.join(assets, 'server-bundle.zip');
    fs.rmSync(zip, { force: true });
    zipDir(stage, zip);
    log(`server-bundle.zip: ${(fs.statSync(zip).size / 1048576).toFixed(1)} MB`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

assembleBundle();
for (const abi of Object.keys(NODE_BUILDS)) await nodeBinaryFor(abi);
log('done. build the APK next (npm run android:build).');
