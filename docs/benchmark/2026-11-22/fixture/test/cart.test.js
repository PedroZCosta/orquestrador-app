import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Cart } from '../src/cart/cart.js';
import { Catalog } from '../src/catalog/catalog.js';

describe('Cart', () => {
  it('soma quantidades do mesmo SKU e resume com os preços atuais', () => {
    const cart = new Cart(Catalog.withSeed());
    cart.add('liv-001');
    cart.add('LIV-001', 2);
    cart.add('CAN-010');
    const summary = cart.summary();
    assert.equal(summary.itemCount, 4);
    assert.equal(summary.subtotal, 309.6);
    assert.equal(summary.lines[0].lineTotal, 269.7);
  });

  it('limita 10 unidades por item', () => {
    const cart = new Cart(Catalog.withSeed());
    cart.add('ADE-060', 10);
    assert.throws(() => cart.add('ADE-060'), { code: 'CART_LIMIT' });
  });

  it('quantidade zero remove o item', () => {
    const cart = new Cart(Catalog.withSeed());
    cart.add('CAM-020', 2);
    cart.setQuantity('CAM-020', 0);
    assert.ok(cart.isEmpty);
  });
});
