import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseBmDate,
  isResultsMeeting,
  nextResultsDate,
  distillCalendar,
} from '../src/earnings.js';

const HERE = dirname(fileURLToPath(import.meta.url));

async function relianceFixture() {
  const text = await readFile(join(HERE, 'fixtures', 'board-meetings-reliance.json'), 'utf8');
  return JSON.parse(text);
}

// ── parseBmDate ────────────────────────────────────────────────────────────
test('parseBmDate converts NSE date to ISO', () => {
  assert.equal(parseBmDate('24-Apr-2026'), '2026-04-24');
  assert.equal(parseBmDate('5-Sep-2024'), '2024-09-05');   // single-digit day padded
  assert.equal(parseBmDate('16-JAN-2025'), '2025-01-16');  // case-insensitive month
});

test('parseBmDate rejects malformed input without throwing', () => {
  for (const bad of ['', '2026-04-24', '24/Apr/2026', '24-Xyz-2026', '32-Jan-2026', null, undefined, 42]) {
    assert.equal(parseBmDate(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

// ── isResultsMeeting ───────────────────────────────────────────────────────
test('isResultsMeeting matches purpose OR free-text desc', () => {
  assert.equal(isResultsMeeting({ bm_purpose: 'Financial Results/Dividend' }), true);
  // Intimation entries tag results only in the desc:
  assert.equal(isResultsMeeting({
    bm_purpose: 'Board Meeting Intimation',
    bm_desc: '...to consider and approve the Unaudited Financial results of the Company...',
  }), true);
  assert.equal(isResultsMeeting({ bm_purpose: 'Bonus', bm_desc: '...to consider Bonus.' }), false);
  assert.equal(isResultsMeeting({}), false);
  assert.equal(isResultsMeeting(null), false);
});

// ── nextResultsDate (deterministic via injected today) ─────────────────────
test('nextResultsDate picks the nearest today-or-later results meeting', async () => {
  const entries = await relianceFixture();
  // Fixture results meetings: 2024-04-22, 2024-07-19, 2024-10-14, 2025-01-16,
  // 2025-04-25, 2025-07-18, 2025-10-17, 2026-01-16, 2026-04-24
  assert.equal(nextResultsDate(entries, '2026-01-01'), '2026-01-16');
  assert.equal(nextResultsDate(entries, '2026-01-16'), '2026-01-16'); // inclusive of today
  assert.equal(nextResultsDate(entries, '2026-02-01'), '2026-04-24');
  assert.equal(nextResultsDate(entries, '2024-01-01'), '2024-04-22');
});

test('nextResultsDate returns null when all results meetings are in the past', async () => {
  const entries = await relianceFixture();
  assert.equal(nextResultsDate(entries, '2026-05-01'), null);
});

// ── distillCalendar ────────────────────────────────────────────────────────
test('distillCalendar groups by symbol and emits only upcoming dates', () => {
  const entries = [
    { bm_symbol: 'AAA', bm_purpose: 'Financial Results', bm_date: '10-Aug-2026' },
    { bm_symbol: 'AAA', bm_purpose: 'Financial Results', bm_date: '12-May-2026' }, // earlier but past
    { bm_symbol: 'bbb', bm_purpose: 'Financial Results/Dividend', bm_date: '20-Aug-2026' },
    { bm_symbol: 'CCC', bm_purpose: 'Bonus', bm_date: '01-Sep-2026' },             // not results
    { bm_symbol: 'DDD', bm_purpose: 'Financial Results', bm_date: '01-Jan-2025' }, // all past
  ];
  const map = distillCalendar(entries, '2026-07-01');
  assert.equal(map.get('AAA'), '2026-08-10');
  assert.equal(map.get('BBB'), '2026-08-20'); // symbol upper-cased
  assert.equal(map.has('CCC'), false);         // no results meeting
  assert.equal(map.has('DDD'), false);         // only past meetings
  assert.equal(map.size, 2);
});

test('distillCalendar on the real fixture yields RELIANCE only', async () => {
  const entries = await relianceFixture();
  const map = distillCalendar(entries, '2026-01-01');
  assert.equal(map.get('RELIANCE'), '2026-01-16');
  assert.equal(map.size, 1);
});
