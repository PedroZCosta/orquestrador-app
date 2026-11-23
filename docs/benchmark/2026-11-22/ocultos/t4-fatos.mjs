// Checador da T4: fatos que a resposta tem de conter. Valores conferidos rodando
// o código original (computeTotals e payOrder com o gateway sempre em timeout):
// subtotal 219,70; desconto 21,97; frete 51,60; imposto 39,55; total 288,88;
// 3 cobranças, esperas de 200 e 400 ms; status payment_failed; reserva liberada;
// e-mail "Pagamento do pedido ... não aprovado"; fora do relatório de vendas.
const num = (inteiro, decimais) => new RegExp(`(?<![\\d.,])${inteiro}[.,]${decimais}(?![\\d])`);
const perto = (a, b, dist = 120) =>
  new RegExp(`(?:${a})[\\s\\S]{0,${dist}}(?:${b})|(?:${b})[\\s\\S]{0,${dist}}(?:${a})`, 'i');

export const FATOS = [
  { id: 'subtotal', descricao: 'subtotal R$ 219,70', teste: (t) => num('219', '70?').test(t) },
  { id: 'desconto', descricao: 'desconto R$ 21,97', teste: (t) => num('21', '97').test(t) },
  { id: 'frete', descricao: 'frete R$ 51,60', teste: (t) => num('51', '60?').test(t) },
  { id: 'imposto', descricao: 'imposto R$ 39,55', teste: (t) => num('39', '55').test(t) },
  { id: 'total', descricao: 'total R$ 288,88', teste: (t) => num('288', '88').test(t) },
  {
    id: 'tentativas',
    descricao: '3 cobranças',
    teste: (t) => perto('\\b3\\b|tr[êe]s', 'tentativa|cobran[çc]a|chamada|attempt|vezes').test(t),
  },
  {
    id: 'esperas',
    descricao: 'esperas de 200 ms e 400 ms (600 ms no total)',
    teste: (t) => (/\b200\b/.test(t) && /\b400\b/.test(t)) || /\b600\s*ms\b/i.test(t),
  },
  { id: 'status', descricao: 'status payment_failed', teste: (t) => /payment_failed/.test(t) },
  {
    id: 'reserva',
    descricao: 'reserva de estoque liberada',
    teste: (t) => perto('libera|release|devolv|desfe|desfaz|volta|solta|cancela', 'reserva|estoque', 80).test(t),
  },
  {
    id: 'mensagem',
    descricao: 'mensagem de pagamento não aprovado',
    teste: (t) => /payment\.failed|n[ãa]o aprovado/i.test(t),
  },
  {
    id: 'relatorio',
    descricao: 'fora do relatório de vendas',
    teste: (t) =>
      perto('relat[óo]rio|salesReport', "n[ãa]o (entra|[ée] contad|conta|aparece|[ée] inclu|soma)|fica de fora|fora do|exclu|ignora|filtra|desconsider|payment_failed'?\\)? (fica|s[ãa]o|[ée])", 160).test(t),
  },
  { id: 'arquivo-frete', descricao: 'cita src/pricing/shipping.js', teste: (t) => /shipping\.js/.test(t) },
  { id: 'arquivo-imposto', descricao: 'cita src/pricing/tax.js', teste: (t) => /tax\.js/.test(t) },
  { id: 'arquivo-pagamento', descricao: 'cita src/payments/paymentService.js', teste: (t) => /paymentService\.js/.test(t) },
];

export function conferirFatos(resposta) {
  const texto = String(resposta ?? '');
  const resultado = FATOS.map((fato) => ({ id: fato.id, descricao: fato.descricao, ok: Boolean(fato.teste(texto)) }));
  return { ok: resultado.every((f) => f.ok), fatos: resultado, faltando: resultado.filter((f) => !f.ok).map((f) => f.descricao) };
}
