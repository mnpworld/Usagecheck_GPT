const STORAGE_KEY = 'usageState';
const BRIDGE_REQUEST = 'USAGECHECK_GPT_REQUEST';
const BRIDGE_RESPONSE = 'USAGECHECK_GPT_RESPONSE';

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function normalize(input = {}) {
  const day = dayKey();
  const dailyLimit = Number(input.dailyLimit) > 0 ? Math.floor(Number(input.dailyLimit)) : 100;
  const warnAt = Array.isArray(input.warnAt) ? input.warnAt : [70, 90, 100];
  if (input.day !== day) return { day, total: 0, dailyLimit, warnAt, lastEventAt: null };
  return {
    day,
    total: Number(input.total) >= 0 ? Math.floor(Number(input.total)) : 0,
    dailyLimit,
    warnAt,
    lastEventAt: input.lastEventAt || null
  };
}

async function getState() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const state = normalize(data[STORAGE_KEY]);
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

async function saveState(state) {
  const normalized = normalize(state);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

async function increment(count = 1) {
  const state = await getState();
  const amount = Number(count) > 0 ? Math.floor(Number(count)) : 1;
  state.total += amount;
  state.lastEventAt = new Date().toISOString();
  return saveState(state);
}

async function setLimit(dailyLimit) {
  const state = await getState();
  const limit = Number(dailyLimit);
  if (Number.isFinite(limit) && limit > 0) state.dailyLimit = Math.floor(limit);
  return saveState(state);
}

async function resetToday() {
  const state = await getState();
  state.total = 0;
  state.lastEventAt = null;
  return saveState(state);
}

if (location.hostname === 'chatgpt.com') {
  let lastSubmittedAt = 0;
  function maybeReport() {
    const now = Date.now();
    if (now - lastSubmittedAt < 800) return;
    lastSubmittedAt = now;
    increment(1).catch((err) => console.warn('Usagecheck GPT: count failed', err));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('textarea, [contenteditable="true"]')) setTimeout(maybeReport, 50);
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!button) return;
    const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.toLowerCase();
    if (label.includes('send') || label.includes('ส่ง')) setTimeout(maybeReport, 50);
  }, true);
}

if (location.hostname === 'mnpworld.github.io' && location.pathname.startsWith('/Usagecheck_GPT')) {
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.type !== BRIDGE_REQUEST) return;
    const { id, action, payload = {} } = event.data;
    let result;
    if (action === 'get') result = await getState();
    else if (action === 'increment') result = await increment(payload.count || 1);
    else if (action === 'setLimit') result = await setLimit(payload.dailyLimit);
    else if (action === 'reset') result = await resetToday();
    else return;
    window.postMessage({ type: BRIDGE_RESPONSE, id, result }, '*');
  });
}
