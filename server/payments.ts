import crypto from 'crypto';
import QRCode from 'qrcode';
import { getServerSecret } from './db';
import type { PaymentMethod, PaymentStatus } from '../src/types';

export interface MercadoPagoPixResult {
  configured: boolean;
  mp_payment_id?: string;
  pix_qr_code?: string;
  pix_qr_code_base64?: string;
  ticket_url?: string;
  error?: string;
}

export interface MercadoPagoCheckoutResult {
  configured: boolean;
  mp_preference_id?: string;
  checkout_url?: string;
  error?: string;
}

export function mapMercadoPagoStatus(mpStatus: string): PaymentStatus {
  switch (mpStatus) {
    case 'approved':
      return 'pago';
    case 'rejected':
      return 'recusado';
    case 'cancelled':
      return 'cancelado';
    case 'refunded':
    case 'charged_back':
      return 'reembolsado';
    case 'pending':
    case 'in_process':
    case 'authorized':
    default:
      return 'aguardando_pagamento';
  }
}

export async function createPixPayment(params: {
  orderNumber: string;
  amountCents: number;
  customerName: string;
  customerEmail: string;
  customerCpf: string;
  notificationUrl: string;
}): Promise<MercadoPagoPixResult> {
  const accessToken = getServerSecret('mp_access_token');
  if (!accessToken) {
    return {
      configured: false,
      error:
        'Gateway Mercado Pago não configurado. Configure o Access Token no Painel Administrativo > Configurações para gerar PIX real.',
    };
  }

  const nameParts = params.customerName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Cliente';
  const lastName = nameParts.slice(1).join(' ') || 'Mariê';
  const cleanCpf = params.customerCpf.replace(/\D/g, '');

  const payload = {
    transaction_amount: Number((params.amountCents / 100).toFixed(2)),
    description: `Pedido ${params.orderNumber} · Mariê Semi Joias`,
    payment_method_id: 'pix',
    external_reference: params.orderNumber,
    notification_url: params.notificationUrl,
    payer: {
      email: params.customerEmail,
      first_name: firstName,
      last_name: lastName,
      identification:
        cleanCpf.length === 11
          ? { type: 'CPF', number: cleanCpf }
          : undefined,
    },
  };

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `marie-${params.orderNumber}-pix`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      id?: number | string;
      message?: string;
      point_of_interaction?: {
        transaction_data?: {
          qr_code?: string;
          qr_code_base64?: string;
          ticket_url?: string;
        };
      };
    };

    if (!response.ok || !data.id) {
      return {
        configured: true,
        error: data.message || 'Não foi possível gerar cobrança PIX no Mercado Pago.',
      };
    }

    const txData = data.point_of_interaction?.transaction_data;
    let qrBase64 = txData?.qr_code_base64 || '';
    if (!qrBase64 && txData?.qr_code) {
      const dataUrl = await QRCode.toDataURL(txData.qr_code, { width: 260, margin: 1 });
      qrBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    }

    return {
      configured: true,
      mp_payment_id: String(data.id),
      pix_qr_code: txData?.qr_code || '',
      pix_qr_code_base64: qrBase64,
      ticket_url: txData?.ticket_url || '',
    };
  } catch (err) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : 'Erro de comunicação com o Mercado Pago.',
    };
  }
}

export async function createCheckoutPreference(params: {
  orderNumber: string;
  paymentMethod: PaymentMethod;
  items: Array<{ title: string; quantity: number; unitPriceCents: number }>;
  shippingCents: number;
  discountCents: number;
  customerEmail: string;
  customerName: string;
  maxInstallments: number;
  appUrl: string;
  notificationUrl: string;
}): Promise<MercadoPagoCheckoutResult> {
  const accessToken = getServerSecret('mp_access_token');
  if (!accessToken) {
    return {
      configured: false,
      error:
        'Gateway Mercado Pago não configurado. Configure o Access Token no Painel Administrativo > Configurações para pagamentos por cartão.',
    };
  }

  const mpItems = params.items.map((item) => ({
    title: item.title,
    quantity: item.quantity,
    currency_id: 'BRL',
    unit_price: Number((item.unitPriceCents / 100).toFixed(2)),
  }));

  if (params.discountCents > 0) {
    // Adjust proportional item total or include discount accurately so MP total matches order total
    const rawItemsTotal = params.items.reduce(
      (acc, i) => acc + i.unitPriceCents * i.quantity,
      0
    );
    const ratio = Math.max(0, (rawItemsTotal - params.discountCents) / Math.max(1, rawItemsTotal));
    for (const item of mpItems) {
      item.unit_price = Number((item.unit_price * ratio).toFixed(2));
    }
  }

  const excludedTypes =
    params.paymentMethod === 'credit_card'
      ? [{ id: 'ticket' }, { id: 'atm' }, { id: 'debit_card' }]
      : params.paymentMethod === 'debit_card'
        ? [{ id: 'ticket' }, { id: 'atm' }, { id: 'credit_card' }]
        : [{ id: 'ticket' }, { id: 'atm' }];

  const body = {
    items: mpItems,
    shipments: {
      cost: Number((params.shippingCents / 100).toFixed(2)),
      mode: 'not_specified',
    },
    payer: {
      name: params.customerName,
      email: params.customerEmail,
    },
    external_reference: params.orderNumber,
    notification_url: params.notificationUrl,
    back_urls: {
      success: `${params.appUrl}/pedido/${params.orderNumber}`,
      failure: `${params.appUrl}/pedido/${params.orderNumber}`,
      pending: `${params.appUrl}/pedido/${params.orderNumber}`,
    },
    auto_return: 'approved',
    payment_methods: {
      excluded_payment_types: excludedTypes,
      installments: params.paymentMethod === 'credit_card' ? Math.max(1, params.maxInstallments) : 1,
    },
  };

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      id?: string;
      init_point?: string;
      message?: string;
    };

    if (!response.ok || !data.init_point) {
      return {
        configured: true,
        error: data.message || 'Erro ao criar link de pagamento no Mercado Pago.',
      };
    }

    return {
      configured: true,
      mp_preference_id: data.id,
      checkout_url: data.init_point,
    };
  } catch (err) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : 'Erro de comunicação com o Mercado Pago.',
    };
  }
}

export async function fetchMercadoPagoPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  external_reference?: string;
} | null> {
  const accessToken = getServerSecret('mp_access_token');
  if (!accessToken) return null;
  if (!/^\d+$/.test(paymentId)) return null;

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    id: number | string;
    status: string;
    external_reference?: string;
  };
  return {
    id: String(data.id),
    status: data.status,
    external_reference: data.external_reference,
  };
}

export function verifyMercadoPagoSignature(params: {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
}): boolean {
  const secret = getServerSecret('mp_webhook_secret');
  if (!secret) {
    // If no webhook secret is configured, still validate by fetching payment directly from Mercado Pago API
    return true;
  }
  if (!params.xSignature || !params.xRequestId || !params.dataId) {
    return false;
  }
  const parts = Object.fromEntries(
    params.xSignature.split(',').map((kv) => {
      const [k, v] = kv.trim().split('=');
      return [k, v];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
  const computed = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(computed);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
