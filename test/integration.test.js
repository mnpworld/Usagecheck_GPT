import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 18787;
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let dataDir;

async function waitForServer() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/usage`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

test.before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'usagecheck-gpt-'));
  child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer();
});

test.after(async () => {
  child?.kill('SIGTERM');
  await rm(dataDir, { recursive: true, force: true });
});

test('dashboard is served', async () => {
  const r = await fetch(`${BASE}/`);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /ChatGPT Usage Monitor/);
});

test('initial usage is zero with default limit', async () => {
  const r = await fetch(`${BASE}/api/usage`);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.total, 0);
  assert.equal(body.dailyLimit, 100);
  assert.equal(body.remaining, 100);
});

test('events from different sources aggregate into one total', async () => {
  const first = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ count: 2, source: 'chrome', channel: 'web' })
  });
  assert.equal(first.status, 201);

  const second = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ count: 3, source: 'desktop', channel: 'app' })
  });
  assert.equal(second.status, 201);

  const usage = await (await fetch(`${BASE}/api/usage`)).json();
  assert.equal(usage.total, 5);
  assert.equal(usage.remaining, 95);
  assert.deepEqual(new Set(usage.sourcesObserved), new Set(['chrome', 'desktop']));
});

test('daily limit can be updated', async () => {
  const r = await fetch(`${BASE}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dailyLimit: 10, warnAt: [70, 90, 100] })
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.settings.dailyLimit, 10);
  assert.equal(body.usage.total, 5);
  assert.equal(body.usage.percent, 50);
  assert.equal(body.usage.remaining, 5);
});

test('invalid JSON is rejected', async () => {
  const r = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad json'
  });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: 'invalid_json' });
});

test('reset today clears current usage', async () => {
  const r = await fetch(`${BASE}/api/reset-today`, { method: 'POST' });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.total, 0);
  assert.equal(body.dailyLimit, 10);
  assert.equal(body.remaining, 10);
});
