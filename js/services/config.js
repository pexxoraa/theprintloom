/**
 * config.js
 * ----------------------------------------------------------------------------
 * Single source of truth for environment configuration & URL routing.
 * ----------------------------------------------------------------------------
 */

// Dynamically prefix paths with repo name if running on GitHub Pages subfolder
const BASE_PATH = window.location.pathname.includes('/theprintloom') ? '/theprintloom' : '';

/** Helper to convert any relative path into a GitHub Pages safe absolute path */
export function resolvePath(path = '') {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return BASE_PATH ? `${BASE_PATH}/${cleanPath}` : `/${cleanPath}`;
}

export const CONFIG = Object.freeze({
  BACKEND: 'gas',

  API: {
    gasBaseUrl: 'https://script.google.com/macros/s/AKfycbyc8CE7Rm-EsLYdgxHfWqGmXnWE6PcnvRoFxNHpYQwEuwa0g1Ub8JCEVvLPiPD_wvWQ/exec',
    nodeBaseUrl: 'https://pexxoraa.github.io/theprintloom',
    timeoutMs: 15000,
  },

  CATALOG: {
    source: 'sheet', // 'local' | 'sheet' — reads the product catalog from your Google Sheet.
    // If the sheet ever returns 0 rows or the request fails, api.js
    // automatically falls back to the local data/products.json so the
    // site never shows an empty store.
  },

  DATA: {
    products: resolvePath('data/products.json'),
    categories: resolvePath('data/categories.json'),
  },

  UPI: {
    vpa: 'pexxoraa@axl',
    payeeName: 'pexxoraa',
  },

  STORAGE_KEYS: {
    cart: 'ploom_cart_v1',
    wishlist: 'ploom_wishlist_v1',
    recentlyViewed: 'ploom_recently_viewed_v1',
    theme: 'ploom_theme_v1',
    checkoutDraft: 'ploom_checkout_draft_v1',
    lastOrder: 'ploom_last_order_v1',
  },

  BUSINESS: {
    freeShippingThreshold: 2000,
    flatShippingRate: 0,
    currency: '₹',
    recentlyViewedLimit: 8,
  },

  ROUTES: {
    home: resolvePath('index.html'),
    collections: resolvePath('pages/collections/index.html'),
    product: resolvePath('pages/product/index.html'),
    cart: resolvePath('pages/cart/index.html'),
    checkout: resolvePath('pages/checkout/index.html'),
    wishlist: resolvePath('pages/wishlist/index.html'),
    about: resolvePath('pages/about/index.html'),
    contact: resolvePath('pages/contact/index.html'),
    profile: resolvePath('pages/profile/index.html'),
    orderSuccess: resolvePath('pages/order-success/index.html'),
    search: resolvePath('pages/search/index.html'),
    notFound: resolvePath('pages/404/index.html'),
  },
});

/** Helper to convert any image path into a full GitHub Pages safe URL */
export function resolveImagePath(path) {
  return resolvePath(path);
}

/** Resolve the active API base URL according to the selected backend. */
export function getApiBaseUrl() {
  return CONFIG.BACKEND === 'node' ? CONFIG.API.nodeBaseUrl : CONFIG.API.gasBaseUrl;
}

export function isBackendConfigured() {
  const url = getApiBaseUrl();
  if (!url) return false;
  if (CONFIG.BACKEND === 'gas') {
    // A real Apps Script deployment URL looks like
    // https://script.google.com/macros/s/AKfyc.../exec
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url);
  }
  // Node/Express (or any other) backend — just require a non-empty, non-placeholder URL.
  return url.startsWith('http');
}
