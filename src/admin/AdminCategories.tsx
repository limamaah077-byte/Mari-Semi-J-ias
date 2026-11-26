import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Category } from '../types';

interface AdminCategoriesProps {
  token: string;
}

export function AdminCategories({ token }: AdminCategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCategories(data.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
    });
    setNewName('');
    setNewDesc('');
    await load();
  };

  const updateCat = async (id: number, patch: Partial<Category>) => {
    await fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await load();
  };

  const reorder = async (index: number, dir: -1 | 1) => {
    const target = categories[index];
    const swap = categories[index + dir];
    if (!target || !swap) return;
    await Promise.all([
      updateCat(target.id, { sort_order: swap.sort_order }),
      updateCat(swap.id, { sort_order: target.sort_order }),
    ]);
  };

  const deleteCat = async (id: number) => {
    await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-[#231A18]">Categorias</h1>
        <p className="text-xs text-[#7A635D]">
          Crie, renomeie, reorganize a ordem e controle a exibição das categorias na loja.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-white border border-[#EAE0DA] p-5 flex flex-col sm:flex-row gap-3 items-end"
      >
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-[#5D4742] mb-1">Nova categoria</label>
          <input
            required
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Tornozeleiras"
            className="w-full border border-[#DFD2CA] px-3 py-2 text-xs"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-[#5D4742] mb-1">Descrição</label>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Breve descrição da coleção"
            className="w-full border border-[#DFD2CA] px-3 py-2 text-xs"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#231A18] text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Adicionar</span>
        </button>
      </form>

      {loading ? (
        <div className="bg-white border border-[#EAE0DA] p-8 text-center text-sm text-[#7A635D]">
          Carregando categorias...
        </div>
      ) : (
        <div className="bg-white border border-[#EAE0DA] divide-y divide-[#F2EAE4]">
          {categories.map((cat, idx) => (
            <div key={cat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <input
                  type="text"
                  defaultValue={cat.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value.trim() !== cat.name) {
                      updateCat(cat.id, { name: e.target.value.trim() });
                    }
                  }}
                  className="font-medium text-sm text-[#231A18] border border-transparent hover:border-[#DFD2CA] focus:border-[#B76E79] px-2 py-0.5 -ml-2"
                />
                <p className="text-xs text-[#8C706A] tabular-nums">
                  Slug: {cat.slug} · {cat.product_count ?? 0} produtos
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => reorder(idx, -1)}
                  className="p-1.5 border border-[#DFD2CA] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === categories.length - 1}
                  onClick={() => reorder(idx, 1)}
                  className="p-1.5 border border-[#DFD2CA] disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateCat(cat.id, { active: !cat.active })}
                  className={`px-3 py-1.5 border font-medium cursor-pointer ${
                    cat.active
                      ? 'border-[#2D6A4F] text-[#2D6A4F]'
                      : 'border-[#9C8782] text-[#9C8782]'
                  }`}
                >
                  {cat.active ? 'Ativa' : 'Oculta'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteCat(cat.id)}
                  className="p-1.5 text-[#9C8782] hover:text-[#B53A3A] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
