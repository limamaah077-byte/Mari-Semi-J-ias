import { ShoppingBag } from 'lucide-react';
import type { Product } from '../types';
import { formatBRL } from '../utils/format';
import { JewelryImage } from './JewelryImage';

interface ProductCardProps {
  product: Product;
  onOpen: (slug: string) => void;
  onQuickAdd: (product: Product) => void;
}

export function ProductCard({ product, onOpen, onQuickAdd }: ProductCardProps) {
  const isOut = !product.allow_backorder && (product.status === 'esgotado' || product.stock_qty <= 0);
  const discountPct =
    product.has_active_promo && product.price_cents > 0
      ? Math.round((1 - product.effective_price_cents / product.price_cents) * 100)
      : 0;

  let subtleTag = '';
  if (isOut) subtleTag = 'Esgotado';
  else if (discountPct > 0) subtleTag = `-${discountPct}%`;
  else if (product.is_launch) subtleTag = 'Lançamento';
  else if (product.is_bestseller) subtleTag = 'Mais vendido';

  return (
    <article className="group flex flex-col bg-white border border-[#EAE0DA] transition-transform duration-200 hover:-translate-y-0.5">
      <button
        type="button"
        onClick={() => onOpen(product.slug)}
        className="relative aspect-[4/3] w-full overflow-hidden bg-[#F5EFEA] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B76E79]"
      >
        <JewelryImage
          src={product.images[0]}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {subtleTag && (
          <span
            className={`absolute top-3 left-3 px-2.5 py-1 text-[11px] font-medium tracking-wide ${
              isOut
                ? 'bg-[#231A18]/85 text-white'
                : discountPct > 0
                  ? 'bg-[#B76E79] text-white'
                  : 'bg-white/95 text-[#231A18] border border-[#E5D7CE]'
            }`}
          >
            {subtleTag}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          <p className="text-xs text-[#8C706A] tracking-wide mb-1">
            {product.category_name || 'Semijoia Lessenza.Vero'}
          </p>
          <button
            type="button"
            onClick={() => onOpen(product.slug)}
            className="text-left cursor-pointer"
          >
            <h3 className="text-[17px] leading-snug font-medium text-[#231A18] group-hover:text-[#9E535F] transition-colors line-clamp-2">
              {product.name}
            </h3>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-[#F2EAE4] flex items-center justify-between gap-3">
          <div className="tabular-nums">
            {product.has_active_promo ? (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs text-[#9C8782] line-through">
                  {formatBRL(product.price_cents)}
                </span>
                <span className="text-[15px] font-semibold text-[#231A18]">
                  {formatBRL(product.effective_price_cents)}
                </span>
              </div>
            ) : (
              <span className="text-[15px] font-semibold text-[#231A18]">
                {formatBRL(product.effective_price_cents)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={isOut}
            onClick={() => {
              if (product.variations.length > 0) {
                onOpen(product.slug);
              } else {
                onQuickAdd(product);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              isOut
                ? 'bg-[#F3ECE8] text-[#A2918C] cursor-not-allowed'
                : 'bg-[#231A18] text-white hover:bg-[#8E4F59]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {isOut ? 'Esgotado' : product.variations.length > 0 ? 'Escolher' : 'Adicionar'}
          </button>
        </div>
      </div>
    </article>
  );
}
