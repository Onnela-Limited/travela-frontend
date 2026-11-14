interface TransactionStatus {
  payment_status?: string | null;
  status?: string | null;
}

export const TRANSACTION_GROUPS = ['Paid', 'Cancelled', 'Failed', 'Pending', 'Other'] as const;
export type TransactionGroup = typeof TRANSACTION_GROUPS[number];

export function transactionGroup(order: TransactionStatus): TransactionGroup {
  const status = (order.payment_status || order.status || '').trim().toLowerCase();
  if (['paid', 'completed'].includes(status)) return 'Paid';
  if (['cancelled', 'canceled'].includes(status)) return 'Cancelled';
  if (['failed', 'payment_failed'].includes(status)) return 'Failed';
  if (['pending', 'pending_payment', 'payment_pending', 'unpaid', 'created', 'processing', 'initiated'].includes(status)) return 'Pending';
  return 'Other';
}

export function groupTransactions<T extends TransactionStatus>(orders: readonly T[]) {
  return TRANSACTION_GROUPS.map(label => ({
    label,
    orders: orders.filter(order => transactionGroup(order) === label),
  }));
}
