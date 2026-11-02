'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { EsimsApi } from '@/lib/api';
import { clearBalancePoll, getBalancePollContext, initBalancePollFromUrl, type BalancePollContext } from '@/lib/balance-poll';
import { dataMbFromBalanceStatusBody } from '@/lib/esim-balance';

const POLL_MS = 5000;
const MAX_POLL_MS = 10 * 60 * 1000;

export function useBalancePoll(options?: { onBalanceReady?: () => void; enabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const enabled = options?.enabled !== false;
  const enabledRef = useRef(enabled);
  const onReadyRef = useRef(options?.onBalanceReady);
  const onBalanceReady = options?.onBalanceReady;
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onReadyRef.current = onBalanceReady; }, [onBalanceReady]);
  const inFlight = useRef(false);
  const [context, setContext] = useState<BalancePollContext | null>(null);
  const [targetMsisdn, setTargetMsisdn] = useState<string>();
  const [confirmedDataMb, setConfirmedDataMb] = useState<number | null>(null);
  const [pollComplete, setPollComplete] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    // Preserve the email URL through login, which clears old purchase state.
    if (!enabled) return;
    const initialize = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const fromReturnUrl = params.get('await_balance') === '1' || params.has('purchased_mb');
      if (fromReturnUrl) initBalancePollFromUrl();
      const next = getBalancePollContext();
      if (next) {
        setContext(next);
        setTargetMsisdn(next.msisdn);
        setConfirmedDataMb(null);
        setPollComplete(false);
        setIsPolling(true);
      }
      if (!fromReturnUrl) return;
      params.delete('await_balance');
      params.delete('msisdn');
      params.delete('purchased_mb');
      params.delete('recharge');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 0);
    return () => window.clearTimeout(initialize);
  }, [enabled, router, pathname]);

  const pollOnce = useCallback(async () => {
    if (!enabledRef.current || !context?.since || inFlight.current) return false;
    if (Date.now() - Date.parse(context.since) > MAX_POLL_MS) {
      setIsPolling(false);
      setPollComplete(true);
      clearBalancePoll();
      return true;
    }
    inFlight.current = true;
    try {
      const res = await EsimsApi.balanceStatus({ since: context.since, msisdn: context.msisdn, require_data: true });
      if (!enabledRef.current) return false;
      if (res.status === 403 || res.status === 404) {
        clearBalancePoll();
        setTargetMsisdn(undefined);
        setContext(null);
        setPollComplete(true);
        setIsPolling(false);
        return true;
      }
      if (!res.ok || !res.body || typeof res.body !== 'object') return false;
      const body = res.body as { balance_ready?: boolean };
      const dataMb = dataMbFromBalanceStatusBody(body);
      if (!body.balance_ready || dataMb === null) return false;
      setConfirmedDataMb(dataMb);
      setPollComplete(true);
      clearBalancePoll();
      setContext(null);
      setIsPolling(false);
      onReadyRef.current?.();
      return true;
    } catch {
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [context]);

  useEffect(() => {
    if (!enabled || !context?.since || pollComplete) return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      const done = await pollOnce();
      if (done) clearInterval(timer);
    };
    const timer = setInterval(() => { void run(); }, POLL_MS);
    void run();
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled, context, pollComplete, pollOnce]);

  return { isPolling, confirmedDataMb, targetMsisdn };
}
