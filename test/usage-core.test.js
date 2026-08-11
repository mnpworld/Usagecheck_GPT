import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, incrementUsage, normalizeState, resetToday, setDailyLimit, statusFor, summarize } from '../lib/usage-core.js';

const DAY = '2026-08-11';

test('default state starts at zero with 100 limit', () => {
  const state = defaultState(DAY);
  assert.equal(state.total, 0);
  assert.equal(state.dailyLimit, 100);
});

test('increment and summarize usage', () => {
  const now = new Date('2026-08-11T04:00:00.000Z');
  const state = incrementUsage({ day: DAY, total: 4, dailyLimit: 10 }, 2, now);
  const usage = summarize(state, DAY);
  assert.equal(usage.total, 6);
  assert.equal(usage.percent, 60);
  assert.equal(usage.remaining, 4);
});

test('new Bangkok day resets count but keeps limit', () => {
  const state = normalizeState({ day: '2026-08-10', total: 80, dailyLimit: 120 }, DAY);
  assert.equal(state.total, 0);
  assert.equal(state.dailyLimit, 120);
});

test('daily limit update and reset work', () => {
  let state = { day: DAY, total: 90, dailyLimit: 100 };
  state = setDailyLimit(state, 200, DAY);
  assert.equal(state.dailyLimit, 200);
  state = resetToday(state, DAY);
  assert.equal(state.total, 0);
  assert.equal(state.dailyLimit, 200);
});

test('warning thresholds map to expected status', () => {
  assert.equal(statusFor(69).level, 'green');
  assert.equal(statusFor(70).level, 'yellow');
  assert.equal(statusFor(90).level, 'orange');
  assert.equal(statusFor(100).level, 'red');
});
