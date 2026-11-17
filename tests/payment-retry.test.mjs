import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { findLatestUnpaidOrder } from '../src/lib/payment-retry.ts';

const attempt = (overrides = {}) => ({
  id: 236, draft_id: 'DRAFT-236', status: 'failed', payment_status: 'failed', paid_at: null,
  created_at: '2026-10-31T20:00:00Z', total_amount: '50.00', currency: 'USD',
  metadata: { simType: 'esim', country: 'TZ' },
  trip: { destination_country: 'TZ', arrival_date: '2026-11-01', departure_date: '2026-12-01' },
  order_items: [{ bundle_id: 4, bundle_name: '50GB (30 days)', data_amount: 50000, validity_days: 30 }],
  ...overrides,
});
const paid = (overrides = {}) => attempt({ id: 237, draft_id: 'DRAFT-237', status: 'paid', payment_status: 'paid',
  created_at: '2026-10-31T20:10:00Z', paid_at: '2026-10-31T20:12:00Z', ...overrides });

test('a successful replacement hides older failed and pending attempts for that purchase', () => {
  const failed = attempt();
  const pending = attempt({ id: 235, payment_status: 'pending' });
  assert.equal(findLatestUnpaidOrder([failed, paid(), pending]), null);
});

test('the original reminder stays when all attempts failed', () => {
  const latest = attempt({ id: 238, created_at: '2026-10-31T21:00:00Z' });
  assert.equal(findLatestUnpaidOrder([attempt(), latest])?.id, 238);
});

test('separate bundles, trips, SIM types, amounts, currencies and top-ups remain payable', () => {
  const variants = [
    { order_items: [{ bundle_id: 5, bundle_name: 'Nomad', data_amount: 10000, validity_days: 30 }] },
    { trip: { destination_country: 'TZ', arrival_date: '2026-12-01', departure_date: '2027-01-01' } },
    { metadata: { simType: 'physical', country: 'TZ' } },
    { metadata: { simType: 'esim', country: 'TZ', checkoutMode: 'topup' } },
    { total_amount: '20.00' }, { currency: 'TZS' },
  ];
  for (const variant of variants) {
    const failed = attempt(variant);
    assert.equal(findLatestUnpaidOrder([failed, paid()])?.id, 236);
  }
});

test('an older paid purchase does not suppress a new unpaid purchase', () => {
  const newer = attempt({ id: 238, created_at: '2026-11-02T09:00:00Z' });
  assert.equal(findLatestUnpaidOrder([paid(), newer])?.id, 238);
});

test('a deleted order disappears after a fresh server response', () => {
  assert.equal(findLatestUnpaidOrder([attempt({ id: 250 })])?.id, 250);
  assert.equal(findLatestUnpaidOrder([]), null);
  assert.equal(findLatestUnpaidOrder([paid()]), null);
});

test('checkout and dashboard never save or restore browser order snapshots', () => {
  for (const page of ['checkout', 'dashboard']) {
    const source = readFileSync(new URL(`../src/app/${page}/page.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\.(?:getItem|setItem)\(\s*['"](?:pendingPayment|lastPurchase)['"]/);
  }
});

test('legacy item names work, while different quantities and unknown products stay payable', () => {
  const named = attempt({ order_items: [{ bundle_name: '50GB (30 days)', data_amount: 50000, validity_days: 30 }] });
  assert.equal(findLatestUnpaidOrder([named, paid()]), null);
  const double = attempt({ order_items: [...named.order_items, ...named.order_items] });
  assert.equal(findLatestUnpaidOrder([double, paid()])?.id, 236);
  assert.equal(findLatestUnpaidOrder([attempt({ order_items: [] }), paid()])?.id, 236);
});

test('a late successful confirmation suppresses attempts begun before that confirmation', () => {
  const waiting = attempt({ id: 238, created_at: '2026-10-31T20:11:00Z' });
  assert.equal(findLatestUnpaidOrder([waiting, paid()]), null);
});
