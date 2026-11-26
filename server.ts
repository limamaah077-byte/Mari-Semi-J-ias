import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  changeAdminPassword,
  getAdminAuthStatus,
  loginAdmin,
  requireAdmin,
  setupInitialAdmin,
  type AdminRequest,
} from './server/auth';
import {
  db,
  getPublicSettings,
  hydrateProduct,
  initializeDatabase,
  type ProductRow,
} from './server/db';
import {
  createCheckoutPreference,
  createPixPayment,
  fetchMercadoPagoPayment,
  mapMercadoPagoStatus,
  verifyMercadoPagoSignature,
} from './server/payments';
import { calculateShippingQuotes, lookupViaCep } from './server/shipping';
import type {
  Coupon,
  FulfillmentStage,
  Order,
  OrderItem,
  OrderStageHistory,
  PaymentMethod,
  PaymentStatus,
  ProductVariation,
} from './src/types';

initializeDatabase();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '6mb' }));

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function getAppUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function hydrateOrder(orderRow: Record<string, unknown>, includeHistory = false): Order {
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
    .all(orderRow.id) as OrderItem[];

  const order: Order = {
    id: Number(orderRow.id),
    order_number: String(orderRow.order_number),
    customer_name: String(orderRow.customer_name),
    customer_cpf: String(orderRow.customer_cpf),
    customer_phone: String(orderRow.customer_phone),
    customer_email: String(orderRow.customer_email),
    cep: String(orderRow.cep),
    state: String(orderRow.state),
    city: String(orderRow.city),
    neighborhood: String(orderRow.neighborhood),
    street: String(orderRow.street),
    number: String(orderRow.number),
    complement: String(orderRow.complement || ''),
    shipping_method: String(orderRow.shipping_method),
    shipping_label: String(orderRow.shipping_label),
    shipping_cents: Number(orderRow.shipping_cents),
    shipping_days: Number(orderRow.shipping_days),
    subtotal_cents: Number(orderRow.subtotal_cents),
    discount_cents: Number(orderRow.discount_cents),
    coupon_code: orderRow.coupon_code ? String(orderRow.coupon_code) : null,
    total_cents: Number(orderRow.total_cents),
    payment_method: orderRow.payment_method as PaymentMethod,
    payment_status: orderRow.payment_status as PaymentStatus,
    mp_payment_id: orderRow.mp_payment_id ? String(orderRow.mp_payment_id) : null,
    mp_preference_id: orderRow.mp_preference_id ? String(orderRow.mp_preference_id) : null,
    pix_qr_code: orderRow.pix_qr_code ? String(orderRow.pix_qr_code) : null,
    pix_qr_code_base64: orderRow.pix_qr_code_base64 ? String(orderRow.pix_qr_code_base64) : null,
    checkout_url: orderRow.checkout_url ? String(orderRow.checkout_url) : null,
    fulfillment_stage: orderRow.fulfillment_stage as FulfillmentStage,
    carrier: String(orderRow.carrier || ''),
    tracking_code: String(orderRow.tracking_code || ''),
    tracking_url: String(orderRow.tracking_url || ''),
    packaging_notes: String(orderRow.packaging_notes || ''),
    internal_notes: String(orderRow.internal_notes || ''),
    shipped_at: orderRow.shipped_at ? String(orderRow.shipped_at) : null,
    delivered_at: orderRow.delivered_at ? String(orderRow.delivered_at) : null,
    created_at: String(orderRow.created_at),
    updated_at: String(orderRow.updated_at),
    items,
  };

  if (includeHistory) {
    order.history = db
      .prepare('SELECT * FROM order_stage_history WHERE order_id = ? ORDER BY id ASC')
      .all(order.id) as OrderStageHistory[];
  }
  return order;
}

function validateCouponServer(params: {
  code: string;
  subtotalCents: number;
  customerIdentifier?: string;
}): { ok: boolean; error?: string; coupon?: Coupon; discount_cents: number; free_shipping: boolean } {
  const normalized = params.code.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, error: 'Informe um código de cupom.', discount_cents: 0, free_shipping: false };
  }

  const row = db
    .prepare('SELECT * FROM coupons WHERE UPPER(code) = ?')
    .get(normalized) as (Omit<Coupon, 'active' | 'one_per_customer' | 'free_shipping'> & {
      active: number;
      one_per_customer: number;
      free_shipping: number;
    }) | undefined;

  if (!row || !row.active) {
    return { ok: false, error: 'Cupom inválido ou inativo.', discount_cents: 0, free_shipping: false };
  }

  const now = Date.now();
  if (row.valid_from && new Date(row.valid_from).getTime() > now) {
    return { ok: false, error: 'Este cupom ainda não entrou em vigência.', discount_cents: 0, free_shipping: false };
  }
  if (row.valid_until && new Date(row.valid_until).getTime() < now) {
    return { ok: false, error: 'Este cupom expirou.', discount_cents: 0, free_shipping: false };
  }
  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return { ok: false, error: 'Limite de utilizações deste cupom foi atingido.', discount_cents: 0, free_shipping: false };
  }
  if (params.subtotalCents < row.min_order_cents) {
    const minFormatted = (row.min_order_cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return {
      ok: false,
      error: `Pedido mínimo de ${minFormatted} para utilizar este cupom.`,
      discount_cents: 0,
      free_shipping: false,
    };
  }
  if (row.one_per_customer && params.customerIdentifier) {
    const cleanId = params.customerIdentifier.trim().toLowerCase();
    const used = db
      .prepare('SELECT id FROM coupon_redemptions WHERE coupon_id = ? AND customer_identifier = ?')
      .get(row.id, cleanId);
    if (used) {
      return {
        ok: false,
        error: 'Este cupom já foi utilizado com este CPF ou e-mail.',
        discount_cents: 0,
        free_shipping: false,
      };
    }
  }

  let discountCents = 0;
  if (row.discount_type === 'percent') {
    discountCents = Math.round((params.subtotalCents * row.discount_value) / 100);
  } else {
    discountCents = Math.round(row.discount_value * 100);
  }
  discountCents = Math.min(discountCents, params.subtotalCents);

  const coupon: Coupon = {
    ...row,
    active: Boolean(row.active),
    one_per_customer: Boolean(row.one_per_customer),
    free_shipping: Boolean(row.free_shipping),
  };

  return {
    ok: true,
    coupon,
    discount_cents: discountCents,
    free_shipping: coupon.free_shipping,
  };
}

