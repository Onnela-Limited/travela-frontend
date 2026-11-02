import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dashboardDataMb, selectDashboardSim } from '../src/lib/bundle-summary.ts';
import { clearBalancePoll, getBalancePollContext, initBalancePollFromUrl, startBalancePoll } from '../src/lib/balance-poll.ts';

test('the combined carrier balance is displayed once, without adding purchased data again', () => {
  assert.equal(dashboardDataMb(false, 54 * 1024, 24 * 1024), 54 * 1024);
  assert.equal(dashboardDataMb(false, 40 * 1024, 10 * 1024), 40 * 1024);
  assert.equal(dashboardDataMb(false, null, 54 * 1024), 54 * 1024);
  assert.equal(dashboardDataMb(false, 0, 24 * 1024), 0);
  assert.equal(dashboardDataMb(true, null, 24 * 1024), null);
});

test('an emailed number selects that SIM rather than the latest SIM on the account', () => {
  const sims = [{ id: 2, esim: { msisdn: '255700000002' } }, { id: 1, esim: { msisdn: '+255700000001' } }];
  assert.equal(selectDashboardSim(sims, '255700000001')?.id, 1);
  assert.equal(selectDashboardSim(sims)?.id, 2);
  assert.equal(selectDashboardSim(sims, '255799999999'), null);
  assert.equal(selectDashboardSim([]), null);
});

test('an email return replaces stale polling state and requests a fresh combined balance', () => {
  const storage = () => {
    const entries = new Map();
    return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
  };
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  globalThis.window = { location: { search: '?await_balance=1&msisdn=%2B255700000001&recharge=RECHARGE123' } };
  localStorage.setItem('travela_await_balance_since', '2020-01-01T00:00:00Z');
  localStorage.setItem('travela_await_balance_msisdn', '255799999999');
  initBalancePollFromUrl();
  const context = getBalancePollContext();
  assert.equal(context.msisdn, '+255700000001');
  assert.ok(Date.now() - Date.parse(context.since) < 5000);
  clearBalancePoll();
  assert.equal(getBalancePollContext(), null);
  // Login clears browser purchase state; the preserved email URL recreates it.
  initBalancePollFromUrl();
  assert.equal(getBalancePollContext().msisdn, '+255700000001');
  clearBalancePoll();
});

test('an ordinary dashboard visit does not invent a top-up or replace its existing poll', () => {
  globalThis.window.location.search = '';
  startBalancePoll({ msisdn: '255700000002' });
  const before = getBalancePollContext();
  initBalancePollFromUrl();
  assert.deepEqual(getBalancePollContext(), before);
  clearBalancePoll();
});
