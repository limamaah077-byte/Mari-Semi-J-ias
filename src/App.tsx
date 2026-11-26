import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { CartItem, Category, Order, Product, StoreSettings } from './types';
import { StoreHeader } from './components/StoreHeader';
import { StoreFooter } from './components/StoreFooter';
import { CartDrawer } from './components/CartDrawer';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { InfoPage } from './pages/InfoPages';
import { AdminAuth } from './admin/AdminAuth';
import { AdminShell } from './admin/AdminShell';

const CART_STORAGE_KEY = 'marie_cart_v1';

const DEFAULT_SETTINGS: StoreSettings = {
  store_name: 'Mariê Semi Joias',
  brand_partner: 'Lessenza.Vero',
  logo_url: '',
  hero_title: 'Seu brilho, sua essência, seu momento.',
  hero_subtitle:
    'Semijoias que transformam detalhes em momentos inesquecíveis. Descubra peças que realçam sua beleza em todos os momentos.',
  hero_cta: 'Comprar agora',
  hero_image: '/src/assets/images/hero_marie_jewelry_1795652703247.jpg',
  announcement_text: 'Use o cupom PRIMEIRACOMPRA e ganhe 10% OFF · Frete grátis acima de R$ 299',
  announcement_active: true,
  whatsapp_phone: '5511999450305',
  whatsapp_display: '(11) 99945-0305',
  email: 'contato@mariesemijoias.com.br',
  instagram: '@mariesemijoias',
  about_title: 'Curadoria oficial Lessenza.Vero',
  about_text: '',
  policy_exchange: '',
  policy_privacy: '',
  policy_shipping: '',
  origin_cep: '01310100',
  free_shipping_threshold_cents: 29900,
  pac_base_cents: 2190,
  sedex_base_cents: 3690,
  mp_max_installments: 6,
};