function restoreOrderStockTx(orderId: number, reason: string): void {
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(orderId) as OrderItem[];

  for (const item of items) {
    if (!item.product_id) continue;
    const prod = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(item.product_id) as ProductRow | undefined;
    if (!prod) continue;

    let variations: ProductVariation[] = [];
    try {
      variations = JSON.parse(prod.variations_json || '[]');
    } catch {
      variations = [];
    }

    const prevQty = prod.stock_qty;
    const newQty = prevQty + item.quantity;

    if (item.variation_label && variations.length > 0) {
      variations = variations.map((v) =>
        v.label === item.variation_label ? { ...v, stock_qty: v.stock_qty + item.quantity } : v
      );
    }

    const nextStatus = prod.status === 'esgotado' && newQty > 0 ? 'ativo' : prod.status;

    db.prepare(
      "UPDATE products SET stock_qty = ?, variations_json = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newQty, JSON.stringify(variations), nextStatus, prod.id);

    db.prepare(
      `INSERT INTO stock_movements (product_id, variation_label, movement_type, delta_qty, previous_qty, new_qty, reason, reference_order_id)
       VALUES (?, ?, 'estorno_cancelamento', ?, ?, ?, ?, ?)`
    ).run(prod.id, item.variation_label || null, item.quantity, prevQty, newQty, reason, orderId);
  }
}

/* ========================= PUBLIC STOREFRONT API ========================= */

app.get('/api/store/bootstrap', (_req, res) => {
  const settings = getPublicSettings();
  const categories = db
    .prepare(
      `SELECT c.*, (
        SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status != 'inativo'
      ) as product_count
      FROM categories c WHERE c.active = 1 ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all();

  const productRows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status != 'inativo'
       ORDER BY p.is_featured DESC, p.id DESC`
    )
    .all() as ProductRow[];

  res.json({
    settings,
    categories,
    products: productRows.map(hydrateProduct),
  });
});

app.get('/api/products', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const filter = String(req.query.filter || '').trim();

  const rows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status != 'inativo'
       ORDER BY p.is_featured DESC, p.id DESC`
    )
    .all() as ProductRow[];

  let list = rows.map(hydrateProduct);
  if (category && category !== 'todas') {
    list = list.filter((p) => p.category_slug === category);
  }
  if (filter === 'lancamentos') list = list.filter((p) => p.is_launch);
  if (filter === 'mais-vendidos') list = list.filter((p) => p.is_bestseller);
  if (filter === 'promocoes') list = list.filter((p) => p.has_active_promo);
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category_name || '').toLowerCase().includes(q)
    );
  }

  res.json({ products: list });
});

app.get('/api/products/:slug', (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = ? AND p.status != 'inativo'`
    )
    .get(req.params.slug) as ProductRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'Peça não encontrada.' });
    return;
  }
  res.json({ product: hydrateProduct(row) });
});

app.get('/api/cep/:cep', async (req, res) => {
  const address = await lookupViaCep(req.params.cep);
  if (!address) {
    res.status(404).json({ error: 'CEP não encontrado. Verifique os 8 dígitos.' });
    return;
  }
  res.json({ address });
});

app.post('/api/shipping/quote', async (req, res) => {
  try {
    const cep = String(req.body?.cep || '');
    const subtotalCents = Math.max(0, Number(req.body?.subtotal_cents || 0));
    const couponCode = String(req.body?.coupon_code || '').trim();
    const settings = getPublicSettings();

    let freeShippingCoupon = false;
    if (couponCode) {
      const check = validateCouponServer({ code: couponCode, subtotalCents });
      if (check.ok && check.free_shipping) {
        freeShippingCoupon = true;
      }
    }

    const quotes = await calculateShippingQuotes({
      cep,
      subtotalCents,
      freeShippingCoupon,
      settings,
    });
    res.json({ quotes });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao calcular frete.' });
  }
});

app.post('/api/coupons/validate', (req, res) => {
  const code = String(req.body?.code || '');
  const subtotalCents = Math.max(0, Number(req.body?.subtotal_cents || 0));
  const customerIdentifier = String(req.body?.customer_identifier || '');

  const result = validateCouponServer({ code, subtotalCents, customerIdentifier });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({
    coupon: result.coupon,
    discount_cents: result.discount_cents,
    free_shipping: result.free_shipping,
  });
});

