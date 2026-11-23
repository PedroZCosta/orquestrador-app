/**
 * Parâmetros de negócio. Alíquotas simplificadas (uma por estado) e frete por
 * região com valor base mais um adicional por quilo, arredondado para cima.
 */
export const STATES = Object.freeze({
  SP: { taxRate: 0.18, region: 'sudeste' },
  RJ: { taxRate: 0.2, region: 'sudeste' },
  MG: { taxRate: 0.18, region: 'sudeste' },
  ES: { taxRate: 0.17, region: 'sudeste' },
  PR: { taxRate: 0.195, region: 'sul' },
  SC: { taxRate: 0.17, region: 'sul' },
  RS: { taxRate: 0.17, region: 'sul' },
  BA: { taxRate: 0.205, region: 'nordeste' },
  PE: { taxRate: 0.205, region: 'nordeste' },
  CE: { taxRate: 0.2, region: 'nordeste' },
  AM: { taxRate: 0.2, region: 'norte' },
  PA: { taxRate: 0.19, region: 'norte' },
  DF: { taxRate: 0.2, region: 'centro-oeste' },
  GO: { taxRate: 0.19, region: 'centro-oeste' },
});

export const SHIPPING = Object.freeze({
  baseByRegion: { sudeste: 15, sul: 18, nordeste: 25, norte: 32, 'centro-oeste': 22 },
  perKgByRegion: { sudeste: 4.5, sul: 5, nordeste: 7.25, norte: 9.8, 'centro-oeste': 6.4 },
  freeShippingThreshold: 299.9,
  maxWeightKg: 30,
});

export const PAYMENT = Object.freeze({
  maxAttempts: 3,
  backoffMs: [200, 400],
  methods: ['credit_card', 'pix', 'boleto'],
});

export const LOW_STOCK_THRESHOLD = 5;

export const STORE = Object.freeze({
  name: 'Loja Dev',
  supportEmail: 'atendimento@lojadev.example',
});
