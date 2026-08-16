/**
 * productCard.js
 * ----------------------------------------------------------------------------
 * Renders product cards used on Home, Collections, Search, Wishlist and
 * Related Products. `mountProductGrid` handles both the HTML output and the
 * event wiring (wishlist toggle + quick add), so any page can just call it.
 * ----------------------------------------------------------------------------
 */

import { products } from '../services/products.js';
import { wishlist } from '../services/wishlist.js';
import { cart } from '../services/cart.js';
import { showToast } from './toast.js';
import { CONFIG } from '../services/config.js';

// Base path resolution for GitHub Pages subfolder hosting
const BASE_PATH = window.location.pathname.includes('/theprintloom') ? '/theprintloom' : '';

function resolveImagePath(path) {
  if (!path) return '';
  // Return early if external or base64
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  
  // Clean leading slashes and dot-slashes
  let cleanPath = path.replace(/^(\.\/|\/)+/, '');
  
  // Prevent double prefixing if path already starts with the repository name
  if (cleanPath.startsWith('theprintloom/')) {
    cleanPath = cleanPath.replace(/^theprintloom\//, '');
  }

  return BASE_PATH ? `${BASE_PATH}/${cleanPath}` : cleanPath;
}

function badge(product) {
  if (product.tags?.includes('bestseller')) return '<span class="product-card__badge">Bestseller</span>';
  if (product.tags?.includes('new-arrival')) return '<span class="product-card__badge">New</span>';
  if (product.discount) return `<span class="product-card__badge">${product.discount}% OFF</span>`;
  return '';
}

export function productCardHtml(product) {
  const finalPrice = products.finalPrice(product);
  const isWishlisted = wishlist.has(product.id);
  const currency = CONFIG.BUSINESS.currency;
  
  const rawImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : '';
  const imageSrc = resolveImagePath(rawImage);
  const productUrl = `${CONFIG.ROUTES.product}?slug=${product.slug}`;

  return `
    <article class="product-card reveal" data-product-id="${product.id}">
      <a href="${productUrl}" class="product-card__link">
        <div class="product-card__media">
          <img src="${imageSrc}" alt="${product.name}" loading="lazy" width="600" height="800">
          ${badge(product)}
        </div>
      </a>
      <button class="product-card__wishlist ${isWishlisted ? 'is-active' : ''}" data-wishlist-toggle="${product.id}" aria-label="Toggle wishlist">
        ${isWishlisted ? '♥' : '♡'}
      </button>
      <div class="product-card__quick-add">
        <button class="btn btn-primary btn-block" data-quick-add="${product.id}">Add to Cart</button>
      </div>
      <div class="product-card__body">
        <a href="${productUrl}">
          <p class="product-card__category">${product.fabric}</p>
          <h3 class="product-card__title">${product.name}</h3>
        </a>
        <div class="product-card__rating">
          <span class="stars">★</span> ${product.rating}
        </div>
        <div class="product-card__price">
          <span class="current">${currency}${finalPrice.toLocaleString('en-IN')}</span>
          ${product.discount ? `<span class="original">${currency}${product.price.toLocaleString('en-IN')}</span><span class="discount">${product.discount}% off</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

/**
 * Render a list of products into `container` and wire up wishlist / add
 * to cart interactions using event delegation.
 */
export function mountProductGrid(container, list) {
  if (!list || !list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No sarees found</h3>
        <p class="mt-2">Try adjusting your filters or search terms.</p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(productCardHtml).join('');

  // Remove former listener if attached, then attach delegated listener
  if (!container._hasGridListener) {
    container.addEventListener('click', async (e) => {
      const wishlistBtn = e.target.closest('[data-wishlist-toggle]');
      if (wishlistBtn) {
        e.preventDefault();
        const id = wishlistBtn.dataset.wishlistToggle;
        const active = wishlist.toggle(id);
        wishlistBtn.classList.toggle('is-active', active);
        wishlistBtn.textContent = active ? '♥' : '♡';
        showToast(active ? 'Added to wishlist' : 'Removed from wishlist', 'success');
        return;
      }

      const quickAddBtn = e.target.closest('[data-quick-add]');
      if (quickAddBtn) {
        e.preventDefault();
        const id = quickAddBtn.dataset.quickAdd;
        await cart.addItem(id, 1);
        showToast('Added to cart', 'success');
        return;
      }
    });
    container._hasGridListener = true;
  }

  // Trigger reveal-on-scroll for newly injected cards.
  window.dispatchEvent(new CustomEvent('reveal:refresh'));
}