app.post('/api/orders', async (req, res) => {
  const body = req.body || {};
  const customerName = String(body.customer_name || '').trim();
  const customerCpf = String(body.customer_cpf || '').replace(/\D/g, '');
  const customerPhone = String(body.customer_phone || '').trim();
  const customerEmail = String(body.customer_email || '').trim().toLowerCase();
  const cep = String(body.cep || '').replace(/\D/g, '');
  const state = String(body.state || '').trim().toUpperCase();
  const city = String(body.city || '').trim();
  const neighborhood = String(body.neighborhood || '').trim();
  const street = String(body.street || '').trim();
  const number = String(body.number || '').trim();
  const complement = String(body.complement || '').trim();
  const shippingMethod = String(body.shipping_method || 'correios_pac').trim();
  const couponCode = String(body.coupon_code || '').trim().toUpperCase();
  const paymentMethod = String(body.payment_method || 'pix') as PaymentMethod;
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!customerName || customerName.length < 3) {
    res.status(400).json({ error: 'Informe seu nome completo.' });
    return;
  }
  if (customerCpf.length !== 11) {
    res.status(400).json({ error: 'Informe um CPF válido com 11 dígitos.' });
    return;
  }
  if (!customerPhone || customerPhone.replace(/\D/g, '').length < 10) {
    res.status(400).json({ error: 'Informe um telefone/WhatsApp válido.' });
    return;
  }
  if (!customerEmail || !customerEmail.includes('@')) {
    res.status(400).json({ error: 'Informe um e-mail válido.' });
    return;
  }
  if (cep.length !== 8 || !state || !city || !neighborhood || !street || !number) {
    res.status(400).json({ error: 'Preencha todos os campos obrigatórios do endereço de entrega.' });
    return;
  }
  if (!['pix', 'credit_card', 'debit_card'].includes(paymentMethod)) {
    res.status(400).json({ error: 'Forma de pagamento inválida.' });
    return;
  }
  if (rawItems.length === 0) {
    res.status(400).json({ error: 'Sua sacola está vazia.' });
    return;
  }

  const settings = getPublicSettings();

  // Compute shipping quotes first outside SQLite immediate tx (network call if Melhor Envio)
  let subtotalPreview = 0;
  for (const reqItem of rawItems) {
    const pRow = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(Number(reqItem.product_id)) as ProductRow | undefined;
    if (pRow) {
      const hydrated = hydrateProduct(pRow);
      subtotalPreview += hydrated.effective_price_cents * Math.max(1, Number(reqItem.quantity || 1));
    }
  }

  let freeShippingByCoupon = false;
  if (couponCode) {
    const preCoupon = validateCouponServer({
      code: couponCode,
      subtotalCents: subtotalPreview,
      customerIdentifier: customerCpf || customerEmail,
    });
    if (!preCoupon.ok) {
      res.status(400).json({ error: preCoupon.error });
      return;
    }
    freeShippingByCoupon = preCoupon.free_shipping;
  }

  const quotes = await calculateShippingQuotes({
    cep,
    subtotalCents: subtotalPreview,
    freeShippingCoupon: freeShippingByCoupon,
    settings,
  });
  const selectedShipping = quotes.find((q) => q.method === shippingMethod) || quotes[0];

  // Atomic immediate transaction: verifies stock, deducts stock, validates coupon, writes order
  const createOrderTx = db.transaction(() => {
    let subtotalCents = 0;
    const preparedItems: Array<{
      productId: number;
      name: string;
      sku: string;
      variationLabel: string | null;
      unitPriceCents: number;
      quantity: number;
      totalCents: number;
      imageUrl: string;
    }> = [];

    for (const rawItem of rawItems) {
      const productId = Number(rawItem.product_id);
      const qty = Math.floor(Number(rawItem.quantity || 0));
      const variationLabel = rawItem.variation_label ? String(rawItem.variation_label) : null;

      if (!productId || qty <= 0) {
        throw new Error('Item inválido no pedido.');
      }

      const row = db
        .prepare('SELECT * FROM products WHERE id = ?')
        .get(productId) as ProductRow | undefined;

      if (!row || row.status === 'inativo') {
        throw new Error('Um dos produtos selecionados não está mais disponível.');
      }

      const prod = hydrateProduct(row);
      const variations = [...prod.variations];

      if (variations.length > 0 && variationLabel) {
        const vIndex = variations.findIndex((v) => v.label === variationLabel);
        if (vIndex === -1) {
          throw new Error(`Variação "${variationLabel}" não encontrada para ${prod.name}.`);
        }
        if (!prod.allow_backorder && variations[vIndex].stock_qty < qty) {
          throw new Error(
            `Estoque insuficiente para ${prod.name} (${variationLabel}). Disponível: ${variations[vIndex].stock_qty}.`
          );
        }
        variations[vIndex] = {
          ...variations[vIndex],
          stock_qty: variations[vIndex].stock_qty - qty,
        };
      } else if (!prod.allow_backorder && (prod.status === 'esgotado' || prod.stock_qty < qty)) {
        throw new Error(
          `Estoque insuficiente para ${prod.name}. Disponível: ${Math.max(0, prod.stock_qty)}.`
        );
      }

      const prevStock = prod.stock_qty;
      const nextStock = prevStock - qty;
      const nextStatus = !prod.allow_backorder && nextStock <= 0 ? 'esgotado' : prod.status;

      db.prepare(
        "UPDATE products SET stock_qty = ?, variations_json = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(nextStock, JSON.stringify(variations), nextStatus, prod.id);

      const itemTotal = prod.effective_price_cents * qty;
      subtotalCents += itemTotal;
      preparedItems.push({
        productId: prod.id,
        name: prod.name,
        sku: prod.sku,
        variationLabel,
        unitPriceCents: prod.effective_price_cents,
        quantity: qty,
        totalCents: itemTotal,
        imageUrl: prod.images[0] || '',
      });
    }

    let discountCents = 0;
    let appliedCoupon: Coupon | undefined;
    if (couponCode) {
      const couponCheck = validateCouponServer({
        code: couponCode,
        subtotalCents,
        customerIdentifier: customerCpf,
      });
      if (!couponCheck.ok) {
        throw new Error(couponCheck.error || 'Cupom inválido.');
      }
      discountCents = couponCheck.discount_cents;
      appliedCoupon = couponCheck.coupon;
    }

    const shippingCents = selectedShipping.price_cents;
    const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
    const orderNumber = `MR-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

    const orderInsert = db
      .prepare(
        `INSERT INTO orders (
          order_number, customer_name, customer_cpf, customer_phone, customer_email,
          cep, state, city, neighborhood, street, number, complement,
          shipping_method, shipping_label, shipping_cents, shipping_days,
          subtotal_cents, discount_cents, coupon_code, total_cents,
          payment_method, payment_status, fulfillment_stage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando_pagamento', 'aguardando_separo')`
      )
      .run(
        orderNumber,
        customerName,
        customerCpf,
        customerPhone,
        customerEmail,
        cep,
        state,
        city,
        neighborhood,
        street,
        number,
        complement,
        selectedShipping.method,
        selectedShipping.label,
        shippingCents,
        selectedShipping.estimated_days,
        subtotalCents,
        discountCents,
        appliedCoupon ? appliedCoupon.code : null,
        totalCents,
        paymentMethod
      );

    const orderId = Number(orderInsert.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, product_sku, variation_label, unit_price_cents, quantity, total_cents, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMove = db.prepare(
      `INSERT INTO stock_movements (product_id, variation_label, movement_type, delta_qty, previous_qty, new_qty, reason, reference_order_id)
       VALUES (?, ?, 'saida_pedido', ?, ?, ?, ?, ?)`
    );

    for (const item of preparedItems) {
      insertItem.run(
        orderId,
        item.productId,
        item.name,
        item.sku,
        item.variationLabel,
        item.unitPriceCents,
        item.quantity,
        item.totalCents,
        item.imageUrl
      );
      const updatedProd = db
        .prepare('SELECT stock_qty FROM products WHERE id = ?')
        .get(item.productId) as { stock_qty: number };
      insertMove.run(
        item.productId,
        item.variationLabel,
        -item.quantity,
        updatedProd.stock_qty + item.quantity,
        updatedProd.stock_qty,
        `Reserva do pedido ${orderNumber}`,
        orderId
      );
    }

    if (appliedCoupon) {
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(appliedCoupon.id);
      db.prepare(
        'INSERT INTO coupon_redemptions (coupon_id, customer_identifier, order_id) VALUES (?, ?, ?)'
      ).run(appliedCoupon.id, customerCpf, orderId);
    }

    db.prepare(
      `INSERT INTO order_stage_history (order_id, from_stage, to_stage, note, changed_by)
       VALUES (?, NULL, 'aguardando_separo', 'Pedido registrado e aguardando confirmação de pagamento.', 'Sistema')`
    ).run(orderId);

    return { orderId, orderNumber, totalCents, subtotalCents, discountCents, shippingCents, preparedItems };
  });

  let created;
  try {
    created = createOrderTx.immediate();
  } catch (err) {
    res.status(409).json({
      error: err instanceof Error ? err.message : 'Não foi possível concluir o pedido.',
    });
    return;
  }

  const appUrl = getAppUrl(req);
  const notificationUrl = `${appUrl}/api/webhooks/mercadopago`;
  let paymentWarning = '';

  if (paymentMethod === 'pix') {
    const pixRes = await createPixPayment({
      orderNumber: created.orderNumber,
      amountCents: created.totalCents,
      customerName,
      customerEmail,
      customerCpf,
      notificationUrl,
    });
    if (pixRes.mp_payment_id) {
      db.prepare(
        `UPDATE orders SET mp_payment_id = ?, pix_qr_code = ?, pix_qr_code_base64 = ?, checkout_url = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(
        pixRes.mp_payment_id,
        pixRes.pix_qr_code || null,
        pixRes.pix_qr_code_base64 || null,
        pixRes.ticket_url || null,
        created.orderId
      );
    } else if (pixRes.error) {
      paymentWarning = pixRes.error;
    }
  } else {
    const prefRes = await createCheckoutPreference({
      orderNumber: created.orderNumber,
      paymentMethod,
      items: created.preparedItems.map((i) => ({
        title: i.variationLabel ? `${i.name} (${i.variationLabel})` : i.name,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
      })),
      shippingCents: created.shippingCents,
      discountCents: created.discountCents,
      customerEmail,
      customerName,
      maxInstallments: settings.mp_max_installments,
      appUrl,
      notificationUrl,
    });
    if (prefRes.checkout_url) {
      db.prepare(
        `UPDATE orders SET mp_preference_id = ?, checkout_url = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(prefRes.mp_preference_id || null, prefRes.checkout_url, created.orderId);
    } else if (prefRes.error) {
      paymentWarning = prefRes.error;
    }
  }

  const savedRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(created.orderId) as Record<
    string,
    unknown
  >;
  const order = hydrateOrder(savedRow, true);
  res.status(201).json({ order, payment_warning: paymentWarning || undefined });
});

app.get('/api/orders/:orderNumber', (req, res) => {
  const row = db
    .prepare('SELECT * FROM orders WHERE UPPER(order_number) = UPPER(?)')
    .get(req.params.orderNumber) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }

  const order = hydrateOrder(row, true);
  // Strip private internal seller notes for customer view
  order.internal_notes = '';
  order.packaging_notes = '';
  res.json({ order });
});

/* ========================= MERCADO PAGO WEBHOOK ========================= */

app.post('/api/webhooks/mercadopago', async (req, res) => {
  try {
    const queryDataId = req.query['data.id'] ? String(req.query['data.id']) : undefined;
    const bodyDataId = req.body?.data?.id ? String(req.body.data.id) : undefined;
    const paymentId = bodyDataId || queryDataId;
    const topic = String(req.body?.type || req.query.topic || '');

    if (topic && topic !== 'payment') {
      res.status(200).json({ received: true });
      return;
    }

    if (!paymentId) {
      res.status(200).json({ received: true });
      return;
    }

    const signatureOk = verifyMercadoPagoSignature({
      xSignature: req.headers['x-signature'] as string | undefined,
      xRequestId: req.headers['x-request-id'] as string | undefined,
      dataId: paymentId,
    });
    if (!signatureOk) {
      res.status(401).json({ error: 'Assinatura webhook inválida.' });
      return;
    }

    const mpPayment = await fetchMercadoPagoPayment(paymentId);
    if (!mpPayment || !mpPayment.external_reference) {
      res.status(200).json({ received: true });
      return;
    }

    const mappedStatus = mapMercadoPagoStatus(mpPayment.status);

    const updateTx = db.transaction(() => {
      const orderRow = db
        .prepare('SELECT * FROM orders WHERE order_number = ?')
        .get(mpPayment.external_reference) as Record<string, unknown> | undefined;
      if (!orderRow) return;

      const prevStatus = String(orderRow.payment_status) as PaymentStatus;
      if (prevStatus === mappedStatus) return;

      db.prepare(
        "UPDATE orders SET payment_status = ?, mp_payment_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(mappedStatus, mpPayment.id, orderRow.id);

      if (mappedStatus === 'pago') {
        db.prepare(
          `INSERT INTO order_stage_history (order_id, from_stage, to_stage, note, changed_by)
           VALUES (?, ?, ?, 'Pagamento confirmado automaticamente via Mercado Pago.', 'Webhook Mercado Pago')`
        ).run(orderRow.id, orderRow.fulfillment_stage, orderRow.fulfillment_stage);
      } else if (
        (mappedStatus === 'recusado' || mappedStatus === 'cancelado' || mappedStatus === 'reembolsado') &&
        prevStatus !== 'recusado' &&
        prevStatus !== 'cancelado' &&
        prevStatus !== 'reembolsado'
      ) {
        restoreOrderStockTx(
          Number(orderRow.id),
          `Estorno automático (${mappedStatus}) do pedido ${orderRow.order_number}`
        );
        db.prepare(
          `INSERT INTO order_stage_history (order_id, from_stage, to_stage, note, changed_by)
           VALUES (?, ?, ?, ?, 'Webhook Mercado Pago')`
        ).run(
          orderRow.id,
          orderRow.fulfillment_stage,
          orderRow.fulfillment_stage,
          `Pagamento atualizado para ${mappedStatus}. Estoque restaurado.`
        );
      }
    });

    updateTx.immediate();
    res.status(200).json({ received: true });
  } catch {
    res.status(500).json({ error: 'Erro ao processar webhook.' });
  }
});

/* ========================= ADMIN AUTH ROUTES ========================= */

app.get('/api/admin/auth/status', (_req, res) => {
  res.json(getAdminAuthStatus());
});

app.post('/api/admin/auth/setup', (req, res) => {
  const result = setupInitialAdmin(
    String(req.body?.phone || ''),
    String(req.body?.password || ''),
    req.body?.name ? String(req.body.name) : undefined
  );
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ token: result.token, admin: result.admin });
});

