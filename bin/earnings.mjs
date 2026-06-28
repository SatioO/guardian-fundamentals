// Earnings-calendar refresh — standalone, cron-schedulable.
//
// Populates each published doc's `next_results_date` from NSE's market-wide
// board-meetings feed, then rebuilds the universe index + manifest. Decoupled
// from the (not-yet-built) XBRL ingest: it patches whatever docs already exist
// under data/fundamentals/, so it's safe to schedule today and keeps working as
// the universe grows.
//
//   npm run earnings            -- refresh from the live NSE feed
//   node bin/earnings.mjs --dry-run        -- compute + report, write nothing
//   node bin/earnings.mjs --window-days 90 -- widen the forward window
//
// One market-wide fetch covers the whole market (the feed isn't paginated).
// Writes are change-gated: a run that finds no new dates writes nothing, so the
// git tree stays clean on quiet days.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { listBoardMeetings } from '../src/nse.js';
import { distillCalendar } from '../src/earnings.js';
import { buildIndex, buildManifest, serializeDoc, docPath } from '../src/artifact.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUND_DIR = join(ROOT, 'data', 'fundamentals');
const UNIVERSE_DIR = join(ROOT, 'data', 'universe');

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

/** Decide the date a doc should carry, given the freshly distilled feed. */
export function resolveNextDate(existing, distilled, todayISO) {
  if (distilled) return distilled;                 // feed is authoritative when present
  if (existing && existing >= todayISO) return existing; // keep a still-future date the feed lacked
  return null;                                      // drop stale past dates
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const windowDays = Number(arg('--window-days', 75)) || 75;

  const today = new Date();
  const todayISO = isoDay(today);
  const to = new Date(today.getTime() + windowDays * 86_400_000);

  // 1. Fetch the market-wide feed FIRST — if this fails we abort before touching disk.
  console.log(`earnings: fetching board meetings ${todayISO} … ${isoDay(to)} (${windowDays}d)`);
  const entries = await listBoardMeetings({ fromDate: today, toDate: to });
  const calendar = distillCalendar(entries, todayISO);
  console.log(`earnings: ${entries.length} feed rows → ${calendar.size} symbols with upcoming results`);

  // 2. Load existing docs and patch next_results_date.
  let files = [];
  try {
    files = (await readdir(FUND_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    console.log('earnings: no data/fundamentals yet — nothing to patch');
    return;
  }

  const docs = [];
  const changed = [];
  for (const f of files) {
    const doc = JSON.parse(await readFile(join(FUND_DIR, f), 'utf8'));
    const sym = doc.identity?.symbol?.toUpperCase();
    const next = resolveNextDate(doc.next_results_date ?? null, calendar.get(sym) ?? null, todayISO);
    if (next !== (doc.next_results_date ?? null)) {
      changed.push(`${sym}: ${doc.next_results_date ?? '∅'} → ${next ?? '∅'}`);
      doc.next_results_date = next;
    }
    docs.push(doc);
  }

  if (changed.length === 0) {
    console.log('earnings: no date changes — leaving artifact untouched');
    return;
  }
  console.log(`earnings: ${changed.length} change(s):\n  ${changed.join('\n  ')}`);

  if (dryRun) {
    console.log('earnings: --dry-run, writing nothing');
    return;
  }

  // 3. Rewrite changed docs + rebuild index/manifest with a fresh stamp.
  const generatedAt = new Date().toISOString();
  docs.sort((a, b) => a.identity.symbol.localeCompare(b.identity.symbol)); // stable order
  const docTexts = {};
  for (const d of docs) {
    const text = serializeDoc(d);
    docTexts[d.identity.symbol] = text;
    await writeFile(join(ROOT, docPath(d.identity.symbol)), text);
  }

  const indexText = JSON.stringify(buildIndex(docs, generatedAt), null, 2) + '\n';
  await writeFile(join(UNIVERSE_DIR, 'index.json'), indexText);

  // Preserve the existing below-floor list verbatim; we only need its bytes for the manifest hash.
  const belowFloorText = await readFile(join(UNIVERSE_DIR, 'below-floor.json'), 'utf8');
  const manifest = buildManifest({ generatedAt, indexText, belowFloorText, docTexts });
  await writeFile(join(ROOT, 'data', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`earnings: wrote ${docs.length} doc(s) + index + manifest`);
}

// Run only when invoked directly (`node bin/earnings.mjs`), so importing
// resolveNextDate for tests doesn't trigger a network fetch.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
