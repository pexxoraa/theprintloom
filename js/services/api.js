/**
 * api.js
 * ----------------------------------------------------------------------------
 * All network communication with the backend goes through this file.
 * UI components and pages must NEVER call `fetch` directly against Google
 * Apps Script (or, later, Node.js) — they only call the functions exported
 * here. That indirection is what lets us swap GAS for Node + Express +
 * MongoDB later without touching a single UI component.
 *
 * Google Apps Script Web Apps only expose doGet/doPost, so we simulate a
 * REST-ish interface by sending an `action` field in the request body/query
 * and letting Code.gs route it (see /backend/Code.gs).
 * ----------------------------------------------------------------------------
 */

import { CONFIG, getApiBaseUrl, isBackendConfigured } from './config.js';

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Low-level request helper. Google Apps Script Web Apps respond fastest to
 * simple POST requests with a text/plain content type (avoids CORS
 * preflight, since GAS does not support OPTIONS). We always POST an
 * `action` + `payload` envelope and parse JSON back.
 */
async function request(action, payload = {}, { method = 'POST' } = {}) {
  const base = getApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.API.timeoutMs);

  try {
    let url = base;
    const init = {
      method,
      signal: controller.signal,
    };

    if (method === 'GET') {
      const qs = new URLSearchParams({ action, ...flatten(payload) }).toString();
      url = `${base}?${qs}`;
    } else {
      // text/plain avoids a CORS preflight against Apps Script deployments.
      init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      init.body = JSON.stringify({ action, payload });
    }

    const response = await fetch(url, init);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError('Invalid JSON response from server', response.status, text);
    }

    if (!response.ok || data?.success === false) {
      throw new ApiError(data?.message || 'Request failed', response.status, data);
    }

    return data?.data ?? data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 0);
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network error', 0);
  } finally {
    clearTimeout(timeout);
  }
}

function flatten(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    out[k] = typeof v === 'object' ? JSON.stringify(v) : v;
  });
  return out;
}

/* ------------------------------------------------------------------------ */
/*  Public API surface — this is what pages/components/services import.     */
/* ------------------------------------------------------------------------ */

let _productsCache = null;
let _settingsCache = null;

async function loadLocalProducts() {
  try {
    // Relative path leverages <base href="/theprintlooms/">
    const res = await fetch('/theprintloom/data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json : (json.products || []);
  } catch (err) {
    console.error('[api.loadLocalProducts] Failed to load products.json:', err);
    return [];
  }
}

async function loadLocalSettings() {
  try {
    const res = await fetch('/theprintloom/data/settings.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[api.loadLocalSettings] Failed to load settings.json:', err);
    return {};
  }
}

export const api = {
  /**
   * Fetch the product catalog. Cached in-memory per page load — every
   * component that needs products (navbar, home, collections, etc.) shares
   * one fetch instead of firing off a separate request each.
   */
  async getProducts() {
    if (_productsCache) return _productsCache;

    if (CONFIG.CATALOG.source === 'sheet') {
      try {
        const sheetProducts = await request('getProducts', {}, { method: 'GET' });
        if (Array.isArray(sheetProducts) && sheetProducts.length > 0) {
          _productsCache = sheetProducts;
          return _productsCache;
        }
        console.warn('[api.getProducts] Products sheet returned no rows — falling back to local data/products.json');
      } catch (err) {
        console.warn('[api.getProducts] Sheet request failed, falling back to local data/products.json', err.message);
      }
    }

    _productsCache = await loadLocalProducts();
    return _productsCache;
  },

  /**
   * Fetch site-wide settings (shipping rules, coupons, brand info).
   */
  async getSettings() {
    if (_settingsCache) return _settingsCache;

    if (CONFIG.CATALOG.source === 'sheet') {
      try {
        const sheetSettings = await request('getSettings', {}, { method: 'GET' });
        if (sheetSettings && Object.keys(sheetSettings).length > 0) {
          _settingsCache = sheetSettings;
          return _settingsCache;
        }
        console.warn('[api.getSettings] Settings sheet returned no rows — falling back to local data/settings.json');
      } catch (err) {
        console.warn('[api.getSettings] Sheet request failed, falling back to local data/settings.json', err.message);
      }
    }

    _settingsCache = await loadLocalSettings();
    return _settingsCache;
  },

  /**
   * Persist an order.
   */
  async saveOrder(orderDraft) {
    if (!isBackendConfigured()) {
      console.warn(
        '[api.saveOrder] Backend not configured. ' +
        'Placing a local DEMO order instead.'
      );
      const orderId = `DEMO-${Date.now().toString().slice(-8)}`;
      return { orderId, demo: true };
    }
    return request('saveOrder', orderDraft);
  },

  /** Subscribe an email to the newsletter list. */
  async subscribeNewsletter(email) {
    return request('subscribeNewsletter', { email });
  },

  /** Submit the contact form. */
  async sendContactMessage(payload) {
    return request('sendContactMessage', payload);
  },
};

export { ApiError };
