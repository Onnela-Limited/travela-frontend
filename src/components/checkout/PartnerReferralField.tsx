'use client';

import { useEffect, useRef, useState } from 'react';
import { changeReferral } from '@/lib/referral-client';

export default function PartnerReferralField() {
  const [input, setInput] = useState('');
  const [applied, setApplied] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [retryAction, setRetryAction] = useState<'load' | 'save'>('load');
  const changing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/referral', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (controller.signal.aborted) return;
      const code = (data.referral?.code ?? '').replace(/^TRV-/, '');
      setInput(code); setApplied(code);
      setError(response.ok ? '' : data.message ?? 'Could not check your partner code.');
    }).catch(() => { if (!controller.signal.aborted) setError('Could not check your partner code. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const save = async (code: string) => {
    if (changing.current) return;
    changing.current = true;
    setLoading(true); setError(''); setRetryAction('save');
    try {
      const data = await changeReferral(code || null);
      const appliedCode = (data.referral?.code ?? '').replace(/^TRV-/, '');
      setApplied(appliedCode); setInput(appliedCode);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { changing.current = false; setLoading(false); }
  };

  const editCode = (value: string) => {
    const code = value.trim().toUpperCase().replace(/^TRV-/, '');
    setInput(code); setError('');
    // Start immediately when a full code is typed or pasted. Order creation
    // already waits for changeReferral, so it cannot overtake this request.
    if (/^[A-Z0-9]{8}$/.test(code)) {
      if (code !== applied) void save(code);
    } else if (!code) {
      if (applied) void save('');
    }
  };

  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
    <label htmlFor="partner-referral-code" className="text-sm font-bold text-slate-800">Partner referral code (optional)</label>
    <p id="partner-referral-help" className="mt-1 text-xs text-slate-500">Paste or type a code from your guide, hotel, or creator. Valid codes apply automatically. Referral links and QR codes apply it for you.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <input id="partner-referral-code" value={input} onChange={event => editCode(event.target.value)} maxLength={8} onPaste={event => { event.preventDefault(); editCode(event.clipboardData.getData('text')); }} placeholder="XXXXXXXX" disabled={loading} aria-describedby="partner-referral-help" aria-invalid={Boolean(error)} autoCapitalize="characters" spellCheck={false} className="min-w-40 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase" />
      <button type="button" disabled={loading} onClick={() => void save('')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-50">Remove</button>
    </div>
    {loading ? <p role="status" className="mt-2 text-xs text-slate-500">Checking partner code…</p> : applied && input === applied && !error ? <p role="status" className="mt-2 text-xs font-bold text-emerald-700">Referral code applied: {applied}</p> : input && !error ? <p className="mt-2 text-xs text-slate-500">Enter the full 8-character referral code.</p> : null}
    {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error} <button type="button" disabled={loading} onClick={() => {
      if (retryAction === 'save') void save(input);
      else { setLoading(true); setAttempt(value => value + 1); }
    }} className="font-bold underline">Retry</button></p> : null}
    <p className="mt-2 text-xs text-slate-500">Prices are unchanged. An order already created for payment keeps its original referral.</p>
  </section>;
}
