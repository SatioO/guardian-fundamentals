import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nseDateParam, listBoardMeetings } from '../src/nse.js';

test('nseDateParam formats ISO / Date as DD-MM-YYYY', () => {
  assert.equal(nseDateParam('2026-06-28'), '28-06-2026');
  assert.equal(nseDateParam('2026-12-01'), '01-12-2026');
  assert.equal(nseDateParam(new Date('2026-01-05T00:00:00Z')), '05-01-2026');
});

test('listBoardMeetings primes cookies then calls the API with the window', async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.includes('/api/corporate-board-meetings')) {
      return {
        ok: true,
        headers: { getSetCookie: () => [], get: () => null },
        json: async () => [{ bm_symbol: 'AAA', bm_purpose: 'Financial Results', bm_date: '10-Aug-2026' }],
      };
    }
    // prime request
    return {
      ok: true,
      headers: { getSetCookie: () => ['nsit=abc; Path=/', 'bm_sb=xyz; Path=/'], get: () => null },
      json: async () => ({}),
    };
  };

  const rows = await listBoardMeetings({ fromDate: '2026-06-28', toDate: '2026-09-10', fetchImpl: fakeFetch });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].bm_symbol, 'AAA');
  // primed first, API second
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /from_date=28-06-2026&to_date=10-09-2026/);
  // primed cookies forwarded on the API call
  assert.equal(calls[1].opts.headers.Cookie, 'nsit=abc; bm_sb=xyz');
});

test('listBoardMeetings throws on non-OK response', async () => {
  const fakeFetch = async (url) => url.includes('/api/')
    ? { ok: false, status: 403, headers: { getSetCookie: () => [] } }
    : { ok: true, headers: { getSetCookie: () => [] }, json: async () => ({}) };
  await assert.rejects(
    listBoardMeetings({ fromDate: '2026-06-28', toDate: '2026-09-10', fetchImpl: fakeFetch }),
    /HTTP 403/,
  );
});
