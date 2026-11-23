import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Catalog } from '../src/catalog/catalog.js';

describe('Catalog', () => {
  it('lista só os produtos ativos, por SKU', () => {
    const catalog = Catalog.withSeed();
    const skus = catalog.list().map((product) => product.sku);
    assert.ok(!skus.includes('BON-070'));
    assert.deepEqual(skus, [...skus].sort());
  });

  it('busca sem acento e sem diferenciar maiúsculas', () => {
    const catalog = Catalog.withSeed();
    const found = catalog.search('REFATORACAO');
    assert.equal(found[0].sku, 'LIV-003');
  });

  it('recusa produto inativo na venda', () => {
    const catalog = Catalog.withSeed();
    assert.throws(() => catalog.getSellable('BON-070'), { code: 'PRODUCT_INACTIVE' });
  });

  it('recusa SKU fora do padrão e repetido', () => {
    const catalog = new Catalog();
    assert.throws(
      () => catalog.add({ sku: 'X1', name: 'x', price: 1, weightKg: 1, category: 'livros' }),
      { code: 'VALIDATION_ERROR' },
    );
    catalog.add({ sku: 'ABC-123', name: 'x', price: 1, weightKg: 1, category: 'livros' });
    assert.throws(
      () => catalog.add({ sku: 'abc-123', name: 'y', price: 2, weightKg: 1, category: 'livros' }),
      { code: 'DUPLICATE_SKU' },
    );
  });

  it('troca o preço criando uma nova versão do produto', () => {
    const catalog = Catalog.withSeed();
    const before = catalog.get('CAN-010');
    const after = catalog.updatePrice('CAN-010', 44.9);
    assert.equal(before.price, 39.9);
    assert.equal(after.price, 44.9);
    assert.equal(catalog.get('CAN-010').price, 44.9);
  });
});
