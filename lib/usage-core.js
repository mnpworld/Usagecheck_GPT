export const DEFAULT_LIMIT = 100;
export const DEFAULT_WARN_AT = [70, 90, 100];

export function bangkokDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function defaultState(day = bangkokDayKey()) {
  return {
    day,
    total: 0,
    dailyLimit: DEFAULT_LIMIT,
    warnAt: [...DEFAULT_WARN_AT],
    lastEventAt: null
  };
}

export function normalizeState(input = {}, day = bangkokDayKey()) {
  const limit = Number(input.dailyLimit);
  const warnAt = Array.isArray(input.warnAt)
    ? input.warnAt.map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 100).sort((a, b) => a - b)
    : [...DEFAULT_WARN_AT];

  if (input.day !== day) {
    return {
      day,
      total: 0,
      dailyLimit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
      warnAt: warnAt.length ? warnAt : [...DEFAULT_WARN_AT],
      lastEventAt: null
    };
  }

  const total = Number(input.total);
  return {
    day,
    total: Number.isFinite(total) && total >= 0 ? Math.floor(total) : 0,
    dailyLimit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT,
    warnAt: warnAt.length ? warnAt : [...DEFAULT_WARN_AT],
    lastEventAt: input.lastEventAt || null
  };
}

export function summarize(input = {}, day = bangkokDayKey()) {
  const state = normalizeState(input, day);
  const percent = state.dailyLimit > 0
    ? Math.min(999, Math.round((state.total / state.dailyLimit) * 100))
    : 0;

  return {
    ...state,
    percent,
    remaining: Math.max(0, state.dailyLimit - state.total)
  };
}

export function incrementUsage(input = {}, count = 1, now = new Date()) {
  const day = bangkokDayKey(now);
  const state = normalizeState(input, day);
  const amount = Number(count);
  const safeCount = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
  return {
    ...state,
    total: state.total + safeCount,
    lastEventAt: now.toISOString()
  };
}

export function setDailyLimit(input = {}, dailyLimit, day = bangkokDayKey()) {
  const state = normalizeState(input, day);
  const limit = Number(dailyLimit);
  if (!Number.isFinite(limit) || limit <= 0) return state;
  return { ...state, dailyLimit: Math.floor(limit) };
}

export function resetToday(input = {}, day = bangkokDayKey()) {
  const state = normalizeState(input, day);
  return { ...state, total: 0, lastEventAt: null };
}

export function statusFor(percent) {
  if (percent >= 100) return { text: 'ถึง Limit', help: 'การใช้งานแตะ 100% ของ Limit วันนี้แล้ว', level: 'red' };
  if (percent >= 90) return { text: 'ใกล้เต็ม', help: 'การใช้งานถึงระดับเตือน 90%', level: 'orange' };
  if (percent >= 70) return { text: 'ควรระวัง', help: 'การใช้งานถึงระดับเตือน 70%', level: 'yellow' };
  return { text: 'ปกติ', help: 'ยังไม่ถึงระดับแจ้งเตือน', level: 'green' };
}
