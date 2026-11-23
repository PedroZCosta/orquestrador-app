import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FakePaymentGateway } from '../src/index.js';
import { formatReport, salesReport } from '../src/reports/salesReport.js';
import { CUSTOMER, testStore } from './helpers.js';

describe('salesReport', () => {
  it('soma receita, descontos e agrupa por SKU e estado', async () => {
    const gateway = new FakePaymentGateway({
      script: [{ ok: true }, { ok: false, retryable: false, reason: 'card_declined' }],
    });
    const store = testStore({ gateway });
    const a = await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'LIV-001', quantity: 2 }] });
    const b = await store.orders.placeOrder({
      customer: { ...CUSTOMER, email: 'bia@example.com', state: 'RJ' },
      items: [{ sku: 'LIV-001', quantity: 1 }],
      couponCode: 'LIVROS15',
    });
    const c = await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'CAN-010', quantity: 1 }] });
    await store.orders.payOrder(a.id, 'pix');
    await store.orders.payOrder(c.id, 'credit_card');

    const report = salesReport(store.orders.listOrders());
    assert.equal(report.orderCount, 2);
    assert.equal(report.revenue, Math.round((a.totals.total + b.totals.total) * 100) / 100);
    assert.equal(report.discounts, b.totals.discount);
    assert.equal(report.bySku['LIV-001'].quantity, 3);
    assert.equal(report.byState.RJ.orders, 1);
    assert.equal(report.topProducts[0].sku, 'LIV-001');
  });

  it('filtra pelo período', async () => {
    const store = testStore();
    await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'CAN-010', quantity: 1 }] });
    store.clock.set('2026-04-02T10:00:00.000Z');
    await store.orders.placeOrder({ customer: CUSTOMER, items: [{ sku: 'CAN-010', quantity: 1 }] });
    const march = salesReport(store.orders.listOrders(), { from: '2026-03-01', to: '2026-04-01' });
    assert.equal(march.orderCount, 1);
  });

  it('texto do relatório', () => {
    const text = formatReport({
      orderCount: 2,
      revenue: 1234.5,
      discounts: 10,
      averageTicket: 617.25,
      topProducts: [{ sku: 'LIV-001', name: 'Livro', quantity: 3, revenue: 269.7 }],
    });
    assert.ok(text.includes('Receita: R$ 1.234,50'));
    assert.ok(text.includes('1. Livro (LIV-001): 3 un., R$ 269,70'));
  });
});
