// Daily/quarterly ingest orchestrator.
//
// Target pipeline (filled in by the ingest subsystem plan):
//   1. nse.listEquities()                       -> candidate master
//   2. universe.evaluateCandidate(...)          -> apply EQ/cap/history/active filters
//   3. for each covered symbol: nse.listFinancialResults -> fetchXbrl
//      -> xbrl.parseInstance/selectFacts -> normalize.normalizePeriod
//      -> schema.fundamentalsDoc
//   4. artifact.writeArtifact(...)              -> data/ tree + manifest
//
// Until the live pipeline lands, ingest is a no-op guard so the cron stays green:
// it asserts the committed sample artifact still validates, and exits. This keeps
// `npm run ingest` safe to schedule from day one.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { validateDoc } from '../src/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUND_DIR = join(ROOT, 'data', 'fundamentals');

async function main() {
  // TODO(ingest-plan): replace this guard with the live NSE/XBRL pipeline above.
  let files = [];
  try {
    files = (await readdir(FUND_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    console.log('ingest: no data/fundamentals yet — nothing to do');
    return;
  }

  let errors = 0;
  for (const f of files) {
    const doc = JSON.parse(await readFile(join(FUND_DIR, f), 'utf8'));
    const errs = validateDoc(doc);
    if (errs.length) {
      errors += errs.length;
      console.error(`ingest: ${f} invalid:\n  - ${errs.join('\n  - ')}`);
    }
  }

  if (errors) {
    console.error(`ingest: ${errors} schema error(s) — failing so the cron does not publish bad data`);
    process.exit(1);
  }
  console.log(`ingest: validated ${files.length} doc(s); live pipeline not yet enabled (no-op)`);
}

await main();
