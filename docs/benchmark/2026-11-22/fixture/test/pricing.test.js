import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Catalog } from '../src/catalog/catalog.js';
import { computeTotals } from '../src/pricing/pricing.js';
import { computeShipping } from '../src/pricing/shipping.js';
import { computeTax, describeRate } from '../src/pricing/tax.js';

const catalog = Catalog.withSeed();
const products = new Map(catalog.list().map((product) => [product.sku, product]));
const NOW = new Date('2026-03-10T12:00:00Z');

describe('computeTotals', () => {
  it('sem cupom: subtotal, frete por peso e imposto do estado', () => {
    const totals = computeTotals({
      items: [{ sku: 'LIV-002', quantity: 1 }],
      products,
      state: 'SP',
      now: NOW,
    });
    assert.equal(totals.subtotal, 129.5);
    assert.equal(totals.shipping, 19.5);
    assert.equal(totals.tax, 23.31);
    assert.equal(totals.total, 172.31);
  });

  it('frete grátis a partir do limite', () => {
    const totals = computeTotals({
      items: [{ sku: 'TEC-040', quantity: 1 }],
      products,
      state: 'PR',
      now: NOW,
    });
    assert.equal(totals.shipping, 0);
    assert.equal(totals.tax, 89.51);
  });

  it('cupom de livros vale só sobre os livros', () => {
    const totals = computeTotals({
      items: [
        { sku: 'LIV-001', quantity: 1 },
        { sku: 'CAM-020', quantity: 1 },
      ],
      products,
      state: 'MG',
      couponCode: 'livros15',
      now: NOW,
    });
    assert.equal(totals.discount, 13.49);
    assert.equal(totals.coupon, 'LIVROS15');
  });

  it('cupom expirado é recusado', () => {
    assert.throws(
      () =>
        computeTotals({
          items: [{ sku: 'LIV-001', quantity: 2 }],
          products,
          state: 'SP',
          couponCode: 'NATAL25',
          now: NOW,
        }),
      { code: 'COUPON_REJECTED' },
    );
  });

  it('cupom acima do mínimo é aceito', () => {
    const totals = computeTotals({
      items: [{ sku: 'LIV-003', quantity: 2 }],
      products,
      state: 'SP',
      couponCode: 'BEMVINDO10',
      now: NOW,
    });
    assert.equal(totals.discount, 19.8);
  });
});

describe('frete e imposto', () => {
  it('cobra o quilo arredondado para cima', () => {
    const lines = [{ sku: 'MON-050', quantity: 1, weightKg: 6.5 }];
    assert.equal(computeShipping({ lines, state: 'AM', discountedSubtotal: 100 }), 100.6);
  });

  it('recusa pedido acima do peso máximo', () => {
    const lines = [{ sku: 'MON-050', quantity: 5, weightKg: 6.5 }];
    assert.throws(() => computeShipping({ lines, state: 'SP', discountedSubtotal: 10 }), { code: 'TOO_HEAVY' });
  });

  it('imposto e descrição da alíquota', () => {
    assert.equal(computeTax(100, 'BA'), 20.5);
    assert.equal(describeRate('PR'), '19,5%');
    assert.equal(describeRate('SP'), '18%');
  });
});
