import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const jsx = require('react/jsx-runtime');
const compiled = ts.transpileModule(readFileSync(new URL('../src/components/checkout/PartnerReferralField.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
async function mount({ saved = null, change } = {}) {
  const states = [], effects = [], calls = [];
  let cursor = 0, first = true, tree;
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return states[i] ??= { current: initial }; },
    useEffect(effect) { if (first) effects.push(effect); },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, AbortController, Error, fetch: async () => ({ ok: true, json: async () => ({ referral: saved ? { code: saved } : null }) }), require: name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return jsx;
    if (name === '@/lib/referral-client') return { changeReferral: async code => {
      calls.push(code);
      return change ? change(code) : { referral: code ? { code } : null };
    } };
    throw new Error(`Unexpected import: ${name}`);
  } });
  function render() { cursor = 0; tree = exports.default(); first = false; return tree; }
  function elements(node) {
    if (!node || typeof node !== 'object') return [];
    const children = node.props?.children;
    return [node, ...[children].flat(Infinity).flatMap(elements)];
  }
  const find = predicate => elements(tree).find(predicate);
  render(); effects.forEach(effect => effect()); await tick(); render();
  return { calls, render, find, text: () => {
    const text = node => typeof node === 'string' ? node : !node || typeof node !== 'object' ? '' : [node.props?.children].flat(Infinity).map(text).join(' ');
    return text(tree);
  }, edit: value => find(el => el.type === 'input').props.onChange({ target: { value } }) };
}

test('pasting a full code applies it automatically with no Apply button', async () => {
  const ui = await mount();
  ui.edit(' trv-2lalhkyy ');
  assert.deepEqual(ui.calls, ['2LALHKYY']);
  await tick(); ui.render();
  assert.match(ui.text(), /Referral code applied:.*2LALHKYY/);
  assert.equal(ui.find(el => el.type === 'button' && el.props.children === 'Apply code'), undefined);
});

test('typing applies only once the code is complete', async () => {
  const ui = await mount();
  for (const value of ['T','TRV-','TRV-2LALHKY']) { ui.edit(value); ui.render(); }
  assert.equal(ui.calls.length, 0);
  ui.edit('TRV-2LALHKYY');
  await tick(); ui.render();
  assert.deepEqual(ui.calls, ['2LALHKYY']);
});

test('codes saved by URL and QR links are displayed as applied without resubmission', async () => {
  const ui = await mount({ saved: 'TRV-2LALHKYY' });
  assert.match(ui.text(), /Referral code applied:.*2LALHKYY/);
  assert.equal(ui.calls.length, 0);
});

test('Remove and clearing the input remove the saved code', async () => {
  for (const clear of [ui => ui.edit(''), ui => ui.find(el => el.type === 'button' && el.props.children === 'Remove').props.onClick()]) {
    const ui = await mount({ saved: 'TRV-2LALHKYY' }); clear(ui);
    await tick(); ui.render();
    assert.deepEqual(ui.calls, [null]);
    assert.doesNotMatch(ui.text(), /Referral code applied:/);
  }
});

test('failed automatic application keeps the entered code and Retry submits that code', async () => {
  let attempts = 0;
  const ui = await mount({ change: async code => {
    if (++attempts === 1) throw new Error('Please try again.');
    return { referral: { code } };
  } });
  ui.edit('TRV-2LALHKYY'); await tick(); ui.render();
  assert.equal(ui.find(el => el.type === 'input').props.value, '2LALHKYY');
  ui.find(el => el.type === 'button' && el.props.children === 'Retry').props.onClick();
  await tick(); ui.render();
  assert.deepEqual(ui.calls, ['2LALHKYY','2LALHKYY']);
  assert.match(ui.text(), /Referral code applied:/);
});
