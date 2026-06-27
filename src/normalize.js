// Normalization — STUB. Fleshed out by the ingest subsystem plan.
//
// Turns selected XBRL facts (per filing) into a ResultPeriod: fills NormalizedCore
// (the universal surface the scorers read) AND the sector-specific SectorLineItems
// union. Sector-aware: a bank maps "interest earned"/"interest expended" into
// BankLines + net_interest_income; a general company maps revenue/expenses into
// GeneralLines. The NormalizedCore margin_kind records WHICH margin was tagged
// (opm/nim/...) so the scorers never derive NIM from OPM (R12).
//
// Assembling many ResultPeriods (newest-first) + identity + valuation into a
// FundamentalsDoc is done with the builders in schema.js.

const NOT_IMPLEMENTED = 'normalize.js: not implemented — see the ingest subsystem plan';

/** selectedFacts + sectorKind -> a ResultPeriod (see schema.js `period`). */
export function normalizePeriod(_selectedFacts, _sectorKind) {
  throw new Error(NOT_IMPLEMENTED);
}

/** Derive TTM EPS / book value from the assembled periods. */
export function deriveValuation(_periods) {
  throw new Error(NOT_IMPLEMENTED);
}
