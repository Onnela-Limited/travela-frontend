export interface BundleHistoryEntry {
  id: string;
  name: string;
  data_mb: number | null;
  added_at: string;
  expires_at: string;
  expired: boolean;
  source: 'purchase' | 'topup' | 'admin_topup';
  reference: string | null;
}

function normalizedNumber(number?: string | null) {
  return number?.replace(/[+\s]/g, '') ?? '';
}

export function selectDashboardSim<T extends { esim?: { msisdn?: string | null; phone_number?: string | null } | null }>(
  sims: T[], targetMsisdn?: string,
): T | null {
  if (targetMsisdn) {
    const target = normalizedNumber(targetMsisdn);
    return sims.find((sim) => normalizedNumber(sim.esim?.msisdn || sim.esim?.phone_number) === target) ?? null;
  }
  return sims[0] ?? null;
}

export function dashboardDataMb(polling: boolean, confirmed: number | null, stored: number | null): number | null {
  // The carrier balance already includes the remaining old data and any added data.
  // Adding the purchased bundle size here would count the top-up twice.
  return polling ? null : confirmed ?? stored;
}
