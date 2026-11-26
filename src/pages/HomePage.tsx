import { useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import type { Category, Product, StoreSettings } from '../types';
import { JewelryImage } from '../components/JewelryImage';
import { ProductCard } from '../components/ProductCard';

interface HomePageProps {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  onNavigate: (path: string) => void;
  onQuickAdd: (product: Product) => void;
}

type ShowcaseTab = 'destaques' | 'lancamentos' | 'mais-vendidos' | 'ofertas';

export function HomePage({
  settings,
  categories,
  products,
  onNavigate,
  onQuickAdd,
}: HomePageProps) {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('destaques');

  const filteredProducts = products
    .filter((p) => {
      if (activeTab === 'destaques') return p.is_featured;
      if (activeTab === 'lancamentos') return p.is_launch;
      if (activeTab === 'mais-vendidos') return p.is_bestseller;
      if (activeTab === 'ofertas') return p.has_active_promo;
      return true;
    })
    .slice(0, 6);

  const displayList = filteredProducts.length > 0 ? filteredProducts : products.slice(0, 6);

  return (
    <main>
      {/* Hero Section */}
      <section className="bg-[#F4ECE6] border-b border-[#E7DAD2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[520px] lg:min-h-[600px]">
            <div className="lg:col-span-6 py-12 lg:py-20 lg:pr-12 flex flex-col justify-center">
              <p className="text-xs tracking-[0.22em] uppercase text-[#8E4F59] font-medium mb-4">
                Revenda Oficial {settings.brand_partner}
              </p>
              <h1
                className="font-display text-4xl sm:text-5xl lg:text-[56px] font-semibold leading-[1.08] text-[#231A18] max-w-xl"
                style={{ textWrap: 'balance' }}
              >
                {settings.hero_title}
              </h1>
              <p className="mt-5 text-[15px] sm:text-base text-[#5D4742] leading-relaxed max-w-lg">
                {settings.hero_subtitle}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('/catalogo')}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#231A18] text-white text-sm font-medium tracking-wide hover:bg-[#8E4F59] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{settings.hero_cta || 'Comprar agora'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/catalogo?filtro=promocoes')}
                  className="px-6 py-3.5 border border-[#CBB5A9] bg-white/70 text-[#231A18] text-sm font-medium hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Ver ofertas
                </button>
              </div>

              <div className="mt-10 pt-6 border-t border-[#E2D3CA] grid grid-cols-3 gap-4 text-xs text-[#5D4742]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#B76E79] shrink-0" />
                  <span>Banho nobre 18k</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#B76E79] shrink-0" />
                  <span>Garantia de 1 ano</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#B76E79] shrink-0" />
                  <span>Todo o Brasil</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 relative min-h-[320px] lg:min-h-full pb-8 lg:pb-0 lg:py-8">
              <div className="h-full w-full overflow-hidden border border-[#E2D3CA] bg-[#EDE2DA]">
                <JewelryImage
                  src={settings.hero_image}
                  alt={`${settings.store_name} · ${settings.brand_partner}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories & Featured Collection */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#EAE0DA]">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59] mb-2">Curadoria Mariê</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#231A18]">
              Peças selecionadas
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2EAE4] border border-[#E5D7CE]">
            {(
              [
                { id: 'destaques', label: 'Destaques' },
                { id: 'lancamentos', label: 'Lançamentos' },
                { id: 'mais-vendidos', label: 'Mais vendidos' },
                { id: 'ofertas', label: 'Ofertas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-[#231A18] shadow-xs'
                    : 'text-[#6B544F] hover:text-[#231A18]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Quick Links */}
        <div className="py-6 flex items-center gap-6 overflow-x-auto border-b border-[#F2EAE4]">
          <button
            type="button"
            onClick={() => onNavigate('/catalogo')}
            className="text-xs font-medium text-[#231A18] hover:text-[#B76E79] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Todas as peças
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onNavigate(`/catalogo?categoria=${cat.slug}`)}
              className="text-xs font-medium text-[#6B544F] hover:text-[#231A18] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {displayList.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={(slug) => onNavigate(`/produto/${slug}`)}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => onNavigate('/catalogo')}
            className="inline-flex items-center gap-2 px-7 py-3 border border-[#231A18] text-[#231A18] text-sm font-medium hover:bg-[#231A18] hover:text-white transition-colors cursor-pointer"
          >
            <span>Explorar catálogo completo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Coupon Spotlight & Brand Narrative */}
      <section className="bg-white border-y border-[#EAE0DA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 bg-[#F9EFF0] border border-[#EAD4D8] p-8 sm:p-10 space-y-4">
            <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59] font-medium">
              Boas-vindas Mariê Semi Joias
            </p>
            <h2 className="font-display text-3xl font-semibold text-[#231A18]">
              10% OFF na sua primeira compra
            </h2>
            <p className="text-sm text-[#5D4742] leading-relaxed">
              Aplique o cupom abaixo na sacola ou no checkout para garantir desconto exclusivo em
              toda a coleção {settings.brand_partner}.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-medium tracking-wider px-4 py-2.5 bg-white border border-[#DFC4C9] text-[#231A18]">
                PRIMEIRACOMPRA
              </span>
              <button
                type="button"
                onClick={() => onNavigate('/catalogo')}
                className="px-5 py-2.5 bg-[#231A18] text-white text-xs font-medium hover:bg-[#8E4F59] transition-colors cursor-pointer"
              >
                Usar cupom agora
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59] font-medium">
              Sobre a marca
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#231A18]">
              {settings.about_title}
            </h2>
            <p className="text-[15px] text-[#5D4742] leading-relaxed">{settings.about_text}</p>
            <button
              type="button"
              onClick={() => onNavigate('/sobre')}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#231A18] border-b border-[#B76E79] pb-0.5 hover:text-[#8E4F59] transition-colors cursor-pointer"
            >
              <span>Conhecer nossa história e garantia</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
