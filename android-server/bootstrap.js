/**
 * Android in-app server bootstrap.
 *
 * The Next.js standalone server (`server.js`, shipped beside this file under
 * the app's files dir) is started as a child process bound to 0.0.0.0 so any
 * device on the Wi-Fi can reach it. This wrapper's job is the three things the
 * WebView needs and plain `server.js` does not provide:
 *
 *  1. write the port to a known file the native shell reads (`server-port`),
 *     after the health endpoint actually answers — not when the port opens;
 *  2. answer `/__shell/ready` on 127.0.0.1:3001 with the external URL and the
 *     device's LAN IPv4, so the WebView (which cannot open sockets) can find
 *     the server with a plain fetch;
 *  3. die with the app: the native shell owns this process's lifetime.
 *
 * It runs on the Node.js binary bundled with the APK (Bionic build, arm64 /
 * x86_64) — the same runtime the standalone server needs.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
// Fixed, documented values: the service starts this wrapper expecting 3000 for
// the app and 3001 for readiness, and the launcher page polls 3001. Env
// overrides exist for tests only.
const PORT = Number(process.env.DH_PORT || 3000);
const READY_PORT = Number(process.env.DH_READY_PORT || 3001);
const PORT_FILE = path.join(ROOT, 'server-port');
const LOG_FILE = path.join(ROOT, 'server.log');

function log(msg) {
  const line = `[dh-server ${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    /* logging must never take the server down */
  }
}

/** IPv4 on a real interface (wlan0/ap0), skipping loopback and emulator nets. */
function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/^(lo|dummy|rmnet|ap_|swlan)/i.test(name)) continue;
      out.push({ name, address: a.address });
    }
  }
  // Prefer Wi-Fi-ish names first.
  const score = (n) => (/^(wlan|ap|swlan|eth)/i.test(n) ? 0 : 1);
  return out.sort((x, y) => score(x.name) - score(y.name));
}

const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOSTNAME: '0.0.0.0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const relay = (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);
  try {
    fs.appendFileSync(LOG_FILE, text);
  } catch {
    /* same */
  }
};
child.stdout.on('data', relay);
child.stderr.on('data', relay);
child.on('exit', (code, sig) => {
  log(`next exited code=${code} sig=${sig}`);
  try {
    fs.rmSync(PORT_FILE, { force: true });
  } catch {
    /* best effort */
  }
  // The shell's watchdog restarts us; exiting is always safe here.
  process.exit(code === null ? 1 : code || 1);
});

// Poll our own health endpoint the same way a client would: an open port is
// not "ready", an answering /api/health is.
function healthOk() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 2000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

const ready = http.createServer((req, res) => {
  if (!req.url || !req.url.startsWith('/__shell/ready')) {
    res.writeHead(404).end();
    return;
  }
  const lan = lanAddresses();
  // The launcher page runs on the shell origin (https://localhost), so this
  // reply is cross-origin. It answers from 127.0.0.1 only, with data that is
  // public by nature (a LAN address), so `*` is the honest scope here.
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(
    JSON.stringify({
      ok: true,
      port: PORT,
      app: `http://127.0.0.1:${PORT}/`,
      // The address to share with other devices on the network.
      share: lan.map((a) => `http://${a.address}:${PORT}/`),
    }),
  );
});
ready.listen(READY_PORT, '127.0.0.1', () => log(`ready endpoint on 127.0.0.1:${READY_PORT}`));

(async () => {
  for (let i = 0; i < 120; i++) {
    if (await healthOk()) {
      fs.writeFileSync(PORT_FILE, String(PORT));
      log(`health ok; wrote ${PORT_FILE}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  log('health never came up within 60s');
})();

const shutdown = () => {
  try {
    child.kill('SIGTERM');
  } catch {
    /* already gone */
  }
  ready.close();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
