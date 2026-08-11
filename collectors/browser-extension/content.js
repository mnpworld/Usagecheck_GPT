const STORAGE_KEY = 'usageStateV2';
const BRIDGE_REQUEST = 'USAGECHECK_GPT_REQUEST';
const BRIDGE_RESPONSE = 'USAGECHECK_GPT_RESPONSE';
const BRIDGE_PUSH = 'USAGECHECK_GPT_PUSH';
const CATEGORIES = ['chat', 'image', 'code', 'research'];

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}
function blank() { return Object.fromEntries(CATEGORIES.map((k) => [k, 0])); }
function blankLast() { return Object.fromEntries(CATEGORIES.map((k) => [k, null])); }
function normalize(input = {}) {
  const day = dayKey();
  const limits = { chat: 100, image: 100, code: 100, research: 100 };
  for (const k of CATEGORIES) {
    const n = Number(input?.limits?.[k]);
    if (Number.isFinite(n) && n > 0) limits[k] = Math.floor(n);
  }
  if (input.day !== day) return { day, usage: blank(), limits, warnAt: [70, 90, 100], lastEventAt: blankLast() };
  const usage = blank();
  const lastEventAt = blankLast();
  for (const k of CATEGORIES) {
    const n = Number(input?.usage?.[k]);
    usage[k] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    lastEventAt[k] = input?.lastEventAt?.[k] || null;
  }
  return { day, usage, limits, warnAt: [70, 90, 100], lastEventAt };
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
async function increment(category = 'chat', count = 1) {
  const state = await getState();
  const key = CATEGORIES.includes(category) ? category : 'chat';
  const n = Number(count);
  state.usage[key] += Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  state.lastEventAt[key] = new Date().toISOString();
  return saveState(state);
}
async function setLimit(category, dailyLimit) {
  const state = await getState();
  const n = Number(dailyLimit);
  if (CATEGORIES.includes(category) && Number.isFinite(n) && n > 0) state.limits[category] = Math.floor(n);
  return saveState(state);
}

function currentComposer() {
  const editor = document.querySelector('textarea, [contenteditable="true"]');
  return editor?.closest('form') || editor?.closest('[data-testid*="composer"]') || editor?.parentElement || document.body;
}
function selectedModeText() {
  const root = currentComposer();
  return [...root.querySelectorAll('[aria-pressed="true"], [aria-current="true"], [data-state="on"], [data-selected="true"]')]
    .map((el) => `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.textContent || ''}`)
    .join(' ')
    .toLowerCase();
}
function currentPromptText() {
  const el = document.querySelector('textarea, [contenteditable="true"]');
  if (!el) return '';
  return ('value' in el ? el.value : el.textContent || '').trim().toLowerCase();
}
function detectCategory() {
  const url = location.href.toLowerCase();
  const mode = selectedModeText();
  const prompt = currentPromptText();
  if (url.includes('deep-research') || /deep\s*research|ค้นคว้าเชิงลึก/.test(mode)) return 'research';
  if (url.includes('codex') || /\bcodex\b|code mode|โหมดเขียนโค้ด/.test(mode)) return 'code';
  if (/create image|generate image|image generation|สร้างรูป|สร้างภาพ|รูปภาพ/.test(mode)) return 'image';
  if (/deep\s*research|ค้นคว้าเชิงลึก/.test(prompt)) return 'research';
  if (/(สร้าง|วาด|generate|create).{0,24}(รูป|ภาพ|image|picture)/i.test(prompt)) return 'image';
  if (/(เขียน|แก้|สร้าง|review|debug).{0,24}(โค้ด|code|script|function|program)/i.test(prompt)) return 'code';
  return 'chat';
}

if (location.hostname === 'chatgpt.com') {
  let lastSubmittedAt = 0;
  function maybeReport() {
    const now = Date.now();
    if (now - lastSubmittedAt < 1200) return;
    lastSubmittedAt = now;
    const category = detectCategory();
    increment(category, 1).catch((err) => console.warn('Usagecheck GPT count failed', err));
  }
  document.addEventListener('submit', () => setTimeout(maybeReport, 0), true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('textarea,[contenteditable="true"]')) setTimeout(maybeReport, 0);
  }, true);
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!button) return;
    const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.textContent || ''}`.toLowerCase();
    if (label.includes('send') || label.includes('ส่ง')) setTimeout(maybeReport, 0);
  }, true);
}

if (location.hostname === 'mnpworld.github.io' && location.pathname.startsWith('/Usagecheck_GPT')) {
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.type !== BRIDGE_REQUEST) return;
    const { id, action, payload = {} } = event.data;
    let result;
    if (action === 'get') result = await getState();
    else if (action === 'setLimit') result = await setLimit(payload.category, payload.dailyLimit);
    else return;
    window.postMessage({ type: BRIDGE_RESPONSE, id, result }, '*');
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]?.newValue) return;
    window.postMessage({ type: BRIDGE_PUSH, result: normalize(changes[STORAGE_KEY].newValue) }, '*');
  });
  getState().then((result) => window.postMessage({ type: BRIDGE_PUSH, result }, '*')).catch(() => {});
}
