import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNextDate } from '../bin/earnings.mjs';

test('resolveNextDate: feed value wins when present', () => {
  assert.equal(resolveNextDate('2026-07-18', '2026-10-20', '2026-08-01'), '2026-10-20');
  assert.equal(resolveNextDate(null, '2026-10-20', '2026-08-01'), '2026-10-20');
});

test('resolveNextDate: keep a still-future existing date the feed lacked', () => {
  assert.equal(resolveNextDate('2026-09-15', null, '2026-08-01'), '2026-09-15');
});

test('resolveNextDate: drop a stale past date when the feed has nothing', () => {
  assert.equal(resolveNextDate('2026-04-24', null, '2026-08-01'), null);
  assert.equal(resolveNextDate(null, null, '2026-08-01'), null);
});
