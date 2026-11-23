import { NotFoundError, DomainError } from '../util/errors.js';
import { createProduct } from './product.js';
import { SEED_PRODUCTS } from './seed.js';

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Catálogo em memória. */
export class Catalog {
  constructor(products = []) {
    this.products = new Map();
    for (const product of products) {
      this.add(product);
    }
  }

  static withSeed() {
    return new Catalog(SEED_PRODUCTS);
  }

  add(data) {
    const product = createProduct(data);
    if (this.products.has(product.sku)) {
      throw new DomainError('DUPLICATE_SKU', `SKU repetido: ${product.sku}.`, { sku: product.sku });
    }
    this.products.set(product.sku, product);
    return product;
  }

  get(sku) {
    const product = this.products.get(String(sku).toUpperCase());
    if (product === undefined) {
      throw new NotFoundError('product', sku);
    }
    return product;
  }

  /** O produto à venda: inexistente ou inativo lança erro. */
  getSellable(sku) {
    const product = this.get(sku);
    if (!product.active) {
      throw new DomainError('PRODUCT_INACTIVE', `${product.name} não está mais à venda.`, { sku: product.sku });
    }
    return product;
  }

  updatePrice(sku, price) {
    const current = this.get(sku);
    const updated = createProduct({ ...current, price });
    this.products.set(updated.sku, updated);
    return updated;
  }

  list({ category, activeOnly = true } = {}) {
    return [...this.products.values()]
      .filter((product) => (activeOnly ? product.active : true))
      .filter((product) => (category === undefined ? true : product.category === category))
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  search(term, { limit = 10 } = {}) {
    const words = normalize(term).split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return [];
    }
    return this.list()
      .map((product) => {
        const haystack = normalize(`${product.name} ${product.category} ${product.sku}`);
        const score = words.filter((word) => haystack.includes(word)).length;
        return { product, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
      .slice(0, limit)
      .map(({ product }) => product);
  }
}
