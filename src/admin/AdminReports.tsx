import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import type { PaymentMethod } from '../types';
import { PAYMENT_METHOD_LABELS, formatBRL } from '../utils/format';

interface AdminReportsProps {
  token: string;
}

interface ReportData {
  summary: {
    total_orders: number;
    paid_revenue_cents: number;
    pending_revenue_cents: number;
    discounts_cents: number;
    shipping_cents: number;
  };
  by_payment: Array<{ payment_method: PaymentMethod; orders: number; total_cents: number }>;
  by_product: Array<{ product_name: string; product_sku: string; qty: number; total_cents: number }>;
}

export function AdminReports({ token }: AdminReportsProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const res = await fetch(`/api/admin/reports?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setReport(data);
  };

  useEffect(() => {
    load();
  }, [token, dateFrom, dateTo]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ['Produto', 'SKU', 'Quantidade', 'Total (BRL)'],
      ...report.by_product.map((p) => [
        `"${p.product_name.replace(/"/g, '""')}"`,
        p.product_sku,
        String(p.qty),
        (p.total_cents / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-marie-${dateFrom || 'inicio'}-${dateTo || 'hoje'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#231A18]">Relatórios</h1>
          <p className="text-xs text-[#7A635D]">
            Consolidação financeira por período, forma de pagamento e peças vendidas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white border border-[#DFD2CA] px-2.5 py-1.5"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white border border-[#DFD2CA] px-2.5 py-1.5"
          />
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#231A18] text-white font-medium cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#EAE0DA] p-5">
              <p className="text-xs text-[#8C706A]">Total de pedidos</p>
              <p className="text-2xl font-semibold text-[#231A18] tabular-nums mt-1">
                {report.summary.total_orders}
              </p>
            </div>
            <div className="bg-white border border-[#EAE0DA] p-5">
              <p className="text-xs text-[#8C706A]">Receita confirmada (paga)</p>
              <p className="text-2xl font-semibold text-[#2D6A4F] tabular-nums mt-1">
                {formatBRL(report.summary.paid_revenue_cents)}
              </p>
            </div>
            <div className="bg-white border border-[#EAE0DA] p-5">
              <p className="text-xs text-[#8C706A]">Aguardando pagamento</p>
              <p className="text-2xl font-semibold text-[#9A6700] tabular-nums mt-1">
                {formatBRL(report.summary.pending_revenue_cents)}
              </p>
            </div>
            <div className="bg-white border border-[#EAE0DA] p-5">
              <p className="text-xs text-[#8C706A]">Descontos concedidos</p>
              <p className="text-2xl font-semibold text-[#231A18] tabular-nums mt-1">
                {formatBRL(report.summary.discounts_cents)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-[#EAE0DA] p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#231A18]">
                Vendas pagas por modalidade
              </h2>
              {report.by_payment.length === 0 ? (
                <p className="text-xs text-[#8C706A]">Sem pagamentos confirmados no período.</p>
              ) : (
                <div className="divide-y divide-[#F2EAE4] text-xs">
                  {report.by_payment.map((row) => (
                    <div key={row.payment_method} className="py-3 flex justify-between">
                      <span className="font-medium text-[#231A18]">
                        {PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method} ({row.orders})
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatBRL(row.total_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#EAE0DA] p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#231A18]">
                Desempenho por peça
              </h2>
              {report.by_product.length === 0 ? (
                <p className="text-xs text-[#8C706A]">Sem peças pagas no período.</p>
              ) : (
                <div className="divide-y divide-[#F2EAE4] text-xs">
                  {report.by_product.map((p, idx) => (
                    <div key={idx} className="py-3 flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-[#231A18] truncate">{p.product_name}</p>
                        <p className="text-[#8C706A] font-mono">
                          {p.product_sku} · {p.qty} un.
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums shrink-0">
                        {formatBRL(p.total_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
