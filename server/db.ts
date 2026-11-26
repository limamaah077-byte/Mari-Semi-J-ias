import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { Product, ProductVariation, StoreSettings } from '../src/types';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'marie.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_normalized TEXT NOT NULL UNIQUE,
      display_phone TEXT NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_secrets (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      characteristics TEXT NOT NULL DEFAULT '',
      warranty_info TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      price_cents INTEGER NOT NULL,
      promo_price_cents INTEGER,
      discount_type TEXT NOT NULL DEFAULT 'none',
      discount_value REAL NOT NULL DEFAULT 0,
      promo_start TEXT,
      promo_end TEXT,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 3,
      allow_backorder INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ativo',
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_launch INTEGER NOT NULL DEFAULT 0,
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      images_json TEXT NOT NULL DEFAULT '[]',
      variations_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      min_order_cents INTEGER NOT NULL DEFAULT 0,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      one_per_customer INTEGER NOT NULL DEFAULT 0,
      free_shipping INTEGER NOT NULL DEFAULT 0,
      valid_from TEXT,
      valid_until TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      customer_identifier TEXT NOT NULL,
      order_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_cpf TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      cep TEXT NOT NULL,
      state TEXT NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      street TEXT NOT NULL,
      number TEXT NOT NULL,
      complement TEXT NOT NULL DEFAULT '',
      shipping_method TEXT NOT NULL,
      shipping_label TEXT NOT NULL,
      shipping_cents INTEGER NOT NULL,
      shipping_days INTEGER NOT NULL DEFAULT 5,
      subtotal_cents INTEGER NOT NULL,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      coupon_code TEXT,
      total_cents INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
      mp_payment_id TEXT,
      mp_preference_id TEXT,
      pix_qr_code TEXT,
      pix_qr_code_base64 TEXT,
      checkout_url TEXT,
      fulfillment_stage TEXT NOT NULL DEFAULT 'aguardando_separo',
      carrier TEXT NOT NULL DEFAULT '',
      tracking_code TEXT NOT NULL DEFAULT '',
      tracking_url TEXT NOT NULL DEFAULT '',
      packaging_notes TEXT NOT NULL DEFAULT '',
      internal_notes TEXT NOT NULL DEFAULT '',
      shipped_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      variation_label TEXT,
      unit_price_cents INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      image_url TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS order_stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      changed_by TEXT NOT NULL DEFAULT 'Sistema',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variation_label TEXT,
      movement_type TEXT NOT NULL,
      delta_qty INTEGER NOT NULL,
      previous_qty INTEGER NOT NULL,
      new_qty INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      reference_order_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const defaultSettings: Record<string, string> = {
    store_name: 'Mariê Semi Joias',
    brand_partner: 'Lessenza.Vero',
    logo_url: '',
    hero_title: 'Seu brilho, sua essência, seu momento.',
    hero_subtitle:
      'Semijoias que transformam detalhes em momentos inesquecíveis. Descubra peças que realçam sua beleza em todos os momentos.',
    hero_cta: 'Comprar agora',
    hero_image: '/src/assets/images/hero_marie_jewelry_1795652703247.jpg',
    announcement_text: 'Use o cupom PRIMEIRACOMPRA e ganhe 10% OFF · Frete grátis acima de R$ 299',
    announcement_active: 'true',
    whatsapp_phone: '5511999450305',
    whatsapp_display: '(11) 99945-0305',
    email: 'contato@mariesemijoias.com.br',
    instagram: '@mariesemijoias',
    about_title: 'Curadoria oficial Lessenza.Vero',
    about_text:
      'A Mariê Semi Joias nasce da paixão por peças atemporais com acabamento de alta joalheria. Como revendedora autorizada Lessenza.Vero, selecionamos semijoias com banho nobre em ouro 18k e ródio, tecnologia antialérgica e design pensado para acompanhar você do cotidiano às ocasiões mais especiais.',
    policy_exchange:
      'Você possui até 7 dias corridos após o recebimento para solicitar troca ou devolução por arrependimento, com a peça sem sinais de uso e na embalagem original. Em casos de defeito de fabricação ou banho, nossa garantia cobre 12 meses mediante certificado.',
    policy_privacy:
      'Seus dados cadastrais e endereço são utilizados exclusivamente para processamento de pedidos, emissão de pagamento seguro e entrega em todo o Brasil. Não compartilhamos informações pessoais com terceiros fora dos parceiros logísticos e de pagamento.',
    policy_shipping:
      'Enviamos para todo o Brasil via Correios (PAC e SEDEX) e transportadoras parceiras. O prazo de separação é de até 1 dia útil após a confirmação do pagamento, com código de rastreamento enviado imediatamente após a postagem.',
    origin_cep: '01310100',
    free_shipping_threshold_cents: '29900',
    pac_base_cents: '2190',
    sedex_base_cents: '3690',
    mp_max_installments: '6',
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }

  const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  if (catCount === 0) {
    const categories = [
      { name: 'Colares', slug: 'colares', description: 'Correntes delicadas, chokers e pontos de luz.', sort_order: 1 },
      { name: 'Brincos', slug: 'brincos', description: 'Argolas esculpidas, gotas e brincos para o dia a dia.', sort_order: 2 },
      { name: 'Pulseiras', slug: 'pulseiras', description: 'Elos italianos, rivieras e braceletes sutis.', sort_order: 3 },
      { name: 'Anéis', slug: 'aneis', description: 'Solitários, aparadores e anéis minimalistas.', sort_order: 4 },
      { name: 'Conjuntos', slug: 'conjuntos', description: 'Combinações harmonizadas para presentear ou usar juntas.', sort_order: 5 },
      { name: 'Acessórios', slug: 'acessorios', description: 'Tornozeleiras, piercings fake e porta-joias.', sort_order: 6 },
    ];
    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug, description, sort_order, active) VALUES (?, ?, ?, ?, 1)'
    );
    for (const c of categories) {
      insertCat.run(c.name, c.slug, c.description, c.sort_order);
    }
  }

  const prodCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
  if (prodCount === 0) {
    const getCatId = (slug: string) =>
      (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug) as { id: number } | undefined)?.id ?? null;

    const seedProducts = [
      {
        name: 'Colar Ponto de Luz Lumière Rose',
        slug: 'colar-ponto-de-luz-lumiere-rose',
        sku: 'LV-COL-101',
        description:
          'Colar delicado com corrente veneziana fina banhada em ouro rosé 18k e pingente solitário de zircônia lapidação brilhante.',
        characteristics: 'Banho em Ouro Rosé 18k · 10 milésimos · Zircônia cristal 6mm · Comprimento 45cm + 5cm extensor · Níquel free.',
        warranty_info: 'Garantia de 1 ano no banho e cravação Lessenza.Vero.',
        notes: 'Peça leve e versátil, ideal para uso solo ou mix de colares.',
        category_id: getCatId('colares'),
        price_cents: 16900,
        promo_price_cents: 13900,
        discount_type: 'fixed',
        discount_value: 30,
        stock_qty: 12,
        is_featured: 1,
        is_launch: 1,
        is_bestseller: 1,
        images: ['/src/assets/images/product_colar_riviera_1795652704385.jpg'],
        variations: [
          { id: 'v1', label: '45cm · Ouro Rosé 18k', sku_suffix: 'RS45', stock_qty: 7 },
          { id: 'v2', label: '50cm · Ouro Rosé 18k', sku_suffix: 'RS50', stock_qty: 5 },
        ],
      },
      {
        name: 'Brinco Gota Esculpida Aurora',
        slug: 'brinco-gota-esculpida-aurora',
        sku: 'LV-BRI-204',
        description:
          'Design orgânico e polimento espelhado em banho de ouro 18k. Leveza absoluta para iluminar o rosto do dia à noite.',
        characteristics: 'Banho em Ouro 18k · Altura 2,8cm · Tarraxa borboleta anatômica · Hipoalergênico.',
        warranty_info: 'Garantia de 1 ano no banho Lessenza.Vero.',
        notes: 'Best-seller da coleção contemporânea.',
        category_id: getCatId('brincos'),
        price_cents: 14900,
        promo_price_cents: null,
        discount_type: 'none',
        discount_value: 0,
        stock_qty: 9,
        is_featured: 1,
        is_launch: 0,
        is_bestseller: 1,
        images: ['/src/assets/images/product_brinco_gota_1795652703840.jpg'],
        variations: [],
      },
      {
        name: 'Pulseira Elo Fino Cristais Celeste',
        slug: 'pulseira-elo-fino-cristais-celeste',
        sku: 'LV-PUL-308',
        description:
          'Pulseira de elos portugueses delicados intercalados por pontos de zircônia cravejados à mão.',
        characteristics: 'Banho em Ouro 18k · Comprimento 17cm + 3cm extensor · Fecho lagosta.',
        warranty_info: 'Garantia de 1 ano no banho e cravação Lessenza.Vero.',
        notes: 'Combina perfeitamente com relógios e braceletes rígidos.',
        category_id: getCatId('pulseiras'),
        price_cents: 12900,
        promo_price_cents: 10965,
        discount_type: 'percent',
        discount_value: 15,
        stock_qty: 8,
        is_featured: 1,
        is_launch: 1,
        is_bestseller: 0,
        images: ['/src/assets/images/product_pulseira_elo_1795652704701.jpg'],
        variations: [],
      },
      {
        name: 'Anel Solitário Cravejado Éclat',
        slug: 'anel-solitario-cravejado-eclat',
        sku: 'LV-ANE-412',
        description:
          'Anel solitário sofisticado com aro cravejado em microzircônias e pedra central de alto brilho.',
        characteristics: 'Banho em Ouro Rosé 18k · Zircônia central 7mm · Cravação inglesa e micro-pavê.',
        warranty_info: 'Garantia de 1 ano no banho Lessenza.Vero.',
        notes: 'Selecione sua numeração de aro antes de adicionar à sacola.',
        category_id: getCatId('aneis'),
        price_cents: 15900,
        promo_price_cents: null,
        discount_type: 'none',
        discount_value: 0,
        stock_qty: 10,
        is_featured: 1,
        is_launch: 0,
        is_bestseller: 1,
        images: ['/src/assets/images/product_anel_solitario_1795652705368.jpg'],
        variations: [
          { id: 'a14', label: 'Aro 14', sku_suffix: '14', stock_qty: 3 },
          { id: 'a16', label: 'Aro 16', sku_suffix: '16', stock_qty: 4 },
          { id: 'a18', label: 'Aro 18', sku_suffix: '18', stock_qty: 3 },
        ],
      },
      {
        name: 'Conjunto Pérola Barroca Nobilis',
        slug: 'conjunto-perola-barroca-nobilis',
        sku: 'LV-CON-501',
        description:
          'Conjunto clássico composto por colar com pérola natural cultivada e par de brincos coordenados em banho ouro 18k.',
        characteristics: 'Pérolas cultivadas de água doce · Banho Ouro 18k · Corrente 45cm.',
        warranty_info: 'Garantia de 1 ano no banho Lessenza.Vero.',
        notes: 'Acompanha caixa presenteável exclusiva Mariê Semi Joias.',
        category_id: getCatId('conjuntos'),
        price_cents: 24900,
        promo_price_cents: 21900,
        discount_type: 'fixed',
        discount_value: 30,
        stock_qty: 6,
        is_featured: 1,
        is_launch: 1,
        is_bestseller: 1,
        images: ['/src/assets/images/product_conjunto_perola_1795652705736.jpg'],
        variations: [],
      },
      {
        name: 'Duo Mix Medalha & Argola Orgânica',
        slug: 'duo-mix-medalha-argola-organica',
        sku: 'LV-ACE-602',
        description:
          'Composição versátil Lessenza.Vero com colar medalha martelada e argola média em acabamento acetinado.',
        characteristics: 'Banho em Ouro 18k e Ouro Rosé · Dupla camada antialérgica.',
        warranty_info: 'Garantia de 1 ano no banho Lessenza.Vero.',
        notes: 'Peça de edição limitada para composições elegantes.',
        category_id: getCatId('acessorios'),
        price_cents: 18900,
        promo_price_cents: null,
        discount_type: 'none',
        discount_value: 0,
        stock_qty: 5,
        is_featured: 1,
        is_launch: 1,
        is_bestseller: 0,
        images: ['/src/assets/images/hero_marie_jewelry_1795652703247.jpg'],
        variations: [],
      },
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (
        name, slug, sku, description, characteristics, warranty_info, notes,
        category_id, price_cents, promo_price_cents, discount_type, discount_value,
        stock_qty, low_stock_threshold, allow_backorder, status,
        is_featured, is_launch, is_bestseller, images_json, variations_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3, 0, 'ativo', ?, ?, ?, ?, ?)
    `);

    for (const p of seedProducts) {
      insertProd.run(
        p.name,
        p.slug,
        p.sku,
        p.description,
        p.characteristics,
        p.warranty_info,
        p.notes,
        p.category_id,
        p.price_cents,
        p.promo_price_cents,
        p.discount_type,
        p.discount_value,
        p.stock_qty,
        p.is_featured,
        p.is_launch,
        p.is_bestseller,
        JSON.stringify(p.images),
        JSON.stringify(p.variations)
      );
    }
  }

  const couponCount = (db.prepare('SELECT COUNT(*) as c FROM coupons').get() as { c: number }).c;
  if (couponCount === 0) {
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_order_cents, max_uses, one_per_customer, free_shipping, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    insertCoupon.run('MARIÊ10', 'percent', 10, 0, null, 0, 0);
    insertCoupon.run('PRIMEIRACOMPRA', 'percent', 10, 10000, null, 1, 0);
    insertCoupon.run('PROMO15', 'percent', 15, 20000, 100, 0, 0);
  }
}

export function getPublicSettings(): StoreSettings {
  const rows = db.prepare('SELECT key, value FROM store_settings').all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const mpSecretRow = db.prepare("SELECT value FROM server_secrets WHERE key = 'mp_access_token'").get() as { value: string } | undefined;
  const meSecretRow = db.prepare("SELECT value FROM server_secrets WHERE key = 'melhor_envio_token'").get() as { value: string } | undefined;

  return {
    store_name: map.get('store_name') ?? 'Mariê Semi Joias',
    brand_partner: map.get('brand_partner') ?? 'Lessenza.Vero',
    logo_url: map.get('logo_url') ?? '',
    hero_title: map.get('hero_title') ?? 'Seu brilho, sua essência, seu momento.',
    hero_subtitle: map.get('hero_subtitle') ?? '',
    hero_cta: map.get('hero_cta') ?? 'Comprar agora',
    hero_image: map.get('hero_image') ?? '/src/assets/images/hero_marie_jewelry_1795652703247.jpg',
    announcement_text: map.get('announcement_text') ?? '',
    announcement_active: map.get('announcement_active') === 'true',
    whatsapp_phone: map.get('whatsapp_phone') ?? '5511999450305',
    whatsapp_display: map.get('whatsapp_display') ?? '(11) 99945-0305',
    email: map.get('email') ?? '',
    instagram: map.get('instagram') ?? '',
    about_title: map.get('about_title') ?? '',
    about_text: map.get('about_text') ?? '',
    policy_exchange: map.get('policy_exchange') ?? '',
    policy_privacy: map.get('policy_privacy') ?? '',
    policy_shipping: map.get('policy_shipping') ?? '',
    origin_cep: map.get('origin_cep') ?? '01310100',
    free_shipping_threshold_cents: Number(map.get('free_shipping_threshold_cents') ?? '29900'),
    pac_base_cents: Number(map.get('pac_base_cents') ?? '2190'),
    sedex_base_cents: Number(map.get('sedex_base_cents') ?? '3690'),
    mp_max_installments: Number(map.get('mp_max_installments') ?? '6'),
    mp_configured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN || mpSecretRow?.value),
    melhor_envio_configured: Boolean(process.env.MELHOR_ENVIO_TOKEN || meSecretRow?.value),
  };
}

export function getServerSecret(key: string): string {
  if (key === 'mp_access_token' && process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return process.env.MERCADOPAGO_ACCESS_TOKEN;
  }
  if (key === 'mp_webhook_secret' && process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    return process.env.MERCADOPAGO_WEBHOOK_SECRET;
  }
  if (key === 'melhor_envio_token' && process.env.MELHOR_ENVIO_TOKEN) {
    return process.env.MELHOR_ENVIO_TOKEN;
  }
  const row = db.prepare('SELECT value FROM server_secrets WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? '';
}

export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  characteristics: string;
  warranty_info: string;
  notes: string;
  category_id: number | null;
  category_name?: string;
  category_slug?: string;
  price_cents: number;
  promo_price_cents: number | null;
  discount_type: string;
  discount_value: number;
  promo_start: string | null;
  promo_end: string | null;
  stock_qty: number;
  low_stock_threshold: number;
  allow_backorder: number;
  status: string;
  is_featured: number;
  is_launch: number;
  is_bestseller: number;
  images_json: string;
  variations_json: string;
  created_at: string;
  updated_at: string;
}

export function hydrateProduct(row: ProductRow): Product {
  let images: string[] = [];
  let variations: ProductVariation[] = [];
  try {
    images = JSON.parse(row.images_json || '[]');
  } catch {
    images = [];
  }
  try {
    variations = JSON.parse(row.variations_json || '[]');
  } catch {
    variations = [];
  }

  const now = Date.now();
  const startOk = !row.promo_start || new Date(row.promo_start).getTime() <= now;
  const endOk = !row.promo_end || new Date(row.promo_end).getTime() >= now;
  const hasPromo =
    row.promo_price_cents !== null &&
    row.promo_price_cents > 0 &&
    row.promo_price_cents < row.price_cents &&
    startOk &&
    endOk;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    description: row.description,
    characteristics: row.characteristics,
    warranty_info: row.warranty_info,
    notes: row.notes,
    category_id: row.category_id,
    category_name: row.category_name,
    category_slug: row.category_slug,
    price_cents: row.price_cents,
    promo_price_cents: row.promo_price_cents,
    discount_type: (row.discount_type as Product['discount_type']) || 'none',
    discount_value: row.discount_value || 0,
    promo_start: row.promo_start,
    promo_end: row.promo_end,
    effective_price_cents: hasPromo && row.promo_price_cents ? row.promo_price_cents : row.price_cents,
    has_active_promo: hasPromo,
    stock_qty: row.stock_qty,
    low_stock_threshold: row.low_stock_threshold,
    allow_backorder: Boolean(row.allow_backorder),
    status: row.status as Product['status'],
    is_featured: Boolean(row.is_featured),
    is_launch: Boolean(row.is_launch),
    is_bestseller: Boolean(row.is_bestseller),
    images,
    variations,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
