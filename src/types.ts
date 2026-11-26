export type ProductStatus = 'ativo' | 'inativo' | 'esgotado';
export type DiscountType = 'none' | 'percent' | 'fixed';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card';
export type PaymentStatus = 'aguardando_pagamento' | 'pago' | 'recusado' | 'cancelado' | 'reembolsado';
export type FulfillmentStage =
  | 'aguardando_separo'
  | 'separado'
  | 'despachado'
  | 'entregue';

export interface ProductVariation {
  id: string;
  label: string;
  sku_suffix?: string;
  stock_qty: number;
}

export interface Product {
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
  discount_type: DiscountType;
  discount_value: number;
  promo_start: string | null;
  promo_end: string | null;
  effective_price_cents: number;
  has_active_promo: boolean;
  stock_qty: number;
  low_stock_threshold: number;
  allow_backorder: boolean;
  status: ProductStatus;
  is_featured: boolean;
  is_launch: boolean;
  is_bestseller: boolean;
  images: string[];
  variations: ProductVariation[];
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  active: boolean;
  product_count?: number;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_cents: number;
  max_uses: number | null;
  used_count: number;
  one_per_customer: boolean;
  free_shipping: boolean;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}

export interface StoreSettings {
  store_name: string;
  brand_partner: string;
  logo_url: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta: string;
  hero_image: string;
  announcement_text: string;
  announcement_active: boolean;
  whatsapp_phone: string;
  whatsapp_display: string;
  email: string;
  instagram: string;
  about_title: string;
  about_text: string;
  policy_exchange: string;
  policy_privacy: string;
  policy_shipping: string;
  origin_cep: string;
  free_shipping_threshold_cents: number;
  pac_base_cents: number;
  sedex_base_cents: number;
  mp_max_installments: number;
  mp_configured?: boolean;
  melhor_envio_configured?: boolean;
}

export interface ShippingQuote {
  method: string;
  label: string;
  price_cents: number;
  estimated_days: number;
  carrier: string;
  is_free?: boolean;
}

export interface CartItem {
  product: Product;
  variation_label: string | null;
  quantity: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  product_sku: string;
  variation_label: string | null;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  image_url: string;
}

export interface OrderStageHistory {
  id: number;
  order_id: number;
  from_stage: string | null;
  to_stage: string;
  note: string;
  changed_by: string;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_cpf: string;
  customer_phone: string;
  customer_email: string;
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  complement: string;
  shipping_method: string;
  shipping_label: string;
  shipping_cents: number;
  shipping_days: number;
  subtotal_cents: number;
  discount_cents: number;
  coupon_code: string | null;
  total_cents: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  checkout_url: string | null;
  fulfillment_stage: FulfillmentStage;
  carrier: string;
  tracking_code: string;
  tracking_url: string;
  packaging_notes: string;
  internal_notes: string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  history?: OrderStageHistory[];
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  variation_label: string | null;
  movement_type: 'entrada' | 'ajuste' | 'saida_pedido' | 'estorno_cancelamento';
  delta_qty: number;
  previous_qty: number;
  new_qty: number;
  reason: string;
  reference_order_id: number | null;
  created_at: string;
}

export interface DashboardMetrics {
  sales_today_cents: number;
  sales_month_cents: number;
  total_revenue_cents: number;
  orders_count: number;
  stage_counts: {
    aguardando_separo: number;
    separado: number;
    despachado: number;
    entregue: number;
  };
  low_stock_count: number;
  out_of_stock_count: number;
  active_coupons_count: number;
  top_products: Array<{
    product_id: number | null;
    product_name: string;
    total_qty: number;
    total_cents: number;
  }>;
  daily_series: Array<{
    date: string;
    revenue_cents: number;
    orders: number;
  }>;
}
