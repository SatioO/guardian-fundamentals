import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fundamentalsDoc, period, sectorLines, validateDoc } from '../src/schema.js';
import { writeArtifact, buildIndex, buildEarningsCalendar, sha256, docPath } from '../src/artifact.js';

test('buildEarningsCalendar emits a sorted symbol→date map', () => {
  const cal = buildEarningsCalendar(
    new Map([['ZEEL', '2026-08-01'], ['ABB', '2026-07-20']]),
    '2026-06-28T00:00:00.000Z',
  );
  assert.equal(cal.count, 2);
  assert.deepEqual(Object.keys(cal.dates), ['ABB', 'ZEEL']); // sorted
  assert.equal(cal.dates.ABB, '2026-07-20');
  const cal2 = buildEarningsCalendar({ ZEEL: '2026-08-01', ABB: '2026-07-20' }, 'x');
  assert.deepEqual(Object.keys(cal2.dates), ['ABB', 'ZEEL']);
});

function sampleDoc(symbol, sector_kind) {
  return fundamentalsDoc({
    symbol, name: `${symbol} Ltd`, sector_kind,
    last_known_market_cap_cr: 1200,
    provenance: { as_of: '2025-03-31' },
    quarterly: [period({
      period_end: '2025-03-31', period_label: 'Q4 FY25', fiscal_quarter: 'Q4',
      core: { revenue_equiv: 100, net_profit: 10 },
      sector: sectorLines(sector_kind, {}),
    })],
  });
}

test('writeArtifact emits valid per-symbol docs, index, below-floor and manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gf-'));
  const docs = [sampleDoc('AAA', 'general'), sampleDoc('BBB', 'bank')];
  const belowFloor = [{ symbol: 'TINY', exchange: 'NSE' }];

  const { manifest, count } = await writeArtifact(root, {
    docs, belowFloor, generatedAt: '2026-06-27T00:00:00.000Z',
  });
  assert.equal(count, 2);

  // per-symbol docs exist and validate
  for (const d of docs) {
    const text = await readFile(join(root, docPath(d.identity.symbol)), 'utf8');
    assert.deepEqual(validateDoc(JSON.parse(text)), []);
    // manifest content hash matches the bytes on disk
    assert.equal(manifest.docs[d.identity.symbol], sha256(text));
  }

  const index = JSON.parse(await readFile(join(root, 'data/universe/index.json'), 'utf8'));
  assert.equal(index.count, 2);
  assert.deepEqual(index.symbols.map((s) => s.symbol), ['AAA', 'BBB']);

  const below = JSON.parse(await readFile(join(root, 'data/universe/below-floor.json'), 'utf8'));
  assert.deepEqual(below.symbols.map((s) => s.symbol), ['TINY']);
});

test('buildIndex carries the fields the app transport needs', () => {
  const index = buildIndex([sampleDoc('AAA', 'bank')], '2026-06-27T00:00:00.000Z');
  const row = index.symbols[0];
  assert.equal(row.symbol, 'AAA');
  assert.equal(row.sector_kind, 'bank');
  assert.equal(row.path, 'data/fundamentals/AAA-NSE.json');
  assert.equal(row.market_cap_cr, 1200);
});
