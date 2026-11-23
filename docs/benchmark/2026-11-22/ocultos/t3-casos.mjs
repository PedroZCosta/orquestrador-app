// Casos do teste oculto da T3: exercita pela API pública tudo o que arredonda
// ou formata dinheiro. O resultado do código original fica em t3-golden.json;
// depois da refatoração, o resultado tem de ser idêntico.
export async function calcularCasos(m) {
  const saida = {};
  const valores = [0, 0.005, 0.015, 1.005, 1.115, 2.675, 9.9, 10.555, 99.995, 123.456, 1234.5, 1899, 21600, 1234567.891, 0.1 + 0.2];
  saida.round2 = valores.map((v) => m.round2(v));
  saida.formatBRL = valores.map((v) => m.formatBRL(v));
  saida.sumMoney = [m.sumMoney([0.1, 0.2, 0.3]), m.sumMoney([89.9, 89.9, 39.9]), m.sumMoney([])];
  saida.percentOf = [m.percentOf(219.7, 10), m.percentOf(89.9, 15), m.percentOf(1.005, 50)];

  const catalog = m.Catalog.withSeed();
  const products = new Map(catalog.list({ activeOnly: false }).map((p) => [p.sku, p]));
  const now = new Date('2026-03-10T12:00:00Z');
  const cestas = [
    [{ sku: 'LIV-001', quantity: 2 }, { sku: 'CAN-010', quantity: 1 }],
    [{ sku: 'LIV-002', quantity: 1 }],
    [{ sku: 'LIV-003', quantity: 3 }, { sku: 'CAM-020', quantity: 2 }],
    [{ sku: 'MOU-030', quantity: 1 }, { sku: 'ADE-060', quantity: 7 }],
    [{ sku: 'TEC-040', quantity: 1 }, { sku: 'LIV-001', quantity: 1 }],
    [{ sku: 'MON-050', quantity: 2 }],
    [{ sku: 'ADE-060', quantity: 9 }, { sku: 'CAN-010', quantity: 3 }, { sku: 'LIV-002', quantity: 1 }],
    [{ sku: 'CAM-020', quantity: 1 }],
  ];
  const cupons = [undefined, 'BEMVINDO10', 'LIVROS15', 'DESC50', 'FRETEGRATIS', 'NATAL25', 'XYZ'];
  const estados = ['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'AM', 'PA', 'DF', 'GO'];
  saida.totais = [];
  for (const [i, items] of cestas.entries()) {
    for (const state of estados) {
      for (const couponCode of cupons) {
        let r;
        try {
          r = m.computeTotals({ items, products, state, couponCode, now });
        } catch (e) {
          r = { erro: e.code ?? e.message };
        }
        saida.totais.push({ i, state, couponCode: couponCode ?? null, r });
      }
    }
  }
  saida.imposto = estados.map((s) => [m.computeTax(123.45, s), m.computeTax(0.07, s), m.computeTax(1899.99, s), m.describeRate(s)]);
  saida.frete = estados.map((state) => [
    m.computeShipping({ lines: [{ weightKg: 0.33, quantity: 3 }], state, discountedSubtotal: 50 }),
    m.computeShipping({ lines: [{ weightKg: 2.2, quantity: 1 }], state, discountedSubtotal: 299.89 }),
    m.deliveryDays(state),
  ]);
  const linha = (sku, quantity, unitPrice, category) => ({ sku, quantity, unitPrice, category });
  saida.cupons = [
    m.evaluateCoupon('BEMVINDO10', [linha('CAN-010', 3, 39.9, 'acessorios')], now),
    m.evaluateCoupon('LIVROS15', [linha('LIV-001', 3, 89.9, 'livros'), linha('CAN-010', 1, 39.9, 'acessorios')], now),
    m.evaluateCoupon('LIVROS15', [linha('LIV-002', 1, 129.5, 'livros')], now),
    m.evaluateCoupon('DESC50', [linha('MON-050', 1, 1899, 'eletronicos')], now),
  ];

  const cart = new m.Cart(catalog);
  cart.add('LIV-001', 3);
  cart.add('CAN-010', 7);
  cart.add('ADE-060', 9);
  saida.carrinho = cart.summary();

  saida.alertas = [
    m.lowStockAlert({ sku: 'MON-050', available: 2 }, 1200),
    m.lowStockAlert({ sku: 'ADE-060', available: 5 }, 3.333),
    m.lowStockAlert({ sku: 'TEC-040', available: 0 }, 89999.995),
    m.lowStockAlert({ sku: 'X', available: 30 }, 10),
  ];

  // Fluxo completo: as mensagens ao cliente e o relatório.
  const gateway = new m.FakePaymentGateway({
    script: [{ ok: true }, { ok: false, retryable: false, reason: 'card_declined' }, { ok: true }, { ok: true }],
  });
  const store = m.createStore({ clock: m.createFixedClock('2026-03-10T12:00:00.000Z'), gateway, sleep: async () => {} });
  const pedidos = [
    { customer: { name: 'Ana', email: 'ana@example.com', state: 'SP' }, items: [{ sku: 'MON-050', quantity: 1 }] },
    { customer: { name: 'Bia', email: 'bia@example.com', state: 'RJ' }, items: [{ sku: 'LIV-001', quantity: 2 }, { sku: 'CAN-010', quantity: 1 }], couponCode: 'BEMVINDO10' },
    { customer: { name: 'Caio', email: 'caio@example.com', state: 'AM' }, items: [{ sku: 'TEC-040', quantity: 1 }], couponCode: 'DESC50' },
    { customer: { name: 'Duda', email: 'duda@example.com', state: 'BA' }, items: [{ sku: 'LIV-003', quantity: 1 }, { sku: 'ADE-060', quantity: 3 }], couponCode: 'LIVROS15' },
  ];
  const criados = [];
  for (const pedido of pedidos) {
    criados.push(await store.orders.placeOrder(pedido));
  }
  for (const pedido of criados) {
    await store.orders.payOrder(pedido.id, 'pix');
  }
  store.orders.shipOrder(criados[0].id, 'br1');
  store.orders.deliverOrder(criados[0].id);
  saida.mensagens = store.transport.sent.map((msg) => ({ to: msg.to, subject: msg.subject, body: msg.body }));
  saida.pedidos = criados.map((p) => ({ id: p.id, status: p.status, totals: p.totals, lines: p.lines }));
  const relatorio = m.salesReport(store.orders.listOrders());
  saida.relatorio = relatorio;
  saida.relatorioTexto = m.formatReport(relatorio);
  saida.relatorioTexto2 = m.formatReport({
    orderCount: 3,
    revenue: 1234567.8,
    discounts: 0,
    averageTicket: 411522.6,
    topProducts: [{ sku: 'MON-050', name: 'Monitor', quantity: 650, revenue: 1234350 }],
  });
  return JSON.parse(JSON.stringify(saida));
}
