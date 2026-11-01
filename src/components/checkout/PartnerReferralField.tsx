'use client';

import { useEffect, useRef, useState } from 'react';
import { changeReferral } from '@/lib/referral-client';

export default function PartnerReferralField() {
  const [input, setInput] = useState('');
  const [applied, setApplied] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const changing = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/referral', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (controller.signal.aborted) return;
      setInput(data.referral?.code ?? ''); setApplied(data.referral?.code ?? '');
      setError(response.ok ? '' : data.message ?? 'Could not check your partner code.');
    }).catch(() => { if (!controller.signal.aborted) setError('Could not check your partner code. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const save = async (remove = false) => {
    if (changing.current) return;
    changing.current = true;
    setLoading(true); setError('');
    try {
      const data = await changeReferral(remove ? null : input);
      setApplied(data.referral?.code ?? ''); setInput(data.referral?.code ?? '');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); }
    finally { changing.current = false; setLoading(false); }
  };
  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
    <label htmlFor="partner-referral-code" className="text-sm font-bold text-slate-800">Partner referral code (optional)</label>
    <p className="mt-1 text-xs text-slate-500">Use a code from your guide, hotel, or creator. This identifies your referrer for new orders.</p>
    <div className="mt-3 flex flex-wrap gap-2"><input id="partner-referral-code" value={input} onChange={event => setInput(event.target.value.toUpperCase())} maxLength={20} placeholder="TRV-XXXXXXXX" disabled={loading} className="min-w-40 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase" /><button type="button" disabled={loading || !input.trim()} onClick={() => void save()} className="rounded-xl bg-[#112116] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Apply code</button><button type="button" disabled={loading} onClick={() => void save(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-50">Remove</button></div>
    {loading ? <p role="status" className="mt-2 text-xs text-slate-500">Checking partner code…</p> : applied && !error ? <p role="status" className="mt-2 text-xs font-bold text-emerald-700">Referral code applied: {applied}</p> : null}
    {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error} <button disabled={loading} onClick={() => { setLoading(true); setAttempt(value => value + 1); }} className="font-bold underline">Retry</button></p> : null}
    <p className="mt-2 text-xs text-slate-500">Prices are unchanged. An order already created for payment keeps its original referral.</p>
  </section>;
}
