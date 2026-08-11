import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'usage.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ events: [], settings: { dailyLimit: 100, warnAt: [70, 90, 100] } }, null, 2));
}

const loadDb = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const saveDb = (db) => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
const dayKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(body));
}

function serveFile(res, relPath, type) {
  const p = path.join(__dirname, relPath);
  if (!fs.existsSync(p)) return sendJson(res, 404, { error: 'not_found' });
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(p).pipe(res);
}

function summarize(db) {
  const today = dayKey();
  const todayEvents = db.events.filter((e) => e.day === today);
  const total = todayEvents.reduce((s, e) => s + (e.count || 1), 0);
  const dailyLimit = Number(db.settings.dailyLimit || 100);
  return {
    day: today,
    total,
    dailyLimit,
    percent: dailyLimit > 0 ? Math.min(999, Math.round((total / dailyLimit) * 100)) : 0,
    remaining: Math.max(0, dailyLimit - total),
    warnAt: db.settings.warnAt || [70, 90, 100],
    lastEventAt: todayEvents.at(-1)?.createdAt || null,
    sourcesObserved: [...new Set(todayEvents.map((e) => e.source || 'unknown'))]
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/') return serveFile(res, 'public/index.html', 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/app.js') return serveFile(res, 'public/app.js', 'text/javascript; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/styles.css') return serveFile(res, 'public/styles.css', 'text/css; charset=utf-8');

  if (req.method === 'GET' && url.pathname === '/api/usage') {
    const db = loadDb();
    return sendJson(res, 200, summarize(db));
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    const db = loadDb();
    return sendJson(res, 200, db.events.slice(-200));
  }

  if (req.method === 'POST' && url.pathname === '/api/events') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let input = {};
    try { input = raw ? JSON.parse(raw) : {}; } catch { return sendJson(res, 400, { error: 'invalid_json' }); }

    const db = loadDb();
    const event = {
      id: crypto.randomUUID(),
      day: dayKey(),
      createdAt: new Date().toISOString(),
      count: Math.max(1, Number(input.count || 1)),
      source: String(input.source || 'collector'),
      channel: String(input.channel || 'unspecified'),
      deviceId: input.deviceId ? String(input.deviceId) : null,
      note: input.note ? String(input.note).slice(0, 120) : null
    };
    db.events.push(event);
    saveDb(db);
    return sendJson(res, 201, { event, usage: summarize(db) });
  }

  if (req.method === 'PUT' && url.pathname === '/api/settings') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let input = {};
    try { input = raw ? JSON.parse(raw) : {}; } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
    const db = loadDb();
    if (Number.isFinite(Number(input.dailyLimit)) && Number(input.dailyLimit) > 0) db.settings.dailyLimit = Number(input.dailyLimit);
    if (Array.isArray(input.warnAt)) db.settings.warnAt = input.warnAt.map(Number).filter((n) => n > 0 && n <= 100).sort((a,b) => a-b);
    saveDb(db);
    return sendJson(res, 200, { settings: db.settings, usage: summarize(db) });
  }

  if (req.method === 'POST' && url.pathname === '/api/reset-today') {
    const db = loadDb();
    const today = dayKey();
    db.events = db.events.filter((e) => e.day !== today);
    saveDb(db);
    return sendJson(res, 200, summarize(db));
  }

  return sendJson(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`Usagecheck GPT running at http://localhost:${PORT}`);
});
