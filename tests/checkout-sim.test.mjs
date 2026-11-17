import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
).toString('base64');
const balanceUrl = moduleUrl(readFileSync(new URL('../src/lib/esim-balance.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/checkout-sim.ts', import.meta.url), 'utf8')
  .replace("'./esim-balance'", JSON.stringify(balanceUrl));
const { checkoutForSim, checkoutSimRows } = await import(moduleUrl(source));

test('an account without a SIM uses the first-purchase assignment flow', () => {
  const result = checkoutForSim(checkoutSimRows({ data: [] })[0]);
  assert.deepEqual(result, { checkoutMode: 'standard' });
  assert.equal('user_esim_id' in result, false);
  assert.equal('msisdn' in result, false);
});

test('an existing SIM keeps its target and live balance for a normal top-up', () => {
  assert.deepEqual(checkoutForSim({ id: 42, balances: { DATA: 500 }, esim: { msisdn: ' 255700000001 ' } }), {
    checkoutMode: 'topup', user_esim_id: 42, msisdn: '255700000001', current_data_mb: 500,
  });
});

test('phone_number remains a supported top-up target', () => {
  assert.equal(checkoutForSim({ id: 42, esim: { phone_number: '255700000001' } }).checkoutMode, 'topup');
});

test('incomplete SIM records and malformed lookups cannot start a new purchase', () => {
  for (const sim of [{}, { id: 42 }, { id: 42, esim: { msisdn: ' ' } }]) {
    assert.throws(() => checkoutForSim(sim), /incomplete/);
  }
  for (const body of [null, {}, { message: 'Failed' }, { data: null }, { data: [null] }]) {
    assert.throws(() => checkoutSimRows(body), /Could not load/);
  }
});

test('SIM list response formats retain existing assignments', () => {
  const rows = [{ id: 42, esim: { msisdn: '255700000001' } }];
  for (const body of [rows, { data: rows }, { esims: rows }]) {
    assert.equal(checkoutForSim(checkoutSimRows(body)[0]).user_esim_id, 42);
  }
});
