# guardian-fundamentals

Derived NSE fundamental-results history (quarterly/annual), refreshed by GitHub
Actions and served as a small CDN artifact for the TraderView **Fundamental
Insights** indicator.

Built from **primary NSE statutory XBRL filings** only. The repo publishes
*derived, normalized* outputs (not verbatim filing tables) for the supported
universe.

## Universe (NSE only, v1)

A symbol is published only if it clears every filter — enforced at ingest, so
the desktop app trusts the artifact and never re-filters:

| Filter | Rule |
|---|---|
| Exchange | **NSE** equity, **`EQ` series only** (no SME/debt/ETF/REIT/InvIT/pref) |
| Market cap | **≥ ₹800 cr**, with a hysteresis band (exit only below ₹720 cr) |
| History | **≥ 4 quarters** of results filed (needed for YoY / trends) |
| Active filer | filed within the last **2 quarters** (drops suspended/dormant) |
| Surveillance | ASM/GSM is a **flag**, never an exclusion |

Sub-₹800cr names the cron *knows* but excludes are listed in
`data/universe/below-floor.json` so the app can show the right message
("We currently support companies with market cap above ₹800 crore") instead of a
generic "not found".

> Market cap / P-E are **not** in the data. They are computed live, client-side,
> from a single quote when the user opens a chart.

## Artifact

```
data/
├── manifest.json              # fetched FRESH (raw); content hashes for cache-busting
├── universe/index.json        # covered symbols + metadata
├── universe/below-floor.json  # known sub-₹800cr symbols (for the UX message)
└── fundamentals/<SYMBOL>-NSE.json
```

- **Manifest (always fresh):**
  `https://raw.githubusercontent.com/SatioO/guardian-fundamentals/main/data/manifest.json`
- **Per-symbol docs (CDN):**
  `https://cdn.jsdelivr.net/gh/SatioO/guardian-fundamentals@main/data/fundamentals/<SYMBOL>-NSE.json`
  - Quarterly cadence → `@main` is fine for v1. Pin by commit (`@<sha>`) for
    immutable caching as a later optimization.

## Document schema

One JSON per symbol, matching the Rust `FundamentalsDoc` contract in the app
(`src-tauri/src/fundamentals/mod.rs`). Keys are `snake_case`; the per-period
`sector` field is a tagged union `{ "kind": "...", "data": { ... } }` over
`general | bank | nbfc | insurance`. See [`src/schema.js`](src/schema.js) for the
canonical JS mirror + validator.

## Status

- ✅ Schema, universe filters, artifact writers, sample data, CI — **done**
- 🚧 Live NSE/XBRL pipeline (`src/nse.js`, `src/xbrl.js`, `src/normalize.js`) —
  **stubbed**; fleshed out by the ingest subsystem plan. `npm run ingest`
  currently validates the committed artifact and no-ops (cron-safe).

The committed `data/` is **sample data** (RELIANCE = general, HDFCBANK = bank) —
plausible magnitudes, not real filings — so the app frontend has a live URL to
develop against today.

## Run locally

```bash
npm ci
npm test                # node --test
npm run build:samples   # regenerate the sample artifact (deterministic)
npm run ingest          # validate artifact (live pipeline pending)
```
