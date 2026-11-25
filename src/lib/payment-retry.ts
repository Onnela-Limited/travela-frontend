/** Dashboard payment reminders concern purchases, rather than every gateway attempt. */
export interface PaymentRetryOrder {
  id: number;
  draft_id?: string;
  payment_status?: string | null;
  status?: string | null;
  paid_at?: string | null;
  created_at?: string;
  total_amount: string | number;
  currency: string;
  metadata?: { simType?: string; checkoutMode?: string; country?: string; customer_cancelled_at?: string } | null;
  trip?: { destination_country?: string; arrival_date?: string; departure_date?: string } | null;
  order_items?: Array<{
    bundle_id?: number | string | null;
    bundle_name?: string;
    bundle?: { id?: number; name?: string } | null;
    data_amount?: number | null;
    validity_days?: number;
  }>;
}

const normalized = (value?: string | null) => (value || '').trim().toLowerCase();

export function isPaidOrder(order: PaymentRetryOrder): boolean {
  return ['paid', 'completed'].includes(normalized(order.payment_status || order.status));
}

export function isUnpaidPayableOrder(order: PaymentRetryOrder): boolean {
  if (isPaidOrder(order) || order.paid_at || order.metadata?.customer_cancelled_at) return false;
  return ['', 'pending', 'pending_payment', 'unpaid', 'failed', 'payment_failed', 'cancelled', 'canceled',
    'expired', 'awaiting_payment', 'payment_required', 'initiated', 'created', 'draft']
    .includes(normalized(order.payment_status || order.status));
}

export function canCancelFailedOrder(order: PaymentRetryOrder): boolean {
  return !isPaidOrder(order) && !['paid','completed'].includes(normalized(order.status)) && !order.paid_at && !order.metadata?.customer_cancelled_at
    && ['failed','payment_failed'].includes(normalized(order.payment_status || order.status));
}

function samePurchase(a: PaymentRetryOrder, b: PaymentRetryOrder): boolean {
  const amountA = Number(a.total_amount);
  const amountB = Number(b.total_amount);
  if (!Number.isFinite(amountA) || !Number.isFinite(amountB) || amountA !== amountB) return false;
  if (normalized(a.currency) !== normalized(b.currency)) return false;
  if (normalized(a.metadata?.simType || 'esim') !== normalized(b.metadata?.simType || 'esim')) return false;
  if ((normalized(a.metadata?.checkoutMode) === 'topup') !== (normalized(b.metadata?.checkoutMode) === 'topup')) return false;
  if (normalized(a.trip?.destination_country || a.metadata?.country) !== normalized(b.trip?.destination_country || b.metadata?.country)) return false;
  if ((a.trip?.arrival_date || '').slice(0, 10) !== (b.trip?.arrival_date || '').slice(0, 10)) return false;
  if ((a.trip?.departure_date || '').slice(0, 10) !== (b.trip?.departure_date || '').slice(0, 10)) return false;
  if (!a.order_items?.length || a.order_items.length !== b.order_items?.length) return false;
  const remaining = [...b.order_items];
  return a.order_items.every((item) => {
    const index = remaining.findIndex((other) => {
      const id = item.bundle_id ?? item.bundle?.id;
      const otherId = other.bundle_id ?? other.bundle?.id;
      if (id != null && otherId != null) {
        if (String(id) !== String(otherId)) return false;
      } else {
        const name = normalized(item.bundle_name || item.bundle?.name);
        if (!name || name !== normalized(other.bundle_name || other.bundle?.name)) return false;
      }
      return (item.data_amount == null || other.data_amount == null || item.data_amount === other.data_amount)
        && (item.validity_days == null || other.validity_days == null || item.validity_days === other.validity_days);
    });
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

export function hasSuccessfulReplacement(order: PaymentRetryOrder, orders: PaymentRetryOrder[]): boolean {
  return orders.some((paid) => {
    if (!isPaidOrder(paid) || !samePurchase(order, paid)) return false;
    const paidTime = Date.parse(paid.paid_at || paid.created_at || '');
    const attemptTime = Date.parse(order.created_at || '');
    return Number.isFinite(paidTime) && Number.isFinite(attemptTime)
      ? paidTime >= attemptTime
      : paid.id >= order.id;
  });
}

export function findLatestUnpaidOrder<T extends PaymentRetryOrder>(
  orders: T[], dismissedIds?: ReadonlySet<string>
): T | null {
  return orders.filter((order) => !dismissedIds?.has(String(order.id)) &&
    isUnpaidPayableOrder(order) && !hasSuccessfulReplacement(order, orders))
    .sort((a, b) => (Date.parse(b.created_at || '') || b.id) - (Date.parse(a.created_at || '') || a.id))[0] ?? null;
}
