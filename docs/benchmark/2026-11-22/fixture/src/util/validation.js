import { STATES } from '../config.js';
import { ValidationError } from './errors.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`O campo "${field}" é obrigatório.`, { field });
  }
  return value.trim();
}

export function requirePositiveInt(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`O campo "${field}" deve ser um inteiro positivo.`, { field, value });
  }
  return value;
}

export function requireOneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`O campo "${field}" deve ser um de: ${allowed.join(', ')}.`, { field, value });
  }
  return value;
}

export function requireEmail(value, field = 'email') {
  const email = requireString(value, field).toLowerCase();
  if (!EMAIL.test(email)) {
    throw new ValidationError(`E-mail inválido: "${value}".`, { field });
  }
  return email;
}

export function requireState(value, field = 'state') {
  const uf = requireString(value, field).toUpperCase();
  if (!Object.hasOwn(STATES, uf)) {
    throw new ValidationError(`Não entregamos no estado "${value}".`, { field, value });
  }
  return uf;
}

export function validateCustomer(customer) {
  if (customer === null || typeof customer !== 'object') {
    throw new ValidationError('Informe o cliente.', { field: 'customer' });
  }
  return {
    name: requireString(customer.name, 'customer.name'),
    email: requireEmail(customer.email, 'customer.email'),
    state: requireState(customer.state, 'customer.state'),
  };
}

export function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('O pedido precisa de pelo menos um item.', { field: 'items' });
  }
  const merged = new Map();
  for (const [index, item] of items.entries()) {
    const sku = requireString(item?.sku, `items[${index}].sku`).toUpperCase();
    const quantity = requirePositiveInt(item?.quantity, `items[${index}].quantity`);
    merged.set(sku, (merged.get(sku) ?? 0) + quantity);
  }
  return [...merged].map(([sku, quantity]) => ({ sku, quantity }));
}
