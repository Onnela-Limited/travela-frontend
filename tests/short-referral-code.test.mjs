import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const next = require('next/server');
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function helpers(reply = 'ABCD1234') {
  const exports = {}, calls = [];
  vm.runInNewContext(compile('../src/lib/referral-server.ts'), { exports, require: () => ({}), process: { env: { REFERRAL_API_URL: 'https://api.example.test/api' } }, AbortSignal,
    fetch: async url => { calls.push(url); return Response.json({ referral: { code: reply } }); } });
  return { ...exports, calls };
}

test('normalizes new and historical codes to exactly eight characters and rejects malformed codes', () => {
  const helper = helpers();
  for (const code of ['ABCD1234', 'abcd1234', 'TRV-ABCD1234', ' trv-abcd1234 ']) assert.equal(helper.normalizeReferral(code), 'ABCD1234');
  for (const code of [null, '', '1234567', '123456789', 'TRV-TRV-ABCD1234', 'ABCD!234']) assert.equal(helper.normalizeReferral(code), null);
});

test('API resolution accepts either response format and checks that it is the same partner', async () => {
  for (const reply of ['ABCD1234', 'TRV-ABCD1234']) {
    const helper = helpers(reply); assert.equal(await helper.resolveReferral('TRV-ABCD1234'), 'ABCD1234');
    assert.equal(helper.calls[0], 'https://api.example.test/api/public/partner-referrals/ABCD1234');
  }
  assert.equal(await helpers('ZZZZ1234').resolveReferral('ABCD1234'), null);
});

test('old QR links and new short links both set the short referral cookie on the public origin', async () => {
  const helper = helpers(); const route = {};
  vm.runInNewContext(compile('../src/app/r/[code]/route.ts'), { exports: route, require: name => name === 'next/server' ? next : helper });
  for (const code of ['TRV-ABCD1234', 'ABCD1234']) {
    const response = await route.GET({ url: `http://localhost:3000/r/${code}` }, { params: Promise.resolve({ code }) });
    assert.equal(response.status, 307); assert.equal(response.headers.get('location'), '/bundles');
    assert.equal(response.cookies.get('travela_referral').value, 'ABCD1234');
  }
});
