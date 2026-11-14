type PaymentOrder = { id: string | number; draft_id?: string };
type PaymentStorage = Pick<Storage, 'getItem' | 'removeItem'>;

/** Remove only this order's reminders, keeping unrelated purchases and sign-in data. */
export function clearCancelledPayment(order: PaymentOrder, local: PaymentStorage, session: PaymentStorage): void {
  for (const key of ['pendingPayment', 'lastPurchase']) {
    const raw = local.getItem(key);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const id = data.order_id ?? data.orderId;
      const draft = data.draft_id ?? data.draftId;
      if (id != null ? String(id) === String(order.id) : Boolean(order.draft_id && draft === order.draft_id)) local.removeItem(key);
    } catch { /* Malformed or unrelated browser data must not cancel another purchase. */ }
  }
  if (session.getItem('travela:receiptOrderId') === String(order.id)) {
    session.removeItem('travela:receiptOrderId');session.removeItem('travela:showReceiptPrompt');
  }
}
