import { ValidationError } from '../util/errors.js';
import { requireString } from '../util/validation.js';

export const CATEGORIES = ['livros', 'acessorios', 'vestuario', 'eletronicos'];

/**
 * Produto do catálogo. Imutável: preço e peso mudam criando outro produto
 * (o catálogo troca a versão inteira).
 */
export function createProduct({ sku, name, price, weightKg, category, active = true }) {
  const code = requireString(sku, 'sku').toUpperCase();
  if (!/^[A-Z]{3}-\d{3}$/.test(code)) {
    throw new ValidationError(`SKU fora do padrão AAA-000: "${sku}".`, { field: 'sku' });
  }
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    throw new ValidationError(`Preço inválido para ${code}.`, { field: 'price' });
  }
  if (typeof weightKg !== 'number' || !(weightKg > 0)) {
    throw new ValidationError(`Peso inválido para ${code}.`, { field: 'weightKg' });
  }
  if (!CATEGORIES.includes(category)) {
    throw new ValidationError(`Categoria desconhecida: "${category}".`, { field: 'category' });
  }
  return Object.freeze({
    sku: code,
    name: requireString(name, 'name'),
    price,
    weightKg,
    category,
    active: Boolean(active),
  });
}
