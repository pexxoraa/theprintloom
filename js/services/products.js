/**
 * products.js
 */

import { api } from './api.js';
import { CONFIG, resolvePath } from './config.js';

let _cache = null;
let _categories = null;

async function loadCatalog() {
  if (!_cache) {
    try {
      _cache = await api.getProducts();
      if (!_cache) _cache = [];
    } catch (err) {
      console.error('Error loading catalog:', err);
      _cache = [];
    }
  }

  // Stock is authoritative in the Google Sheet's "stock" column — the backend
  // (Code.gs -> decrementStock_) decrements it for real when an order is
  // placed, so every visitor always sees the true current count. No local
  // simulation here; just make sure it's a number.
  return _cache.map((p) => ({
    ...p,
    stock: typeof p.stock === 'number' ? p.stock : Number(p.stock) || 0,
  }));
}

async function loadCategories() {
  if (_categories) return _categories;
  
  const pathsToTry = [
    CONFIG?.DATA?.categories,
    resolvePath('data/categories.json'),
    '/theprintloom/data/categories.json',
    './data/categories.json',
    'data/categories.json'
  ].filter(Boolean);

  for (const categoriesUrl of pathsToTry) {
    try {
      const res = await fetch(categoriesUrl);
      if (res.ok) {
        const json = await res.json();
        _categories = Array.isArray(json) ? json : (json.categories || []);
        if (_categories.length > 0) return _categories;
      }
    } catch (err) {
      // Continue to next fallback path
    }
  }
  return [];
}

export const products = {

  // Stock is now decremented for real on the backend (Code.gs, when the
  // order is saved to the Products sheet), so the frontend doesn't need to
  // simulate it locally anymore. This just clears the in-memory cache so the
  // very next `products.all()` call re-fetches fresh numbers from the Sheet
  // instead of showing stale pre-order stock for the rest of the session.
  reduceStock() {
    _cache = null;
  },

  async all() {
    return loadCatalog();
  },

  async categories() {
    return loadCategories();
  },

  async getBySlug(slug) {
    const list = await loadCatalog();
    return list.find((p) => p.slug === slug) || null;
  },

  async getById(id) {
    const list = await loadCatalog();
    return list.find((p) => p.id === id) || null;
  },

  async featured(limit = 8) {
    const list = await loadCatalog();
    return list.filter((p) => p.featured).slice(0, limit);
  },

  async byTag(tag, limit = 8) {
    const list = await loadCatalog();
    return list.filter((p) => p.tags?.includes(tag)).slice(0, limit);
  },

  async byCategory(categoryId) {
    const list = await loadCatalog();
    return list.filter((p) => p.category === categoryId);
  },

  async related(product, limit = 4) {
    if (!product) return [];
    const list = await loadCatalog();
    return list
      .filter((p) => p.id !== product.id && p.category === product.category)
      .slice(0, limit);
  },

  async search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const list = await loadCatalog();
    return list.filter((p) => {
      const haystack = [p.name, p.fabric, p.description, ...(p.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  },

  filter(list = [], { categories = [], minPrice, maxPrice, fabrics = [] } = {}) {
    return list.filter((p) => {
      const finalPrice = products.finalPrice(p);
      if (categories.length && !categories.includes(p.category)) return false;
      if (fabrics.length && !fabrics.includes(p.fabric)) return false;
      if (typeof minPrice === 'number' && finalPrice < minPrice) return false;
      if (typeof maxPrice === 'number' && finalPrice > maxPrice) return false;
      return true;
    });
  },

  sort(list = [], mode) {
    const arr = [...(list || [])];
    switch (mode) {
      case 'price-asc': return arr.sort((a, b) => products.finalPrice(a) - products.finalPrice(b));
      case 'price-desc': return arr.sort((a, b) => products.finalPrice(b) - products.finalPrice(a));
      case 'rating': return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest': return arr.reverse();
      default: return arr;
    }
  },

  finalPrice(product) {
    if (!product || typeof product.price !== 'number') return 0;
    const discount = product.discount || 0;
    return Math.round(product.price * (1 - discount / 100));
  },
};
