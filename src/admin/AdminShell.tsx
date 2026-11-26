import { useState } from 'react';
import {
  BarChart3,
  Boxes,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  X,
} from 'lucide-react';
import type { StoreSettings } from '../types';
import { AdminDashboard } from './AdminDashboard';
import { AdminSales } from './AdminSales';
import { AdminProducts } from './AdminProducts';
import { AdminCategories } from './AdminCategories';
import { AdminCoupons } from './AdminCoupons';
import { AdminStock } from './AdminStock';
import { AdminReports } from './AdminReports';
import { AdminSettings } from './AdminSettings';

export type AdminTab =
  | 'dashboard'
  | 'vendas'
  | 'produtos'
  | 'categorias'
  | 'cupons'
  | 'estoque'
  | 'relatorios'
  | 'configuracoes';

interface AdminShellProps {
  token: string;
  adminUser: { name: string; phone: string };
  onLogout: () => void;
  onExitToStore: () => void;
  onSettingsUpdated: (settings: StoreSettings) => void;
}

export function AdminShell({
  token,
  adminUser,
  onLogout,
  onExitToStore,
  onSettingsUpdated,
}: AdminShellProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [salesInitialStage, setSalesInitialStage] = useState<string>('aguardando_separo');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const menuItems: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vendas', label: 'Vendas', icon: ShoppingBag },
    { id: 'produtos', label: 'Produtos', icon: Package },
    { id: 'categorias', label: 'Categorias', icon: FolderTree },
    { id: 'cupons', label: 'Cupons', icon: Tag },
    { id: 'estoque', label: 'Estoque', icon: Boxes },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F6] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-[#231A18] text-white px-4 h-14 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="p-1.5 cursor-pointer"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-display text-xl font-semibold">Mariê Admin</span>
        </div>
        <button
          type="button"
          onClick={onExitToStore}
          className="text-xs text-[#EBD5D8] hover:text-white cursor-pointer"
        >
          Ver loja
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          mobileNavOpen ? 'fixed inset-y-0 left-0 z-50 block' : 'hidden'
        } lg:block w-64 bg-[#231A18] text-[#EDE3DC] shrink-0 flex flex-col justify-between border-r border-[#3A2D2A] no-print`}
      >
        <div>
          <div className="px-6 py-6 border-b border-[#3A2D2A]">
            <p className="font-display text-2xl font-semibold text-white">Mariê Semi Joias</p>
            <p className="text-[11px] text-[#CBB8B2] mt-0.5 tabular-nums">{adminUser.phone}</p>
          </div>

          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#B76E79] text-white'
                      : 'text-[#D6C6BF] hover:bg-[#332724] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-[#3A2D2A] space-y-2 text-xs">
          <button
            type="button"
            onClick={onExitToStore}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[#D6C6BF] hover:text-white hover:bg-[#332724] cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>Ir para a loja pública</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[#E8A5A5] hover:bg-[#332724] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do painel</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 lg:p-10">
        {activeTab === 'dashboard' && (
          <AdminDashboard
            token={token}
            onGoToSales={(stage) => {
              if (stage) setSalesInitialStage(stage);
              setActiveTab('vendas');
            }}
            onGoToStock={() => setActiveTab('estoque')}
          />
        )}
        {activeTab === 'vendas' && <AdminSales token={token} initialStage={salesInitialStage} />}
        {activeTab === 'produtos' && <AdminProducts token={token} />}
        {activeTab === 'categorias' && <AdminCategories token={token} />}
        {activeTab === 'cupons' && <AdminCoupons token={token} />}
        {activeTab === 'estoque' && <AdminStock token={token} />}
        {activeTab === 'relatorios' && <AdminReports token={token} />}
        {activeTab === 'configuracoes' && (
          <AdminSettings token={token} onSettingsUpdated={onSettingsUpdated} />
        )}
      </main>
    </div>
  );
}
