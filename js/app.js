/**
 * app.js
 * ----------------------------------------------------------------------------
 * Bootstraps chrome shared by every page: sticky header, footer, scroll
 * reveal animations, back-to-top button, contact form handler, and homepage category strip loading.
 * ----------------------------------------------------------------------------
 */

import { renderNavbar } from './components/navbar.js';
import { renderFooter } from './components/footer.js';
import { router } from './router.js';
import { api } from './services/api.js';
import { CONFIG } from './services/config.js';

export async function initApp() {
  const headerRoot = document.getElementById('site-header');
  const footerRoot = document.getElementById('site-footer');

  if (headerRoot) {
    await renderNavbar(headerRoot);
    router.highlightActiveNav(headerRoot);
  }
  
  if (footerRoot) {
    await renderFooter(footerRoot);
  }

  initScrollReveal();
  initBackToTop();
  initWhatsAppButton();
  initContactForm();
}

/**
 * Initializes the intersection observer for scroll-triggered reveal animations.
 */
function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  const observeAll = () => {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((el, i) => {
      el.style.setProperty('--stagger-index', i % 8);
      observer.observe(el);
    });
  };

  observeAll();
  
  // Re-scan whenever components inject new content (e.g., dynamic product grids).
  window.addEventListener('reveal:refresh', observeAll);
}

/**
 * Initializes the floating "Back to Top" button.
 */
function initBackToTop() {
  let btn = document.getElementById('back-to-top');
  
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.textContent = '↑';
    document.body.appendChild(btn);
  }
  
  window.addEventListener('scroll', () => {
    btn.classList.toggle('is-visible', window.scrollY > 480);
  });
  
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * Initializes the floating WhatsApp action button.
 */
