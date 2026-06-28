// Artifact writers: per-symbol docs + universe index + below-floor list + manifest.
// Delivery model mirrors guardian-circuit-bands:
//   - manifest.json  -> fetched FRESH via raw.githubusercontent (never cached)
//   - bulk files     -> immutable, served via jsDelivr; pin by commit for caching
//
// Layout under data/:
//   data/manifest.json
//   data/universe/index.json        (covered symbols + metadata)
//   data/universe/below-floor.json  (known sub-Rs800cr symbols, for the UX message)
//   data/fundamentals/<SYMBOL>-NSE.json

import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { SCHEMA_VERSION } from './schema.js';

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function docPath(symbol) {
  return `data/fundamentals/${symbol}-NSE.json`;
}

/** Stable-stringify a doc (sorted keys) so unchanged data yields identical bytes. */
export function serializeDoc(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}

export function buildIndex(docs, generatedAt) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    count: docs.length,
    symbols: docs.map((d) => ({
      symbol: d.identity.symbol,
      exchange: 'NSE',
      name: d.identity.name,
      sector_kind: d.identity.sector_kind,
      market_cap_cr: d.last_known_market_cap_cr,
      as_of: d.provenance.as_of,
      next_results_date: d.next_results_date,
      path: docPath(d.identity.symbol),
    })),
  };
}

/**
 * Whole-market earnings calendar: symbol -> next results date (ISO).
 * Decoupled from the per-symbol docs so the desktop app can overlay an earnings
 * date for ANY charted symbol (covered or not), independent of doc coverage.
 *
 * @param {Map<string,string>|Record<string,string>} dates
 * @param {string} generatedAt
 */
export function buildEarningsCalendar(dates, generatedAt) {
  const entries = dates instanceof Map ? [...dates.entries()] : Object.entries(dates);
  // Sorted keys → stable bytes when the data is unchanged.
  const sorted = Object.fromEntries(entries.sort((a, b) => a[0].localeCompare(b[0])));
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    count: Object.keys(sorted).length,
    dates: sorted,
  };
}

export function buildBelowFloor(belowFloor, generatedAt) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    count: belowFloor.length,
    symbols: belowFloor.map((c) => ({ symbol: c.symbol, exchange: 'NSE' })),
  };
}

export function buildManifest({ generatedAt, indexText, belowFloorText, docTexts }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    universe: {
      indexPath: 'data/universe/index.json',
      belowFloorPath: 'data/universe/below-floor.json',
      indexSha256: sha256(indexText),
      belowFloorSha256: sha256(belowFloorText),
    },
    // Per-symbol content hashes let the app skip refetches when bytes are unchanged.
    docs: Object.fromEntries(
      Object.entries(docTexts).map(([sym, text]) => [sym, sha256(text)]),
    ),
  };
}

/** Write the full data/ tree to disk under `root`. */
export async function writeArtifact(root, { docs, belowFloor, generatedAt }) {
  await mkdir(join(root, 'data', 'fundamentals'), { recursive: true });
  await mkdir(join(root, 'data', 'universe'), { recursive: true });

  const docTexts = {};
  for (const d of docs) {
    const text = serializeDoc(d);
    docTexts[d.identity.symbol] = text;
    await writeFile(join(root, docPath(d.identity.symbol)), text);
  }

  const indexText = JSON.stringify(buildIndex(docs, generatedAt), null, 2) + '\n';
  const belowFloorText = JSON.stringify(buildBelowFloor(belowFloor, generatedAt), null, 2) + '\n';
  await writeFile(join(root, 'data', 'universe', 'index.json'), indexText);
  await writeFile(join(root, 'data', 'universe', 'below-floor.json'), belowFloorText);

  const manifest = buildManifest({ generatedAt, indexText, belowFloorText, docTexts });
  await writeFile(join(root, 'data', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  return { manifest, count: docs.length };
}
