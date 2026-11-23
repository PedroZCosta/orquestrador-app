import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateCoupon } from '../src/pricing/discounts.js';

const NOW = new Date('2026-03-10T12:00:00Z');
const line = (sku, quantity, unitPrice, category = 'acessorios') => ({ sku, quantity, unitPrice, category });

describe('evaluateCoupon', () => {
  it('cupom desconhecido', () => {
    assert.deepEqual(evaluateCoupon('NAOEXISTE', [line('CAN-010', 1, 39.9)], NOW), {
      ok: false,
      code: 'NAOEXISTE',
      reason: 'UNKNOWN',
    });
  });

  it('percentual sobre o subtotal', () => {
    const result = evaluateCoupon('BEMVINDO10', [line('CAN-010', 3, 39.9)], NOW);
    assert.equal(result.ok, true);
    assert.equal(result.amount, 11.97);
  });

  it('abaixo do mínimo é recusado', () => {
    const result = evaluateCoupon('BEMVINDO10', [line('CAN-010', 2, 39.9)], NOW);
    assert.equal(result.reason, 'MIN_SUBTOTAL');
  });

  it('valor fixo', () => {
    const result = evaluateCoupon('DESC50', [line('TEC-040', 1, 459, 'eletronicos')], NOW);
    assert.equal(result.amount, 50);
  });

  it('frete grátis', () => {
    const result = evaluateCoupon('FRETEGRATIS', [line('MOU-030', 2, 149, 'eletronicos')], NOW);
    assert.deepEqual(result, { ok: true, code: 'FRETEGRATIS', amount: 0, freeShipping: true });
  });

  it('cupom de categoria sem itens da categoria', () => {
    const result = evaluateCoupon('LIVROS15', [line('CAN-010', 1, 39.9)], NOW);
    assert.equal(result.reason, 'NOT_APPLICABLE');
  });
});
