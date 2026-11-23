import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EventBus } from '../src/events/eventBus.js';
import { Inventory } from '../src/inventory/inventory.js';

describe('Inventory', () => {
  it('reserva tira do disponível, mas não do físico', () => {
    const inventory = new Inventory({ stock: { 'LIV-001': 10 } });
    inventory.reserve('ORD-1', [{ sku: 'LIV-001', quantity: 3 }]);
    assert.equal(inventory.available('LIV-001'), 7);
    assert.equal(inventory.onHand('LIV-001'), 10);
  });

  it('reserva tudo ou nada', () => {
    const inventory = new Inventory({ stock: { 'LIV-001': 10, 'MON-050': 1 } });
    assert.throws(
      () =>
        inventory.reserve('ORD-1', [
          { sku: 'LIV-001', quantity: 2 },
          { sku: 'MON-050', quantity: 2 },
        ]),
      { code: 'OUT_OF_STOCK' },
    );
    assert.equal(inventory.available('LIV-001'), 10);
  });

  it('commit tira do físico e avisa estoque baixo', () => {
    const bus = new EventBus();
    const inventory = new Inventory({ stock: { 'TEC-040': 8 }, bus });
    inventory.reserve('ORD-1', [{ sku: 'TEC-040', quantity: 3 }]);
    inventory.commit('ORD-1');
    assert.equal(inventory.onHand('TEC-040'), 5);
    assert.equal(inventory.available('TEC-040'), 5);
    assert.deepEqual(bus.emitted('stock.low'), [{ sku: 'TEC-040', available: 5 }]);
  });

  it('release devolve a reserva ao disponível', () => {
    const inventory = new Inventory({ stock: { 'CAN-010': 4 } });
    inventory.reserve('ORD-1', [{ sku: 'CAN-010', quantity: 4 }]);
    assert.equal(inventory.available('CAN-010'), 0);
    inventory.release('ORD-1');
    assert.equal(inventory.available('CAN-010'), 4);
    assert.throws(() => inventory.release('ORD-1'), { code: 'NO_RESERVATION' });
  });
});
