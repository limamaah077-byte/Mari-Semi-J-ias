import { getServerSecret } from './db';
import type { ShippingQuote, StoreSettings } from '../src/types';

export interface ViaCepAddress {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

export async function lookupViaCep(rawCep: string): Promise<ViaCepAddress | null> {
  const clean = rawCep.replace(/\D/g, '');
  if (!/^\d{8}$/.test(clean)) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean;
      cep?: string;
      uf?: string;
      localidade?: string;
      bairro?: string;
      logradouro?: string;
    };
    if (data.erro || !data.uf) return null;
    return {
      cep: clean,
      state: data.uf,
      city: data.localidade || '',
      neighborhood: data.bairro || '',
      street: data.logradouro || '',
    };
  } catch {
    return null;
  }
}

function getRegionMultiplier(cep: string): { factor: number; pacDays: number; sedexDays: number } {
  const firstDigit = cep[0];
  // 0xxxx = Grande SP, 1xxxx = Interior SP
  if (firstDigit === '0') return { factor: 0.8, pacDays: 3, sedexDays: 1 };
  if (firstDigit === '1') return { factor: 0.95, pacDays: 4, sedexDays: 2 };
  // 2xxxx = RJ/ES, 3xxxx = MG
  if (firstDigit === '2' || firstDigit === '3') return { factor: 1.05, pacDays: 5, sedexDays: 2 };
  // 8xxxx = PR/SC, 9xxxx = RS
  if (firstDigit === '8' || firstDigit === '9') return { factor: 1.15, pacDays: 6, sedexDays: 3 };
  // 7xxxx = Centro-Oeste
  if (firstDigit === '7') return { factor: 1.25, pacDays: 7, sedexDays: 3 };
  // 4xxxx, 5xxxx = BA/SE/PE/AL/PB/RN
  if (firstDigit === '4' || firstDigit === '5') return { factor: 1.45, pacDays: 9, sedexDays: 4 };
  // 6xxxx = Norte / CE/PI/MA
  return { factor: 1.65, pacDays: 11, sedexDays: 5 };
}

export async function calculateShippingQuotes(params: {
  cep: string;
  subtotalCents: number;
  freeShippingCoupon: boolean;
  settings: StoreSettings;
}): Promise<ShippingQuote[]> {
  const cleanCep = params.cep.replace(/\D/g, '');
  if (!/^\d{8}$/.test(cleanCep)) {
    throw new Error('CEP inválido. Informe os 8 dígitos.');
  }

  const freeByThreshold =
    params.settings.free_shipping_threshold_cents > 0 &&
    params.subtotalCents >= params.settings.free_shipping_threshold_cents;
  const freeShipping = params.freeShippingCoupon || freeByThreshold;

  const melhorEnvioToken = getServerSecret('melhor_envio_token');
  if (melhorEnvioToken) {
    try {
      const origin = params.settings.origin_cep.replace(/\D/g, '') || '01310100';
      const resp = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${melhorEnvioToken}`,
          'User-Agent': 'MarieSemiJoias/1.0',
        },
        body: JSON.stringify({
          from: { postal_code: origin },
          to: { postal_code: cleanCep },
          products: [
            {
              id: 'joias',
              width: 16,
              height: 6,
              length: 20,
              weight: 0.25,
              insurance_value: Math.max(50, params.subtotalCents / 100),
              quantity: 1,
            },
          ],
        }),
      });
      if (resp.ok) {
        const list = (await resp.json()) as Array<{
          id?: number;
          name?: string;
          price?: string;
          delivery_time?: number;
          error?: string;
          company?: { name?: string };
        }>;
        const valid = list
          .filter((item) => !item.error && item.price && item.delivery_time)
          .slice(0, 4)
          .map((item, idx) => {
            const cents = Math.round(Number(item.price) * 100);
            const isCheapest = idx === 0;
            const applyFree = freeShipping && isCheapest;
            return {
              method: `melhorenvio_${item.id ?? idx}`,
              label: `${item.company?.name ? `${item.company.name} · ` : ''}${item.name || 'Envio'}`,
              price_cents: applyFree ? 0 : cents,
              estimated_days: item.delivery_time || 5,
              carrier: item.company?.name || 'Correios',
              is_free: applyFree,
            };
          });
        if (valid.length > 0) {
          return valid;
        }
      }
    } catch {
      // Fallback gracefully to store configurable Correios regional table
    }
  }

  const region = getRegionMultiplier(cleanCep);
  const pacCents = freeShipping ? 0 : Math.round(params.settings.pac_base_cents * region.factor);
  const sedexCents = Math.round(params.settings.sedex_base_cents * region.factor);

  return [
    {
      method: 'correios_pac',
      label: freeShipping ? 'Correios PAC · Frete Grátis' : 'Correios PAC',
      price_cents: pacCents,
      estimated_days: region.pacDays,
      carrier: 'Correios',
      is_free: freeShipping,
    },
    {
      method: 'correios_sedex',
      label: 'Correios SEDEX (Expresso)',
      price_cents: sedexCents,
      estimated_days: region.sedexDays,
      carrier: 'Correios',
      is_free: false,
    },
  ];
}