app.post('/api/admin/auth/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const result = loginAdmin(
    ip,
    String(req.body?.phone || ''),
    String(req.body?.password || '')
  );
  if (!result.ok) {
    res.status(401).json({ error: result.error });
    return;
  }
  res.json({ token: result.token, admin: result.admin });
});

app.get('/api/admin/auth/me', requireAdmin, (req: AdminRequest, res) => {
  res.json({ admin: req.adminUser });
});

app.post('/api/admin/auth/change-password', requireAdmin, (req, res) => {
  const result = changeAdminPassword(
    String(req.body?.current_password || ''),
    String(req.body?.new_password || '')
  );
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});

/* ========================= PROTECTED ADMIN API ========================= */

app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  const period = String(req.query.period || '30d');
  let dateClause = '';
  if (period === 'today') {
    dateClause = "AND date(created_at, 'localtime') = date('now', 'localtime')";
  } else if (period === '7d') {
    dateClause = "AND created_at >= datetime('now', '-7 days')";
  } else if (period === '30d') {
    dateClause = "AND created_at >= datetime('now', '-30 days')";
  }

  const paidFilter = "payment_status = 'pago'";

  const salesToday = (
    db
      .prepare(
        `SELECT COALESCE(SUM(total_cents), 0) as total FROM orders WHERE ${paidFilter} AND date(created_at, 'localtime') = date('now', 'localtime')`
      )
      .get() as { total: number }
  ).total;

  const salesMonth = (
    db
      .prepare(
        `SELECT COALESCE(SUM(total_cents), 0) as total FROM orders WHERE ${paidFilter} AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`
      )
      .get() as { total: number }
  ).total;

  const totalRevenue = (
    db
      .prepare(`SELECT COALESCE(SUM(total_cents), 0) as total FROM orders WHERE ${paidFilter} ${dateClause}`)
      .get() as { total: number }
  ).total;

  const ordersCount = (
    db
      .prepare(`SELECT COUNT(*) as c FROM orders WHERE 1=1 ${dateClause}`)
      .get() as { c: number }
  ).c;

  const stageRows = db
    .prepare(
      `SELECT fulfillment_stage, COUNT(*) as c FROM orders WHERE payment_status != 'cancelado' AND payment_status != 'recusado' GROUP BY fulfillment_stage`
    )
    .all() as Array<{ fulfillment_stage: string; c: number }>;

  const stageCounts = {
    aguardando_separo: 0,
    separado: 0,
    despachado: 0,
    entregue: 0,
  };
  for (const s of stageRows) {
    if (s.fulfillment_stage in stageCounts) {
      stageCounts[s.fulfillment_stage as keyof typeof stageCounts] = s.c;
    }
  }

  const lowStockCount = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM products WHERE status != 'inativo' AND stock_qty > 0 AND stock_qty <= low_stock_threshold"
      )
      .get() as { c: number }
  ).c;

  const outOfStockCount = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM products WHERE status = 'esgotado' OR stock_qty <= 0"
      )
      .get() as { c: number }
  ).c;

  const activeCouponsCount = (
    db.prepare('SELECT COUNT(*) as c FROM coupons WHERE active = 1').get() as { c: number }
  ).c;

  const topProducts = db
    .prepare(
      `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.total_cents) as total_cents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.payment_status != 'cancelado' AND o.payment_status != 'recusado' ${dateClause.replace(/created_at/g, 'o.created_at')}
       GROUP BY oi.product_id, oi.product_name
       ORDER BY total_qty DESC
       LIMIT 5`
    )
    .all();

  const dailySeries = db
    .prepare(
      `SELECT date(created_at, 'localtime') as date,
              COALESCE(SUM(CASE WHEN payment_status = 'pago' THEN total_cents ELSE 0 END), 0) as revenue_cents,
              COUNT(*) as orders
       FROM orders
       WHERE created_at >= datetime('now', '-14 days')
       GROUP BY date(created_at, 'localtime')
       ORDER BY date ASC`
    )
    .all();

  res.json({
    metrics: {
      sales_today_cents: salesToday,
      sales_month_cents: salesMonth,
      total_revenue_cents: totalRevenue,
      orders_count: ordersCount,
      stage_counts: stageCounts,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      active_coupons_count: activeCouponsCount,
      top_products: topProducts,
      daily_series: dailySeries,
    },
  });
});

