import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Coupon } from '../types';
import { formatBRL, formatDateBR } from '../utils/format';

interface AdminCouponsProps {
  token: string;
}

export function AdminCoupons({ token }: AdminCouponsProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderReais, setMinOrderReais] = useState('0');
  const [maxUses, setMaxUses] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [onePerCustomer, setOnePerCustomer] = useState(false);
  const [freeShipping, setFreeShipping] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/coupons', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCoupons(data.coupons || []);
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue.replace(',', '.')) || 0,
        min_order_cents: Math.round((Number(minOrderReais.replace(',', '.')) || 0) * 100),
        max_uses: maxUses ? Number(maxUses) : null,
        valid_until: validUntil || null,
        one_per_customer: onePerCustomer,
        free_shipping: freeShipping,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao criar cupom.');
      return;
    }
    setCode('');
    setMaxUses('');
    setValidUntil('');
    await load();
  };

  const toggleActive = async (c: Coupon) => {
    await fetch(`/api/admin/coupons/${c.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    });
    await load();
  };

  const deleteCoupon = async (id: number) => {
    await fetch(`/api/admin/coupons/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-[#231A18]">Cupons de Desconto</h1>
        <p className="text-xs text-[#7A635D]">
          Crie cupons percentuais, em reais, com pedido mínimo, validade, limite de uso ou frete grátis.
        </p>
      </div>

      <form onSubmit={handleCreate} className="bg-white border border-[#EAE0DA] p-5 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div className="sm:col-span-2">
            <label className="block font-medium text-[#5D4742] mb-1">Código do cupom *</label>
            <input
              required
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: MARIÊ10"
              className="w-full border border-[#DFD2CA] px-3 py-2 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block font-medium text-[#5D4742] mb-1">Tipo</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
              className="w-full border border-[#DFD2CA] px-3 py-2 bg-white"
            >
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-[#5D4742] mb-1">Valor</label>
            <input
              required
              type="text"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block font-medium text-[#5D4742] mb-1">Pedido mínimo (R$)</label>
            <input
              type="text"
              value={minOrderReais}
              onChange={(e) => setMinOrderReais(e.target.value)}
              className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block font-medium text-[#5D4742] mb-1">Limite de usos</label>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Ilimitado"
              className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <label className="text-[#5D4742] mr-2">Validade:</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="border border-[#DFD2CA] px-2.5 py-1.5"
              />
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onePerCustomer}
                onChange={(e) => setOnePerCustomer(e.target.checked)}
                className="accent-[#231A18]"
              />
              <span>1 uso por cliente</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={freeShipping}
                onChange={(e) => setFreeShipping(e.target.checked)}
                className="accent-[#231A18]"
              />
              <span>Concede Frete Grátis</span>
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#231A18] text-white font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar cupom</span>
          </button>
        </div>

        {error && <p className="text-[#B53A3A]">{error}</p>}
      </form>

      <div className="bg-white border border-[#EAE0DA] overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FAF8F6] border-b border-[#EAE0DA] text-[#6B544F]">
            <tr>
              <th className="py-3 px-4 font-medium">Código</th>
              <th className="py-3 px-4 font-medium">Desconto</th>
              <th className="py-3 px-4 font-medium">Mínimo</th>
              <th className="py-3 px-4 font-medium">Usos</th>
              <th className="py-3 px-4 font-medium">Validade</th>
              <th className="py-3 px-4 font-medium">Regras</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2EAE4]">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="py-3 px-4 font-mono font-semibold text-[#231A18]">{c.code}</td>
                <td className="py-3 px-4 tabular-nums">
                  {c.discount_type === 'percent'
                    ? `${c.discount_value}%`
                    : formatBRL(Math.round(c.discount_value * 100))}
                </td>
                <td className="py-3 px-4 tabular-nums">{formatBRL(c.min_order_cents)}</td>
                <td className="py-3 px-4 tabular-nums">
                  {c.used_count} / {c.max_uses ?? '∞'}
                </td>
                <td className="py-3 px-4 tabular-nums">
                  {c.valid_until ? formatDateBR(c.valid_until) : 'Sem prazo'}
                </td>
                <td className="py-3 px-4 text-[#5D4742]">
                  {[
                    c.one_per_customer ? '1/cliente' : '',
                    c.free_shipping ? 'Frete grátis' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Padrão'}
                </td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleActive(c)}
                    className={`px-2.5 py-1 border font-medium cursor-pointer ${
                      c.active ? 'border-[#2D6A4F] text-[#2D6A4F]' : 'border-[#9C8782] text-[#9C8782]'
                    }`}
                  >
                    {c.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => deleteCoupon(c.id)}
                    className="p-1.5 text-[#9C8782] hover:text-[#B53A3A] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
