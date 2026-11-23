/** Catálogo e estoque iniciais da loja (usados pela aplicação e pelos testes). */
export const SEED_PRODUCTS = [
  { sku: 'LIV-001', name: 'Livro: Arquitetura Limpa', price: 89.9, weightKg: 0.6, category: 'livros' },
  { sku: 'LIV-002', name: 'Livro: Domain-Driven Design', price: 129.5, weightKg: 0.9, category: 'livros' },
  { sku: 'LIV-003', name: 'Livro: Refatoração', price: 99, weightKg: 0.8, category: 'livros' },
  { sku: 'CAN-010', name: 'Caneca Dev', price: 39.9, weightKg: 0.4, category: 'acessorios' },
  { sku: 'CAM-020', name: 'Camiseta Node', price: 59.9, weightKg: 0.3, category: 'vestuario' },
  { sku: 'MOU-030', name: 'Mouse sem fio', price: 149, weightKg: 0.2, category: 'eletronicos' },
  { sku: 'TEC-040', name: 'Teclado mecânico', price: 459, weightKg: 1.2, category: 'eletronicos' },
  { sku: 'MON-050', name: 'Monitor 27 polegadas', price: 1899, weightKg: 6.5, category: 'eletronicos' },
  { sku: 'ADE-060', name: 'Adesivos (pacote)', price: 12.5, weightKg: 0.05, category: 'acessorios' },
  { sku: 'BON-070', name: 'Boné Dev (fora de linha)', price: 49.9, weightKg: 0.2, category: 'vestuario', active: false },
];

export const SEED_STOCK = {
  'LIV-001': 20,
  'LIV-002': 12,
  'LIV-003': 20,
  'CAN-010': 30,
  'CAM-020': 25,
  'MOU-030': 15,
  'TEC-040': 8,
  'MON-050': 3,
  'ADE-060': 100,
  'BON-070': 0,
};
