import { useEffect, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import type { StoreSettings } from '../types';

interface AdminSettingsProps {
  token: string;
  onSettingsUpdated: (settings: StoreSettings) => void;
}

export function AdminSettings({ token, onSettingsUpdated }: AdminSettingsProps) {
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpWebhookSecret, setMpWebhookSecret] = useState('');
  const [melhorEnvioToken, setMelhorEnvioToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setForm(d.settings));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSavedMsg('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          announcement_active: form.announcement_active ? 'true' : 'false',
          mp_access_token: mpAccessToken.trim() || undefined,
          mp_webhook_secret: mpWebhookSecret.trim() || undefined,
          melhor_envio_token: melhorEnvioToken.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.settings) {
        setForm(data.settings);
        onSettingsUpdated(data.settings);
        setMpAccessToken('');
        setMpWebhookSecret('');
        setMelhorEnvioToken('');
        setSavedMsg('Configurações salvas com sucesso.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm({ ...form, logo_url: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm({ ...form, hero_image: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage('');
    const res = await fetch('/api/admin/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPwMessage(data.error || 'Erro ao alterar senha.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setPwMessage('Senha administrativa atualizada com sucesso.');
  };

  if (!form) {
    return <div className="p-8 text-sm text-[#7A635D]">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-[#231A18]">Configurações da Loja</h1>
        <p className="text-xs text-[#7A635D]">
          Personalize identidade, banners, textos, WhatsApp, políticas, frete e integração Mercado Pago.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Identidade & Banners */}
        <section className="bg-white border border-[#EAE0DA] p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">
            Identidade, Logo e Banner Principal
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">Nome da loja</label>
              <input
                type="text"
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">Marca parceira</label>
              <input
                type="text"
                value={form.brand_partner}
                onChange={(e) => setForm({ ...form, brand_partner: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <div className="flex justify-between mb-1">
                <label className="font-medium text-[#5D4742]">URL da Logo (vazio = logo textual)</label>
                <label className="text-[#8E4F59] underline cursor-pointer">
                  <span>Enviar arquivo</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              </div>
              <input
                type="text"
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-[#5D4742] mb-1">Frase principal (Hero)</label>
              <input
                type="text"
                value={form.hero_title}
                onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-[#5D4742] mb-1">Subtítulo do Hero</label>
              <textarea
                rows={2}
                value={form.hero_subtitle}
                onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">Texto do botão principal</label>
              <input
                type="text"
                value={form.hero_cta}
                onChange={(e) => setForm({ ...form, hero_cta: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="font-medium text-[#5D4742]">Imagem do Banner Principal</label>
                <label className="text-[#8E4F59] underline cursor-pointer">
                  <span>Enviar imagem</span>
                  <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                </label>
              </div>
              <input
                type="text"
                value={form.hero_image}
                onChange={(e) => setForm({ ...form, hero_image: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-4">
              <div className="flex-1">
                <label className="block font-medium text-[#5D4742] mb-1">Faixa de aviso / cupom no topo</label>
                <input
                  type="text"
                  value={form.announcement_text}
                  onChange={(e) => setForm({ ...form, announcement_text: e.target.value })}
                  className="w-full border border-[#DFD2CA] px-3 py-2"
                />
              </div>
              <label className="inline-flex items-center gap-2 pt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.announcement_active}
                  onChange={(e) => setForm({ ...form, announcement_active: e.target.checked })}
                  className="accent-[#231A18]"
                />
                <span>Exibir faixa</span>
              </label>
            </div>
          </div>
        </section>

        {/* Contato e Políticas */}
        <section className="bg-white border border-[#EAE0DA] p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">
            Contato, WhatsApp e Políticas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">WhatsApp (somente dígitos c/ DDI 55)</label>
              <input
                type="text"
                value={form.whatsapp_phone}
                onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">WhatsApp exibido na loja</label>
              <input
                type="text"
                value={form.whatsapp_display}
                onChange={(e) => setForm({ ...form, whatsapp_display: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">E-mail de contato</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">Instagram</label>
              <input
                type="text"
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-[#5D4742] mb-1">Sobre a Mariê Semi Joias</label>
              <textarea
                rows={3}
                value={form.about_text}
                onChange={(e) => setForm({ ...form, about_text: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-[#5D4742] mb-1">Política de Troca e Devolução</label>
              <textarea
                rows={2}
                value={form.policy_exchange}
                onChange={(e) => setForm({ ...form, policy_exchange: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-[#5D4742] mb-1">Informações de Entrega</label>
              <textarea
                rows={2}
                value={form.policy_shipping}
                onChange={(e) => setForm({ ...form, policy_shipping: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-medium text-[#5D4742] mb-1">Política de Privacidade</label>
              <textarea
                rows={2}
                value={form.policy_privacy}
                onChange={(e) => setForm({ ...form, policy_privacy: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2"
              />
            </div>
          </div>
        </section>

        {/* Frete e Pagamentos Reais */}
        <section className="bg-white border border-[#EAE0DA] p-6 space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">
            Frete (Brasil) e Pagamentos (Mercado Pago)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">CEP de origem</label>
              <input
                type="text"
                value={form.origin_cep}
                onChange={(e) => setForm({ ...form, origin_cep: e.target.value })}
                className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">Frete grátis acima (centavos)</label>
              <input
                type="number"
                value={form.free_shipping_threshold_cents}
                onChange={(e) =>
                  setForm({ ...form, free_shipping_threshold_cents: Number(e.target.value) || 0 })
                }
                className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">PAC base (centavos)</label>
              <input
                type="number"
                value={form.pac_base_cents}
                onChange={(e) => setForm({ ...form, pac_base_cents: Number(e.target.value) || 0 })}
                className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">SEDEX base (centavos)</label>
              <input
                type="number"
                value={form.sedex_base_cents}
                onChange={(e) =>
                  setForm({ ...form, sedex_base_cents: Number(e.target.value) || 0 })
                }
                className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#F0E6E0] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">
                Mercado Pago Access Token{' '}
                <span className="text-[#8C706A]">
                  ({form.mp_configured ? 'Configurado' : 'Não configurado'})
                </span>
              </label>
              <input
                type="password"
                value={mpAccessToken}
                onChange={(e) => setMpAccessToken(e.target.value)}
                placeholder="APP_USR-... (deixe vazio para manter atual)"
                className="w-full border border-[#DFD2CA] px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">
                Mercado Pago Webhook Secret
              </label>
              <input
                type="password"
                value={mpWebhookSecret}
                onChange={(e) => setMpWebhookSecret(e.target.value)}
                placeholder="Chave secreta do webhook"
                className="w-full border border-[#DFD2CA] px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">
                Parcelas máximas no cartão
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={form.mp_max_installments}
                onChange={(e) =>
                  setForm({ ...form, mp_max_installments: Number(e.target.value) || 1 })
                }
                className="w-full border border-[#DFD2CA] px-3 py-2 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium text-[#5D4742] mb-1">
                Token Melhor Envio (opcional){' '}
                <span className="text-[#8C706A]">
                  ({form.melhor_envio_configured ? 'Configurado' : 'Tabela regional ativa'})
                </span>
              </label>
              <input
                type="password"
                value={melhorEnvioToken}
                onChange={(e) => setMelhorEnvioToken(e.target.value)}
                placeholder="Bearer token Melhor Envio"
                className="w-full border border-[#DFD2CA] px-3 py-2 font-mono"
              />
            </div>
          </div>
        </section>

        {savedMsg && (
          <div className="p-3 bg-[#EDF7F1] border border-[#B8DEC7] text-[#2D6A4F] flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{savedMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-[#231A18] text-white font-medium hover:bg-[#8E4F59] cursor-pointer"
        >
          {saving ? 'Salvando...' : 'Salvar todas as configurações'}
        </button>
      </form>

      {/* Segurança da Conta Admin */}
      <form onSubmit={handlePasswordChange} className="bg-white border border-[#EAE0DA] p-6 space-y-4 text-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#B76E79]" />
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">
            Alterar senha administrativa
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-[#5D4742] mb-1">Senha atual</label>
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-[#DFD2CA] px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-medium text-[#5D4742] mb-1">Nova senha</label>
            <input
              required
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-[#DFD2CA] px-3 py-2"
            />
          </div>
        </div>
        {pwMessage && <p className="text-[#5D4742]">{pwMessage}</p>}
        <button
          type="submit"
          className="px-5 py-2.5 border border-[#231A18] text-[#231A18] font-medium hover:bg-[#231A18] hover:text-white transition-colors cursor-pointer"
        >
          Atualizar senha
        </button>
      </form>
    </div>
  );
}
