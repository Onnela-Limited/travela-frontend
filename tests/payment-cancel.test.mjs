import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canCancelFailedOrder,findLatestUnpaidOrder,shouldRetryPendingPayment} from '../src/lib/payment-retry.ts';
import {clearCancelledPayment} from '../src/lib/payment-cancel.ts';
const failed=patch=>({id:10,draft_id:'DRAFT-10',payment_status:'failed',status:'payment_failed',paid_at:null,total_amount:'20.00',currency:'USD',...patch});
const store=entries=>{const data=new Map(Object.entries(entries));return {getItem:key=>data.get(key)??null,removeItem:key=>data.delete(key),data};};
test('cancel is offered only for confirmed failed and unpaid orders',()=>{
 assert.equal(canCancelFailedOrder(failed()),true);assert.equal(canCancelFailedOrder(failed({payment_status:'payment_failed'})),true);
 for(const patch of [{payment_status:'paid'},{status:'paid'},{payment_status:'pending'},{paid_at:'2026-11-14T10:00:00Z'},{metadata:{customer_cancelled_at:'2026-11-14T10:00:00Z'}}])assert.equal(canCancelFailedOrder(failed(patch)),false);
});
test('explicitly cancelled orders cannot return as unpaid reminders but late payment success remains paid',()=>{
 const cancelled=failed({status:'cancelled',payment_status:'cancelled',metadata:{customer_cancelled_at:'2026-11-14T10:00:00Z'}});
 assert.equal(findLatestUnpaidOrder([cancelled]),null);assert.equal(shouldRetryPendingPayment([cancelled],{order_id:10}),false);
 const other=failed({id:11});assert.equal(findLatestUnpaidOrder([cancelled,other]).id,11);
 assert.equal(findLatestUnpaidOrder([{...cancelled,status:'paid',payment_status:'paid',paid_at:'2026-11-14T10:01:00Z'}]),null);
 assert.equal(findLatestUnpaidOrder([failed({payment_status:'cancelled',status:'cancelled'})]).id,10);
});
test('cancelling removes only that order’s pending snapshots and receipt prompts',()=>{
 const local=store({token:'PRIVATE-TOKEN',cart:'UNRELATED-CART',pendingPayment:JSON.stringify({order_id:10}),lastPurchase:JSON.stringify({orderId:10})});const session=store({'travela:receiptOrderId':'10','travela:showReceiptPrompt':'1'});
 clearCancelledPayment({id:10,draft_id:'DRAFT-10'},local,session);assert.equal(local.getItem('pendingPayment'),null);assert.equal(local.getItem('lastPurchase'),null);assert.equal(session.getItem('travela:showReceiptPrompt'),null);assert.equal(local.getItem('token'),'PRIVATE-TOKEN');assert.equal(local.getItem('cart'),'UNRELATED-CART');
});
test('newer, unrelated or malformed checkout data stays untouched',()=>{
 const local=store({pendingPayment:JSON.stringify({order_id:11,draft_id:'DRAFT-10'}),lastPurchase:'malformed'}),session=store({'travela:receiptOrderId':'11','travela:showReceiptPrompt':'1'});
 clearCancelledPayment({id:10,draft_id:'DRAFT-10'},local,session);assert.ok(local.getItem('pendingPayment'));assert.equal(local.getItem('lastPurchase'),'malformed');assert.equal(session.getItem('travela:showReceiptPrompt'),'1');
 const matching=store({pendingPayment:JSON.stringify({draft_id:'DRAFT-10'})});clearCancelledPayment({id:10,draft_id:'DRAFT-10'},matching,store({}));assert.equal(matching.getItem('pendingPayment'),null);
});
