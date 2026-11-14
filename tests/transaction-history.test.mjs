import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupTransactions, transactionGroup } from '../src/lib/transaction-history.ts';

test('groups canonical statuses and legacy spellings', () => {
  for (const [status, expected] of [['paid', 'Paid'], ['completed', 'Paid'], ['cancelled', 'Cancelled'], ['canceled', 'Cancelled'], ['failed', 'Failed'], ['payment_failed', 'Failed'], ['pending', 'Pending'], ['processing', 'Pending'], ['expired', 'Other'], ['', 'Other']]) {
    assert.equal(transactionGroup({ payment_status: status }), expected);
  }
  assert.equal(transactionGroup({ status: ' PAID ' }), 'Paid');
  assert.equal(transactionGroup({ payment_status: 'failed', status: 'pending' }), 'Failed');
});

test('each order appears once, keeps its within-group order and remains unchanged', () => {
  const orders = Object.freeze([
    Object.freeze({ id: 5, payment_status: 'failed' }),
    Object.freeze({ id: 4, payment_status: 'paid' }),
    Object.freeze({ id: 3, payment_status: 'failed' }),
    Object.freeze({ id: 2, payment_status: 'pending' }),
    Object.freeze({ id: 1, payment_status: 'unknown' }),
    Object.freeze({ id: 0, payment_status: 'cancelled' }),
  ]);
  const groups = groupTransactions(orders);
  assert.deepEqual(groups.map(group => group.label), ['Paid', 'Cancelled', 'Failed', 'Pending', 'Other']);
  assert.deepEqual(groups.find(group => group.label === 'Failed').orders.map(order => order.id), [5, 3]);
  assert.deepEqual(groups.flatMap(group => group.orders).map(order => order.id).sort(), [0, 1, 2, 3, 4, 5]);
  assert.equal(groups[0].orders[0], orders[1]);
  assert.ok(groupTransactions([]).every(group => group.orders.length === 0));
});
