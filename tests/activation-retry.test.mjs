import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activationRetryFromSearch, clearPendingEsimInstall, hasPendingEsimInstall, writePendingEsimInstall } from '../src/lib/esim-activation.ts';
import { selectDashboardSim } from '../src/lib/bundle-summary.ts';

test('the retry email identifies the exact eSIM and number, not another SIM on the account', () => {
  const retry = activationRetryFromSearch('?retry_activation=1&user_esim_id=7&msisdn=%2B255700000001');
  assert.deepEqual(retry, { userEsimId: 7, msisdn: '+255700000001' });
  const sims = [{ id: 8, esim: { msisdn: '255700000002' } }, { id: 7, esim: { msisdn: '255700000001' } }];
  assert.equal(selectDashboardSim(sims, retry.msisdn, retry.userEsimId)?.id, 7);
  assert.equal(selectDashboardSim(sims, retry.msisdn, 8), null);
  assert.equal(selectDashboardSim(sims, retry.msisdn, 99), null);
});

test('ordinary, incomplete or malformed dashboard URLs cannot initiate the retry flow', () => {
  for (const search of ['', '?msisdn=255700000001', '?retry_activation=1',
    '?retry_activation=1&user_esim_id=-1&msisdn=255700000001',
    '?retry_activation=1&user_esim_id=1&msisdn=invalid']) {
    assert.equal(activationRetryFromSearch(search), null);
  }
});

test('opening the retry link can clear the old installation prompt only for its selected eSIM', () => {
  const values = new Map();
  globalThis.window = {};
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  writePendingEsimInstall(8);
  clearPendingEsimInstall(7);
  assert.equal(hasPendingEsimInstall(8), true);
  writePendingEsimInstall(7);
  const retry = activationRetryFromSearch('?retry_activation=1&user_esim_id=7&msisdn=255700000001');
  clearPendingEsimInstall(retry.userEsimId);
  assert.equal(hasPendingEsimInstall(7), false);
});
