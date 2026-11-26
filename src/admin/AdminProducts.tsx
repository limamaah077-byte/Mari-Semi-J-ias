import { useEffect, useState } from 'react';
import { Copy, Edit3, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import type { Category, DiscountType, Product, ProductStatus, ProductVariation } from '../types';
import { formatBRL } from '../utils/format';
import { JewelryImage } from '../components/JewelryImage';

interface AdminProductsProps {
  token: string;
}

export function AdminProducts({ token }: AdminProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [characteristics, setCharacteristics] = useState('');
  const [warrantyInfo, setWarrantyInfo] = useState('Garantia de 1 ano no banho Lessenza.Vero.');
  const [notes, setNotes] = useState('');
  const [priceReais, setPriceReais] = useState('149.00');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [promoStart, setPromoStart] = useState('');
  const [promoEnd, setPromoEnd] = useState('');
  const [stockQty, setStockQty] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('3');
  const [allowBackorder, setAllowBackorder] = useState(false);
  const [status, setStatus] = useState<ProductStatus>('ativo');
  const [isFeatured, setIsFeatured] = useState(true);
  const [isLaunch, setIsLaunch] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [imagesText, setImagesText] = useState('');
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/categories', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      setProducts(pData.products || []);
      setCategories(cData.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const openNew = () => {
    setEditing(null);
    setName('');
    setSku('');
    setCategoryId(categories[0] ? String(categories[0].id) : '');
    setDescription('');
    setCharacteristics('');
    setWarrantyInfo('Garantia de 1 ano no banho Lessenza.Vero.');
    setNotes('');
    setPriceReais('149.00');
    setDiscountType('none');
    setDiscountValue('0');
    setPromoStart('');
    setPromoEnd('');
    setStockQty('10');
    setLowStockThreshold('3');
    setAllowBackorder(false);
    setStatus('ativo');
    setIsFeatured(true);
    setIsLaunch(false);
    setIsBestseller(false);
    setImagesText('/src/assets/images/product_colar_riviera_1795652704385.jpg');
    setVariations([]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setSku(p.sku);
    setCategoryId(p.category_id ? String(p.category_id) : '');
    setDescription(p.description);
    setCharacteristics(p.characteristics);
    setWarrantyInfo(p.warranty_info);
    setNotes(p.notes);
    setPriceReais((p.price_cents / 100).toFixed(2));
    setDiscountType(p.discount_type || 'none');
    setDiscountValue(String(p.discount_value || 0));
    setPromoStart(p.promo_start ? p.promo_start.slice(0, 16) : '');
    setPromoEnd(p.promo_end ? p.promo_end.slice(0, 16) : '');
    setStockQty(String(p.stock_qty));
    setLowStockThreshold(String(p.low_stock_threshold));
    setAllowBackorder(p.allow_backorder);
    setStatus(p.status);
    setIsFeatured(p.is_featured);
    setIsLaunch(p.is_launch);
    setIsBestseller(p.is_bestseller);
    setImagesText(p.images.join('\n'));
    setVariations(p.variations || []);
    setError('');
    setModalOpen(true);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagesText((prev) => (prev.trim() ? `${prev.trim()}\n${reader.result}` : String(reader.result)));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const priceCents = Math.round(Number(priceReais.replace(',', '.')) * 100);
      const images = imagesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name,
        sku,
        category_id: categoryId ? Number(categoryId) : null,
        description,
        characteristics,
        warranty_info: warrantyInfo,
        notes,
        price_cents: priceCents,
        discount_type: discountType,
        discount_value: Number(discountValue.replace(',', '.')) || 0,
        promo_start: promoStart || null,
        promo_end: promoEnd || null,
        stock_qty: Number(stockQty) || 0,
        low_stock_threshold: Number(lowStockThreshold) || 3,
        allow_backorder: allowBackorder,
        status,
        is_featured: isFeatured,
        is_launch: isLaunch,
        is_bestseller: isBestseller,
        images,
        variations,
      };

      const url = editing ? `/api/admin/products/${editing.id}` : '/api/admin/products';
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar produto.');
        return;
      }
      setModalOpen(false);
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p: Product) => {
    const next = p.status === 'inativo' ? (p.stock_qty > 0 || p.allow_backorder ? 'ativo' : 'esgotado') : 'inativo';
    await fetch(`/api/admin/products/${p.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    await loadAll();
  };

  const duplicateProduct = async (id: number) => {
    await fetch(`/api/admin/products/${id}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAll();
  };

  const deleteProduct = async (id: number) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#231A18]">Produtos</h1>
          <p className="text-xs text-[#7A635D]">
            Gerencie peças, preços promocionais, variações, fotos e destaques da loja.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#231A18] text-white text-xs font-medium hover:bg-[#8E4F59] self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo produto</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-[#EAE0DA] p-8 text-center text-sm text-[#7A635D]">
          Carregando produtos...
        </div>
      ) : (
        <div className="bg-white border border-[#EAE0DA] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F6] border-b border-[#EAE0DA] text-[#6B544F]">
              <tr>
                <th className="py-3 px-4 font-medium">Peça</th>
                <th className="py-3 px-4 font-medium">SKU</th>
                <th className="py-3 px-4 font-medium">Categoria</th>
                <th className="py-3 px-4 font-medium text-right">Preço</th>
                <th className="py-3 px-4 font-medium text-right">Estoque</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EAE4]">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAF8F6]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <JewelryImage
                        src={p.images[0]}
                        alt={p.name}
                        className="w-10 h-10 object-cover bg-[#F5EFEA] shrink-0"
                      />
                      <div>
                        <p className="font-medium text-[#231A18]">{p.name}</p>
                        <p className="text-[11px] text-[#8C706A]">
                          {[
                            p.is_featured ? 'Home' : '',
                            p.is_launch ? 'Lançamento' : '',
                            p.is_bestseller ? 'Mais vendido' : '',
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Catálogo'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#5D4742]">{p.sku}</td>
                  <td className="py-3 px-4 text-[#5D4742]">{p.category_name || '—'}</td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {p.has_active_promo ? (
                      <div>
                        <span className="line-through text-[#9C8782] mr-1.5">
                          {formatBRL(p.price_cents)}
                        </span>
                        <span className="font-semibold text-[#8E4F59]">
                          {formatBRL(p.effective_price_cents)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-medium text-[#231A18]">{formatBRL(p.price_cents)}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium">{p.stock_qty}</td>
                  <td className="py-3 px-4">
                    <span
                      className={
                        p.status === 'ativo'
                          ? 'text-[#2D6A4F] font-medium'
                          : p.status === 'esgotado'
                            ? 'text-[#B53A3A] font-medium'
                            : 'text-[#8C706A]'
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        title="Editar"
                        className="p-1.5 text-[#5D4742] hover:text-[#231A18] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(p)}
                        title={p.status === 'inativo' ? 'Publicar' : 'Ocultar'}
                        className="p-1.5 text-[#5D4742] hover:text-[#231A18] cursor-pointer"
                      >
                        {p.status === 'inativo' ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateProduct(p.id)}
                        title="Duplicar"
                        className="p-1.5 text-[#5D4742] hover:text-[#231A18] cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProduct(p.id)}
                        title="Excluir"
                        className="p-1.5 text-[#9C8782] hover:text-[#B53A3A] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="bg-white border border-[#E6D9D1] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5 text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE0DA]">
              <h2 className="font-display text-2xl font-semibold text-[#231A18]">
                {editing ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-[#6B544F] hover:text-[#231A18] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-medium text-[#5D4742] mb-1">Nome da peça *</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">SKU / Código *</label>
                <input
                  required
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="LV-COL-102"
                  className="w-full border border-[#DFD2CA] px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">Categoria</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3 py-2 bg-white"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">Preço original (R$)</label>
                <input
                  required
                  type="text"
                  value={priceReais}
                  onChange={(e) => setPriceReais(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProductStatus)}
                  className="w-full border border-[#DFD2CA] px-3 py-2 bg-white"
                >
                  <option value="ativo">Ativo (Publicado)</option>
                  <option value="inativo">Inativo (Oculto)</option>
                  <option value="esgotado">Esgotado</option>
                </select>
              </div>
            </div>

            {/* Promoção */}
            <div className="p-4 bg-[#FAF8F6] border border-[#EAE0DA] space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#231A18]">Promoção direta no produto</p>
                {discountType !== 'none' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('none');
                      setDiscountValue('0');
                      setPromoStart('');
                      setPromoEnd('');
                    }}
                    className="text-[11px] text-[#B53A3A] underline cursor-pointer"
                  >
                    Retirar promoção
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[#5D4742] mb-1">Tipo de desconto</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2"
                  >
                    <option value="none">Sem promoção</option>
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#5D4742] mb-1">Valor do desconto</label>
                  <input
                    type="text"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={discountType === 'none'}
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[#5D4742] mb-1">Início da promoção</label>
                  <input
                    type="datetime-local"
                    value={promoStart}
                    onChange={(e) => setPromoStart(e.target.value)}
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[#5D4742] mb-1">Término da promoção</label>
                  <input
                    type="datetime-local"
                    value={promoEnd}
                    onChange={(e) => setPromoEnd(e.target.value)}
                    className="w-full bg-white border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Estoque e flags */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">Estoque disponível</label>
                <input
                  type="number"
                  min={0}
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">Alerta estoque baixo</label>
                <input
                  type="number"
                  min={1}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowBackorder}
                    onChange={(e) => setAllowBackorder(e.target.checked)}
                    className="accent-[#231A18]"
                  />
                  <span>Permitir venda com estoque zerado</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="accent-[#231A18]"
                />
                <span>Destaque na página inicial</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLaunch}
                  onChange={(e) => setIsLaunch(e.target.checked)}
                  className="accent-[#231A18]"
                />
                <span>Marcar como Lançamento</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBestseller}
                  onChange={(e) => setIsBestseller(e.target.checked)}
                  className="accent-[#231A18]"
                />
                <span>Marcar como Mais vendido</span>
              </label>
            </div>

            {/* Descriptions */}
            <div className="space-y-3">
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#5D4742] mb-1">
                    Características da peça
                  </label>
                  <textarea
                    rows={2}
                    value={characteristics}
                    onChange={(e) => setCharacteristics(e.target.value)}
                    className="w-full border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#5D4742] mb-1">
                    Informações de garantia
                  </label>
                  <textarea
                    rows={2}
                    value={warrantyInfo}
                    onChange={(e) => setWarrantyInfo(e.target.value)}
                    className="w-full border border-[#DFD2CA] px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-[#5D4742] mb-1">Observações</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-[#DFD2CA] px-3 py-2"
                />
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-medium text-[#5D4742]">Fotos (1 URL por linha ou envie arquivo)</label>
                <label className="px-3 py-1 bg-[#FAF8F6] border border-[#DFD2CA] cursor-pointer hover:bg-[#F0E6E0]">
                  <span>Enviar foto</span>
                  <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
                </label>
              </div>
              <textarea
                rows={2}
                value={imagesText}
                onChange={(e) => setImagesText(e.target.value)}
                className="w-full border border-[#DFD2CA] px-3 py-2 font-mono text-[11px]"
              />
            </div>

            {/* Variations */}
            <div className="p-4 bg-[#FAF8F6] border border-[#EAE0DA] space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#231A18]">Variações (Aro, Tamanho, Banho)</p>
                <button
                  type="button"
                  onClick={() =>
                    setVariations((prev) => [
                      ...prev,
                      { id: `v-${Date.now()}`, label: '', sku_suffix: '', stock_qty: 5 },
                    ])
                  }
                  className="text-xs font-medium text-[#8E4F59] cursor-pointer"
                >
                  + Adicionar variação
                </button>
              </div>
              {variations.map((v, idx) => (
                <div key={v.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Ex: Aro 16"
                    value={v.label}
                    onChange={(e) =>
                      setVariations((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                      )
                    }
                    className="col-span-6 bg-white border border-[#DFD2CA] px-2.5 py-1.5"
                  />
                  <input
                    type="text"
                    placeholder="Sufixo SKU"
                    value={v.sku_suffix || ''}
                    onChange={(e) =>
                      setVariations((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, sku_suffix: e.target.value } : item
                        )
                      )
                    }
                    className="col-span-3 bg-white border border-[#DFD2CA] px-2.5 py-1.5 font-mono"
                  />
                  <input
                    type="number"
                    min={0}
                    value={v.stock_qty}
                    onChange={(e) =>
                      setVariations((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, stock_qty: Number(e.target.value) || 0 } : item
                        )
                      )
                    }
                    className="col-span-2 bg-white border border-[#DFD2CA] px-2.5 py-1.5 tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setVariations((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 text-[#B53A3A] flex justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 bg-[#FDF2F2] border border-[#F2C6C6] text-[#A32929]">{error}</div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-[#DFD2CA] text-[#5D4742] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#231A18] text-white font-medium hover:bg-[#8E4F59] cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar produto'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
