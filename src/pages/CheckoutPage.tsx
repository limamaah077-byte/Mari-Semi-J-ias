import { useEffect, useState } from 'react';
import { CreditCard, Lock, QrCode, Tag, Truck } from 'lucide-react';
import type { CartItem, Order, PaymentMethod, ShippingQuote, StoreSettings } from '../types';
import { formatBRL, maskCEP, maskCPF, maskPhone } from '../utils/format';
import { JewelryImage } from '../components/JewelryImage';

interface CheckoutPageProps {
  items: CartItem[];
  settings: StoreSettings;
  onOrderCreated: (order: Order, paymentWarning?: string) => void;
  onBackToStore: () => void;
}

export function CheckoutPage({
  items,
  settings,
  onOrderCreated,
  onBackToStore,
}: CheckoutPageProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const [cep, setCep] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [cepLoading, setCepLoading] = useState(false);

  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_cents: number;
    free_shipping: boolean;
  } | null>(null);
  const [couponError, setCouponError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const subtotalCents = items.reduce(
    (sum, i) => sum + i.product.effective_price_cents * i.quantity,
    0
  );

  const selectedQuote = quotes.find((q) => q.method === selectedShippingMethod) || quotes[0];
  const shippingCents = selectedQuote ? selectedQuote.price_cents : 0;
  const discountCents = appliedCoupon ? appliedCoupon.discount_cents : 0;
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

  const fetchShipping = async (cleanCep: string, couponCode?: string) => {
    if (cleanCep.length !== 8) return;
    setShippingLoading(true);
    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cep: cleanCep,
          subtotal_cents: subtotalCents,
          coupon_code: couponCode ?? appliedCoupon?.code ?? '',
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.quotes)) {
        setQuotes(data.quotes);
        if (data.quotes.length > 0 && !data.quotes.some((q: ShippingQuote) => q.method === selectedShippingMethod)) {
          setSelectedShippingMethod(data.quotes[0].method);
        }
      }
    } finally {
      setShippingLoading(false);
    }
  };

  useEffect(() => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      setCepLoading(true);
      fetch(`/api/cep/${clean}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.address) {
            setState(data.address.state);
            setCity(data.address.city);
            setNeighborhood(data.address.neighborhood);
            setStreet(data.address.street);
          }
        })
        .finally(() => setCepLoading(false));
      fetchShipping(clean);
    }
  }, [cep]);

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponInput.trim()) return;
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotal_cents: subtotalCents,
          customer_identifier: customerCpf.replace(/\D/g, '') || customerEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || 'Cupom inválido.');
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({
        code: data.coupon.code,
        discount_cents: data.discount_cents,
        free_shipping: data.free_shipping,
      });
      const clean = cep.replace(/\D/g, '');
      if (clean.length === 8) {
        await fetchShipping(clean, data.coupon.code);
      }
    } catch {
      setCouponError('Não foi possível validar o cupom.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          customer_cpf: customerCpf,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          cep,
          state,
          city,
          neighborhood,
          street,
          number,
          complement,
          shipping_method: selectedQuote?.method || 'correios_pac',
          coupon_code: appliedCoupon?.code || '',
          payment_method: paymentMethod,
          items: items.map((i) => ({
            product_id: i.product.id,
            variation_label: i.variation_label,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível concluir o pedido.');
        return;
      }
      onOrderCreated(data.order, data.payment_warning);
    } catch {
      setError('Erro de conexão ao registrar o pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold text-[#231A18] mb-3">
          Sua sacola está vazia
        </h1>
        <p className="text-sm text-[#6B544F] mb-6">
          Adicione semijoias à sacola antes de seguir para o pagamento.
        </p>
        <button
          type="button"
          onClick={onBackToStore}
          className="px-6 py-3 bg-[#231A18] text-white text-sm font-medium cursor-pointer"
        >
          Voltar à loja
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-6 border-b border-[#EAE0DA] mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59] mb-1">Finalização Segura</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#231A18]">
            Checkout
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#6B544F]">
          <Lock className="w-3.5 h-3.5 text-[#B76E79]" />
          <span>Ambiente criptografado</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-8">
          {/* Dados Pessoais */}
          <section className="bg-white border border-[#EAE0DA] p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">1. Seus Dados</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">Nome completo *</label>
                <input
                  required
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5D4742] mb-1">CPF *</label>
                <input
                  required
                  type="text"
                  value={customerCpf}
                  onChange={(e) => setCustomerCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5D4742] mb-1">WhatsApp / Telefone *</label>
                <input
                  required
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">E-mail *</label>
                <input
                  required
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
            </div>
          </section>

          {/* Endereço e Frete */}
          <section className="bg-white border border-[#EAE0DA] p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">
              2. Entrega para todo o Brasil
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">CEP *</label>
                <input
                  required
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(maskCEP(e.target.value))}
                  placeholder="00000-000"
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm tabular-nums focus:outline-none focus:border-[#B76E79]"
                />
                {cepLoading && <p className="text-[11px] text-[#8C706A] mt-1">Buscando CEP...</p>}
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">UF *</label>
                <input
                  required
                  type="text"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className="w-full border border-[#DFD2CA] px-3 py-2.5 text-sm uppercase focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">Cidade *</label>
                <input
                  required
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">Bairro *</label>
                <input
                  required
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">Rua / Logradouro *</label>
                <input
                  required
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">Número *</label>
                <input
                  required
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-[#5D4742] mb-1">Complemento</label>
                <input
                  type="text"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  placeholder="Apto, bloco, referência"
                  className="w-full border border-[#DFD2CA] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#B76E79]"
                />
              </div>
            </div>

            {shippingLoading && (
              <p className="text-xs text-[#8C706A] pt-2">Calculando modalidades de frete...</p>
            )}

            {quotes.length > 0 && (
              <div className="pt-3 space-y-2">
                <p className="text-xs font-medium text-[#231A18] flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#B76E79]" />
                  <span>Modalidade de envio</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quotes.map((q) => (
                    <label
                      key={q.method}
                      className={`flex items-center justify-between p-3.5 border cursor-pointer transition-colors ${
                        selectedQuote?.method === q.method
                          ? 'border-[#231A18] bg-[#FAF8F6]'
                          : 'border-[#E5D7CE] hover:border-[#B76E79]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="shipping_method"
                          checked={selectedQuote?.method === q.method}
                          onChange={() => setSelectedShippingMethod(q.method)}
                          className="accent-[#231A18]"
                        />
                        <div>
                          <p className="text-xs font-medium text-[#231A18]">{q.label}</p>
                          <p className="text-[11px] text-[#7A635D]">
                            Prazo estimado: {q.estimated_days} dias úteis
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#231A18] tabular-nums">
                        {q.price_cents === 0 ? 'Grátis' : formatBRL(q.price_cents)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Forma de Pagamento */}
          <section className="bg-white border border-[#EAE0DA] p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">
              3. Forma de Pagamento
            </h2>
            <p className="text-xs text-[#6B544F]">
              Processamento oficial via Mercado Pago com confirmação automática por webhook.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  {
                    id: 'pix',
                    label: 'PIX',
                    desc: 'QR Code e Copia e Cola',
                    icon: QrCode,
                  },
                  {
                    id: 'credit_card',
                    label: 'Cartão de Crédito',
                    desc: `Até ${settings.mp_max_installments}x no checkout`,
                    icon: CreditCard,
                  },
                  {
                    id: 'debit_card',
                    label: 'Cartão de Débito',
                    desc: 'Débito online seguro',
                    icon: CreditCard,
                  },
                ] as const
              ).map((pm) => {
                const Icon = pm.icon;
                return (
                  <label
                    key={pm.id}
                    className={`flex flex-col gap-1.5 p-4 border cursor-pointer transition-colors ${
                      paymentMethod === pm.id
                        ? 'border-[#231A18] bg-[#FAF8F6]'
                        : 'border-[#E5D7CE] hover:border-[#B76E79]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4 text-[#B76E79]" />
                      <input
                        type="radio"
                        name="payment_method"
                        checked={paymentMethod === pm.id}
                        onChange={() => setPaymentMethod(pm.id)}
                        className="accent-[#231A18]"
                      />
                    </div>
                    <span className="text-sm font-medium text-[#231A18]">{pm.label}</span>
                    <span className="text-[11px] text-[#7A635D]">{pm.desc}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Summary */}
        <aside className="lg:col-span-5 bg-white border border-[#EAE0DA] p-6 space-y-5 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">Resumo do Pedido</h2>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={`${item.product.id}-${item.variation_label || 'std'}`}
                className="flex items-center gap-3 pb-3 border-b border-[#F3ECE8]"
              >
                <JewelryImage
                  src={item.product.images[0]}
                  alt={item.product.name}
                  className="w-14 h-14 object-cover bg-[#F5EFEA] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#231A18] truncate">{item.product.name}</p>
                  {item.variation_label && (
                    <p className="text-[11px] text-[#8C706A]">{item.variation_label}</p>
                  )}
                  <p className="text-[11px] text-[#7A635D] tabular-nums">Qtd: {item.quantity}</p>
                </div>
                <span className="text-xs font-semibold text-[#231A18] tabular-nums">
                  {formatBRL(item.product.effective_price_cents * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Cupom */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-medium text-[#5D4742] flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#B76E79]" />
              <span>Cupom de desconto</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Ex: PRIMEIRACOMPRA"
                className="flex-1 border border-[#DFD2CA] px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:border-[#B76E79]"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                className="px-4 py-2 bg-[#F4ECE6] border border-[#DFD2CA] text-xs font-medium text-[#231A18] hover:bg-[#EAE0DA] cursor-pointer"
              >
                Aplicar
              </button>
            </div>
            {couponError && <p className="text-xs text-[#B53A3A]">{couponError}</p>}
            {appliedCoupon && (
              <p className="text-xs text-[#3B6E4C]">
                Cupom {appliedCoupon.code} aplicado (-{formatBRL(appliedCoupon.discount_cents)}
                {appliedCoupon.free_shipping ? ' + Frete Grátis' : ''}).
              </p>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-[#EAE0DA] text-sm tabular-nums">
            <div className="flex justify-between text-[#5D4742]">
              <span>Subtotal</span>
              <span>{formatBRL(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between text-[#3B6E4C]">
                <span>Desconto ({appliedCoupon?.code})</span>
                <span>-{formatBRL(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#5D4742]">
              <span>Frete ({selectedQuote ? selectedQuote.label : 'Informe o CEP'})</span>
              <span>
                {!selectedQuote
                  ? '—'
                  : shippingCents === 0
                    ? 'Grátis'
                    : formatBRL(shippingCents)}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold text-[#231A18] pt-3 border-t border-[#EAE0DA]">
              <span>Total</span>
              <span>{formatBRL(totalCents)}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#FDF2F2] border border-[#F2C6C6] text-xs text-[#A32929]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 bg-[#231A18] text-white text-sm font-medium tracking-wide hover:bg-[#8E4F59] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting ? 'Processando pedido...' : 'Confirmar e ir para pagamento'}
          </button>
        </aside>
      </form>
    </main>
  );
}
