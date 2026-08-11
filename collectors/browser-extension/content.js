const SERVER_URL = 'http://localhost:8787';

function getDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['deviceId'], (data) => {
      if (data.deviceId) return resolve(data.deviceId);
      const id = crypto.randomUUID();
      chrome.storage.local.set({ deviceId: id }, () => resolve(id));
    });
  });
}

async function reportUsage() {
  const deviceId = await getDeviceId();
  try {
    await fetch(`${SERVER_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: 1,
        source: 'browser-extension',
        channel: 'chatgpt-web',
        deviceId
      })
    });
  } catch (err) {
    console.warn('Usagecheck GPT: failed to report usage', err);
  }
}

let lastSubmittedAt = 0;
function maybeReport() {
  const now = Date.now();
  if (now - lastSubmittedAt < 800) return;
  lastSubmittedAt = now;
  reportUsage();
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('textarea, [contenteditable="true"]')) {
    setTimeout(maybeReport, 50);
  }
}, true);

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button');
  if (!button) return;
  const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.toLowerCase();
  if (label.includes('send') || label.includes('ส่ง')) {
    setTimeout(maybeReport, 50);
  }
}, true);
