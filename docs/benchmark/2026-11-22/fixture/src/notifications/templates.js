import { STORE } from '../config.js';

function price(value) {
  const [integer, decimals] = (Math.round(value * 100) / 100).toFixed(2).split('.');
  return `R$ ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimals}`;
}

function signature() {
  return `\n\n${STORE.name}\nDúvidas: ${STORE.supportEmail}`;
}

/**
 * Textos das mensagens ao cliente, por evento. Cada um devolve
 * `{ subject, body }`.
 */
export const TEMPLATES = {
  'order.placed': ({ orderId, name, total }) => ({
    subject: `Pedido ${orderId} recebido`,
    body: `Olá, ${name}! Recebemos o seu pedido ${orderId}, no valor de ${price(total)}. Assim que o pagamento for aprovado, avisaremos.${signature()}`,
  }),
  'order.paid': ({ orderId, name, total }) => ({
    subject: `Pedido ${orderId} confirmado`,
    body: `Olá, ${name}! O pagamento de ${price(total)} do pedido ${orderId} foi aprovado. Já estamos separando os itens.${signature()}`,
  }),
  'payment.failed': ({ orderId, name, reason }) => ({
    subject: `Pagamento do pedido ${orderId} não aprovado`,
    body: `Olá, ${name}. Não conseguimos aprovar o pagamento do pedido ${orderId} (${reason}). Os itens voltaram ao estoque; faça um novo pedido quando quiser.${signature()}`,
  }),
  'order.shipped': ({ orderId, name, trackingCode }) => ({
    subject: `Pedido ${orderId} enviado`,
    body: `Olá, ${name}! O pedido ${orderId} saiu para entrega. Código de rastreio: ${trackingCode}.${signature()}`,
  }),
  'order.delivered': ({ orderId, name }) => ({
    subject: `Pedido ${orderId} entregue`,
    body: `Olá, ${name}! O pedido ${orderId} foi entregue. Bom proveito!${signature()}`,
  }),
};
