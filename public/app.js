const $ = (id) => document.getElementById(id);

function statusFor(percent) {
  if (percent >= 100) return { text: 'ถึง Limit', help: 'การใช้งานแตะ 100% ของ Limit วันนี้แล้ว', cls: 'red' };
  if (percent >= 90) return { text: 'ใกล้เต็ม', help: 'การใช้งานถึงระดับเตือน 90%', cls: 'orange' };
  if (percent >= 70) return { text: 'ควรระวัง', help: 'การใช้งานถึงระดับเตือน 70%', cls: 'yellow' };
  return { text: 'ปกติ', help: 'ยังไม่ถึงระดับแจ้งเตือน', cls: 'green' };
}

function render(data) {
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
  $('statusDot').className = `status-dot ${s.cls}`;
  $('barFill').className = s.cls;
}

async function refresh() {
  const res = await fetch('/api/usage');
  render(await res.json());
}

$('addOne').addEventListener('click', async () => {
  const res = await fetch('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 1, source: 'dashboard-test', channel: 'manual' })
  });
  const data = await res.json();
  render(data.usage);
});

$('saveLimit').addEventListener('click', async () => {
  const dailyLimit = Number($('limitInput').value);
  const res = await fetch('/api/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyLimit })
  });
  const data = await res.json();
  render(data.usage);
});

$('resetToday').addEventListener('click', async () => {
  if (!confirm('Reset ยอดการใช้งานของวันนี้เป็น 0?')) return;
  const res = await fetch('/api/reset-today', { method: 'POST' });
  render(await res.json());
});

refresh();
setInterval(refresh, 5000);
