/**
 * Relatório de vendas de um período.
 *
 * Entram os pedidos criados em [from, to) (datas ISO, comparadas em UTC).
 * Pedidos com pagamento recusado não são venda e ficam de fora.
 */
export function salesReport(orders, { from, to } = {}) {
  const start = from === undefined ? -Infinity : Date.parse(from);
  const end = to === undefined ? Infinity : Date.parse(to);
  const counted = orders
    .filter((order) => order.status !== 'payment_failed')
    .filter((order) => {
      const created = Date.parse(order.createdAt);
      return created >= start && created < end;
    });

  const revenue = Math.round(counted.reduce((sum, order) => sum + order.totals.total, 0) * 100) / 100;
  const discounts = Math.round(counted.reduce((sum, order) => sum + order.totals.discount, 0) * 100) / 100;
  const averageTicket = counted.length === 0 ? 0 : Math.round((revenue / counted.length) * 100) / 100;

  const bySku = {};
  for (const order of counted) {
    for (const line of order.lines) {
      const entry = bySku[line.sku] ?? { sku: line.sku, name: line.name, quantity: 0, revenue: 0 };
      entry.quantity += line.quantity;
      entry.revenue = Math.round((entry.revenue + line.lineTotal) * 100) / 100;
      bySku[line.sku] = entry;
    }
  }

  const byState = {};
  for (const order of counted) {
    const state = order.customer.state;
    const entry = byState[state] ?? { state, orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue = Math.round((entry.revenue + order.totals.total) * 100) / 100;
    byState[state] = entry;
  }

  const topProducts = Object.values(bySku)
    .sort((a, b) => b.revenue - a.revenue || a.sku.localeCompare(b.sku))
    .slice(0, 5);

  return {
    orderCount: counted.length,
    revenue,
    discounts,
    averageTicket,
    bySku,
    byState,
    topProducts,
  };
}

/** O relatório em texto, para o e-mail diário. */
export function formatReport(report) {
  const brl = (value) => {
    const fixed = value.toFixed(2);
    const [integer, decimals] = fixed.split('.');
    return 'R$ ' + integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimals;
  };
  const lines = [
    `Pedidos: ${report.orderCount}`,
    `Receita: ${brl(report.revenue)}`,
    `Descontos concedidos: ${brl(report.discounts)}`,
    `Ticket médio: ${brl(report.averageTicket)}`,
    '',
    'Mais vendidos:',
    ...report.topProducts.map(
      (item, index) => `${index + 1}. ${item.name} (${item.sku}): ${item.quantity} un., ${brl(item.revenue)}`,
    ),
  ];
  return lines.join('\n');
}
