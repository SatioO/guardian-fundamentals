// Generates the sample artifact (RELIANCE = general, HDFCBANK = bank) so the
// desktop frontend has a real CDN URL to develop against before the live XBRL
// ingest exists. Run: npm run build:samples
//
// The data is illustrative (hand-set, plausible magnitudes), NOT real filings.
// It exists to exercise the schema + scoring end-to-end, and is regenerated
// deterministically (no clock) so committed bytes are stable.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fundamentalsDoc, period, sectorLines } from '../src/schema.js';
import { partitionUniverse } from '../src/universe.js';
import { writeArtifact } from '../src/artifact.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED_AT = '2026-06-27T00:00:00.000Z'; // fixed for deterministic output

// Eight fiscal quarters, newest-first (FY ends March). Year-ago = index+4.
const Q = [
  { period_end: '2025-03-31', period_label: 'Q4 FY25', fiscal_quarter: 'Q4' },
  { period_end: '2024-12-31', period_label: 'Q3 FY25', fiscal_quarter: 'Q3' },
  { period_end: '2024-09-30', period_label: 'Q2 FY25', fiscal_quarter: 'Q2' },
  { period_end: '2024-06-30', period_label: 'Q1 FY25', fiscal_quarter: 'Q1' },
  { period_end: '2024-03-31', period_label: 'Q4 FY24', fiscal_quarter: 'Q4' },
  { period_end: '2023-12-31', period_label: 'Q3 FY24', fiscal_quarter: 'Q3' },
  { period_end: '2023-09-30', period_label: 'Q2 FY24', fiscal_quarter: 'Q2' },
  { period_end: '2023-06-30', period_label: 'Q1 FY24', fiscal_quarter: 'Q1' },
];

// ---- RELIANCE (general / energy conglomerate) ----------------------------
// Revenue/profit grow ~8-10% YoY with steady margins -> a healthy general score.
const relianceQuarters = Q.map((q, i) => {
  const ix = Q.length - 1 - i;            // 0 = oldest, ascending with time
  const revenue = 230000 + ix * 6000;     // Rs crore
  const opProfit = Math.round(revenue * 0.17);
  const netProfit = Math.round(revenue * 0.073);
  const eps = +(netProfit / 6766).toFixed(2); // ~676.6 cr shares
  return period({
    ...q,
    basis: 'consolidated',
    is_audited: q.fiscal_quarter === 'Q4',
    core: {
      revenue_equiv: revenue,
      operating_profit_equiv: opProfit,
      margin_equiv_pct: +((opProfit / revenue) * 100).toFixed(2),
      margin_kind: 'opm',
      net_profit: netProfit,
      eps,
    },
    sector: sectorLines('general', {
      revenue_from_operations: revenue,
      total_expenses: revenue - opProfit,
      operating_profit: opProfit,
      opm_pct: +((opProfit / revenue) * 100).toFixed(2),
    }),
  });
});

const reliance = fundamentalsDoc({
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd',
  isin: 'INE002A01018',
  sector_kind: 'general',
  sector: 'Energy',
  industry: 'Refineries & Marketing',
  shares_outstanding: 6766000000,
  face_value: 10,
  quarterly: relianceQuarters,
  next_results_date: '2026-07-18',
  market_cap_floor_ok: true,
  last_known_market_cap_cr: 1925000,
  valuation: { ttm_eps: 105.4, ttm_eps_basis: 'consolidated', book_value_per_share: 1240 },
  provenance: { as_of: '2025-03-31', fields_resolved_pct: 0.0, ingest_run_id: 'sample' },
});

// ---- HDFCBANK (bank) -----------------------------------------------------
// NII grows, NIM steady ~3.5%, gross NPA easing -> a healthy bank score.
const hdfcQuarters = Q.map((q, i) => {
  const ix = Q.length - 1 - i;
  const interestEarned = 70000 + ix * 2500;
  const interestExpended = Math.round(interestEarned * 0.58);
  const nii = interestEarned - interestExpended;
  const netProfit = Math.round(nii * 0.42);
  return period({
    ...q,
    basis: 'consolidated',
    is_audited: q.fiscal_quarter === 'Q4',
    core: {
      revenue_equiv: interestEarned,
      operating_profit_equiv: nii,
      margin_equiv_pct: 3.5,
      margin_kind: 'nim',
      net_profit: netProfit,
      eps: +(netProfit / 760).toFixed(2),
    },
    sector: sectorLines('bank', {
      total_income: interestEarned + Math.round(interestEarned * 0.12),
      interest_earned: interestEarned,
      interest_expended: interestExpended,
      net_interest_income: nii,
      nim_pct: 3.5,
      gross_npa_pct: +(1.4 - ix * 0.03).toFixed(2),  // easing over time
      net_npa_pct: +(0.45 - ix * 0.01).toFixed(2),
      provisions_and_contingencies: Math.round(nii * 0.10),
    }),
  });
});

const hdfcbank = fundamentalsDoc({
  symbol: 'HDFCBANK',
  name: 'HDFC Bank Ltd',
  isin: 'INE040A01034',
  sector_kind: 'bank',
  sector: 'Financial Services',
  industry: 'Private Sector Bank',
  shares_outstanding: 7600000000,
  face_value: 1,
  quarterly: hdfcQuarters,
  next_results_date: '2026-07-19',
  market_cap_floor_ok: true,
  last_known_market_cap_cr: 1480000,
  valuation: { ttm_eps: 89.2, ttm_eps_basis: 'consolidated', book_value_per_share: 620 },
  provenance: { as_of: '2025-03-31', fields_resolved_pct: 0.0, ingest_run_id: 'sample' },
});

// ---- below-floor example (drives the "we support >Rs800cr" UX message) ----
const candidates = [
  { symbol: 'RELIANCE', series: 'EQ', marketCapCr: 1925000, quartersFiled: 8, quartersSinceLastFiling: 0, wasInUniverse: true },
  { symbol: 'HDFCBANK', series: 'EQ', marketCapCr: 1480000, quartersFiled: 8, quartersSinceLastFiling: 0, wasInUniverse: true },
  { symbol: 'TINYCAPLTD', series: 'EQ', marketCapCr: 410, quartersFiled: 8, quartersSinceLastFiling: 0, wasInUniverse: false },
];
const { belowFloor } = partitionUniverse(candidates);

const { count } = await writeArtifact(ROOT, {
  docs: [reliance, hdfcbank],
  belowFloor,
  generatedAt: GENERATED_AT,
});

console.log(`build:samples wrote ${count} docs + universe index + ${belowFloor.length} below-floor + manifest`);
