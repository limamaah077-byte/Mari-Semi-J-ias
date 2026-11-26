import { Mail, MessageCircle, ShieldCheck, Truck } from 'lucide-react';
import type { StoreSettings } from '../types';

interface InfoPageProps {
  page: 'sobre' | 'contato' | 'politicas';
  settings: StoreSettings;
  onNavigate: (path: string) => void;
}

export function InfoPage({ page, settings, onNavigate }: InfoPageProps) {
  if (page === 'sobre') {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="space-y-3 border-b border-[#EAE0DA] pb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59]">
            {settings.store_name} · {settings.brand_partner}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#231A18]">
            {settings.about_title}
          </h1>
        </div>
        <div className="bg-white border border-[#EAE0DA] p-8 space-y-6 text-[15px] text-[#5D4742] leading-relaxed">
          <p>{settings.about_text}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[#F0E6E0]">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#231A18] mb-2">
                Qualidade & Banho Nobre
              </h2>
              <p className="text-sm">
                Todas as semijoias contam com camadas nobres em ouro 18k ou ródio, verniz protetor e
                tecnologia hipoalergênica livre de níquel.
              </p>
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#231A18] mb-2">
                Versatilidade em Cada Detalhe
              </h2>
              <p className="text-sm">
                Curadoria pensada para transitar entre o cotidiano elegante e ocasiões especiais,
                sempre acompanhada de embalagem cuidadosa e certificado de garantia.
              </p>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/catalogo')}
              className="px-6 py-3 bg-[#231A18] text-white text-xs font-medium cursor-pointer"
            >
              Ver coleção completa
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (page === 'contato') {
    const waLink = `https://wa.me/${settings.whatsapp_phone}?text=${encodeURIComponent(
      'Olá! Vim pelo site da Mariê Semi Joias e gostaria de tirar uma dúvida.'
    )}`;
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="space-y-3 border-b border-[#EAE0DA] pb-8">
          <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59]">Atendimento</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#231A18]">
            Fale com a Mariê Semi Joias
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#EAE0DA] p-8 space-y-4">
            <MessageCircle className="w-6 h-6 text-[#B76E79]" />
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">WhatsApp</h2>
            <p className="text-sm text-[#5D4742]">
              Atendimento direto para dúvidas sobre medidas, banhos, combinações e acompanhamento de
              pedidos.
            </p>
            <p className="text-base font-medium text-[#231A18] tabular-nums">
              {settings.whatsapp_display}
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-5 py-2.5 bg-[#231A18] text-white text-xs font-medium"
            >
              Iniciar conversa no WhatsApp
            </a>
          </div>

          <div className="bg-white border border-[#EAE0DA] p-8 space-y-4">
            <Mail className="w-6 h-6 text-[#B76E79]" />
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">
              E-mail e Redes Sociais
            </h2>
            <div className="text-sm text-[#5D4742] space-y-2">
              {settings.email && (
                <p>
                  <span className="font-medium text-[#231A18]">E-mail:</span> {settings.email}
                </p>
              )}
              {settings.instagram && (
                <p>
                  <span className="font-medium text-[#231A18]">Instagram:</span> {settings.instagram}
                </p>
              )}
              <p className="text-xs text-[#8C706A] pt-2">
                Envio para todo o Brasil via Correios e transportadoras parceiras.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-8">
      <div className="space-y-3 border-b border-[#EAE0DA] pb-8">
        <p className="text-xs tracking-[0.2em] uppercase text-[#8E4F59]">Transparência</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#231A18]">
          Políticas da Loja
        </h1>
      </div>
      <div className="space-y-6">
        <section className="bg-white border border-[#EAE0DA] p-8 space-y-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#B76E79]" />
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">
              Política de Troca, Devolução e Garantia
            </h2>
          </div>
          <p className="text-sm text-[#5D4742] leading-relaxed">{settings.policy_exchange}</p>
        </section>

        <section className="bg-white border border-[#EAE0DA] p-8 space-y-3">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-[#B76E79]" />
            <h2 className="font-display text-2xl font-semibold text-[#231A18]">
              Informações de Entrega para todo o Brasil
            </h2>
          </div>
          <p className="text-sm text-[#5D4742] leading-relaxed">{settings.policy_shipping}</p>
        </section>

        <section className="bg-white border border-[#EAE0DA] p-8 space-y-3">
          <h2 className="font-display text-2xl font-semibold text-[#231A18]">
            Política de Privacidade
          </h2>
          <p className="text-sm text-[#5D4742] leading-relaxed">{settings.policy_privacy}</p>
        </section>
      </div>
    </main>
  );
}
