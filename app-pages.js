import { CATEGORIES, statusFor, summarize, normalizeState } from './lib/usage-core.js';

const BRIDGE_REQUEST = 'USAGECHECK_GPT_REQUEST';
const BRIDGE_RESPONSE = 'USAGECHECK_GPT_RESPONSE';
const BRIDGE_PUSH = 'USAGECHECK_GPT_PUSH';
const $ = (id) => document.getElementById(id);
let connected = false;
let pending = new Map();
let lastState = null;

function bridgeCall(action, payload = {}, timeoutMs = 1200) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('collector_unavailable'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    window.postMessage({ type: BRIDGE_REQUEST, id, action, payload }, '*');
  });
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === BRIDGE_RESPONSE) {
    const item = pending.get(event.data.id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.delete(event.data.id);
    connected = true;
    item.resolve(event.data.result);
    return;
  }
  if (event.data?.type === BRIDGE_PUSH && event.data?.result) {
    connected = true;
    lastState = normalizeState(event.data.result);
    render(lastState);
  }
});

function cardHtml(item) {
  const s = statusFor(item.percent);
  return `<article class="card usage-card">
    <div class="card-head">
      <div><p class="label">${item.label}</p><div class="metric small-metric">${item.percent}%</div></div>
      <span class="pill ${s.level}">${s.text}</span>
    </div>
    <div class="bar"><div class="${s.level}" style="width:${Math.min(100, item.percent)}%"></div></div>
    <div class="row"><span>ใช้ <b>${item.total}</b> / ${item.limit}</span><span>เหลือ <b>${item.remaining}</b></span></div>
    <div class="limit-row"><label>Limit</label><input data-limit-input="${item.key}" type="number" min="1" value="${item.limit}"><button data-save-limit="${item.key}">บันทึก</button></div>
    <p class="muted tiny">ล่าสุด: ${item.lastEventAt ? new Date(item.lastEventAt).toLocaleTimeString('th-TH') : 'ยังไม่มีการใช้งานวันนี้'}</p>
  </article>`;
}

function bindLimitButtons() {
  document.querySelectorAll('[data-save-limit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const category = button.dataset.saveLimit;
      const input = document.querySelector(`[data-limit-input="${category}"]`);
      try {
        const result = await bridgeCall('setLimit', { category, dailyLimit: Number(input.value) });
        lastState = normalizeState(result);
        render(lastState);
      } catch {
        renderOffline();
      }
    });
  });
}

function render(state) {
  const data = summarize(state);
  $('categoryGrid').innerHTML = CATEGORIES.map((key) => cardHtml(data.categories[key])).join('');
  $('connectionBanner').className = 'banner ok';
  $('connectionBanner').textContent = '● Realtime Collector เชื่อมต่อแล้ว — ตัวเลขจะอัปเดตทันทีเมื่อมีการใช้งาน';
  $('storageMode').textContent = `Production mode • Realtime • วันที่ ${data.day} (Asia/Bangkok)`;
  bindLimitButtons();
}

function renderOffline() {
  connected = false;
  $('connectionBanner').className = 'banner error';
  $('connectionBanner').textContent = '● Collector Offline — กรุณาติดตั้ง/Reload Usagecheck GPT Collector แล้ว Refresh หน้านี้';
  $('categoryGrid').innerHTML = CATEGORIES.map((key) => `<article class="card usage-card offline-card"><p class="label">${key === 'chat' ? 'แชททั่วไป' : key === 'image' ? 'สร้างรูปภาพ' : key === 'code' ? 'เขียนโค้ด' : 'Deep Research'}</p><div class="metric small-metric">--%</div><p class="muted">ยังไม่ได้รับข้อมูลจาก Collector</p></article>`).join('');
  $('storageMode').textContent = 'ไม่มีข้อมูลจำลอง: Production mode จะแสดงเฉพาะข้อมูลที่ Collector ตรวจพบจริง';
}

async function connect() {
  try {
    const result = await bridgeCall('get');
    connected = true;
    lastState = normalizeState(result);
    render(lastState);
  } catch {
    renderOffline();
  }
}

window.addEventListener('focus', () => { if (!connected) connect(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !connected) connect(); });
connect();