export default function App() {
  const [route, setRoute] = useState<string>(() => window.location.pathname + window.location.search);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);

  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [lastPaymentWarning, setLastPaymentWarning] = useState<string | undefined>(undefined);

  // Admin auth token held strictly in React state memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<{ name: string; phone: string } | null>(null);

  const loadStoreBootstrap = async () => {
    try {
      const res = await fetch('/api/store/bootstrap');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setCategories(data.categories || []);
        setProducts(data.products || []);
      }
    } finally {
      setLoadingStore(false);
    }
  };

  useEffect(() => {
    loadStoreBootstrap();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path: string) => {
    if (path !== route) {
      window.history.pushState({}, '', path);
      setRoute(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const addToCart = (product: Product, variationLabel: string | null = null, qty = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.product.id === product.id && i.variation_label === variationLabel
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { product, variation_label: variationLabel, quantity: qty }];
    });
    setCartOpen(true);
  };

  const updateCartQty = (productId: number, variationLabel: string | null, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId && i.variation_label === variationLabel
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: number, variationLabel: string | null) => {
    setCart((prev) =>
      prev.filter((i) => !(i.product.id === productId && i.variation_label === variationLabel))
    );
  };

  const pathname = route.split('?')[0];
  const searchParams = new URLSearchParams(route.includes('?') ? route.split('?')[1] : '');

  // Private Admin Route (/admin or /painel) — completely isolated from public storefront
  if (pathname === '/admin' || pathname === '/painel') {
    if (!adminToken || !adminUser) {
      return (
        <AdminAuth
          onAuthenticated={(tok, usr) => {
            setAdminToken(tok);
            setAdminUser(usr);
          }}
          onBackToStore={() => navigate('/')}
        />
      );
    }

    return (
      <AdminShell
        token={adminToken}
        adminUser={adminUser}
        onLogout={() => {
          setAdminToken(null);
          setAdminUser(null);
        }}
        onExitToStore={() => {
          loadStoreBootstrap();
          navigate('/');
        }}
        onSettingsUpdated={(updated) => setSettings(updated)}
      />
    );
  }

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const waHref = `https://wa.me/${settings.whatsapp_phone}?text=${encodeURIComponent(
    'Olá! Vim pelo site da Mariê Semi Joias e gostaria de tirar uma dúvida.'
  )}`;

  let content: React.ReactNode = null;

  if (loadingStore) {
    content = (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-[#7A635D]">
        Carregando boutique Mariê Semi Joias...
      </div>
    );
  } else if (pathname === '/' || pathname === '') {
    content = (
      <HomePage
        settings={settings}
        categories={categories}
        products={products}
        onNavigate={navigate}
        onQuickAdd={(p) => addToCart(p, null, 1)}
      />
    );
  } else if (pathname === '/catalogo') {
    content = (
      <CatalogPage
        key={route}
        categories={categories}
        products={products}
        initialCategory={searchParams.get('categoria') || 'todas'}
        initialFilter={searchParams.get('filtro') || 'todos'}
        initialQuery={searchParams.get('q') || ''}
        onNavigate={navigate}
        onQuickAdd={(p) => addToCart(p, null, 1)}
      />
    );
  } else if (pathname.startsWith('/produto/')) {
    const slug = pathname.replace('/produto/', '');
    const product = products.find((p) => p.slug === slug);
    if (!product) {
      content = (
        <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="font-display text-3xl text-[#231A18]">Peça não encontrada</h1>
          <button
            type="button"
            onClick={() => navigate('/catalogo')}
            className="px-6 py-3 bg-[#231A18] text-white text-xs font-medium cursor-pointer"
          >
            Voltar ao catálogo
          </button>
        </div>
      );
    } else {
      content = (
        <ProductDetailPage
          product={product}
          settings={settings}
          onBack={() => navigate('/catalogo')}
          onAddToCart={addToCart}
        />
      );
    }
  } else if (pathname === '/checkout') {
    content = (
      <CheckoutPage
        items={cart}
        settings={settings}
        onBackToStore={() => navigate('/catalogo')}
        onOrderCreated={(order, warning) => {
          setLastOrder(order);
          setLastPaymentWarning(warning);
          setCart([]);
          loadStoreBootstrap();
          navigate(`/pedido/${order.order_number}`);
        }}
      />
    );
  } else if (pathname.startsWith('/pedido/')) {
    const orderNumber = pathname.replace('/pedido/', '');
    content = (
      <OrderTrackingPage
        orderNumber={orderNumber}
        initialOrder={lastOrder?.order_number === orderNumber ? lastOrder : null}
        paymentWarning={lastPaymentWarning}
        settings={settings}
        onNavigate={navigate}
      />
    );
  } else if (pathname === '/sobre') {
    content = <InfoPage page="sobre" settings={settings} onNavigate={navigate} />;
  } else if (pathname === '/contato') {
    content = <InfoPage page="contato" settings={settings} onNavigate={navigate} />;
  } else if (pathname === '/politicas') {
    content = <InfoPage page="politicas" settings={settings} onNavigate={navigate} />;
  } else {
    content = (
      <HomePage
        settings={settings}
        categories={categories}
        products={products}
        onNavigate={navigate}
        onQuickAdd={(p) => addToCart(p, null, 1)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F6]">
      <StoreHeader
        settings={settings}
        cartCount={cartCount}
        currentPath={pathname}
        onNavigate={navigate}
        onOpenCart={() => setCartOpen(true)}
        onSearchSubmit={(q) => navigate(`/catalogo?q=${encodeURIComponent(q)}`)}
      />

      <div className="flex-1">{content}</div>

      <StoreFooter settings={settings} onNavigate={navigate} />

      <CartDrawer
        open={cartOpen}
        items={cart}
        settings={settings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        onCheckout={() => {
          setCartOpen(false);
          navigate('/checkout');
        }}
      />

      {/* Floating WhatsApp Button (Public Storefront Only) */}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Atendimento via WhatsApp"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-4 py-2.5 bg-[#231A18] text-white text-xs font-medium shadow-lg border border-[#4A3935] hover:bg-[#8E4F59] transition-colors no-print"
      >
        <MessageCircle className="w-4 h-4 text-[#F4D9DD]" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
    </div>
  );
}
