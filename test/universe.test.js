import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCandidate, partitionUniverse,
  MARKET_CAP_FLOOR_CR, MARKET_CAP_EXIT_CR,
} from '../src/universe.js';

const base = {
  series: 'EQ', marketCapCr: 1000, quartersFiled: 8,
  quartersSinceLastFiling: 0, wasInUniverse: false,
};

test('floor matches the Rust contract (Rs800cr)', () => {
  assert.equal(MARKET_CAP_FLOOR_CR, 800);
});

test('a clean large-cap EQ name is covered', () => {
  assert.deepEqual(evaluateCandidate(base), { included: true, reason: 'covered' });
});

test('non-EQ series is excluded before anything else', () => {
  for (const series of ['SM', 'ST', 'BE', 'IL']) {
    assert.equal(evaluateCandidate({ ...base, series }).reason, 'wrong_series');
  }
});

test('insufficient history is excluded even when large-cap', () => {
  assert.equal(evaluateCandidate({ ...base, quartersFiled: 3 }).reason, 'insufficient_history');
});

test('stale (inactive) filer is excluded', () => {
  assert.equal(evaluateCandidate({ ...base, quartersSinceLastFiling: 2 }).reason, 'inactive_filer');
});

test('below floor is excluded and tagged below_threshold', () => {
  const r = evaluateCandidate({ ...base, marketCapCr: 500 });
  assert.deepEqual(r, { included: false, reason: 'below_threshold' });
});

test('hysteresis: existing member survives in the 720-800 band; new entrant does not', () => {
  const inBand = 760; // between exit (720) and floor (800)
  assert.equal(inBand > MARKET_CAP_EXIT_CR && inBand < MARKET_CAP_FLOOR_CR, true);
  assert.equal(evaluateCandidate({ ...base, marketCapCr: inBand, wasInUniverse: true }).included, true);
  assert.equal(evaluateCandidate({ ...base, marketCapCr: inBand, wasInUniverse: false }).included, false);
});

test('hysteresis: an existing member below the exit band is finally dropped', () => {
  assert.equal(evaluateCandidate({ ...base, marketCapCr: 700, wasInUniverse: true }).reason, 'below_threshold');
});

test('partitionUniverse splits covered from below-floor and ignores other exclusions', () => {
  const { covered, belowFloor } = partitionUniverse([
    { ...base, symbol: 'BIG', marketCapCr: 5000 },
    { ...base, symbol: 'SMALL', marketCapCr: 300 },
    { ...base, symbol: 'SME', series: 'SM' },          // wrong_series -> neither list
    { ...base, symbol: 'YOUNG', quartersFiled: 1 },    // insufficient -> neither list
  ]);
  assert.deepEqual(covered.map((c) => c.symbol), ['BIG']);
  assert.deepEqual(belowFloor.map((c) => c.symbol), ['SMALL']);
});
