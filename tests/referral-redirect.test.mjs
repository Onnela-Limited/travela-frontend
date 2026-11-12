import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const next = require('next/server');
const source = readFileSync(new URL('../src/app/r/[code]/route.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function handler(resolveReferral) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => {
    if (name === 'next/server') return next;
    if (name === '@/lib/referral-server') return {
      normalizeReferral: code => /^TRV-[A-Z0-9]{8}$/.test(code) ? code : null,
      resolveReferral, REFERRAL_COOKIE: 'travela_referral',
      referralCookieOptions: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 2592000 },
    };
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports.GET;
}
const internalRequest = { url: 'http://localhost:3000/r/TRV-2LALHKYY' };
const params = code => ({ params: Promise.resolve({ code }) });

test('valid referrals stay on the public browser origin behind a localhost proxy', async () => {
  const response = await handler(async code => code)(internalRequest, params('TRV-2LALHKYY'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), '/bundles');
  assert.equal(new URL(response.headers.get('location'), 'https://thetravela.com/r/TRV-2LALHKYY').href, 'https://thetravela.com/bundles');
  assert.equal(response.cookies.get('travela_referral')?.value, 'TRV-2LALHKYY');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('unknown referral redirects stay on the same origin without setting a cookie', async () => {
  const response = await handler(async () => null)(internalRequest, params('TRV-2LALHKYY'));
  assert.equal(response.headers.get('location'), '/bundles?referral=unavailable');
  assert.equal(response.headers.get('set-cookie'), null);
});

test('malformed codes do not reach the API and their redirects cannot be cached', async () => {
  const response = await handler(async () => { throw new Error('Must not call'); })(internalRequest, params('invalid'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), '/bundles?referral=unavailable');
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('API outages remain retryable errors without a redirect or cookie', async () => {
  const response = await handler(async () => { throw new Error('Unavailable'); })(internalRequest, params('TRV-2LALHKYY'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('location'), null);
  assert.equal(response.headers.get('set-cookie'), null);
});
