import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Product, StockMovement } from '../types';
import { formatDateTimeBR } from '../utils/format';

interface AdminStockProps {
  token: string;
}

export function AdminStock({ token }: AdminStockProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedProdId, setSelectedProdId] = useState<number | ''>('');
  const [variationLabel, setVariationLabel] = useState('');
  const [movementType, setMovementType] = useState<'entrada' | 'ajuste'>('entrada');
  const [deltaQty, setDeltaQty] = useState('5');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const res = await fetch('/api/admin/stock', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setProducts(data.products || []);
    setMovements(data.movements || []);
    if (!selectedProdId && data.products?.length) {
      setSelectedProdId(data.products[0].id);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const activeProduct = products.find((p) => p.id === selectedProdId);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/stock/adjust', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: selectedProdId,
        variation_label: variationLabel || null,
        movement_type: movementType,
        delta_qty: Number(deltaQty),
        reason: reason.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao atualizar estoque.');
      return;
    }
    setReason('');
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-[#231A18]">Estoque</h1>
        <p className="text-xs text-[#7A635D]">
          Controle automático com reserva atômica nas compras, entrada de peças e histórico de movimentações.
        </p>
      </div>

      {/* Entrada / Ajuste Manual */}
      <form onSubmit={handleAdjust} className="bg-white border border-[#EAE0DA] p-5 space-y-4 text-xs">
        <p className="font-semibold text-[#231A18]">Entrada ou ajuste manual de estoque</p>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[#5D4742] mb-1">Produto</label>
            <select
              value={selectedProdId}
              onChange={(e) => {
                setSelectedProdId(Number(e.target.value));
                setVariationLabel('');
              }}
              className="w-full border border-[#DFD2CA] px-3 py-2 bg-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.stock_qty} un.)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[#5D4742] mb-1">Variação (opcional)</label>
            <select
              value={variationLabel}
              onChange={(e) => setVariationLabel(e.target.value)}
              className="w-full border border-[#DFD2CA] px-3 py-2 bg-white"
            >
              <option value="">Geral</option>
              {(activeProduct?.variations || []).map((v) => (
                <option key={v.id} value={v.label}>
                  {v.label} ({v.stock_qty})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[#5D4742] mb-1">Tipo</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as 'entrada' | 'ajuste')}
              className="w-full border border-[#DFD2CA] px-3 py-2 bg-white"
            >
              <option value="entrada">Entrada de mercadoria</option>
              <option value="ajuste">Ajuste manual (+/-)</option>
            </select>
          </div>
          <div>
            <label className="block text-[#5D4742] mb-1">Quantidade (+/-)</label>
            <input
              required
              type="number"
              value={deltaQty}
              onChange={(e) => setDeltaQty(e.target.value)}
              className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[#5D4742] mb-1">Motivo</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reposição Lessenza.Vero"
              className="w-full border border-[#DFD2CA] px-3 py-2"
            />
          </div>
        </div>
        {error && <p className="text-[#B53A3A]">{error}</p>}
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#231A18] text-white font-medium cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Registrar movimentação</span>
        </button>
      </form>

      {/* Posição Atual */}
      <div className="bg-white border border-[#EAE0DA] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#EAE0DA] bg-[#FAF8F6] text-xs font-semibold text-[#231A18]">
          Posição atual e alertas de estoque
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#EAE0DA] text-[#6B544F]">
            <tr>
              <th className="py-2.5 px-4 font-medium">Produto</th>
              <th className="py-2.5 px-4 font-medium">SKU</th>
              <th className="py-2.5 px-4 font-medium">Variações</th>
              <th className="py-2.5 px-4 font-medium text-right">Qtd Atual</th>
              <th className="py-2.5 px-4 font-medium">Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F2EAE4]">
            {products.map((p) => {
              const isOut = p.stock_qty <= 0;
              const isLow = p.stock_qty > 0 && p.stock_qty <= p.low_stock_threshold;
              return (
                <tr key={p.id}>
                  <td className="py-2.5 px-4 font-medium text-[#231A18]">{p.name}</td>
                  <td className="py-2.5 px-4 font-mono text-[#5D4742]">{p.sku}</td>
                  <td className="py-2.5 px-4 text-[#7A635D]">
                    {p.variations.length > 0
                      ? p.variations.map((v) => `${v.label}: ${v.stock_qty}`).join(' · ')
                      : 'Sem variações'}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{p.stock_qty}</td>
                  <td className="py-2.5 px-4 font-medium">
                    {isOut ? (
                      <span className="text-[#B53A3A]">Esgotado</span>
                    ) : isLow ? (
                      <span className="text-[#B45309]">Estoque baixo</span>
                    ) : (
                      <span className="text-[#2D6A4F]">Normal</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Histórico */}
      <div className="bg-white border border-[#EAE0DA] overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#EAE0DA] bg-[#FAF8F6] text-xs font-semibold text-[#231A18]">
          Histórico de movimentações
        </div>
        {movements.length === 0 ? (
          <p className="p-6 text-xs text-[#8C706A] text-center">
            Nenhuma movimentação registrada ainda.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#EAE0DA] text-[#6B544F]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Data</th>
                <th className="py-2.5 px-4 font-medium">Produto</th>
                <th className="py-2.5 px-4 font-medium">Tipo</th>
                <th className="py-2.5 px-4 font-medium text-right">Delta</th>
                <th className="py-2.5 px-4 font-medium text-right">Saldo</th>
                <th className="py-2.5 px-4 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EAE4]">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 px-4 tabular-nums text-[#7A635D]">
                    {formatDateTimeBR(m.created_at)}
                  </td>
                  <td className="py-2.5 px-4 text-[#231A18]">
                    {m.product_name} {m.variation_label ? `(${m.variation_label})` : ''}
                  </td>
                  <td className="py-2.5 px-4 text-[#5D4742]">{m.movement_type}</td>
                  <td
                    className={`py-2.5 px-4 text-right tabular-nums font-medium ${
                      m.delta_qty > 0 ? 'text-[#2D6A4F]' : 'text-[#B53A3A]'
                    }`}
                  >
                    {m.delta_qty > 0 ? `+${m.delta_qty}` : m.delta_qty}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums">
                    {m.previous_qty} → {m.new_qty}
                  </td>
                  <td className="py-2.5 px-4 text-[#5D4742]">{m.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
