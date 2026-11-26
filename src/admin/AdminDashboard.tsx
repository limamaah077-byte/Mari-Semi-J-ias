import { useEffect, useState } from 'react';
import type { DashboardMetrics } from '../types';
import { formatBRL } from '../utils/format';

interface AdminDashboardProps {
  token: string;
  onGoToSales: (stage?: string) => void;
  onGoToStock: () => void;
}

export function AdminDashboard({ token, onGoToSales, onGoToStock }: AdminDashboardProps) {
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/dashboard?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setMetrics(d.metrics))
      .finally(() => setLoading(false));
  }, [token, period]);

  if (loading || !metrics) {
    return <div className="p-8 text-sm text-[#6B544F]">Carregando indicadores...</div>;
  }

  const maxSeriesRevenue = Math.max(
    1,
    ...metrics.daily_series.map((d) => d.revenue_cents)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#231A18]">Dashboard</h1>
          <p className="text-xs text-[#7A635D]">
            Visão geral em tempo real das vendas, pedidos e estoque da loja.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#EFE7E1] border border-[#E2D4CB] self-start">
          {(
            [
              { id: 'today', label: 'Hoje' },
              { id: '7d', label: '7 dias' },
              { id: '30d', label: '30 dias' },
              { id: 'all', label: 'Tudo' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                period === p.id ? 'bg-white text-[#231A18]' : 'text-[#6B544F] hover:text-[#231A18]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#EAE0DA] p-5">
          <p className="text-xs text-[#8C706A]">Vendas do dia (pagas)</p>
          <p className="text-2xl font-semibold text-[#231A18] tabular-nums mt-1.5">
            {formatBRL(metrics.sales_today_cents)}
          </p>
        </div>
        <div className="bg-white border border-[#EAE0DA] p-5">
          <p className="text-xs text-[#8C706A]">Vendas do mês (pagas)</p>
          <p className="text-2xl font-semibold text-[#231A18] tabular-nums mt-1.5">
            {formatBRL(metrics.sales_month_cents)}
          </p>
        </div>
        <div className="bg-white border border-[#EAE0DA] p-5">
          <p className="text-xs text-[#8C706A]">Total faturado no período</p>
          <p className="text-2xl font-semibold text-[#231A18] tabular-nums mt-1.5">
            {formatBRL(metrics.total_revenue_cents)}
          </p>
        </div>
        <div className="bg-white border border-[#EAE0DA] p-5">
          <p className="text-xs text-[#8C706A]">Quantidade de pedidos</p>
          <p className="text-2xl font-semibold text-[#231A18] tabular-nums mt-1.5">
            {metrics.orders_count}
          </p>
        </div>
      </div>

      {/* 4 Stage Order Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            {
              key: 'aguardando_separo',
              label: 'Aguardando separo',
              count: metrics.stage_counts.aguardando_separo,
              accent: 'text-[#9A6700]',
            },
            {
              key: 'separado',
              label: 'Pedidos separados',
              count: metrics.stage_counts.separado,
              accent: 'text-[#6B4E71]',
            },
            {
              key: 'despachado',
              label: 'Pedidos despachados',
              count: metrics.stage_counts.despachado,
              accent: 'text-[#1E5F74]',
            },
            {
              key: 'entregue',
              label: 'Pedidos entregues',
              count: metrics.stage_counts.entregue,
              accent: 'text-[#2D6A4F]',
            },
          ] as const
        ).map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onGoToSales(s.key)}
            className="bg-white border border-[#EAE0DA] p-4 text-left hover:border-[#B76E79] transition-colors cursor-pointer"
          >
            <p className="text-xs text-[#7A635D]">{s.label}</p>
            <p className={`text-2xl font-semibold tabular-nums mt-1 ${s.accent}`}>{s.count}</p>
          </button>
        ))}
      </div>

      {/* Secondary Operational Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={onGoToStock}
          className="bg-white border border-[#EAE0DA] p-4 text-left hover:border-[#B76E79] cursor-pointer"
        >
          <p className="text-xs text-[#7A635D]">Produtos com estoque baixo</p>
          <p className="text-xl font-semibold text-[#B45309] tabular-nums mt-1">
            {metrics.low_stock_count}
          </p>
        </button>
        <button
          type="button"
          onClick={onGoToStock}
          className="bg-white border border-[#EAE0DA] p-4 text-left hover:border-[#B76E79] cursor-pointer"
        >
          <p className="text-xs text-[#7A635D]">Produtos esgotados</p>
          <p className="text-xl font-semibold text-[#B53A3A] tabular-nums mt-1">
            {metrics.out_of_stock_count}
          </p>
        </button>
        <div className="bg-white border border-[#EAE0DA] p-4">
          <p className="text-xs text-[#7A635D]">Cupons ativos</p>
          <p className="text-xl font-semibold text-[#231A18] tabular-nums mt-1">
            {metrics.active_coupons_count}
          </p>
        </div>
      </div>

      {/* Chart + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#EAE0DA] p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">
            Receita paga nos últimos 14 dias
          </h2>
          {metrics.daily_series.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8C706A]">
              Nenhuma venda registrada nos últimos 14 dias. Assim que novos pedidos forem criados,
              o gráfico será exibido aqui.
            </div>
          ) : (
            <div className="pt-4">
              <div className="h-44 flex items-end gap-2 border-b border-[#EAE0DA] pb-2">
                {metrics.daily_series.map((d) => {
                  const pct = Math.max(6, Math.round((d.revenue_cents / maxSeriesRevenue) * 100));
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                      <div
                        title={`${d.date}: ${formatBRL(d.revenue_cents)} (${d.orders} pedidos)`}
                        style={{ height: `${pct}%` }}
                        className="w-full max-w-[32px] bg-[#B76E79] hover:bg-[#231A18] transition-colors"
                      />
                      <span className="text-[10px] text-[#8C706A] tabular-nums truncate w-full text-center">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#EAE0DA] p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">
            Produtos mais vendidos
          </h2>
          {metrics.top_products.length === 0 ? (
            <p className="text-xs text-[#8C706A] py-8 text-center">
              Ainda não há itens vendidos no período selecionado.
            </p>
          ) : (
            <div className="divide-y divide-[#F2EAE4]">
              {metrics.top_products.map((tp, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[#231A18] truncate">{tp.product_name}</p>
                    <p className="text-xs text-[#8C706A] tabular-nums">{tp.total_qty} un.</p>
                  </div>
                  <span className="font-semibold text-[#231A18] tabular-nums shrink-0">
                    {formatBRL(tp.total_cents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
