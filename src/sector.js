// Sector classification: map a filing to a SectorKind (general | bank | nbfc |
// insurance) which selects the scoring model downstream. Strategy, in order:
//   1. taxonomy   — the XBRL taxonomy/entity-type the filer used (most reliable)
//   2. fingerprint — presence of sector-defining line items (e.g. "interest earned"
//                    on the face of the P&L => bank/nbfc)
//   3. text        — NIC/industry text keywords (least reliable, last resort)
// Only (3) is implemented here; (1)/(2) arrive with the real XBRL parser.

const BANK_KEYWORDS = ['bank'];
const NBFC_KEYWORDS = ['finance', 'financial services', 'housing finance', 'nbfc', 'capital', 'fincorp'];
const INSURANCE_KEYWORDS = ['insurance', 'assurance', 'life insurance', 'general insurance'];

/**
 * Classify by industry/name text. Returns { kind, method, confidence }.
 * Banks match before NBFCs (a "bank" containing "finance" is still a bank).
 */
export function classifyByText(text) {
  const t = (text ?? '').toLowerCase();
  const hit = (kws) => kws.some((k) => t.includes(k));

  if (hit(INSURANCE_KEYWORDS)) return mk('insurance', 0.6);
  if (hit(BANK_KEYWORDS)) return mk('bank', 0.7);
  if (hit(NBFC_KEYWORDS)) return mk('nbfc', 0.6);
  return mk('general', 0.5);
}

function mk(kind, confidence) {
  return { kind, method: 'text', confidence };
}

/**
 * Top-level classifier. Prefers taxonomy/fingerprint signals when the parser
 * supplies them, else falls back to text. `signals` is reserved for the real
 * XBRL parser (taxonomy id, face-of-P&L line items).
 */
export function classifySector({ industry, name, signals } = {}) {
  // TODO(ingest-plan): consume `signals.taxonomy` and `signals.lineItems` for
  // taxonomy/fingerprint classification before falling back to text.
  void signals;
  return classifyByText(industry || name || '');
}
