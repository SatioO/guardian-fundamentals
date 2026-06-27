import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fundamentalsDoc, period, sectorLines, validateDoc, normalizedCore, SCHEMA_VERSION,
} from '../src/schema.js';

test('a minimal general doc validates', () => {
  const doc = fundamentalsDoc({
    symbol: 'ACME', name: 'Acme Ltd', sector_kind: 'general',
    quarterly: [period({
      period_end: '2025-03-31', period_label: 'Q4 FY25', fiscal_quarter: 'Q4',
      core: { revenue_equiv: 100, net_profit: 10 },
      sector: sectorLines('general', { revenue_from_operations: 100 }),
    })],
  });
  assert.deepEqual(validateDoc(doc), []);
  assert.equal(doc.schema_version, SCHEMA_VERSION);
  assert.equal(doc.identity.exchange, 'NSE');
});

test('sector union serializes as {kind, data}', () => {
  const s = sectorLines('bank', { net_interest_income: 400, nim_pct: 3.2 });
  assert.equal(s.kind, 'bank');
  assert.equal(s.data.net_interest_income, 400);
  // round-trips through JSON unchanged (matches Rust serde tagged union)
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('normalizedCore fills every field with null defaults', () => {
  const c = normalizedCore({ revenue_equiv: 5 });
  assert.equal(c.revenue_equiv, 5);
  assert.equal(c.net_profit, null);
  assert.equal(c.margin_kind, 'unavailable');
});

test('validateDoc rejects wrong exchange, bad sector kind, malformed period', () => {
  const bad = fundamentalsDoc({ symbol: 'X', name: 'X', sector_kind: 'general' });
  bad.identity.exchange = 'BSE';
  bad.identity.sector_kind = 'crypto';
  bad.results.quarterly = [{ period_end: '', fiscal_quarter: '', basis: 'weird', core: {}, sector: { kind: 'nope' } }];
  const errs = validateDoc(bad);
  assert.ok(errs.some((e) => e.includes('exchange')));
  assert.ok(errs.some((e) => e.includes('sector_kind')));
  assert.ok(errs.some((e) => e.includes('period_end')));
  assert.ok(errs.some((e) => e.includes('basis')));
});

test('unknown sector kind throws at build time', () => {
  assert.throws(() => sectorLines('reit', {}), /unknown sector kind/);
  assert.throws(() => fundamentalsDoc({ symbol: 'X', name: 'X', sector_kind: 'reit' }), /unknown sector kind/);
});
