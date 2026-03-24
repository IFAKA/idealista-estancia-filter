// content.js

const CACHE_KEY = 'estancia_cache';
const FILTER_KEY = 'estancia_filter';

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
  let cache = await loadCache();
  
  // Migration check: If cache has old number values, we might want to refresh or convert
  // For now, we'll just treat them as valid but missing extra details unless we want to force refresh
  
  const uncachedIds = propertyIds.filter(id => {
    const entry = cache[id];
    // Re-fetch if not in cache OR if it's the old format (number)
    return !entry || typeof entry === 'number';
  });

  const cachedCount = propertyIds.length - uncachedIds.length;
  console.log(`Cache has ${cachedCount} properties, fetching ${uncachedIds.length} new ones`);

  if (uncachedIds.length === 0) {
    updateStatus(`✓ ${cachedCount} propiedades en caché`, false);
    // Re-apply filter/injection with complete cache
    const dropdown = document.getElementById('estancia-dropdown');
    if (dropdown) {
      applyFilter(dropdown.value);
    }
    return;
  }

  // Process uncached properties sequentially
  for (let i = 0; i < uncachedIds.length; i++) {
    const propertyId = uncachedIds[i];
    const details = await extractPropertyDetails(propertyId);
    
    if (details) {
      await setCachedDetails(propertyId, details);
      console.log(`Cached property ${propertyId}:`, details);
    }

    // Update progress
    const processed = cachedCount + i + 1;
    const remaining = uncachedIds.length - i - 1;
    updateStatus(`${processed} / ${propertyIds.length} propiedades cargadas${remaining > 0 ? ` (${remaining} restantes)` : ''}`);

    // Apply filter/injection in real-time
    const dropdown = document.getElementById('estancia-dropdown');
    if (dropdown) {
      applyFilter(dropdown.value);
    }

    // Add small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Done
  updateStatus(`✓ ${propertyIds.length} propiedades listas`, false);
  const dropdown = document.getElementById('estancia-dropdown');
  if (dropdown) {
    applyFilter(dropdown.value);
  }
}