async function initWhatsAppButton() {
  if (document.getElementById('whatsapp-fab')) return;
  
  let settings = {};
  try { 
    settings = await api.getSettings(); 
  } catch { 
    /* falls back safely below if API fails */ 
  }
  
  const whatsapp = settings?.brand?.supportWhatsapp || '919030621457';
  const message = encodeURIComponent('Hi! I would like to place an order from The Print Loom.');
  const link = `https://wa.me/${whatsapp}?text=${message}`;

  const btn = document.createElement('a');
  btn.id = 'whatsapp-fab';
  btn.href = link;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.setAttribute('aria-label', 'Order on WhatsApp');
  btn.className = 'back-to-top is-visible'; // Reusing the back-to-top base styles
  btn.style.cssText = 'right: var(--space-6); left: auto; bottom: var(--space-6); background: #25D366; z-index: 99;';
  
  btn.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9-.2-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4.1-.2 0-.4 0-.5C10.9 8.4 10.5 7.4 10.3 7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-1 1-1 2.3 0 1.4 1 2.7 1.1 2.9.1.2 2 3 4.8 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.9-1.3.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z"/>
      <path d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.3L2 22l4.8-1.5C8.3 21.5 10.1 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.7 0-3.3-.5-4.7-1.3l-.3-.2-3.1.9.9-3.2-.2-.3C3.7 14.3 3.2 12.7 3.2 11 3.2 6.1 7.1 2.2 12 2.2S20.8 6.1 20.8 11 16.9 20.2 12 20.2z"/>
    </svg>`;
    
  document.body.appendChild(btn);
}

/**
 * Initializes and handles Contact Form submissions asynchronously.
 */
function initContactForm() {
  const contactForm = document.querySelector('form') || document.getElementById('contact-form');
  if (!contactForm) return;

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect field inputs safely based on typical attributes or placeholders
    const inputs = contactForm.querySelectorAll('input, textarea');
    let formData = {
      name: '',
      email: '',
      phone: '',
      service: 'General Inquiry',
      message: ''
    };

    inputs.forEach(input => {
      const type = (input.type || '').toLowerCase();
      const nameAttr = (input.name || input.id || input.placeholder || '').toLowerCase();
      const val = input.value.trim();

      if (type === 'email' || nameAttr.includes('email')) {
        formData.email = val;
      } else if (type === 'tel' || nameAttr.includes('phone')) {
        formData.phone = val;
      } else if (nameAttr.includes('name')) {
        formData.name = val;
      } else if (nameAttr.includes('subject') || nameAttr.includes('service')) {
        formData.service = val;
      } else if (input.tagName === 'TEXTAREA' || nameAttr.includes('message')) {
        formData.message = val;
      }
    });

    // Fallback if specific inputs weren't caught by keyword matching
    if (!formData.name && inputs[0]) formData.name = inputs[0].value.trim();
    if (!formData.email && inputs[1]) formData.email = inputs[1].value.trim();
    if (!formData.message && inputs[inputs.length - 1]) formData.message = inputs[inputs.length - 1].value.trim();

    try {
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      const response = await api.request({
        action: 'sendContactMessage',
        payload: formData
      });

      if (response && response.success) {
        alert('Thank you! Your message has been sent successfully.');
        contactForm.reset();
      } else {
        alert('Failed to send message. Please try again later.');
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    } catch (err) {
      console.error('Contact form submission error:', err);
      alert('An error occurred while sending your message. Please reach out directly via WhatsApp.');
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
      }
    }
  });
}

/**
 * Merges products from the local JSON file and the Google Sheets backend.
 * This can be imported into your collections page or router to build the grid.
 */
export async function loadAllProducts() {
    let localProducts = [];
    let sheetProducts = [];

    // Create a live timestamp to bust the browser cache!
    const cacheBuster = new Date().getTime();

    // 1. Fetch Local Products
    try {
        const localResponse = await fetch(`/theprintloom/data/products.json?t=${cacheBuster}`);
        if (localResponse.ok) {
            const data = await localResponse.json();
            localProducts = Array.isArray(data) ? data : (data.products || data.data || []);
        }
    } catch (error) {
        console.error("Error loading local products:", error);
    }

    // 2. Fetch Google Sheets Products (always, regardless of CATALOG.source —
    //    this is how live stock/new products from the Sheet show up on Collections)
    try {
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyc8CE7Rm-EsLYdgxHfWqGmXnWE6PcnvRoFxNHpYQwEuwa0g1Ub8JCEVvLPiPD_wvWQ/exec';
        const sheetResponse = await fetch(`${SCRIPT_URL}?action=getProducts&t=${cacheBuster}`);
        const sheetData = await sheetResponse.json();

        if (sheetData.success && Array.isArray(sheetData.data)) {
            sheetProducts = sheetData.data;
        }
    } catch (error) {
        console.error("Error loading Google Sheet products:", error);
    }

    // 3. Merge arrays
    const safeLocal = Array.isArray(localProducts) ? localProducts : [];
    const safeSheet = Array.isArray(sheetProducts) ? sheetProducts : [];
    let combined = [...safeLocal, ...safeSheet];

    // 4. Normalize every product to a valid `images` array — this is the field
    //    productCard.js and the product detail page actually read from.
    //    Handles rows that only have a singular `image` string (typical of a
    //    flat Sheet row), already-correct `images` arrays, or nothing at all.
    combined = combined.map(product => {
        let images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];

        if (images.length === 0 && product.image) {
            images = [product.image];
        }

        images = images.map(img => {
            if (img.startsWith('http') || img.startsWith('/theprintloom/')) return img;
            const filename = img.split('/').pop();
            return `/theprintloom/assets/images/products/${filename}`;
        });

        product.images = images;
        return product;
    });

    return combined;
}
/**
 * Stock UI Handler
 * Evaluates product stock and updates the UI accordingly.
 */
export function updateStockUI(product) {
  // Uses classes to target elements (ensure these match your HTML elements)
  const stockBadge = document.querySelector('.stock-status'); 
  const addToCartBtn = document.querySelector('.add-to-cart-btn'); 
  const buyNowBtn = document.querySelector('.buy-now-btn');

  // If these elements don't exist on the current page, exit safely
  if (!stockBadge || !addToCartBtn || !buyNowBtn) return;

  if (product && product.stock > 0) {
      stockBadge.innerText = `In Stock (${product.stock} left)`;
      stockBadge.style.color = 'var(--color-success, green)'; 
      
      addToCartBtn.disabled = false;
      buyNowBtn.disabled = false;
      addToCartBtn.innerText = "Add to Cart";
      buyNowBtn.innerText = "Buy Now";
  } else {
      stockBadge.innerText = `Out of Stock`;
      stockBadge.style.color = 'var(--color-error, red)'; 
      
      addToCartBtn.disabled = true;
      buyNowBtn.disabled = true;
      addToCartBtn.innerText = "Unavailable";
      buyNowBtn.innerText = "Unavailable";
  }
}
