import { DomainError } from '../util/errors.js';
import { requirePositiveInt } from '../util/validation.js';

const MAX_QUANTITY_PER_ITEM = 10;

/**
 * Carrinho de compras: guarda SKUs e quantidades e mostra um resumo com os
 * preços atuais do catálogo. O total final (cupom, imposto, frete) é do
 * `computeTotals`, no fechamento do pedido.
 */
export class Cart {
  constructor(catalog) {
    this.catalog = catalog;
    this.lines = new Map();
  }

  add(sku, quantity = 1) {
    requirePositiveInt(quantity, 'quantity');
    const product = this.catalog.getSellable(sku);
    const next = (this.lines.get(product.sku) ?? 0) + quantity;
    if (next > MAX_QUANTITY_PER_ITEM) {
      throw new DomainError('CART_LIMIT', `Máximo de ${MAX_QUANTITY_PER_ITEM} unidades por item.`, {
        sku: product.sku,
      });
    }
    this.lines.set(product.sku, next);
    return next;
  }

  setQuantity(sku, quantity) {
    const code = String(sku).toUpperCase();
    if (quantity === 0) {
      this.lines.delete(code);
      return 0;
    }
    this.lines.delete(code);
    return this.add(code, quantity);
  }

  remove(sku) {
    return this.lines.delete(String(sku).toUpperCase());
  }

  clear() {
    this.lines.clear();
  }

  get isEmpty() {
    return this.lines.size === 0;
  }

  items() {
    return [...this.lines].map(([sku, quantity]) => ({ sku, quantity }));
  }

  summary() {
    const lines = [...this.lines].map(([sku, quantity]) => {
      const product = this.catalog.get(sku);
      const lineTotal = Math.round(product.price * quantity * 100) / 100;
      return { sku, name: product.name, quantity, unitPrice: product.price, lineTotal };
    });
    const subtotal = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    return { lines, itemCount, subtotal };
  }
}