/* ---- Admin Products ---- */

app.get('/api/admin/products', requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.id DESC`
    )
    .all() as ProductRow[];
  res.json({ products: rows.map(hydrateProduct) });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const sku = String(b.sku || '').trim() || `LV-${Date.now().toString().slice(-5)}`;
    if (!name) {
      res.status(400).json({ error: 'Informe o nome da peça.' });
      return;
    }

    let slug = slugify(b.slug ? String(b.slug) : name);
    const existingSlug = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (existingSlug) slug = `${slug}-${Date.now().toString().slice(-4)}`;

    const priceCents = Math.max(100, Math.round(Number(b.price_cents || 0)));
    const discountType = String(b.discount_type || 'none');
    const discountValue = Number(b.discount_value || 0);
    let promoPriceCents: number | null = b.promo_price_cents ? Math.round(Number(b.promo_price_cents)) : null;

    if (discountType === 'percent' && discountValue > 0) {
      promoPriceCents = Math.max(100, Math.round(priceCents * (1 - discountValue / 100)));
    } else if (discountType === 'fixed' && discountValue > 0) {
      promoPriceCents = Math.max(100, priceCents - Math.round(discountValue * 100));
    } else if (discountType === 'none') {
      promoPriceCents = null;
    }

    const stockQty = Math.max(0, Math.floor(Number(b.stock_qty || 0)));
    const allowBackorder = b.allow_backorder ? 1 : 0;
    let status = String(b.status || 'ativo');
    if (stockQty === 0 && !allowBackorder && status === 'ativo') {
      status = 'esgotado';
    }

    const images = Array.isArray(b.images) ? b.images.filter(Boolean) : [];
    const variations = Array.isArray(b.variations) ? b.variations : [];

    const info = db
      .prepare(
        `INSERT INTO products (
          name, slug, sku, description, characteristics, warranty_info, notes,
          category_id, price_cents, promo_price_cents, discount_type, discount_value,
          promo_start, promo_end, stock_qty, low_stock_threshold, allow_backorder,
          status, is_featured, is_launch, is_bestseller, images_json, variations_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        slug,
        sku,
        String(b.description || ''),
        String(b.characteristics || ''),
        String(b.warranty_info || ''),
        String(b.notes || ''),
        b.category_id ? Number(b.category_id) : null,
        priceCents,
        promoPriceCents,
        discountType,
        discountValue,
        b.promo_start || null,
        b.promo_end || null,
        stockQty,
        Math.max(1, Number(b.low_stock_threshold || 3)),
        allowBackorder,
        status,
        b.is_featured ? 1 : 0,
        b.is_launch ? 1 : 0,
        b.is_bestseller ? 1 : 0,
        JSON.stringify(images),
        JSON.stringify(variations)
      );

    if (stockQty > 0) {
      db.prepare(
        `INSERT INTO stock_movements (product_id, movement_type, delta_qty, previous_qty, new_qty, reason)
         VALUES (?, 'entrada', ?, 0, ?, 'Cadastro inicial do produto')`
      ).run(info.lastInsertRowid, stockQty, stockQty);
    }

    const created = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`
      )
      .get(info.lastInsertRowid) as ProductRow;

    res.status(201).json({ product: hydrateProduct(created) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao cadastrar produto.' });
  }
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    const b = req.body || {};
    const name = String(b.name ?? existing.name).trim();
    const sku = String(b.sku ?? existing.sku).trim();
    const priceCents = Math.max(100, Math.round(Number(b.price_cents ?? existing.price_cents)));
    const discountType = String(b.discount_type ?? existing.discount_type);
    const discountValue = Number(b.discount_value ?? existing.discount_value);

    let promoPriceCents: number | null =
      b.promo_price_cents !== undefined ? (b.promo_price_cents ? Math.round(Number(b.promo_price_cents)) : null) : existing.promo_price_cents;

    if (discountType === 'percent' && discountValue > 0) {
      promoPriceCents = Math.max(100, Math.round(priceCents * (1 - discountValue / 100)));
    } else if (discountType === 'fixed' && discountValue > 0) {
      promoPriceCents = Math.max(100, priceCents - Math.round(discountValue * 100));
    } else if (discountType === 'none') {
      promoPriceCents = null;
    }

    const stockQty = Math.max(0, Math.floor(Number(b.stock_qty ?? existing.stock_qty)));
    const allowBackorder = b.allow_backorder !== undefined ? (b.allow_backorder ? 1 : 0) : existing.allow_backorder;
    let status = String(b.status ?? existing.status);
    if (stockQty === 0 && !allowBackorder && status === 'ativo') {
      status = 'esgotado';
    } else if (stockQty > 0 && status === 'esgotado' && b.status === undefined) {
      status = 'ativo';
    }

    const images = Array.isArray(b.images) ? b.images.filter(Boolean) : JSON.parse(existing.images_json || '[]');
    const variations = Array.isArray(b.variations) ? b.variations : JSON.parse(existing.variations_json || '[]');

    db.prepare(
      `UPDATE products SET
        name = ?, sku = ?, description = ?, characteristics = ?, warranty_info = ?, notes = ?,
        category_id = ?, price_cents = ?, promo_price_cents = ?, discount_type = ?, discount_value = ?,
        promo_start = ?, promo_end = ?, stock_qty = ?, low_stock_threshold = ?, allow_backorder = ?,
        status = ?, is_featured = ?, is_launch = ?, is_bestseller = ?, images_json = ?, variations_json = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      name,
      sku,
      String(b.description ?? existing.description),
      String(b.characteristics ?? existing.characteristics),
      String(b.warranty_info ?? existing.warranty_info),
      String(b.notes ?? existing.notes),
      b.category_id !== undefined ? (b.category_id ? Number(b.category_id) : null) : existing.category_id,
      priceCents,
      promoPriceCents,
      discountType,
      discountValue,
      b.promo_start !== undefined ? b.promo_start || null : existing.promo_start,
      b.promo_end !== undefined ? b.promo_end || null : existing.promo_end,
      stockQty,
      Math.max(1, Number(b.low_stock_threshold ?? existing.low_stock_threshold)),
      allowBackorder,
      status,
      b.is_featured !== undefined ? (b.is_featured ? 1 : 0) : existing.is_featured,
      b.is_launch !== undefined ? (b.is_launch ? 1 : 0) : existing.is_launch,
      b.is_bestseller !== undefined ? (b.is_bestseller ? 1 : 0) : existing.is_bestseller,
      JSON.stringify(images),
      JSON.stringify(variations),
      id
    );

    if (stockQty !== existing.stock_qty) {
      db.prepare(
        `INSERT INTO stock_movements (product_id, movement_type, delta_qty, previous_qty, new_qty, reason)
         VALUES (?, 'ajuste', ?, ?, ?, 'Atualização pela edição do produto')`
      ).run(id, stockQty - existing.stock_qty, existing.stock_qty, stockQty);
    }

    const updated = db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`
      )
      .get(id) as ProductRow;

    res.json({ product: hydrateProduct(updated) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar produto.' });
  }
});

app.post('/api/admin/products/:id/duplicate', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Produto não encontrado.' });
    return;
  }

  const suffix = Date.now().toString().slice(-4);
  const newName = `${existing.name} (Cópia)`;
  const newSlug = `${existing.slug}-copia-${suffix}`;
  const newSku = `${existing.sku}-${suffix}`;

  const info = db
    .prepare(
      `INSERT INTO products (
        name, slug, sku, description, characteristics, warranty_info, notes,
        category_id, price_cents, promo_price_cents, discount_type, discount_value,
        promo_start, promo_end, stock_qty, low_stock_threshold, allow_backorder,
        status, is_featured, is_launch, is_bestseller, images_json, variations_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inativo', 0, ?, ?, ?, ?)`
    )
    .run(
      newName,
      newSlug,
      newSku,
      existing.description,
      existing.characteristics,
      existing.warranty_info,
      existing.notes,
      existing.category_id,
      existing.price_cents,
      existing.promo_price_cents,
      existing.discount_type,
      existing.discount_value,
      existing.promo_start,
      existing.promo_end,
      existing.stock_qty,
      existing.low_stock_threshold,
      existing.allow_backorder,
      existing.is_launch,
      existing.is_bestseller,
      existing.images_json,
      existing.variations_json
    );

  const created = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`
    )
    .get(info.lastInsertRowid) as ProductRow;
  res.status(201).json({ product: hydrateProduct(created) });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true });
});

/* ---- Admin Categories ---- */

app.get('/api/admin/categories', requireAdmin, (_req, res) => {
  const categories = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
       FROM categories c ORDER BY c.sort_order ASC, c.id ASC`
    )
    .all();
  res.json({ categories });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Informe o nome da categoria.' });
    return;
  }
  let slug = slugify(name);
  if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
    slug = `${slug}-${Date.now().toString().slice(-3)}`;
  }
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM categories').get() as { m: number }
  ).m;

  const info = db
    .prepare('INSERT INTO categories (name, slug, description, sort_order, active) VALUES (?, ?, ?, ?, ?)')
    .run(name, slug, String(req.body?.description || ''), maxOrder + 1, req.body?.active === false ? 0 : 1);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ category });
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as
    | { id: number; name: string; slug: string; description: string; sort_order: number; active: number }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Categoria não encontrada.' });
    return;
  }

  const name = String(req.body?.name ?? existing.name).trim();
  const description = String(req.body?.description ?? existing.description);
  const sortOrder = Number(req.body?.sort_order ?? existing.sort_order);
  const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : existing.active;

  db.prepare('UPDATE categories SET name = ?, description = ?, sort_order = ?, active = ? WHERE id = ?').run(
    name,
    description,
    sortOrder,
    active,
    id
  );
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json({ category: updated });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ---- Admin Coupons ---- */

