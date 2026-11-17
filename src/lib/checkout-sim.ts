import { dataMbFromAssignment } from './esim-balance';

export interface CheckoutSim {
  id?: number;
  balances?: Record<string, unknown> | null;
  esim?: { msisdn?: string | null; phone_number?: string | null } | null;
}

/** An empty, successful lookup uses the regular purchase and assignment flow. */
export function checkoutForSim(sim: CheckoutSim | null | undefined) {
  const msisdn = sim?.esim?.msisdn?.trim() || sim?.esim?.phone_number?.trim();
  if (!sim) return { checkoutMode: 'standard' as const };
  if (!sim.id || !msisdn) {
    throw new Error('Your SIM details are incomplete. Refresh your dashboard and try again.');
  }
  return {
    checkoutMode: 'topup' as const,
    user_esim_id: sim.id,
    msisdn,
    current_data_mb: dataMbFromAssignment(sim) ?? 0,
  };
}

/** Failed or malformed lookups must never be interpreted as an empty account. */
export function checkoutSimRows(body: unknown): CheckoutSim[] {
  const root = body as { data?: unknown; esims?: unknown } | null;
  const rows = Array.isArray(body) ? body : root?.data ?? root?.esims;
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object')) {
    throw new Error('Could not load your SIM. Please try again.');
  }
  return rows as CheckoutSim[];
}
