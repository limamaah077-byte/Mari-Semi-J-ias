import type { StoreSettings } from '../types';

interface StoreFooterProps {
  settings: StoreSettings;
  onNavigate: (path: string) => void;
}

export function StoreFooter({ settings, onNavigate }: StoreFooterProps) {
  return (
    <footer className="bg-[#231A18] text-[#EDE3DC] border-t border-[#3A2D2A] no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2 space-y-3">
          <p className="font-display text-3xl font-semibold text-white tracking-wide">
            {settings.store_name}
          </p>
          <p className="text-xs tracking-widest uppercase text-[#D6B4A8]">
            Revenda Oficial {settings.brand_partner}
          </p>
          <p className="text-sm text-[#CBBAB2] max-w-md leading-relaxed">
            Semijoias com acabamento de alta joalheria, banho nobre em ouro 18k e ródio antialérgico,
            com envio segurado para todo o Brasil.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-lg font-medium text-white">Institucional</h3>
          <ul className="space-y-2 text-sm text-[#CBBAB2]">
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/catalogo')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Catálogo completo
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/sobre')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Sobre a Mariê Semi Joias
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/politicas')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Trocas, Privacidade e Entrega
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => onNavigate('/contato')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Fale conosco
              </button>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-lg font-medium text-white">Atendimento</h3>
          <ul className="space-y-2 text-sm text-[#CBBAB2]">
            <li>WhatsApp: {settings.whatsapp_display}</li>
            {settings.email && <li>E-mail: {settings.email}</li>}
            {settings.instagram && <li>Instagram: {settings.instagram}</li>}
            <li className="pt-2 text-xs text-[#A8948C]">
              Pagamentos seguros via PIX, Crédito e Débito · Envio para todo o Brasil.
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[#3A2D2A] py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#A8948C]">
          <span>
            © {new Date().getFullYear()} {settings.store_name}. Todos os direitos reservados.
          </span>
          <span>Curadoria {settings.brand_partner}</span>
        </div>
      </div>
    </footer>
  );
}
