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

export async function listEquities() {
  throw new Error(NOT_IMPLEMENTED);
}

export async function listFinancialResults(_symbol) {
  throw new Error(NOT_IMPLEMENTED);
}

export async function fetchXbrl(_url) {
  throw new Error(NOT_IMPLEMENTED);
}
