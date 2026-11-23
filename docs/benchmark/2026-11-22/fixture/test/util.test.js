import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EventBus } from '../src/events/eventBus.js';
import { createIdGenerator } from '../src/util/ids.js';
import { createMemoryLogger } from '../src/util/logger.js';
import { validateCustomer, validateItems } from '../src/util/validation.js';

describe('EventBus', () => {
  it('entrega aos assinantes e guarda o histórico', () => {
    const bus = new EventBus();
    const seen = [];
    const off = bus.on('x', (payload) => seen.push(payload.n));
    bus.on('*', (_payload, event) => seen.push(event.type));
    bus.emit('x', { n: 1 });
    off();
    bus.emit('x', { n: 2 });
    assert.deepEqual(seen, [1, 'x', 'x']);
    assert.equal(bus.emitted('x').length, 2);
  });

  it('assinante com erro não derruba os outros', () => {
    const logger = createMemoryLogger();
    const bus = new EventBus({ logger });
    let called = false;
    bus.on('x', () => {
      throw new Error('falhou');
    });
    bus.on('x', () => {
      called = true;
    });
    bus.emit('x');
    assert.ok(called);
    assert.equal(logger.records[0].level, 'error');
  });
});

describe('validação', () => {
  it('normaliza cliente e junta itens repetidos', () => {
    assert.deepEqual(validateCustomer({ name: ' Ana ', email: 'ANA@EXAMPLE.COM', state: 'sp' }), {
      name: 'Ana',
      email: 'ana@example.com',
      state: 'SP',
    });
    assert.deepEqual(
      validateItems([
        { sku: 'liv-001', quantity: 1 },
        { sku: 'LIV-001', quantity: 2 },
      ]),
      [{ sku: 'LIV-001', quantity: 3 }],
    );
  });

  it('ids sequenciais', () => {
    const next = createIdGenerator('ORD');
    assert.equal(next(), 'ORD-0001');
    assert.equal(next(), 'ORD-0002');
  });
});
