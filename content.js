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

  // Create filter item matching Idealista's existing filter structure
  const filterItem = document.createElement('div');
  filterItem.className = 'item-form dropdown-filter';
  filterItem.id = 'estancia-minima-filter';
  filterItem.innerHTML = `
    <span class="title-label">Estancia mínima</span>
    <div class="dropdown-list">
      <input type="hidden" name="adfilter_estancia_minima" value="default">
      <button class="dropdown-wrapper" id="estancia-dropdown" type="button" data-role="link-dropdown">
        <span class="placeholder">Indiferente</span>
        <ul class="dropdown">
          <li data-value="default">Indiferente</li>
          <li data-value="1">1 mes</li>
          <li data-value="2">2 meses</li>
          <li data-value="3">3 meses</li>
          <li data-value="4">4 meses</li>
          <li data-value="6">6 meses</li>
          <li data-value="12">12 meses</li>
        </ul>
      </button>
      <ul class="dropdown-list">
        <li data-value="default" selected="selected">Indiferente</li>
        <li data-value="1">1 mes</li>
        <li data-value="2">2 meses</li>
        <li data-value="3">3 meses</li>
        <li data-value="4">4 meses</li>
        <li data-value="6">6 meses</li>
        <li data-value="12">12 meses</li>
      </ul>
    </div>
  `;

  // Insert after the price filter (find the last item-form with id containing 'price')
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
  const propertyCards = document.querySelectorAll('[data-testid*="property-card"]') ||
                       document.querySelectorAll('article.property-card') ||
                       document.querySelectorAll('a[href*="/inmueble/"]');

  propertyCards.forEach(card => {
    const link = card.href || card.querySelector('a')?.href;
    if (!link) return;

    const match = link.match(/inmueble\/(\d+)/);
    if (!match) return;

    const propertyId = match[1];
    const cachedMonths = cache[propertyId];

    // Show property if:
    // - Filter is "All" (selectedMonths is empty), OR
    // - We haven't fetched data yet (show to avoid hiding too much), OR
    // - Property's minimum stay <= selected filter
    const shouldShow = !selectedMonths ||
                      cachedMonths === undefined ||
                      cachedMonths <= parseInt(selectedMonths);

    // Get the container element (parent of card)
    const container = card.closest('article') || card.closest('li') || card.parentElement;
    if (container) {
      container.style.display = shouldShow ? '' : 'none';
    }
  });
}

// Add event listener to dropdown
function setupFilterListener() {
  const filterItem = document.getElementById('estancia-minima-filter');
  if (!filterItem) return;

  // Get both the dropdown menu items and the button
  const dropdownItems = filterItem.querySelectorAll('.dropdown-list li');
  const dropdownButton = filterItem.querySelector('.dropdown-wrapper');

  // Add click listener to each dropdown item
  dropdownItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const value = item.getAttribute('data-value');

      // Update the button text
      if (dropdownButton) {
        const textMap = {
          'default': 'Indiferente',
          '1': '1 mes',
          '2': '2 meses',
          '3': '3 meses',
          '4': '4 meses',
          '6': '6 meses',
          '12': '12 meses'
        };
        dropdownButton.querySelector('.placeholder').textContent = textMap[value] || 'Indiferente';
      }

      // Update the hidden input
      const hiddenInput = filterItem.querySelector('input[type="hidden"]');
      if (hiddenInput) {
        hiddenInput.value = value;
      }

      // Apply filter
      applyFilter(value === 'default' ? '' : value);
    });
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
