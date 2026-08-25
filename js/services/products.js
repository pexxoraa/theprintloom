/**
 * products.js
 */

import { api } from './api.js';
import { CONFIG, resolvePath } from './config.js';

let _cache = null;
let _categories = null;

/**
 * A row from a Google Sheet is always flat — every cell is a plain string,
 * never a real array. So a sheet product typically arrives as a single
 * `image` (or `images`) *string*, sometimes with several URLs separated by
 * a comma/pipe/newline if someone pasted more than one. Every image-reading
 * component (productCard.js, the product detail page, navbar.js) expects
 * `product.images` to already be a proper array — so we guarantee that
 * shape here, once, for every product regardless of where it came from
 * (local JSON already provides a real array; the Sheet does not).
 */
export function normalizeProductImages(product) {
  const raw = product.images ?? product.Images ?? product.image ?? product.Image
    ?? product['Image URL'] ?? product.imageUrl ?? product.photo ?? product.Photo ?? '';

  let images;
  if (Array.isArray(raw)) {
    images = raw;
  } else if (typeof raw === 'string') {
    images = raw.split(/[,|\n]/);
  } else {
    images = [];
  }

  return images
    .map((img) => (typeof img === 'string' ? img.trim() : img))
    .filter(Boolean);
}

/**
 * A Sheet image cell (or even a local JSON entry) is often just a bare
 * filename like "A0042-Bigger-Tulips.jpg" with no folder — someone typed
 * or pasted the filename only. Treated as a path as-is, the browser
 * requests it relative to whatever page it's on (e.g.
 * pages/product/A0042-Bigger-Tulips.jpg, or even the site root), which
 * 404s. Every real product photo actually lives in
 * /assets/images/products/, so bare filenames (and full Drive/http URLs,
 * which are left untouched) are resolved against that folder here — once,
 * for every product, everywhere images are read.
 */
export function resolveProductImages(product) {
  return normalizeProductImages(product).map((img) => {
    if (img.startsWith('http') || img.startsWith('data:')) return img;
    const filename = img.split('/').pop();
    return resolvePath(`assets/images/products/${filename}`);
  });
}

/**
 * Builds a lookup so a product's category matches regardless of whether the
 * Sheet has the internal id ("cat-power-looms"), the slug ("power-looms"),
 * or — the realistic case, since someone is typing this by hand into a
 * spreadsheet — the human-readable name ("Power Looms"). Every key is
 * lowercased/trimmed so casing and stray whitespace in the Sheet don't
 * break the match either.
 */
export function buildCategoryLookup(categories) {
  const lookup = new Map();
  (categories || []).forEach((c) => {
    [c.id, c.slug, c.name].filter(Boolean).forEach((key) => {
      lookup.set(String(key).trim().toLowerCase(), c.id);
    });
  });
  return lookup;
}

/** Rewrites product.category to the canonical category id using the lookup above. */
export function resolveProductCategory(product, categoryLookup) {
  const rawCategory = (product.category ?? '').toString().trim();
  const matchedId = categoryLookup.get(rawCategory.toLowerCase());
  return matchedId ? { ...product, category: matchedId } : product;
}

async function loadCatalog() {
  if (!_cache) {
    try {
      const [rawProducts, categories] = await Promise.all([
        api.getProducts().catch((err) => { console.error('Error loading catalog:', err); return []; }),
        loadCategories(),
      ]);

      const categoryLookup = buildCategoryLookup(categories);
      _cache = (rawProducts || []).map((p) => resolveProductCategory(p, categoryLookup));
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
    images: resolveProductImages(p),
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
    const sameCategory = list.filter((p) => p.id !== product.id && p.category === product.category);
    if (sameCategory.length > 0) return sameCategory.slice(0, limit);
    // No other product shares this exact category (e.g. it's the only item
    // in that category right now, or the Sheet's category text for this
    // row doesn't match any known category). Rather than showing an empty
    // "Related Sarees" section, fall back to any other products so the
    // section is never blank.
    return list.filter((p) => p.id !== product.id).slice(0, limit);
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