// Inject filter widget
function injectFilterWidget() {
  const filterForm = document.querySelector('#filter-form');
  if (!filterForm) return;

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

  const priceFilter = document.querySelector('#price-filter-container');
  if (priceFilter && priceFilter.nextElementSibling) {
    priceFilter.parentNode.insertBefore(filterItem, priceFilter.nextElementSibling);
  } else {
    const resetButton = document.querySelector('#reset-filters');
    if (resetButton) {
      resetButton.parentNode.insertBefore(filterItem, resetButton);
    } else {
      filterForm.appendChild(filterItem);
    }
  }

  setupFilterListener();

  const propertyIds = extractPropertyIds();
  window.estanciaPropertyIds = propertyIds;
  updateStatus(`Cargando ${propertyIds.length} propiedades...`);
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

async function setCachedDetails(propertyId, details) {
  const cache = await loadCache();
  cache[propertyId] = details;
  await saveCache(cache);
}

async function extractPropertyDetails(propertyId) {
  try {
    const detailUrl = `https://www.idealista.com/inmueble/${propertyId}/`;
    const response = await fetch(detailUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const details = {
      minStay: null,
      available: null,
      lookingFor: { gender: null, age: null, couple: null, minor: null },
      rules: { smoking: null, pets: null },
      roommates: { count: null, gender: null, occupation: null, atmosphere: null },
      features: { bed: null, furnished: null }
    };

    // --- Parsing Logic ---

    // 1. "Están buscando..." (Looking for)
    // Often in .details-property-feature-one
    const features = doc.querySelectorAll('.details-property_features li');
    features.forEach(li => {
      const text = li.textContent.trim();
      
      // Min Stay
      if (text.includes('Estancia mínima')) {
        const match = text.match(/(\d+)\s*mes/);
        if (match) details.minStay = parseInt(match[1]);
      }
      // Availability
      else if (text.includes('Ya disponible') || text.includes('Disponible')) {
        details.available = text;
      }
      // Age
      else if (text.includes('años')) {
        // Can be roommate age or looking for age. Usually "Están buscando..." is first block
        if (!details.lookingFor.age) details.lookingFor.age = text;
      }
      // Gender (Looking for)
      else if (text.includes('El género da igual') || text.includes('Solo chicas') || text.includes('Solo chicos')) {
         details.lookingFor.gender = text;
      }
    });

    // 2. Normas (Rules) - Icons often used
    const ruleContainers = doc.querySelectorAll('.feature-container');
    ruleContainers.forEach(container => {
      const text = container.textContent.trim();
      const icon = container.querySelector('i');
      const iconClass = icon ? icon.className : '';

      if (text.includes('fumar') || iconClass.includes('smokers')) {
        details.rules.smoking = !text.toLowerCase().includes('no'); // 'No se puede fumar' -> false
      }
      if (text.includes('mascotas') || iconClass.includes('pets')) {
        details.rules.pets = !text.toLowerCase().includes('no');
      }
      if (text.includes('parejas') || iconClass.includes('couples')) {
        details.lookingFor.couple = !text.toLowerCase().includes('no');
      }
      if (text.includes('menores') || iconClass.includes('minors')) {
        details.lookingFor.minor = !text.toLowerCase().includes('no');
      }
    });

    // 3. Roommates (Tus compañeros/as)
    // Often found by heading
    const h2s = doc.querySelectorAll('h2');
    let roommatesUl = null;
    h2s.forEach(h2 => {
      if (h2.textContent.includes('compañeros')) {
        const nextDiv = h2.nextElementSibling;
        if (nextDiv) roommatesUl = nextDiv.querySelector('ul');
      }
    });

    if (roommatesUl) {
      const lis = roommatesUl.querySelectorAll('li');
      details.roommates.total = lis.length; // Approximate, or look for specific text
      lis.forEach(li => {
        const t = li.textContent.trim();
        if (t.includes('Chicos') || t.includes('Chicas')) details.roommates.gender = t;
        if (t.includes('Trabajan') || t.includes('Estudian')) details.roommates.occupation = t;
        if (t.includes('ambiente')) details.roommates.atmosphere = t;
      });
    }

    // 4. Room Features (Características de la habitación)
    h2s.forEach(h2 => {
      if (h2.textContent.includes('Características de la habitación')) {
        const nextDiv = h2.nextElementSibling;
        if (nextDiv) {
          const lis = nextDiv.querySelectorAll('li');
          lis.forEach(li => {
            const t = li.textContent.trim();
            if (t.includes('Cama doble')) details.features.bed = 'Cama doble';
            else if (t.includes('Cama simple')) details.features.bed = 'Cama simple';
            
            if (t.includes('amueblada')) details.features.furnished = true;
          });
        }
      }
    });

    // 5. Chat availability
    const contactSection = doc.querySelector('.module-contact');
    if (contactSection) {
      const lastMessage = contactSection.querySelector('.lastMessage');
      const noChatForm = contactSection.querySelector('.no-contact-form');
      const chatButton = contactSection.querySelector('.button-chat');
      if (lastMessage || noChatForm) {
        details.canChat = false;
      } else if (chatButton) {
        details.canChat = true;
      }
    }

    return details;

  } catch (error) {
    console.error(`Error extracting property ${propertyId}:`, error);
    return null;
  }
}

async function applyFilter(selectedMonths) {
  const cache = await loadCache();

  const propertyCards = getPropertyCards();
  if (propertyCards.length === 0) return;

  let shown = 0;
  let hidden = 0;

  propertyCards.forEach(card => {
    const propertyId = getPropertyIdFromCard(card);
    if (!propertyId) return;

    let cachedData = cache[propertyId];

    // Handle old cache format (number)
    if (typeof cachedData === 'number') {
       cachedData = { minStay: cachedData };
    }

    // Filter Logic
    let shouldShow = true;
    if (selectedMonths && cachedData && cachedData.minStay) {
      if (cachedData.minStay > parseInt(selectedMonths)) {
        shouldShow = false;
      }
    }
    if (cachedData && cachedData.canChat === false) {
      shouldShow = false;
    }

    // Toggle Visibility
    const container = getCardContainer(card);
    if (container) {
      container.style.display = shouldShow ? '' : 'none';
      if (shouldShow) shown++; else hidden++;
    }

    // Inject Details (only if showing)
    if (shouldShow && cachedData) {
      injectDetails(card, cachedData);
    }
  });

  if (!selectedMonths) {
    updateStatus(`✓ Mostrando todas las propiedades (${shown})`, false);
  } else {
    updateStatus(`✓ ${shown} propiedades (${hidden} filtradas por estancia ≥ ${selectedMonths}m)`, false);
  }
}

function injectDetails(card, details) {
  // Ensure all fields exist even if cached entry is incomplete/old format
  const safeDetails = {
    minStay: details.minStay || null,
    available: details.available || null,
    lookingFor: {
      gender: null, age: null, couple: null, minor: null,
      ...(details.lookingFor || {})
    },
    rules: {
      smoking: null, pets: null,
      ...(details.rules || {})
    },
    roommates: {
      total: null, gender: null, occupation: null, atmosphere: null,
      ...(details.roommates || {})
    },
    features: {
      bed: null, furnished: null,
      ...(details.features || {})
    }
  };

  // Find where to inject
  let infoContainer = card.closest('.item-info-container');
  if (!infoContainer) {
    const container = card.closest('article');
    if (container) infoContainer = container.querySelector('.item-info-container');
  }

  if (!infoContainer) return;

  if (infoContainer.querySelector('.extension-details-row')) return;

  const detailsRow = document.createElement('div');
  detailsRow.className = 'extension-details-row';

  const addItem = (icon, text, type = 'neutral') => {
    if (!text && !icon) return;
    const span = document.createElement('span');
    span.className = `ext-detail-item ${type}`;
    span.innerHTML = `<i>${icon}</i> ${text || ''}`;
    detailsRow.appendChild(span);
  };

  // 1. Min Stay
  if (safeDetails.minStay) {
    addItem('📅', `> ${safeDetails.minStay} meses`);
  }

  // 2. Rules
  if (safeDetails.rules.smoking === false) addItem('🚫', 'No fumadores', 'warning');
  else if (safeDetails.rules.smoking === true) addItem('🚬', 'Fumadores OK');

  if (safeDetails.rules.pets === false) addItem('🚫', 'No mascotas', 'warning');
  else if (safeDetails.rules.pets === true) addItem('🐶', 'Mascotas OK', 'success');
  
  if (safeDetails.lookingFor.couple === false) addItem('🚫', 'No parejas', 'warning');

  // 3. Roommates
  if (safeDetails.roommates.gender) {
    let icon = '👥';
    const lower = safeDetails.roommates.gender.toLowerCase();
    if (lower.includes('chicas') && !lower.includes('chicos')) icon = '👩';
    if (lower.includes('chicos') && !lower.includes('chicas')) icon = '👨';
    addItem(icon, safeDetails.roommates.gender);
  }

  // 4. Room Features
  if (safeDetails.features.bed) {
    const bedIcon = '🛏️';
    const bedText = safeDetails.features.bed.replace('Cama ', '');
    addItem(bedIcon, bedText);
  }

  // 5. Availability
  if (safeDetails.available && !safeDetails.available.includes('Ya')) {
      const shortDate = safeDetails.available.replace('Disponible a partir del ', 'Desde ');
      addItem('⏳', shortDate);
  }

  // Find insertion point: After .item-detail-char
  const charRow = infoContainer.querySelector('.item-detail-char');
  if (charRow) {
    charRow.parentNode.insertBefore(detailsRow, charRow.nextSibling);
  } else {
    // Fallback
    const priceRow = infoContainer.querySelector('.price-row');
    if (priceRow) {
        priceRow.parentNode.insertBefore(detailsRow, priceRow.nextSibling);
    } else {
        infoContainer.appendChild(detailsRow);
    }
  }
}

// Helpers
function getPropertyCards() {
  return document.querySelectorAll('a[href*="/inmueble/"]');
}

function getPropertyIdFromCard(card) {
  const link = card.href || card.getAttribute('href');
  if (!link) return null;
  const match = link.match(/inmueble\/(\d+)/);
  return match ? match[1] : null;
}

function getCardContainer(card) {
  let container = card.closest('li'); // Common in lists
  if (!container) container = card.closest('article');
  if (!container) container = card.parentElement?.parentElement;
  return container;
}

// Add event listener to dropdown
function setupFilterListener() {
  const dropdown = document.getElementById('estancia-dropdown');
  if (!dropdown) return;

  // Load saved filter value
  chrome.storage.local.get([FILTER_KEY], (result) => {
    const savedValue = result[FILTER_KEY] || '';
    dropdown.value = savedValue;
    applyFilter(savedValue);
  });

  dropdown.addEventListener('change', (e) => {
    const value = e.target.value;
    chrome.storage.local.set({ [FILTER_KEY]: value });
    applyFilter(value);
  });
}

function extractPropertyIds() {
  const propertyIds = [];
  const cards = getPropertyCards();
  cards.forEach(card => {
    const id = getPropertyIdFromCard(card);
    if (id) propertyIds.push(id);
  });
  return [...new Set(propertyIds)];
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFilterWidget);
} else {
  injectFilterWidget();
}