app.get('/api/admin/coupons', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() as Array<Record<string, unknown>>;
  res.json({
    coupons: rows.map((r) => ({
      ...r,
      active: Boolean(r.active),
      one_per_customer: Boolean(r.one_per_customer),
      free_shipping: Boolean(r.free_shipping),
    })),
  });
});

app.post('/api/admin/coupons', requireAdmin, (req, res) => {
  try {
    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Informe o código do cupom.' });
      return;
    }
    const info = db
      .prepare(
        `INSERT INTO coupons (code, discount_type, discount_value, min_order_cents, max_uses, one_per_customer, free_shipping, valid_from, valid_until, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        b.discount_type === 'fixed' ? 'fixed' : 'percent',
        Math.max(0, Number(b.discount_value || 0)),
        Math.max(0, Math.round(Number(b.min_order_cents || 0))),
        b.max_uses ? Number(b.max_uses) : null,
        b.one_per_customer ? 1 : 0,
        b.free_shipping ? 1 : 0,
        b.valid_from || null,
        b.valid_until || null,
        b.active === false ? 0 : 1
      );
    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ coupon });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar cupom.' });
  }
});

app.put('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Cupom não encontrado.' });
    return;
  }
  const b = req.body || {};
  db.prepare(
    `UPDATE coupons SET code = ?, discount_type = ?, discount_value = ?, min_order_cents = ?, max_uses = ?,
     one_per_customer = ?, free_shipping = ?, valid_from = ?, valid_until = ?, active = ? WHERE id = ?`
  ).run(
    String(b.code ?? existing.code).trim().toUpperCase(),
    b.discount_type ?? existing.discount_type,
    Number(b.discount_value ?? existing.discount_value),
    Number(b.min_order_cents ?? existing.min_order_cents),
    b.max_uses !== undefined ? (b.max_uses ? Number(b.max_uses) : null) : existing.max_uses,
    b.one_per_customer !== undefined ? (b.one_per_customer ? 1 : 0) : existing.one_per_customer,
    b.free_shipping !== undefined ? (b.free_shipping ? 1 : 0) : existing.free_shipping,
    b.valid_from !== undefined ? b.valid_from || null : existing.valid_from,
    b.valid_until !== undefined ? b.valid_until || null : existing.valid_until,
    b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
    id
  );
  res.json({ ok: true });
});

app.delete('/api/admin/coupons/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ---- Admin Orders & 4-Stage Fulfillment Workflow ---- */

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const stage = String(req.query.stage || '').trim();
  const q = String(req.query.q || '').trim().toLowerCase();
  const dateFrom = String(req.query.date_from || '').trim();
  const dateTo = String(req.query.date_to || '').trim();

  let rows = db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC')
    .all() as Array<Record<string, unknown>>;

  if (stage && stage !== 'todos') {
    rows = rows.filter((r) => r.fulfillment_stage === stage);
  }
  if (q) {
    rows = rows.filter(
      (r) =>
        String(r.order_number).toLowerCase().includes(q) ||
        String(r.customer_name).toLowerCase().includes(q) ||
        String(r.customer_email).toLowerCase().includes(q) ||
        String(r.customer_cpf).includes(q)
    );
  }
  if (dateFrom) {
    rows = rows.filter((r) => String(r.created_at).slice(0, 10) >= dateFrom);
  }
  if (dateTo) {
    rows = rows.filter((r) => String(r.created_at).slice(0, 10) <= dateTo);
  }

  res.json({ orders: rows.map((r) => hydrateOrder(r, true)) });
});

app.get('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }
  res.json({ order: hydrateOrder(row, true) });
});

app.patch('/api/admin/orders/:id/stage', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Pedido não encontrado.' });
    return;
  }

  const nextStage = String(req.body?.fulfillment_stage || existing.fulfillment_stage) as FulfillmentStage;
  if (!['aguardando_separo', 'separado', 'despachado', 'entregue'].includes(nextStage)) {
    res.status(400).json({ error: 'Etapa inválida.' });
    return;
  }

  const carrier = req.body?.carrier !== undefined ? String(req.body.carrier) : String(existing.carrier || '');
  const trackingCode =
    req.body?.tracking_code !== undefined ? String(req.body.tracking_code) : String(existing.tracking_code || '');
  const trackingUrl =
    req.body?.tracking_url !== undefined ? String(req.body.tracking_url) : String(existing.tracking_url || '');
  const packagingNotes =
    req.body?.packaging_notes !== undefined
      ? String(req.body.packaging_notes)
      : String(existing.packaging_notes || '');
  const internalNotes =
    req.body?.internal_notes !== undefined
      ? String(req.body.internal_notes)
      : String(existing.internal_notes || '');

  const shippedAt =
    req.body?.shipped_at !== undefined
      ? req.body.shipped_at || null
      : nextStage === 'despachado' && !existing.shipped_at
        ? new Date().toISOString()
        : existing.shipped_at;

  const deliveredAt =
    nextStage === 'entregue' && !existing.delivered_at
      ? new Date().toISOString()
      : existing.delivered_at;

  const stageLabels: Record<FulfillmentStage, string> = {
    aguardando_separo: 'Pedido Aguardando Separo',
    separado: 'Pedido Separado',
    despachado: 'Pedido Despachado',
    entregue: 'Pedido Entregue',
  };

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE orders SET
        fulfillment_stage = ?, carrier = ?, tracking_code = ?, tracking_url = ?,
        packaging_notes = ?, internal_notes = ?, shipped_at = ?, delivered_at = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nextStage,
      carrier,
      trackingCode,
      trackingUrl,
      packagingNotes,
      internalNotes,
      shippedAt,
      deliveredAt,
      id
    );

    if (existing.fulfillment_stage !== nextStage || req.body?.history_note) {
      const note =
        String(req.body?.history_note || '').trim() ||
        `Movido para ${stageLabels[nextStage]}${trackingCode ? ` · Rastreio: ${trackingCode}` : ''}`;
      db.prepare(
        `INSERT INTO order_stage_history (order_id, from_stage, to_stage, note, changed_by)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, existing.fulfillment_stage, nextStage, note, req.adminUser?.name || 'Admin');
    }
  });

  tx.immediate();
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({ order: hydrateOrder(updated, true) });
});

