import { useEffect, useState } from 'react';
import { Eye, Printer, Search, X } from 'lucide-react';
import type { FulfillmentStage, Order, PaymentStatus } from '../types';
import {
  FULFILLMENT_STAGE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatBRL,
  formatDateTimeBR,
} from '../utils/format';

interface AdminSalesProps {
  token: string;
  initialStage?: string;
}

const STAGES: Array<{ id: FulfillmentStage; title: string; subtitle: string }> = [
  {
    id: 'aguardando_separo',
    title: '1. Pedido Aguardando Separo',
    subtitle: 'Pedidos aguardando conferência e separação das peças',
  },
  {
    id: 'separado',
    title: '2. Pedido Separado',
    subtitle: 'Conferidos, embalados e prontos para despacho',
  },
  {
    id: 'despachado',
    title: '3. Pedido Despachado',
    subtitle: 'Enviados com código e link de rastreamento',
  },
  {
    id: 'entregue',
    title: '4. Pedido Entregue',
    subtitle: 'Histórico completo de pedidos entregues ao cliente',
  },
];

export function AdminSales({ token, initialStage = 'aguardando_separo' }: AdminSalesProps) {
  const [activeStage, setActiveStage] = useState<string>(initialStage);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [carrierInput, setCarrierInput] = useState('');
  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [trackingUrlInput, setTrackingUrlInput] = useState('');
  const [packagingNotesInput, setPackagingNotesInput] = useState('');
  const [internalNotesInput, setInternalNotesInput] = useState('');
  const [savingStage, setSavingStage] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setOrders(data.orders || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [token, dateFrom, dateTo]);

  useEffect(() => {
    if (initialStage) setActiveStage(initialStage);
  }, [initialStage]);

  const openDetail = (order: Order) => {
    setSelectedOrder(order);
    setCarrierInput(order.carrier || 'Correios');
    setTrackingCodeInput(order.tracking_code || '');
    setTrackingUrlInput(order.tracking_url || '');
    setPackagingNotesInput(order.packaging_notes || '');
    setInternalNotesInput(order.internal_notes || '');
  };

  const moveStage = async (
    orderId: number,
    nextStage: FulfillmentStage,
    extra?: {
      carrier?: string;
      tracking_code?: string;
      tracking_url?: string;
      packaging_notes?: string;
      internal_notes?: string;
    }
  ) => {
    setSavingStage(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/stage`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fulfillment_stage: nextStage,
          ...extra,
        }),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(data.order);
        }
      }
    } finally {
      setSavingStage(false);
    }
  };

  const updatePaymentStatus = async (orderId: number, status: PaymentStatus) => {
    const res = await fetch(`/api/admin/orders/${orderId}/payment-status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment_status: status }),
    });
    const data = await res.json();
    if (res.ok && data.order) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
      if (selectedOrder?.id === orderId) setSelectedOrder(data.order);
    }
  };

  const visibleOrders = orders.filter((o) => {
    const matchesStage = activeStage === 'todos' || o.fulfillment_stage === activeStage;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      o.order_number.toLowerCase().includes(q) ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q);
    return matchesStage && matchesSearch;
  });

  const countByStage = (stage: FulfillmentStage) =>
    orders.filter((o) => o.fulfillment_stage === stage).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#231A18]">Vendas & Separação</h1>
          <p className="text-xs text-[#7A635D]">
            Fluxo completo de pedidos em quatro etapas salvas no banco de dados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8C706A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pedido ou cliente..."
              className="bg-white border border-[#DFD2CA] pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#B76E79]"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white border border-[#DFD2CA] px-2.5 py-1.5 text-xs"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white border border-[#DFD2CA] px-2.5 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* 4 Stage Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 no-print">
        {STAGES.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setActiveStage(stage.id)}
            className={`p-3.5 text-left border transition-colors cursor-pointer ${
              activeStage === stage.id
                ? 'bg-[#231A18] text-white border-[#231A18]'
                : 'bg-white text-[#231A18] border-[#EAE0DA] hover:border-[#B76E79]'
            }`}
          >
            <p className="text-xs font-medium">{stage.title}</p>
            <p
              className={`text-xl font-semibold tabular-nums mt-1 ${
                activeStage === stage.id ? 'text-[#F4D9DD]' : 'text-[#8E4F59]'
              }`}
            >
              {countByStage(stage.id)}
            </p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveStage('todos')}
          className={`p-3.5 text-left border transition-colors cursor-pointer ${
            activeStage === 'todos'
              ? 'bg-[#231A18] text-white border-[#231A18]'
              : 'bg-white text-[#231A18] border-[#EAE0DA] hover:border-[#B76E79]'
          }`}
        >
          <p className="text-xs font-medium">Todos os Pedidos</p>
          <p
            className={`text-xl font-semibold tabular-nums mt-1 ${
              activeStage === 'todos' ? 'text-[#F4D9DD]' : 'text-[#231A18]'
            }`}
          >
            {orders.length}
          </p>
        </button>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="bg-white border border-[#EAE0DA] p-8 text-center text-sm text-[#7A635D] no-print">
          Carregando pedidos...
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="bg-white border border-[#EAE0DA] p-12 text-center space-y-2 no-print">
          <p className="font-display text-2xl text-[#231A18]">Nenhum pedido nesta etapa</p>
          <p className="text-xs text-[#7A635D]">
            Os pedidos realizados na loja aparecerão aqui automaticamente conforme o fluxo de
            separação.
          </p>
        </div>
      ) : (
        <div className="space-y-4 no-print">
          {visibleOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-[#EAE0DA] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-mono font-semibold text-[#231A18] tabular-nums">
                    #{order.order_number}
                  </span>
                  <span className="text-[#8C706A]">·</span>
                  <span className="font-medium text-[#231A18]">{order.customer_name}</span>
                  <span className="text-[#8C706A]">·</span>
                  <span className="text-[#7A635D] tabular-nums">
                    {formatDateTimeBR(order.created_at)}
                  </span>
                  <span className="text-[#8C706A]">·</span>
                  <span
                    className={`font-medium ${
                      order.payment_status === 'pago'
                        ? 'text-[#2D6A4F]'
                        : order.payment_status === 'recusado' || order.payment_status === 'cancelado'
                          ? 'text-[#B53A3A]'
                          : 'text-[#9A6700]'
                    }`}
                  >
                    {PAYMENT_METHOD_LABELS[order.payment_method]} ·{' '}
                    {PAYMENT_STATUS_LABELS[order.payment_status]}
                  </span>
                </div>

                <div className="text-xs text-[#5D4742] space-y-0.5">
                  {order.items.map((item) => (
                    <p key={item.id}>
                      <span className="tabular-nums font-medium">{item.quantity}x</span>{' '}
                      {item.product_name}
                      {item.variation_label ? ` (${item.variation_label})` : ''}
                    </p>
                  ))}
                </div>

                <p className="text-xs text-[#7A635D]">
                  Envio: {order.street}, {order.number} · {order.city}/{order.state} (CEP{' '}
                  {order.cep})
                  {order.tracking_code ? ` · Rastreio: ${order.tracking_code}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="text-right mr-2">
                  <p className="text-[11px] text-[#8C706A]">Total</p>
                  <p className="text-base font-semibold text-[#231A18] tabular-nums">
                    {formatBRL(order.total_cents)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openDetail(order)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#DFD2CA] text-xs font-medium text-[#231A18] hover:bg-[#FAF8F6] cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Detalhes</span>
                </button>

                {order.fulfillment_stage === 'aguardando_separo' && (
                  <button
                    type="button"
                    disabled={savingStage}
                    onClick={() => moveStage(order.id, 'separado')}
                    className="px-4 py-2 bg-[#231A18] text-white text-xs font-medium hover:bg-[#8E4F59] cursor-pointer"
                  >
                    Separar pedido
                  </button>
                )}

                {order.fulfillment_stage === 'separado' && (
                  <button
                    type="button"
                    disabled={savingStage}
                    onClick={() => openDetail(order)}
                    className="px-4 py-2 bg-[#231A18] text-white text-xs font-medium hover:bg-[#8E4F59] cursor-pointer"
                  >
                    Marcar como despachado
                  </button>
                )}

                {order.fulfillment_stage === 'despachado' && (
                  <button
                    type="button"
                    disabled={savingStage}
                    onClick={() => moveStage(order.id, 'entregue')}
                    className="px-4 py-2 bg-[#2D6A4F] text-white text-xs font-medium hover:bg-[#24553F] cursor-pointer"
                  >
                    Confirmar entrega
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail & Print Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6D9D1] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#EAE0DA]">
              <div>
                <p className="text-xs text-[#8E4F59] uppercase tracking-wider">
                  {FULFILLMENT_STAGE_LABELS[selectedOrder.fulfillment_stage]}
                </p>
                <h2 className="font-display text-3xl font-semibold text-[#231A18] tabular-nums">
                  Pedido #{selectedOrder.order_number}
                </h2>
                <p className="text-xs text-[#7A635D]">
                  Compra em {formatDateTimeBR(selectedOrder.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#DFD2CA] text-xs font-medium text-[#231A18] hover:bg-[#FAF8F6] cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Separação</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 text-[#6B544F] hover:text-[#231A18] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#FAF8F6] border border-[#EAE0DA] space-y-1">
                <p className="font-semibold text-[#231A18]">Dados do Cliente</p>
                <p>{selectedOrder.customer_name}</p>
                <p className="tabular-nums">CPF: {selectedOrder.customer_cpf}</p>
                <p className="tabular-nums">Tel: {selectedOrder.customer_phone}</p>
                <p>{selectedOrder.customer_email}</p>
              </div>
              <div className="p-4 bg-[#FAF8F6] border border-[#EAE0DA] space-y-1">
                <p className="font-semibold text-[#231A18]">Endereço de Entrega</p>
                <p>
                  {selectedOrder.street}, {selectedOrder.number}{' '}
                  {selectedOrder.complement ? `(${selectedOrder.complement})` : ''}
                </p>
                <p>
                  {selectedOrder.neighborhood} · {selectedOrder.city}/{selectedOrder.state}
                </p>
                <p className="tabular-nums">CEP: {selectedOrder.cep}</p>
                <p>Frete: {selectedOrder.shipping_label}</p>
              </div>
            </div>

            {/* Items for Picking / Conferência */}
            <div className="border border-[#EAE0DA]">
              <div className="bg-[#FAF8F6] px-4 py-2.5 border-b border-[#EAE0DA] text-xs font-semibold text-[#231A18]">
                Itens para Separação
              </div>
              <div className="divide-y divide-[#F2EAE4]">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-[#231A18]">{item.product_name}</p>
                      <p className="text-[#7A635D] font-mono">
                        SKU: {item.product_sku}
                        {item.variation_label ? ` · ${item.variation_label}` : ''}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold text-[#231A18]">Qtd: {item.quantity}</p>
                      <p className="text-[#7A635D]">{formatBRL(item.total_cents)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals & Payment Control */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 border border-[#EAE0DA] space-y-1.5 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#7A635D]">Subtotal</span>
                  <span>{formatBRL(selectedOrder.subtotal_cents)}</span>
                </div>
                {selectedOrder.discount_cents > 0 && (
                  <div className="flex justify-between text-[#2D6A4F]">
                    <span>
                      Desconto {selectedOrder.coupon_code ? `(${selectedOrder.coupon_code})` : ''}
                    </span>
                    <span>-{formatBRL(selectedOrder.discount_cents)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#7A635D]">Frete</span>
                  <span>{formatBRL(selectedOrder.shipping_cents)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm text-[#231A18] pt-1.5 border-t border-[#EAE0DA]">
                  <span>Total</span>
                  <span>{formatBRL(selectedOrder.total_cents)}</span>
                </div>
              </div>

              <div className="p-4 border border-[#EAE0DA] space-y-2 no-print">
                <p className="font-semibold text-[#231A18]">
                  Pagamento ({PAYMENT_METHOD_LABELS[selectedOrder.payment_method]})
                </p>
                <select
                  value={selectedOrder.payment_status}
                  onChange={(e) =>
                    updatePaymentStatus(selectedOrder.id, e.target.value as PaymentStatus)
                  }
                  className="w-full border border-[#DFD2CA] px-3 py-2 text-xs bg-white"
                >
                  <option value="aguardando_pagamento">Aguardando pagamento</option>
                  <option value="pago">Pago</option>
                  <option value="recusado">Pagamento recusado</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="reembolsado">Reembolsado</option>
                </select>
              </div>
            </div>

            {/* Logistics, Packaging & Stage Action */}
            <div className="p-4 bg-[#FAF8F6] border border-[#EAE0DA] space-y-3 text-xs no-print">
              <p className="font-semibold text-[#231A18]">Logística, Embalagem & Rastreamento</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#5D4742] mb-1">Transportadora</label>
                  <input
                    type="text"
                    value={carrierInput}
                    onChange={(e) => setCarrierInput(e.target.value)}
                    placeholder="Correios / Jadlog"
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[#5D4742] mb-1">Código de rastreamento</label>
                  <input
                    type="text"
                    value={trackingCodeInput}
                    onChange={(e) => setTrackingCodeInput(e.target.value.toUpperCase())}
                    placeholder="AA123456789BR"
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#5D4742] mb-1">Link de rastreamento</label>
                  <input
                    type="url"
                    value={trackingUrlInput}
                    onChange={(e) => setTrackingUrlInput(e.target.value)}
                    placeholder="https://rastreamento.correios.com.br/..."
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#5D4742] mb-1">Informações de embalagem</label>
                  <input
                    type="text"
                    value={packagingNotesInput}
                    onChange={(e) => setPackagingNotesInput(e.target.value)}
                    placeholder="Caixa presenteável + certificado Lessenza.Vero"
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[#5D4742] mb-1">Observações internas</label>
                  <input
                    type="text"
                    value={internalNotesInput}
                    onChange={(e) => setInternalNotesInput(e.target.value)}
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      disabled={savingStage}
                      onClick={() =>
                        moveStage(selectedOrder.id, st.id, {
                          carrier: carrierInput,
                          tracking_code: trackingCodeInput,
                          tracking_url: trackingUrlInput,
                          packaging_notes: packagingNotesInput,
                          internal_notes: internalNotesInput,
                        })
                      }
                      className={`px-3 py-2 border text-xs font-medium cursor-pointer ${
                        selectedOrder.fulfillment_stage === st.id
                          ? 'bg-[#231A18] text-white border-[#231A18]'
                          : 'bg-white text-[#231A18] border-[#DFD2CA] hover:border-[#231A18]'
                      }`}
                    >
                      {st.id === 'despachado' ? 'Registrar envio' : FULFILLMENT_STAGE_LABELS[st.id]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stage History */}
            {selectedOrder.history && selectedOrder.history.length > 0 && (
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-[#231A18]">Histórico das etapas</p>
                <div className="border border-[#EAE0DA] divide-y divide-[#F2EAE4]">
                  {selectedOrder.history.map((h) => (
                    <div key={h.id} className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[#231A18]">{h.note}</p>
                        <p className="text-[11px] text-[#8C706A]">Por: {h.changed_by}</p>
                      </div>
                      <span className="text-[11px] text-[#7A635D] tabular-nums shrink-0">
                        {formatDateTimeBR(h.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
