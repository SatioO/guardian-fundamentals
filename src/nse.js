// NSE access layer — STUB. Fleshed out by the ingest subsystem plan.
//
// Responsibilities (when implemented):
//   - listEquities():        the NSE equity master (symbol, series, ISIN, name,
//                            industry) to seed the candidate universe.
//   - listFinancialResults(): the corporate "Financial Results" filing feed
//                            (per-symbol or bulk), yielding XBRL attachment URLs.
//   - fetchXbrl(url):        download a single XBRL instance document.
//
// NSE endpoints require a browser-like session (cookie priming + headers). That
// fiddly handshake lives here so the rest of the pipeline stays pure.

const NOT_IMPLEMENTED = 'nse.js: not implemented — see the ingest subsystem plan';

const UA = 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/118.0';
const HOME = 'https://www.nseindia.com/companies-listing/corporate-filings-board-meetings';
const BOARD_MEETINGS = 'https://www.nseindia.com/api/corporate-board-meetings';

/** Format a Date (or "YYYY-MM-DD") as NSE's "DD-MM-YYYY" query param. */
export function nseDateParam(d) {
  const dt = typeof d === 'string' ? new Date(`${d}T00:00:00Z`) : d;
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = dt.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Fetch the market-wide corporate board-meetings feed for a date window.
 * One cookie-primed request covers the whole market — the feed is not paginated
 * (a 2-month window returns ~5k rows in a single response), so the caller picks a
 * forward window wide enough to capture every company's next announced meeting
 * (~75 days is comfortably beyond the quarterly cadence + announcement lead time).
 *
 * @param {object}   opts
 * @param {string|Date} opts.fromDate  inclusive window start ("YYYY-MM-DD" or Date)
 * @param {string|Date} opts.toDate    inclusive window end
 * @param {typeof fetch} [opts.fetchImpl=fetch]  injectable for testing
 * @returns {Promise<Array<object>>} raw board-meeting entries (bm_symbol, bm_date, bm_purpose, bm_desc, ...)
 */
export async function listBoardMeetings({ fromDate, toDate, fetchImpl = fetch }) {
  // 1. Cookie-prime: a plain GET on the listing page sets the anti-bot cookies.
  const jar = [];
  const prime = await fetchImpl(HOME, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  collectCookies(prime, jar);

  // 2. Hit the JSON API with the primed cookies + a Referer the WAF expects.
  const url = `${BOARD_MEETINGS}?index=equities&from_date=${nseDateParam(fromDate)}&to_date=${nseDateParam(toDate)}`;
  const res = await fetchImpl(url, {
    headers: {
      'User-Agent': UA,
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      Referer: HOME,
      Cookie: jar.join('; '),
    },
  });
  if (!res.ok) throw new Error(`board-meetings HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('board-meetings: expected a JSON array');
  return data;
}

/** Pull Set-Cookie name=value pairs from a fetch Response into `jar`. */
function collectCookies(res, jar) {
  // Node's fetch exposes multiple Set-Cookie via getSetCookie(); fall back to get().
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  for (const line of raw) {
    const pair = line.split(';')[0];
    if (pair) jar.push(pair);
  }
}

export async function listEquities() {
  throw new Error(NOT_IMPLEMENTED);
}

export async function listFinancialResults(_symbol) {
  throw new Error(NOT_IMPLEMENTED);
}

export async function fetchXbrl(_url) {
  throw new Error(NOT_IMPLEMENTED);
}
