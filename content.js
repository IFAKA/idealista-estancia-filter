// content.js

const CACHE_KEY = 'estancia_cache';

// Update status message in the filter widget
function updateStatus(message, isLoading = true) {
  const statusText = document.getElementById('estancia-status-text');
  const spinner = document.getElementById('estancia-loading-spinner');

  if (statusText) {
    statusText.textContent = message;
  }

  if (spinner) {
    spinner.style.display = isLoading ? 'inline-block' : 'none';
  }
}

async function collectPropertyData(propertyIds) {
  const cache = await loadCache();
  const uncachedIds = propertyIds.filter(id => !(id in cache));

  const cached = propertyIds.length - uncachedIds.length;
  console.log(`Cache has ${cached} properties, fetching ${uncachedIds.length} new ones`);

  if (uncachedIds.length === 0) {
    updateStatus(`✓ ${cached} propiedades en caché`, false);
    return;
  }

  // Process uncached properties sequentially (avoid rate limiting)
  for (let i = 0; i < uncachedIds.length; i++) {
    const propertyId = uncachedIds[i];
    const months = await extractEstanciaMinima(propertyId);
    if (months !== null) {
      await setCachedMonths(propertyId, months);
      console.log(`Cached property ${propertyId}: ${months} months`);
    }

    // Update progress
    const processed = cached + i + 1;
    const remaining = uncachedIds.length - i - 1;
    updateStatus(`${processed} / ${propertyIds.length} propiedades cargadas${remaining > 0 ? ` (${remaining} restantes)` : ''}`);

    // Add small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Done
  updateStatus(`✓ ${propertyIds.length} propiedades listas`, false);
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
    <div id="estancia-status" style="margin-top: 8px; font-size: 12px; color: #666;">
      <span id="estancia-loading-spinner" style="display: inline-block; margin-right: 4px;">⏳</span>
      <span id="estancia-status-text">Cargando datos...</span>
    </div>
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

  // Update status
  updateStatus(`Cargando ${propertyIds.length} propiedades...`);

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
  console.log('=== FILTER DEBUG ===');
  console.log('Selected months:', selectedMonths);
  console.log('Full cache:', cache);

  // Find property cards - Idealista uses <a> tags with inmueble hrefs
  let propertyCards = document.querySelectorAll('a[href*="/inmueble/"]');
  console.log(`Found ${propertyCards.length} property links`);

  if (propertyCards.length === 0) {
    updateStatus('❌ No se encontraron propiedades', false);
    return;
  }

  let shown = 0;
  let hidden = 0;
  const details = [];

  propertyCards.forEach((card, index) => {
    // Get the property URL
    const link = card.href || card.getAttribute('href');
    if (!link) return;

    // Extract property ID
    const idMatch = link.match(/inmueble\/(\d+)/);
    if (!idMatch) return;

    const propertyId = idMatch[1];
    const cachedMonths = cache[propertyId];

    // Logic: hide if filter is set AND we have data AND data exceeds filter
    const shouldHide = selectedMonths &&
                       cachedMonths !== undefined &&
                       cachedMonths > parseInt(selectedMonths);

    const shouldShow = !shouldHide;

    // Find the container to hide - try multiple levels
    let container = card.closest('li');
    if (!container) container = card.closest('article');
    if (!container) container = card.parentElement;
    if (!container) container = card.parentElement?.parentElement;

    if (container) {
      const currentDisplay = container.style.display;
      container.style.display = shouldShow ? '' : 'none';

      const action = shouldShow ? 'SHOW' : 'HIDE';
      const detail = `ID ${propertyId}: estancia=${cachedMonths}m, filter=${selectedMonths}m → ${action}`;
      details.push(detail);
      console.log(detail);

      if (shouldShow) shown++;
      else hidden++;
    }
  });

  console.log('Filter results:', { shown, hidden, total: shown + hidden });
  console.log('===================');

  // Update status with filter result
  if (!selectedMonths) {
    updateStatus(`✓ Mostrando todas las propiedades (${shown})`, false);
  } else {
    updateStatus(`✓ ${shown} propiedades (${hidden} filtradas por estancia ≥ ${selectedMonths}m)`, false);
  }
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
