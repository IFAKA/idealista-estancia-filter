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

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectFilterWidget);
} else {
  injectFilterWidget();
}