app.patch('/api/admin/orders/:id/payment-status', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const nextStatus = String(req.body?.payment_status || '') as PaymentStatus;
  if (!['aguardando_pagamento', 'pago', 'recusado', 'cancelado', 'reembolsado'].includes(nextStatus)) {
    res.status(400).json({ error: 'Status de pagamento inválido.' });
    return;
  }

  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) throw new Error('Pedido não encontrado.');

    const prevStatus = String(existing.payment_status) as PaymentStatus;
    db.prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(
      nextStatus,
      id
    );

    if (
      (nextStatus === 'recusado' || nextStatus === 'cancelado' || nextStatus === 'reembolsado') &&
      prevStatus !== 'recusado' &&
      prevStatus !== 'cancelado' &&
      prevStatus !== 'reembolsado'
    ) {
      restoreOrderStockTx(id, `Estorno por status ${nextStatus} alterado no painel`);
    }

    db.prepare(
      `INSERT INTO order_stage_history (order_id, from_stage, to_stage, note, changed_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      id,
      existing.fulfillment_stage,
      existing.fulfillment_stage,
      `Status de pagamento alterado para "${nextStatus}".`,
      req.adminUser?.name || 'Admin'
    );
  });

  try {
    tx.immediate();
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ order: hydrateOrder(updated, true) });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar pagamento.' });
  }
});

/* ---- Admin Stock ---- */

app.get('/api/admin/stock', requireAdmin, (_req, res) => {
  const products = (
    db
      .prepare(
        `SELECT p.*, c.name as category_name, c.slug as category_slug
         FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.stock_qty ASC, p.name ASC`
      )
      .all() as ProductRow[]
  ).map(hydrateProduct);

  const movements = db
    .prepare(
      `SELECT sm.*, p.name as product_name, p.sku as product_sku
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       ORDER BY sm.id DESC
       LIMIT 150`
    )
    .all();

  res.json({ products, movements });
});

app.post('/api/admin/stock/adjust', requireAdmin, (req, res) => {
  const productId = Number(req.body?.product_id);
  const deltaQty = Math.trunc(Number(req.body?.delta_qty || 0));
  const movementType = req.body?.movement_type === 'entrada' ? 'entrada' : 'ajuste';
  const variationLabel = req.body?.variation_label ? String(req.body.variation_label) : null;
  const reason = String(req.body?.reason || '').trim() || 'Ajuste manual de estoque';

  if (!productId || deltaQty === 0) {
    res.status(400).json({ error: 'Informe o produto e uma quantidade diferente de zero.' });
    return;
  }

  const tx = db.transaction(() => {
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow | undefined;
    if (!prod) throw new Error('Produto não encontrado.');

    let variations: ProductVariation[] = [];
    try {
      variations = JSON.parse(prod.variations_json || '[]');
    } catch {
      variations = [];
    }

    if (variationLabel && variations.length > 0) {
      variations = variations.map((v) =>
        v.label === variationLabel ? { ...v, stock_qty: Math.max(0, v.stock_qty + deltaQty) } : v
      );
    }

    const prevQty = prod.stock_qty;
    const newQty = Math.max(0, prevQty + deltaQty);
    let nextStatus = prod.status;
    if (newQty <= 0 && !prod.allow_backorder && prod.status === 'ativo') {
      nextStatus = 'esgotado';
    } else if (newQty > 0 && prod.status === 'esgotado') {
      nextStatus = 'ativo';
    }

    db.prepare(
      "UPDATE products SET stock_qty = ?, variations_json = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newQty, JSON.stringify(variations), nextStatus, productId);

    db.prepare(
      `INSERT INTO stock_movements (product_id, variation_label, movement_type, delta_qty, previous_qty, new_qty, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(productId, variationLabel, movementType, deltaQty, prevQty, newQty, reason);
  });

  try {
    tx.immediate();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao movimentar estoque.' });
  }
});

