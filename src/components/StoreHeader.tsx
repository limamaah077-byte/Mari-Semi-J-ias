import { useState } from 'react';
import { Menu, Search, ShoppingBag, X } from 'lucide-react';
import type { StoreSettings } from '../types';
import { isSafeImageUrl } from '../utils/format';

interface StoreHeaderProps {
  settings: StoreSettings;
  cartCount: number;
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenCart: () => void;
  onSearchSubmit: (q: string) => void;
}

export function StoreHeader({
  settings,
  cartCount,
  currentPath,
  onNavigate,
  onOpenCart,
  onSearchSubmit,
}: StoreHeaderProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const navLinks = [
    { label: 'Início', path: '/' },
    { label: 'Catálogo', path: '/catalogo' },
    { label: 'Lançamentos', path: '/catalogo?filtro=lancamentos' },
    { label: 'Sobre', path: '/sobre' },
    { label: 'Contato', path: '/contato' },
  ];

  const handleLink = (path: string) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#EAE0DA] no-print">
      {settings.announcement_active && settings.announcement_text && !bannerDismissed && (
        <div className="bg-[#231A18] text-[#FAF8F6] text-xs py-2 px-4 flex items-center justify-center relative">
          <p className="text-center truncate pr-6">{settings.announcement_text}</p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Fechar aviso"
            className="absolute right-3 p-1 text-[#CBB8B2] hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Abrir menu"
            className="md:hidden p-2 -ml-2 text-[#231A18] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => handleLink('/')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSafeImageUrl(settings.logo_url) ? (
              <img
                src={settings.logo_url}
                alt={settings.store_name}
                referrerPolicy="no-referrer"
                className="h-9 w-auto object-contain"
              />
            ) : (
              <span className="font-display text-2xl sm:text-[26px] font-semibold tracking-wide text-[#231A18]">
                {settings.store_name}
              </span>
            )}
          </button>
        </div>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5D4742]">
          {navLinks.map((link) => {
            const active =
              link.path === '/'
                ? currentPath === '/'
                : currentPath.startsWith(link.path.split('?')[0]) &&
                  (link.path.includes('?')
                    ? window.location.search.includes('lancamentos')
                    : !window.location.search.includes('lancamentos'));
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => handleLink(link.path)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                  active
                    ? 'text-[#231A18] border-b border-[#B76E79]'
                    : 'hover:text-[#231A18]'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Buscar peças"
            className="p-2 text-[#5D4742] hover:text-[#231A18] transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#231A18] text-white text-xs font-medium whitespace-nowrap shrink-0 hover:bg-[#8E4F59] transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Sacola</span>
            <span className="tabular-nums text-[#F4D9DD]">({cartCount})</span>
          </button>
        </div>
      </div>

      {searchOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit(searchText);
            setSearchOpen(false);
          }}
          className="border-t border-[#F0E6E0] bg-[#FAF8F6] px-4 py-3"
        >
          <div className="max-w-2xl mx-auto flex gap-2">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar colares, brincos, anéis ou código SKU..."
              autoFocus
              className="flex-1 bg-white border border-[#DFD2CA] px-3.5 py-2 text-sm text-[#231A18] focus:outline-none focus:border-[#B76E79]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#231A18] text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              Buscar
            </button>
          </div>
        </form>
      )}

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#EAE0DA] bg-white px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => handleLink(link.path)}
              className="block w-full text-left py-2.5 text-sm font-medium text-[#231A18] border-b border-[#F5EFEA] last:border-b-0 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
