// Universe membership rules. Enforced at ingest so junk never reaches the CDN.
// The desktop app trusts the published universe; it does NOT re-filter.
//
// Filters (NSE-only, v1):
//   1. EQ series only            — exclude SME/debt/ETF/REIT/InvIT/pref shares
//   2. market cap >= Rs800 cr    — with hysteresis so borderline names don't flicker
//   3. >= MIN_QUARTERS filed      — need history to compute YoY / trends
//   4. active filer               — filed within the last STALE_QUARTERS quarters
// Surveillance (ASM/GSM) is a FLAG carried on the doc, never an exclusion.

export const MARKET_CAP_FLOOR_CR = 800;        // entry threshold (matches Rust MARKET_CAP_FLOOR_CR)
export const MARKET_CAP_EXIT_CR = 720;         // exit threshold = floor - 10% hysteresis band
export const MIN_QUARTERS = 4;                 // minimum quarterly results to be scoreable
export const STALE_QUARTERS = 2;               // no filing in this many quarters => dropped
export const ALLOWED_SERIES = new Set(['EQ']); // NSE equity series only

/**
 * Decide whether a candidate stays in the universe.
 *
 * @param {object} c candidate
 * @param {string} c.series         NSE series code, e.g. "EQ", "BE", "SM"
 * @param {number} c.marketCapCr    current market cap in Rs crore
 * @param {number} c.quartersFiled  count of distinct quarterly results available
 * @param {number} c.quartersSinceLastFiling  staleness in quarters (0 = most recent quarter present)
 * @param {boolean} c.wasInUniverse previous membership (for hysteresis)
 * @returns {{included: boolean, reason: string}}
 *   reason ∈ covered | below_threshold | wrong_series | insufficient_history | inactive_filer
 */
export function evaluateCandidate(c) {
  if (!ALLOWED_SERIES.has(c.series)) {
    return { included: false, reason: 'wrong_series' };
  }
  if ((c.quartersFiled ?? 0) < MIN_QUARTERS) {
    return { included: false, reason: 'insufficient_history' };
  }
  if ((c.quartersSinceLastFiling ?? Infinity) >= STALE_QUARTERS) {
    return { included: false, reason: 'inactive_filer' };
  }

  // Hysteresis: an existing member survives down to the exit band; a new entrant
  // must clear the full floor. Stops a stock straddling Rs800cr from flickering.
  const threshold = c.wasInUniverse ? MARKET_CAP_EXIT_CR : MARKET_CAP_FLOOR_CR;
  if ((c.marketCapCr ?? 0) < threshold) {
    return { included: false, reason: 'below_threshold' };
  }

  return { included: true, reason: 'covered' };
}

/**
 * Partition candidates into the published universe vs the "known but below floor"
 * set. The below-floor set powers the app's "we support >Rs800cr" message — it
 * lets the frontend distinguish below_threshold from not_in_dataset.
 */
export function partitionUniverse(candidates) {
  const covered = [];
  const belowFloor = [];
  for (const c of candidates) {
    const v = evaluateCandidate(c);
    if (v.included) covered.push(c);
    else if (v.reason === 'below_threshold') belowFloor.push(c);
  }
  return { covered, belowFloor };
}
