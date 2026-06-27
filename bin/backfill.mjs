// One-time historical backfill orchestrator — STUB.
//
// Walks the full NSE EQ universe, pulls the last ~8-12 quarters of XBRL results
// per covered symbol, normalizes, and writes the initial data/ tree. After this
// runs once, bin/ingest.mjs maintains it incrementally.
//
// Until the live pipeline lands, use `npm run build:samples` to produce the
// sample artifact. This stub fails loudly so it is never mistaken for done.

console.error('backfill.mjs: not implemented — see the ingest subsystem plan.');
console.error('For now, run `npm run build:samples` to generate the sample artifact.');
process.exit(1);
