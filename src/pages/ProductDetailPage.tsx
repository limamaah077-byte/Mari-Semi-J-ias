import { useState } from 'react';
import { ArrowLeft, Check, Share2, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import type { Product, StoreSettings } from '../types';
import { formatBRL } from '../utils/format';
import { JewelryImage } from '../components/JewelryImage';

interface ProductDetailPageProps {
  product: Product;
  settings: StoreSettings;
  onBack: () => void;
  onAddToCart: (product: Product, variationLabel: string | null, qty: number) => void;
}

export function ProductDetailPage({
  product,
  settings,
  onBack,
  onAddToCart,
}: ProductDetailPageProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(
    product.variations.length > 0 ? product.variations[0].label : null
  );
  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  const activeVarObj = product.variations.find((v) => v.label === selectedVariation);
  const availableStock = activeVarObj ? activeVarObj.stock_qty : product.stock_qty;
  const isOut = !product.allow_backorder && (product.status === 'esgotado' || availableStock <= 0);

  const discountPct =
    product.has_active_promo && product.price_cents > 0
      ? Math.round((1 - product.effective_price_cents / product.price_cents) * 100)
      : 0;

  const handleAdd = () => {
    if (isOut) return;
    onAddToCart(product, selectedVariation, qty);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const shareText = encodeURIComponent(
    `Olha essa semijoia da ${settings.store_name}: ${product.name} (${formatBRL(product.effective_price_cents)}) — ${window.location.href}`
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-medium text-[#6B544F] hover:text-[#231A18] mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao catálogo</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left Sticky Gallery */}
        <div className="lg:col-span-7 lg:sticky lg:top-24 space-y-4">
          <div className="aspect-[4/3] w-full bg-[#F5EFEA] border border-[#EAE0DA] overflow-hidden">
            <JewelryImage
              src={product.images[selectedImage] || product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImage(idx)}
                  className={`aspect-square border overflow-hidden cursor-pointer ${
                    selectedImage === idx ? 'border-[#231A18]' : 'border-[#EAE0DA] opacity-75 hover:opacity-100'
                  }`}
                >
                  <JewelryImage src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Contiguous Purchase Module */}
        <div className="lg:col-span-5 bg-white border border-[#EAE0DA] p-6 sm:p-8 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-4 text-xs text-[#8C706A] mb-2">
              <span>{product.category_name || 'Coleção Lessenza.Vero'}</span>
              <span className="font-mono tabular-nums">SKU {product.sku}</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#231A18] leading-tight">
              {product.name}
            </h1>
          </div>

          <div className="pb-5 border-b border-[#F0E6E0] tabular-nums">
            {product.has_active_promo ? (
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#9C8782] line-through">
                    {formatBRL(product.price_cents)}
                  </span>
                  {discountPct > 0 && (
                    <span className="text-xs font-medium text-[#8E4F59]">
                      Economize {discountPct}%
                    </span>
                  )}
                </div>
                <p className="text-3xl font-semibold text-[#231A18]">
                  {formatBRL(product.effective_price_cents)}
                </p>
              </div>
            ) : (
              <p className="text-3xl font-semibold text-[#231A18]">
                {formatBRL(product.effective_price_cents)}
              </p>
            )}
            <p className="text-xs text-[#7A635D] mt-1.5">
              Em até {settings.mp_max_installments}x no cartão ou à vista no PIX
            </p>
          </div>

          {product.variations.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-[#231A18]">Selecione a variação</p>
              <div className="flex flex-wrap gap-2">
                {product.variations.map((v) => {
                  const varOut = !product.allow_backorder && v.stock_qty <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={varOut}
                      onClick={() => {
                        setSelectedVariation(v.label);
                        setQty(1);
                      }}
                      className={`px-3.5 py-2 text-xs font-medium border transition-colors cursor-pointer ${
                        selectedVariation === v.label
                          ? 'bg-[#231A18] text-white border-[#231A18]'
                          : varOut
                            ? 'bg-[#F5EFEA] text-[#B2A29E] border-[#E6DCD6] line-through cursor-not-allowed'
                            : 'bg-white text-[#231A18] border-[#DFD2CA] hover:border-[#231A18]'
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className={isOut ? 'text-[#B53A3A] font-medium' : 'text-[#5D4742]'}>
              {isOut
                ? 'Peça esgotada no momento'
                : availableStock <= 3
                  ? `Últimas ${availableStock} unidades disponíveis`
                  : `Em estoque (${availableStock} disponíveis)`}
            </span>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="flex items-center border border-[#DFD2CA]">
              <button
                type="button"
                disabled={isOut || qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3.5 py-3 text-sm text-[#5D4742] hover:text-[#231A18] disabled:opacity-40 cursor-pointer"
              >
                -
              </button>
              <span className="px-3 text-sm font-medium tabular-nums">{qty}</span>
              <button
                type="button"
                disabled={isOut || (!product.allow_backorder && qty >= availableStock)}
                onClick={() => setQty((q) => q + 1)}
                className="px-3.5 py-3 text-sm text-[#5D4742] hover:text-[#231A18] disabled:opacity-40 cursor-pointer"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={isOut}
              onClick={handleAdd}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-6 text-sm font-medium transition-colors cursor-pointer ${
                isOut
                  ? 'bg-[#EAE0DA] text-[#9C8782] cursor-not-allowed'
                  : addedFeedback
                    ? 'bg-[#3B6E4C] text-white'
                    : 'bg-[#231A18] text-white hover:bg-[#8E4F59]'
              }`}
            >
              {addedFeedback ? <Check className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
              <span>
                {isOut
                  ? 'Produto esgotado'
                  : addedFeedback
                    ? 'Adicionado à sacola'
                    : 'Adicionar à sacola'}
              </span>
            </button>
          </div>

          <div className="pt-2">
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#6B544F] hover:text-[#231A18]"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartilhar esta peça no WhatsApp</span>
            </a>
          </div>

          {/* Description, Specs & Warranty */}
          <div className="pt-5 border-t border-[#F0E6E0] space-y-4 text-sm text-[#5D4742] leading-relaxed">
            <div>
              <h2 className="font-medium text-[#231A18] mb-1">Descrição</h2>
              <p>{product.description}</p>
            </div>

            {product.characteristics && (
              <div>
                <h2 className="font-medium text-[#231A18] mb-1">Características da peça</h2>
                <p>{product.characteristics}</p>
              </div>
            )}

            {product.warranty_info && (
              <div className="flex items-start gap-2.5 bg-[#FAF8F6] p-3.5 border border-[#EAE0DA]">
                <ShieldCheck className="w-4 h-4 text-[#B76E79] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[#231A18]">Garantia</p>
                  <p className="text-xs text-[#6B544F] mt-0.5">{product.warranty_info}</p>
                </div>
              </div>
            )}

            {product.notes && (
              <div className="flex items-start gap-2.5 text-xs text-[#6B544F]">
                <Truck className="w-4 h-4 text-[#B76E79] shrink-0 mt-0.5" />
                <p>{product.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
