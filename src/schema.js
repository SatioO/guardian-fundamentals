// Canonical FundamentalsDoc contract — the JS mirror of the Rust struct in
// src-tauri/src/fundamentals/mod.rs (FundamentalsDoc). The cron produces these;
// the desktop app's JS transport hands the raw JSON to Rust, which decodes →
// caches → scores. Keys are snake_case to match serde's field names. The
// SectorLineItems union is serialized as {kind, data} to match
// #[serde(tag = "kind", content = "data", rename_all = "snake_case")].
//
// Market cap / P-E are intentionally NOT in the document — they are computed
// live, client-side, from a single quote on chart visit.

export const SCHEMA_VERSION = 1;

export const SECTOR_KINDS = ['general', 'bank', 'nbfc', 'insurance'];
export const STATEMENT_BASES = ['standalone', 'consolidated'];
export const MARGIN_KINDS = ['opm', 'nim', 'spread', 'uw_margin', 'unavailable'];

/** Build one normalized quarterly/annual period. */
export function period({
  period_end,
  period_label,
  fiscal_quarter,
  basis = 'consolidated',
  is_audited = false,
  is_restated = false,
  core = {},
  sector,
}) {
  return {
    period_end,
    period_label,
    fiscal_quarter,
    basis,
    is_audited,
    is_restated,
    core: normalizedCore(core),
    sector: sector ?? sectorLines('general', {}),
  };
}

export function normalizedCore(c = {}) {
  return {
    revenue_equiv: c.revenue_equiv ?? null,
    operating_profit_equiv: c.operating_profit_equiv ?? null,
    margin_equiv_pct: c.margin_equiv_pct ?? null,
    margin_kind: c.margin_kind ?? 'unavailable',
    other_income: c.other_income ?? null,
    interest: c.interest ?? null,
    depreciation: c.depreciation ?? null,
    pbt: c.pbt ?? null,
    tax: c.tax ?? null,
    net_profit: c.net_profit ?? null,
    eps: c.eps ?? null,
  };
}

/** SectorLineItems tagged union: {kind, data}. */
export function sectorLines(kind, data = {}) {
  if (!SECTOR_KINDS.includes(kind)) throw new Error(`unknown sector kind: ${kind}`);
  return { kind, data };
}

export function fundamentalsDoc({
  symbol,
  name,
  isin = '',
  sector_kind = 'general',
  sector = null,
  industry = null,
  shares_outstanding = null,
  face_value = null,
  quarterly = [],
  annual = [],
  next_results_date = null,
  market_cap_floor_ok = true,
  last_known_market_cap_cr = null,
  valuation = {},
  provenance = {},
}) {
  if (!SECTOR_KINDS.includes(sector_kind)) throw new Error(`unknown sector kind: ${sector_kind}`);
  return {
    doc_id: `${symbol}-NSE`,
    schema_version: SCHEMA_VERSION,
    identity: {
      symbol,
      exchange: 'NSE',
      isin,
      name,
      sector,
      industry,
      sector_kind,
      sector_classification: {
        kind: sector_kind,
        method: 'taxonomy',
        confidence: 1.0,
      },
      shares_outstanding,
      face_value,
    },
    valuation: {
      ttm_eps: valuation.ttm_eps ?? null,
      ttm_eps_basic: valuation.ttm_eps_basic ?? null,
      ttm_eps_is_annual_derived: valuation.ttm_eps_is_annual_derived ?? false,
      ttm_eps_basis: valuation.ttm_eps_basis ?? null,
      book_value_per_share: valuation.book_value_per_share ?? null,
    },
    results: { quarterly, annual },
    next_results_date,
    market_cap_floor_ok,
    last_known_market_cap_cr,
    provenance: {
      as_of: provenance.as_of ?? '',
      schema_version: SCHEMA_VERSION,
      sources: provenance.sources ?? [],
      ingest_run_id: provenance.ingest_run_id ?? '',
      taxonomy: provenance.taxonomy ?? 'in-gaap-ind-as',
      fields_resolved_pct: provenance.fields_resolved_pct ?? 0,
    },
  };
}

/**
 * Structural validator — asserts a doc satisfies the Rust contract well enough
 * that decode_doc() will accept it and the scorers can read it. Returns an array
 * of error strings (empty = valid). This is a guardrail against schema drift,
 * NOT a full JSON-schema check.
 */
export function validateDoc(doc) {
  const errs = [];
  const req = (cond, msg) => { if (!cond) errs.push(msg); };

  req(doc && typeof doc === 'object', 'doc must be an object');
  if (!doc) return errs;

  req(typeof doc.doc_id === 'string' && doc.doc_id.length > 0, 'doc_id missing');
  req(doc.schema_version === SCHEMA_VERSION, `schema_version must be ${SCHEMA_VERSION}`);

  const id = doc.identity ?? {};
  req(typeof id.symbol === 'string' && id.symbol.length > 0, 'identity.symbol missing');
  req(id.exchange === 'NSE', 'identity.exchange must be NSE');
  req(SECTOR_KINDS.includes(id.sector_kind), `identity.sector_kind invalid: ${id.sector_kind}`);

  const r = doc.results ?? {};
  req(Array.isArray(r.quarterly), 'results.quarterly must be an array');
  req(Array.isArray(r.annual), 'results.annual must be an array');

  for (const [label, list] of [['quarterly', r.quarterly], ['annual', r.annual]]) {
    (list ?? []).forEach((p, i) => {
      req(typeof p.period_end === 'string' && p.period_end.length > 0,
        `${label}[${i}].period_end missing`);
      req(typeof p.fiscal_quarter === 'string' && p.fiscal_quarter.length > 0,
        `${label}[${i}].fiscal_quarter missing`);
      req(STATEMENT_BASES.includes(p.basis), `${label}[${i}].basis invalid: ${p.basis}`);
      req(p.core && typeof p.core === 'object', `${label}[${i}].core missing`);
      req(p.sector && SECTOR_KINDS.includes(p.sector.kind) && p.sector.data && typeof p.sector.data === 'object',
        `${label}[${i}].sector must be a {kind,data} union`);
    });
  }

  req(typeof doc.market_cap_floor_ok === 'boolean', 'market_cap_floor_ok must be boolean');
  return errs;
}
