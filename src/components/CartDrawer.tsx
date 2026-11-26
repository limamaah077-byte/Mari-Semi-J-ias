import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { CartItem, StoreSettings } from '../types';
import { formatBRL } from '../utils/format';
import { JewelryImage } from './JewelryImage';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  settings: StoreSettings;
  onClose: () => void;
  onUpdateQty: (productId: number, variationLabel: string | null, delta: number) => void;
  onRemove: (productId: number, variationLabel: string | null) => void;
  onCheckout: () => void;
}

export function CartDrawer({
  open,
  items,
  settings,
  onClose,
  onUpdateQty,
  onRemove,
  onCheckout,
}: CartDrawerProps) {
  if (!open) return null;

  const subtotalCents = items.reduce(
    (sum, i) => sum + i.product.effective_price_cents * i.quantity,
    0
  );
  const freeThreshold = settings.free_shipping_threshold_cents || 0;
  const remainingForFree = Math.max(0, freeThreshold - subtotalCents);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-[#FAF8F6] shadow-2xl border-l border-[#E6D9D1]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E6D9D1] bg-white">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#B76E79]" strokeWidth={1.6} />
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">Sua Sacola</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar sacola"
            className="p-2 text-[#6B544F] hover:text-[#231A18] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {freeThreshold > 0 && items.length > 0 && (
          <div className="px-6 py-3 bg-[#F9EFF0] border-b border-[#EEDADE] text-xs text-[#6B3B44]">
            {remainingForFree === 0
              ? 'Você garantiu Frete Grátis via PAC nesta compra.'
              : `Faltam ${formatBRL(remainingForFree)} para ganhar Frete Grátis via PAC.`}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="w-10 h-10 mx-auto text-[#C6AFA8] mb-3" strokeWidth={1.2} />
              <p className="font-display text-xl text-[#231A18] mb-1">Sua sacola está vazia</p>
              <p className="text-sm text-[#7A635D]">
                Explore nossas coleções Lessenza.Vero e escolha suas peças favoritas.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.product.id}-${item.variation_label || 'default'}`}
                className="flex gap-4 bg-white p-3.5 border border-[#EAE0DA]"
              >
                <JewelryImage
                  src={item.product.images[0]}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover shrink-0 bg-[#F5EFEA]"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-[#231A18] truncate">
                    {item.product.name}
                  </h3>
                  {item.variation_label && (
                    <p className="text-xs text-[#8C706A] mt-0.5">{item.variation_label}</p>
                  )}
                  <p className="text-sm font-semibold text-[#231A18] tabular-nums mt-1">
                    {formatBRL(item.product.effective_price_cents)}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="inline-flex items-center border border-[#DFD2CA] bg-[#FAF8F6]">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQty(item.product.id, item.variation_label, -1)
                        }
                        aria-label="Diminuir quantidade"
                        className="p-1.5 text-[#5D4742] hover:text-[#231A18] cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2.5 text-xs font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQty(item.product.id, item.variation_label, 1)
                        }
                        aria-label="Aumentar quantidade"
                        className="p-1.5 text-[#5D4742] hover:text-[#231A18] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(item.product.id, item.variation_label)}
                      aria-label="Remover item"
                      className="p-1.5 text-[#9C8782] hover:text-[#B53A3A] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[#E6D9D1] bg-white px-6 py-5 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B544F]">Subtotal</span>
              <span className="text-base font-semibold text-[#231A18] tabular-nums">
                {formatBRL(subtotalCents)}
              </span>
            </div>
            <p className="text-xs text-[#8C706A]">
              Frete e cupom de desconto são calculados na etapa de finalização.
            </p>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3.5 px-6 bg-[#231A18] text-white text-sm font-medium tracking-wide hover:bg-[#8E4F59] transition-colors cursor-pointer"
            >
              Finalizar compra
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
