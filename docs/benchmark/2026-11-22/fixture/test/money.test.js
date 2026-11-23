import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatBRL, percentOf, round2, sumMoney } from '../src/money.js';

describe('money', () => {
  it('arredonda para duas casas', () => {
    assert.equal(round2(10.555), 10.56);
    assert.equal(round2(0.1 + 0.2), 0.3);
    assert.equal(round2(3), 3);
  });

  it('formata em reais com separador de milhar', () => {
    assert.equal(formatBRL(0), 'R$ 0,00');
    assert.equal(formatBRL(9.9), 'R$ 9,90');
    assert.equal(formatBRL(1234.5), 'R$ 1.234,50');
    assert.equal(formatBRL(1899000), 'R$ 1.899.000,00');
  });

  it('soma e calcula percentuais', () => {
    assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6);
    assert.equal(percentOf(219.7, 10), 21.97);
  });
});
