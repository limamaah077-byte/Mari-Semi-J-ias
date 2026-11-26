import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import type { Order, StoreSettings } from '../types';
import {
  FULFILLMENT_STAGE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatBRL,
  formatDateTimeBR,
  isSafeHttpUrl,
} from '../utils/format';

interface OrderTrackingPageProps {
  orderNumber: string;
  initialOrder?: Order | null;
  paymentWarning?: string;
  settings: StoreSettings;
  onNavigate: (path: string) => void;
}

export function OrderTrackingPage({
  orderNumber,
  initialOrder,
  paymentWarning,
  settings,
  onNavigate,
}: OrderTrackingPageProps) {
  const [order, setOrder] = useState<Order | null>(initialOrder ?? null);
  const [loading, setLoading] = useState(!initialOrder);
  const [copied, setCopied] = useState(false);

  const loadOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    const timer = setInterval(() => {
      if (order?.payment_status === 'aguardando_pagamento') {
        loadOrder();
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [orderNumber, order?.payment_status]);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center text-sm text-[#6B544F]">
        Carregando detalhes do pedido...
      </main>
    );
  }

  if (!order) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl font-semibold text-[#231A18]">
          Pedido não encontrado
        </h1>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="px-6 py-3 bg-[#231A18] text-white text-sm font-medium cursor-pointer"
        >
          Voltar à loja
        </button>
      </main>
    );
  }

  const copyPix = () => {
    if (!order.pix_qr_code) return;
    navigator.clipboard.writeText(order.pix_qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="bg-white border border-[#EAE0DA] p-6 sm:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#F0E6E0]">
          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-[#8E4F59] mb-1">
              Confirmação de Pedido
            </p>
            <h1 className="font-display text-3xl font-semibold text-[#231A18] tabular-nums">
              Pedido #{order.order_number}
            </h1>
            <p className="text-xs text-[#7A635D] mt-1">
              Registrado em {formatDateTimeBR(order.created_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrder}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#DFD2CA] text-xs font-medium text-[#231A18] hover:bg-[#FAF8F6] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar status</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-3.5 bg-[#FAF8F6] border border-[#EAE0DA]">
            <p className="text-xs text-[#8C706A]">Pagamento</p>
            <p className="font-medium text-[#231A18] mt-0.5">
              {PAYMENT_METHOD_LABELS[order.payment_method]}
            </p>
          </div>
          <div className="p-3.5 bg-[#FAF8F6] border border-[#EAE0DA]">
            <p className="text-xs text-[#8C706A]">Status financeiro</p>
            <p
              className={`font-medium mt-0.5 ${
                order.payment_status === 'pago'
                  ? 'text-[#2D6A4F]'
                  : order.payment_status === 'recusado' || order.payment_status === 'cancelado'
                    ? 'text-[#B53A3A]'
                    : 'text-[#9A6700]'
              }`}
            >
              {PAYMENT_STATUS_LABELS[order.payment_status]}
            </p>
          </div>
          <div className="p-3.5 bg-[#FAF8F6] border border-[#EAE0DA]">
            <p className="text-xs text-[#8C706A]">Etapa do pedido</p>
            <p className="font-medium text-[#231A18] mt-0.5">
              {FULFILLMENT_STAGE_LABELS[order.fulfillment_stage]}
            </p>
          </div>
        </div>

        {paymentWarning && (
          <div className="p-4 bg-[#FFF8EB] border border-[#F0D9A7] text-xs text-[#7B5200]">
            {paymentWarning} Caso precise finalizar o pagamento manualmente ou tirar dúvidas, fale
            conosco pelo WhatsApp {settings.whatsapp_display}.
          </div>
        )}

        {/* Real PIX QR Code */}
        {order.payment_method === 'pix' &&
          order.payment_status === 'aguardando_pagamento' &&
          order.pix_qr_code && (
            <div className="p-6 bg-[#FAF8F6] border border-[#E5D7CE] flex flex-col sm:flex-row items-center gap-6">
              {order.pix_qr_code_base64 && (
                <img
                  src={`data:image/png;base64,${order.pix_qr_code_base64}`}
                  alt="QR Code PIX"
                  className="w-44 h-44 bg-white p-2 border border-[#DFD2CA]"
                />
              )}
              <div className="flex-1 space-y-3 w-full">
                <h2 className="font-display text-2xl font-semibold text-[#231A18]">
                  Pague com PIX
                </h2>
                <p className="text-xs text-[#5D4742]">
                  Escaneie o QR Code no aplicativo do seu banco ou copie o código PIX abaixo. A
                  confirmação é automática.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={order.pix_qr_code}
                    className="flex-1 bg-white border border-[#DFD2CA] px-3 py-2 text-xs font-mono text-[#231A18]"
                  />
                  <button
                    type="button"
                    onClick={copyPix}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#231A18] text-white text-xs font-medium cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Real Checkout Pro Link (Credit/Debit) */}
        {order.payment_method !== 'pix' &&
          order.payment_status === 'aguardando_pagamento' &&
          isSafeHttpUrl(order.checkout_url) && (
            <div className="p-6 bg-[#FAF8F6] border border-[#E5D7CE] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#231A18]">
                  Concluir pagamento seguro
                </h2>
                <p className="text-xs text-[#5D4742] mt-1">
                  Clique no botão ao lado para finalizar seu pagamento no ambiente protegido do
                  Mercado Pago.
                </p>
              </div>
              <a
                href={order.checkout_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#231A18] text-white text-xs font-medium hover:bg-[#8E4F59] whitespace-nowrap shrink-0"
              >
                <span>Pagar agora</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

        {/* Rastreamento */}
        {order.tracking_code && (
          <div className="p-5 bg-[#F9EFF0] border border-[#EAD4D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-[#8E4F59] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-[#231A18]">
                  Código de rastreamento {order.carrier ? `(${order.carrier})` : ''}
                </p>
                <p className="font-mono text-sm font-semibold text-[#231A18] mt-0.5">
                  {order.tracking_code}
                </p>
              </div>
            </div>
            {isSafeHttpUrl(order.tracking_url) && (
              <a
                href={order.tracking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#231A18] text-white text-xs font-medium whitespace-nowrap shrink-0"
              >
                <span>Rastrear entrega</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Itens & Endereço */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#EAE0DA] p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#231A18] flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#B76E79]" />
            <span>Peças do Pedido</span>
          </h2>
          <div className="space-y-3 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 pb-2.5 border-b border-[#F3ECE8]">
                <div>
                  <p className="font-medium text-[#231A18]">{item.product_name}</p>
                  <p className="text-xs text-[#7A635D] tabular-nums">
                    {item.variation_label ? `${item.variation_label} · ` : ''}Qtd: {item.quantity}
                  </p>
                </div>
                <span className="font-medium text-[#231A18] tabular-nums">
                  {formatBRL(item.total_cents)}
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm pt-2 tabular-nums">
            <div className="flex justify-between text-[#5D4742]">
              <span>Subtotal</span>
              <span>{formatBRL(order.subtotal_cents)}</span>
            </div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between text-[#3B6E4C]">
                <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
                <span>-{formatBRL(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#5D4742]">
              <span>Frete ({order.shipping_label})</span>
              <span>{order.shipping_cents === 0 ? 'Grátis' : formatBRL(order.shipping_cents)}</span>
            </div>
            <div className="flex justify-between font-semibold text-[#231A18] pt-2 border-t border-[#EAE0DA]">
              <span>Total</span>
              <span>{formatBRL(order.total_cents)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#EAE0DA] p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">Entrega</h2>
          <div className="text-sm text-[#5D4742] space-y-1">
            <p className="font-medium text-[#231A18]">{order.customer_name}</p>
            <p>
              {order.street}, {order.number} {order.complement ? `· ${order.complement}` : ''}
            </p>
            <p>
              {order.neighborhood} · {order.city}/{order.state}
            </p>
            <p className="tabular-nums">CEP: {order.cep}</p>
          </div>
          <div className="pt-4 border-t border-[#F0E6E0] text-xs text-[#7A635D]">
            <p>Dúvidas sobre o seu pedido?</p>
            <a
              href={`https://wa.me/${settings.whatsapp_phone}?text=${encodeURIComponent(
                `Olá! Gostaria de informações sobre o pedido #${order.order_number}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-1.5 font-medium text-[#231A18] border-b border-[#B76E79]"
            >
              Falar no WhatsApp {settings.whatsapp_display}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
