import { defaultState, incrementUsage, resetToday, setDailyLimit, statusFor, summarize, normalizeState } from './lib/usage-core.js';

const STORAGE_KEY = 'usagecheck-gpt-pages-v1';
const BRIDGE_REQUEST = 'USAGECHECK_GPT_REQUEST';
const BRIDGE_RESPONSE = 'USAGECHECK_GPT_RESPONSE';
const $ = (id) => document.getElementById(id);
let bridgeAvailable = false;
let pending = new Map();

function localLoad() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
  } catch {
    return defaultState();
  }
}

function localSave(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function bridgeCall(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('bridge_timeout'));
    }, 700);
    pending.set(id, { resolve, timer });
    window.postMessage({ type: BRIDGE_REQUEST, id, action, payload }, '*');
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.type !== BRIDGE_RESPONSE) return;
  const item = pending.get(event.data.id);
  if (!item) return;
  clearTimeout(item.timer);
  pending.delete(event.data.id);
  bridgeAvailable = true;
  item.resolve(event.data.result);
});

async function readState() {
  try {
    const state = await bridgeCall('get');
    return normalizeState(state);
  } catch {
    return localLoad();
  }
}

async function mutate(action, payload = {}) {
  try {
    return normalizeState(await bridgeCall(action, payload));
  } catch {
    const current = localLoad();
    if (action === 'increment') return localSave(incrementUsage(current, payload.count || 1));
    if (action === 'setLimit') return localSave(setDailyLimit(current, payload.dailyLimit));
    if (action === 'reset') return localSave(resetToday(current));
    return current;
  }
}

function render(state) {
  const data = summarize(state);
  $('total').textContent = data.total;
  $('limit').textContent = data.dailyLimit;
  $('percent').textContent = `${data.percent}%`;
  $('remaining').textContent = data.remaining;
  $('limitInput').value = data.dailyLimit;
  $('barFill').style.width = `${Math.min(100, data.percent)}%`;
  $('lastEvent').textContent = data.lastEventAt ? new Date(data.lastEventAt).toLocaleTimeString('th-TH') : 'ยังไม่มีข้อมูล';
  const s = statusFor(data.percent);
  $('statusText').textContent = s.text;
  $('statusHelp').textContent = s.help;
  $('statusDot').className = `status-dot ${s.level}`;
  $('barFill').className = s.level;
  const banner = $('connectionBanner');
  banner.className = `banner ${bridgeAvailable ? 'ok' : 'warning'}`;
  banner.textContent = bridgeAvailable
    ? 'เชื่อมต่อ Browser Collector แล้ว — Dashboard และ ChatGPT ใช้ยอดเดียวกัน'
    : 'โหมดทดลองบน GitHub Pages — ยังไม่พบ Browser Collector จึงเก็บยอดไว้ใน Local Storage ของหน้านี้';
  $('storageMode').textContent = bridgeAvailable ? 'ข้อมูลจาก Browser Collector' : 'ข้อมูล Local Storage ของ GitHub Pages';
}

async function refresh() {
  bridgeAvailable = false;
  render(await readState());
}

$('addOne').addEventListener('click', async () => render(await mutate('increment', { count: 1 })));
$('saveLimit').addEventListener('click', async () => render(await mutate('setLimit', { dailyLimit: Number($('limitInput').value) })));
$('resetToday').addEventListener('click', async () => {
  if (!confirm('Reset ยอดการใช้งานของวันนี้เป็น 0?')) return;
  render(await mutate('reset'));
});

refresh();
setInterval(refresh, 5000);