/* ---- Admin Reports ---- */

app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const dateFrom = String(req.query.date_from || '').trim();
  const dateTo = String(req.query.date_to || '').trim();

  const filters: string[] = [];
  const params: string[] = [];
  if (dateFrom) {
    filters.push("date(created_at, 'localtime') >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    filters.push("date(created_at, 'localtime') <= ?");
    params.push(dateTo);
  }
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const summary = db
    .prepare(
      `SELECT
         COUNT(*) as total_orders,
         COALESCE(SUM(CASE WHEN payment_status = 'pago' THEN total_cents ELSE 0 END), 0) as paid_revenue_cents,
         COALESCE(SUM(CASE WHEN payment_status = 'aguardando_pagamento' THEN total_cents ELSE 0 END), 0) as pending_revenue_cents,
         COALESCE(SUM(CASE WHEN payment_status = 'pago' THEN discount_cents ELSE 0 END), 0) as discounts_cents,
         COALESCE(SUM(CASE WHEN payment_status = 'pago' THEN shipping_cents ELSE 0 END), 0) as shipping_cents
       FROM orders ${whereClause}`
    )
    .get(...params);

  const byPayment = db
    .prepare(
      `SELECT payment_method, COUNT(*) as orders, COALESCE(SUM(total_cents), 0) as total_cents
       FROM orders ${whereClause ? `${whereClause} AND payment_status = 'pago'` : "WHERE payment_status = 'pago'"}
       GROUP BY payment_method`
    )
    .all(...params);

  const byProduct = db
    .prepare(
      `SELECT oi.product_name, oi.product_sku, SUM(oi.quantity) as qty, SUM(oi.total_cents) as total_cents
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.payment_status = 'pago' ${dateFrom ? "AND date(o.created_at, 'localtime') >= ?" : ''} ${dateTo ? "AND date(o.created_at, 'localtime') <= ?" : ''}
       GROUP BY oi.product_name, oi.product_sku
       ORDER BY total_cents DESC`
    )
    .all(...params);

  res.json({ summary, by_payment: byPayment, by_product: byProduct });
});

/* ---- Admin Settings ---- */

app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({ settings: getPublicSettings() });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const body = req.body || {};
  const allowedKeys = [
    'store_name',
    'brand_partner',
    'logo_url',
    'hero_title',
    'hero_subtitle',
    'hero_cta',
    'hero_image',
    'announcement_text',
    'announcement_active',
    'whatsapp_phone',
    'whatsapp_display',
    'email',
    'instagram',
    'about_title',
    'about_text',
    'policy_exchange',
    'policy_privacy',
    'policy_shipping',
    'origin_cep',
    'free_shipping_threshold_cents',
    'pac_base_cents',
    'sedex_base_cents',
    'mp_max_installments',
  ];

  const upsertSetting = db.prepare(
    'INSERT INTO store_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const upsertSecret = db.prepare(
    "INSERT INTO server_secrets (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  );

  const tx = db.transaction(() => {
    for (const k of allowedKeys) {
      if (body[k] !== undefined) {
        upsertSetting.run(k, String(body[k]));
      }
    }
    if (typeof body.mp_access_token === 'string' && body.mp_access_token.trim()) {
      upsertSecret.run('mp_access_token', body.mp_access_token.trim());
    }
    if (typeof body.mp_webhook_secret === 'string' && body.mp_webhook_secret.trim()) {
      upsertSecret.run('mp_webhook_secret', body.mp_webhook_secret.trim());
    }
    if (typeof body.melhor_envio_token === 'string' && body.melhor_envio_token.trim()) {
      upsertSecret.run('melhor_envio_token', body.melhor_envio_token.trim());
    }
  });

  tx.immediate();
  res.json({ settings: getPublicSettings() });
});

/* ========================= SERVER BOOTSTRAP ========================= */

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Mariê Semi Joias rodando em http://0.0.0.0:${port}`);
  });
}

startServer();
