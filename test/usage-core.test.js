import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, defaultState, incrementUsage, normalizeState, resetToday, setCategoryLimit, statusFor, summarize } from '../lib/usage-core.js';

const DAY='2026-08-11';

test('default state has four categories',()=>{const s=defaultState(DAY);assert.deepEqual(Object.keys(s.usage),CATEGORIES);for(const k of CATEGORIES){assert.equal(s.usage[k],0);assert.equal(s.limits[k],100)}});

test('increments are isolated per category',()=>{const now=new Date('2026-08-11T04:00:00.000Z');let s=defaultState(DAY);s=incrementUsage(s,'image',2,now);s=incrementUsage(s,'code',1,now);const u=summarize(s,DAY);assert.equal(u.categories.image.total,2);assert.equal(u.categories.code.total,1);assert.equal(u.categories.chat.total,0);assert.equal(u.categories.research.total,0)});

test('each category calculates its own percent',()=>{let s=defaultState(DAY);s=setCategoryLimit(s,'image',20,DAY);s=incrementUsage(s,'image',5,new Date('2026-08-11T04:00:00.000Z'));const u=summarize(s,DAY);assert.equal(u.categories.image.percent,25);assert.equal(u.categories.image.remaining,15)});

test('new Bangkok day resets all usage but keeps category limits',()=>{const s=normalizeState({day:'2026-08-10',usage:{chat:80,image:3,code:4,research:1},limits:{chat:120,image:20,code:50,research:10}},DAY);for(const k of CATEGORIES)assert.equal(s.usage[k],0);assert.equal(s.limits.chat,120);assert.equal(s.limits.research,10)});

test('reset today clears all categories',()=>{let s=defaultState(DAY);for(const k of CATEGORIES)s=incrementUsage(s,k,1,new Date('2026-08-11T04:00:00.000Z'));s=resetToday(s,DAY);for(const k of CATEGORIES)assert.equal(s.usage[k],0)});

test('warning thresholds map to expected status',()=>{assert.equal(statusFor(69).level,'green');assert.equal(statusFor(70).level,'yellow');assert.equal(statusFor(90).level,'orange');assert.equal(statusFor(100).level,'red')});
