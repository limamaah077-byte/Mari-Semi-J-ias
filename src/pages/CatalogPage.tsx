import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Category, Product } from '../types';
import { ProductCard } from '../components/ProductCard';

interface CatalogPageProps {
  categories: Category[];
  products: Product[];
  initialCategory?: string;
  initialFilter?: string;
  initialQuery?: string;
  onNavigate: (path: string) => void;
  onQuickAdd: (product: Product) => void;
}

export function CatalogPage({
  categories,
  products,
  initialCategory = 'todas',
  initialFilter = 'todos',
  initialQuery = '',
  onNavigate,
  onQuickAdd,
}: CatalogPageProps) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [specialFilter, setSpecialFilter] = useState(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState<'destaques' | 'menor-preco' | 'maior-preco'>('destaques');

  const filtered = useMemo(() => {
    let list = [...products];
    if (selectedCategory !== 'todas') {
      list = list.filter((p) => p.category_slug === selectedCategory);
    }
    if (specialFilter === 'lancamentos') list = list.filter((p) => p.is_launch);
    if (specialFilter === 'mais-vendidos') list = list.filter((p) => p.is_bestseller);
    if (specialFilter === 'promocoes') list = list.filter((p) => p.has_active_promo);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.category_name || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'menor-preco') {
      list.sort((a, b) => a.effective_price_cents - b.effective_price_cents);
    } else if (sortBy === 'maior-preco') {
      list.sort((a, b) => b.effective_price_cents - a.effective_price_cents);
    }

    return list;
  }, [products, selectedCategory, specialFilter, query, sortBy]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="pb-8 border-b border-[#EAE0DA] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59] mb-2">
            Coleção Lessenza.Vero
          </p>
          <h1 className="font-display text-4xl font-semibold text-[#231A18]">Catálogo</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#8C706A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar peça ou SKU..."
              className="w-full bg-white border border-[#DFD2CA] pl-9 pr-8 py-2 text-sm text-[#231A18] focus:outline-none focus:border-[#B76E79]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C706A] hover:text-[#231A18] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white border border-[#DFD2CA] px-3 py-2 text-sm text-[#231A18] focus:outline-none focus:border-[#B76E79]"
          >
            <option value="destaques">Ordenar: Destaques</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
          </select>
        </div>
      </div>

      {/* Category & Special Filter Controls */}
      <div className="py-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#F2EAE4]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('todas')}
            className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              selectedCategory === 'todas'
                ? 'bg-[#231A18] text-white border-[#231A18]'
                : 'bg-white text-[#5D4742] border-[#E5D7CE] hover:border-[#231A18]'
            }`}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.slug)}
              className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                selectedCategory === c.slug
                  ? 'bg-[#231A18] text-white border-[#231A18]'
                  : 'bg-white text-[#5D4742] border-[#E5D7CE] hover:border-[#231A18]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2EAE4]">
          {(
            [
              { id: 'todos', label: 'Tudo' },
              { id: 'lancamentos', label: 'Lançamentos' },
              { id: 'mais-vendidos', label: 'Mais vendidos' },
              { id: 'promocoes', label: 'Promoções' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSpecialFilter(f.id)}
              className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                specialFilter === f.id
                  ? 'bg-white text-[#231A18] shadow-xs'
                  : 'text-[#6B544F] hover:text-[#231A18]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-[#8C706A] tabular-nums">
        {filtered.length} {filtered.length === 1 ? 'peça encontrada' : 'peças encontradas'}
      </p>

      {filtered.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#EAE0DA] mt-4">
          <p className="font-display text-2xl text-[#231A18] mb-2">Nenhuma peça encontrada</p>
          <p className="text-sm text-[#7A635D] mb-6">
            Tente remover os filtros selecionados ou buscar por outro termo.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('todas');
              setSpecialFilter('todos');
              setQuery('');
            }}
            className="px-5 py-2.5 bg-[#231A18] text-white text-xs font-medium cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={(slug) => onNavigate(`/produto/${slug}`)}
              onQuickAdd={onQuickAdd}
            />
          ))}
        </div>
      )}
    </main>
  );
}
