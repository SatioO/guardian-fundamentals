// XBRL instance parser — STUB. Fleshed out by the ingest subsystem plan.
//
// Two-layer parse:
//   1. parseInstance(xml) -> { facts, contexts, units }
//      facts: [{ concept, contextRef, unitRef, value, decimals }]
//      contexts: { [id]: { periodStart, periodEnd, instant, dimensions } }
//   2. selectFacts(parsed, taxonomyMap) -> tagged values keyed by canonical concept,
//      resolving the correct (latest, non-cumulative) context per line item.
//
// Uses fast-xml-parser. SEBI's results taxonomy tags the standalone vs
// consolidated and quarterly vs YTD contexts via dimensions — selecting the
// right context is the hard part and is the ingest plan's core work.

import { XMLParser } from 'fast-xml-parser';

const NOT_IMPLEMENTED = 'xbrl.js: not implemented — see the ingest subsystem plan';

export function makeParser() {
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
}

export function parseInstance(_xml) {
  throw new Error(NOT_IMPLEMENTED);
}

export function selectFacts(_parsed, _taxonomyMap) {
  throw new Error(NOT_IMPLEMENTED);
}
