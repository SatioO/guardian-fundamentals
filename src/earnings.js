// Earnings-calendar distillation — pure logic over the NSE board-meetings feed.
//
// The NSE "corporate-board-meetings" feed lists scheduled board meetings; a
// subset are results meetings ("Financial Results" / "Financial Results/Dividend"
// / ...). Companies file an *intimation* and a *results* entry for the same
// meeting, so the same (symbol, date) appears more than once — we dedupe.
//
// `next_results_date` for a symbol = the nearest results meeting whose date is
// today or later. Past meetings are ignored (they're already published; the doc
// itself carries the realised quarter). When a company has no upcoming results
// meeting posted, it gets no date (null) and the caller falls back elsewhere.
//
// Pure + clock-injected (`todayISO` passed in) so output is deterministic and
// the committed artifact bytes are stable.

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Parse an NSE board-meeting date ("24-Apr-2026") to ISO ("2026-04-24").
 * Returns null on any malformed input — never throws.
 * @param {string} s
 * @returns {string | null}
 */
export function parseBmDate(s) {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return null;
  const year = m[3];
  // Reject impossible days (e.g. 32) by round-tripping through Date.
  const iso = `${year}-${mon}-${day}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[1])) return null;
  return iso;
}

/**
 * Is this board-meeting entry a financial-results meeting?
 * NSE tags results inconsistently: sometimes in `bm_purpose`
 * ("Financial Results/Dividend"), sometimes only in the free-text `bm_desc`
 * ("...consider and approve the Unaudited Financial results..."). Match either,
 * case-insensitively.
 * @param {{bm_purpose?: string, bm_desc?: string}} entry
 * @returns {boolean}
 */
export function isResultsMeeting(entry) {
  if (!entry) return false;
  const hay = `${entry.bm_purpose ?? ''} ${entry.bm_desc ?? ''}`.toLowerCase();
  return hay.includes('financial results') || hay.includes('financial result');
}

/**
 * Nearest upcoming results-meeting date (ISO) for a set of entries that belong
 * to ONE symbol. Returns null when none are today-or-later.
 * @param {Array<object>} entries
 * @param {string} todayISO  "YYYY-MM-DD"
 * @returns {string | null}
 */
export function nextResultsDate(entries, todayISO) {
  let best = null;
  for (const e of entries) {
    if (!isResultsMeeting(e)) continue;
    const iso = parseBmDate(e.bm_date);
    if (!iso || iso < todayISO) continue;
    if (best === null || iso < best) best = iso;
  }
  return best;
}

/**
 * Distill a market-wide board-meetings feed into `symbol -> next_results_date`.
 * Only symbols with an upcoming results meeting appear in the map.
 * @param {Array<{bm_symbol?: string, bm_purpose?: string, bm_desc?: string, bm_date?: string}>} entries
 * @param {string} todayISO  "YYYY-MM-DD"
 * @returns {Map<string, string>}  upper-cased symbol -> ISO date
 */
export function distillCalendar(entries, todayISO) {
  const bySymbol = new Map();
  for (const e of entries) {
    const sym = (e.bm_symbol ?? '').toUpperCase();
    if (!sym) continue;
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym).push(e);
  }
  const out = new Map();
  for (const [sym, group] of bySymbol) {
    const d = nextResultsDate(group, todayISO);
    if (d) out.set(sym, d);
  }
  return out;
}
