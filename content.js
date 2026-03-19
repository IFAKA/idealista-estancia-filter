// content.js

const CACHE_KEY = 'estancia_cache';

// Inject filter widget at top of listings
function injectFilterWidget() {
  // Only run on listing pages (contains property cards)
  const listingContainer = document.querySelector('[data-testid="property-list"]') ||
                          document.querySelector('ul.property-list');

  if (!listingContainer) return;

  // Create widget HTML
  const widget = document.createElement('div');
  widget.id = 'estancia-filter-widget';
  widget.innerHTML = `
    <div class="estancia-filter-container">
      <label for="estancia-dropdown">Filter by minimum stay:</label>
      <select id="estancia-dropdown">
        <option value="">All</option>
        <option value="1">1 month</option>
        <option value="2">2 months</option>
        <option value="3">3 months</option>
        <option value="4">4 months</option>
        <option value="6">6 months</option>
        <option value="12">12 months</option>
      </select>
    </div>
  `;

  // Insert at top of page
  const pageContent = document.querySelector('main') || document.body;
  pageContent.insertBefore(widget, pageContent.firstChild);
}

async function loadCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY], (result) => {
      resolve(result[CACHE_KEY] || {});
    });
  });
}

async function saveCache(cache) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CACHE_KEY]: cache }, resolve);
  });
}

async function getCachedMonths(propertyId) {
  const cache = await loadCache();
  return cache[propertyId];
}

async function setCachedMonths(propertyId, months) {
  const cache = await loadCache();
  cache[propertyId] = months;
  await saveCache(cache);
}

async function extractEstanciaMinima(propertyId) {
  try {
    const detailUrl = `https://www.idealista.com/inmueble/${propertyId}/`;
    const response = await fetch(detailUrl);
    const html = await response.text();

    // Parse HTML to find <li>Estancia mínima de X meses</li>
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Look for the specific text pattern
    const liElements = doc.querySelectorAll('li');
    for (let li of liElements) {
      if (li.textContent.includes('Estancia mínima')) {
        const match = li.textContent.match(/(\d+)\s*mes/);
        if (match) {
          return parseInt(match[1]);
        }
      }
    }

    // If not found, treat as no restriction
    return null;
  } catch (error) {
    console.error(`Error fetching property ${propertyId}:`, error);
    return null;
  }
}

function extractPropertyIds() {
  const propertyIds = [];

  // Find property cards - Idealista uses data-testid or specific class patterns
  const propertyCards = document.querySelectorAll('[data-testid*="property-card"]') ||
                       document.querySelectorAll('article.property-card') ||
                       document.querySelectorAll('a[href*="/inmueble/"]');

  propertyCards.forEach(card => {
    // Extract ID from URL: /inmueble/87140652/
    const link = card.href || card.querySelector('a')?.href;
    if (link) {
      const match = link.match(/inmueble\/(\d+)/);
      if (match) {
        propertyIds.push(match[1]);
      }
    }
  });

  return [...new Set(propertyIds)]; // Remove duplicates
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFilterWidget);
} else {
  injectFilterWidget();
}
