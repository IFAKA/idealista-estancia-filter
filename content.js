// content.js

const CACHE_KEY = 'estancia_cache';

async function collectPropertyData(propertyIds) {
  const cache = await loadCache();
  const uncachedIds = propertyIds.filter(id => !(id in cache));

  console.log(`Cache has ${propertyIds.length - uncachedIds.length} properties, fetching ${uncachedIds.length} new ones`);

  // Process uncached properties sequentially (avoid rate limiting)
  for (const propertyId of uncachedIds) {
    const months = await extractEstanciaMinima(propertyId);
    if (months !== null) {
      await setCachedMonths(propertyId, months);
      console.log(`Cached property ${propertyId}: ${months} months`);
    }

    // Add small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

// Inject filter widget into the existing filter form
function injectFilterWidget() {
  // Find the filter form
  const filterForm = document.querySelector('#filter-form');
  if (!filterForm) return;

  // Create filter item with simple select element
  const filterItem = document.createElement('div');
  filterItem.className = 'item-form';
  filterItem.id = 'estancia-minima-filter';
  filterItem.innerHTML = `
    <span class="title-label">Estancia mínima</span>
    <select id="estancia-dropdown" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; cursor: pointer; width: 100%; max-width: 200px;">
      <option value="">Indiferente</option>
      <option value="1">1 mes</option>
      <option value="2">2 meses</option>
      <option value="3">3 meses</option>
      <option value="4">4 meses</option>
      <option value="6">6 meses</option>
      <option value="12">12 meses</option>
    </select>
  `;

  // Insert after the price filter
  const priceFilter = document.querySelector('#price-filter-container');
  if (priceFilter && priceFilter.nextElementSibling) {
    priceFilter.parentNode.insertBefore(filterItem, priceFilter.nextElementSibling);
  } else {
    // Fallback: insert as last filter before reset button
    const resetButton = document.querySelector('#reset-filters');
    if (resetButton) {
      resetButton.parentNode.insertBefore(filterItem, resetButton);
    } else {
      filterForm.appendChild(filterItem);
    }
  }

  // Set up filter listener
  setupFilterListener();

  // Extract property IDs and start background collection
  const propertyIds = extractPropertyIds();
  window.estanciaPropertyIds = propertyIds;

  // Start background collection (don't await, let it run in background)
  collectPropertyData(propertyIds);
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

async function applyFilter(selectedMonths) {
  const cache = await loadCache();
  console.log('Applying filter for months:', selectedMonths, 'Cache:', cache);

  // Find property cards - try multiple selectors
  let propertyCards = document.querySelectorAll('a[href*="/inmueble/"]');

  if (propertyCards.length === 0) {
    propertyCards = document.querySelectorAll('[data-testid*="property"]');
  }

  console.log(`Found ${propertyCards.length} property cards`);

  propertyCards.forEach(card => {
    // Get the property URL
    const link = card.href || card.getAttribute('href');
    if (!link) return;

    // Extract property ID
    const match = link.match(/inmueble\/(\d+)/);
    if (!match) return;

    const propertyId = match[1];
    const cachedMonths = cache[propertyId];

    // Show property if:
    // - Filter is empty (Indiferente), OR
    // - We haven't fetched data yet (show to be safe), OR
    // - Property's minimum stay <= selected filter value
    const shouldShow = !selectedMonths ||
                      cachedMonths === undefined ||
                      cachedMonths <= parseInt(selectedMonths);

    // Hide the property card container
    const container = card.closest('li') || card.closest('article') || card.parentElement?.parentElement;
    if (container) {
      container.style.display = shouldShow ? '' : 'none';
      console.log(`Property ${propertyId}: ${cachedMonths} months - ${shouldShow ? 'SHOW' : 'HIDE'}`);
    }
  });
}

// Add event listener to dropdown
function setupFilterListener() {
  const dropdown = document.getElementById('estancia-dropdown');
  if (!dropdown) return;

  dropdown.addEventListener('change', (e) => {
    const value = e.target.value;
    console.log('Estancia filter changed to:', value);
    applyFilter(value);
  });
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
