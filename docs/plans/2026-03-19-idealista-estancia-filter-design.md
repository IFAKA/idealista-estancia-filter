# Idealista Estancia Minima Filter Extension Design

**Date:** 2026-03-19
**Project:** Idealista Mini Browser Extension
**Status:** Approved

## Overview

A lightweight Brave/Chrome extension that filters Idealista property listings by minimum stay duration (estancia mínima). Since this data only appears on property detail pages, the extension automatically crawls details in the background and caches results to avoid rework.

## Problem Statement

- Users browsing Idealista listings cannot filter by minimum stay duration on the listing page
- The estancia minima information is only visible on individual property detail pages
- Users currently must visit each property to check this constraint

## Solution

Single content script that:
1. Injects a filter dropdown widget into Idealista listing pages
2. Automatically extracts estancia minima from property detail pages for uncached properties
3. Caches results in browser storage to avoid re-fetching
4. Shows/hides properties based on the user's selected filter

## Technical Design

### Architecture

**Single Content Script Model** (no background worker)
- Keep it simple: all logic in one `content.js` file
- Lightweight, fast injection, no cross-script messaging

### File Structure

```
estancia-minima/
├── manifest.json
├── content.js
├── styles.css
└── docs/plans/
    └── 2026-03-19-idealista-estancia-filter-design.md
```

### Components

#### 1. Manifest (`manifest.json`)
- Permissions: `https://www.idealista.com/*` (content script + fetch)
- `chrome.storage` for caching
- Icon assets (optional for MVP)

#### 2. Content Script (`content.js`)

**Initialization:**
- Run on Idealista listing pages (detect URL pattern)
- Inject filter widget into DOM at top of listing
- Load cached data from `chrome.storage.local`

**Data Collection:**
- Extract property IDs from listing cards (DOM parsing)
- For each property not in cache:
  - Fetch property detail page via `fetch()`
  - Parse HTML to find `<li>Estancia mínima de X meses</li>`
  - Extract number via regex: `/\d+/`
  - Store in cache immediately
- Build map of `{ propertyId: months }`

**Filtering:**
- Bind change listener to filter dropdown
- On change, iterate property cards
- Apply CSS `display: none` to non-matching properties
- Immediately responsive (no re-fetching)

#### 3. Styles (`styles.css`)

Minimal styling for injected widget:
- Simple dropdown/select element
- Positioned at top of listing
- Non-intrusive design

### Data Storage

**Structure:**
```json
{
  "estancia_cache": {
    "87140652": 4,
    "87140653": 6,
    "87140654": 12
  }
}
```

**Key:** Property ID (from URL or listing element)
**Value:** Months (integer)

**Caching Strategy:**
- Cache indefinitely (estancia minima is stable once published)
- No expiration/cleanup logic (YAGNI principle)

### Data Extraction

**HTML Pattern:**
```html
<li>Estancia mínima de 4 meses</li>
```

**Extraction Logic:**
```javascript
const text = detailPage.querySelector('li');
if (text?.textContent?.includes('Estancia mínima')) {
  const months = parseInt(text.textContent.match(/\d+/)[0]);
}
```

### User Flow

1. User navigates to Idealista listing page
2. Extension injects filter widget ("Filter by minimum stay: [All ▼]")
3. Extension begins background crawl of uncached properties
4. User can immediately filter by selecting 1-12 months or "All"
5. Properties not matching filter are hidden with `display: none`
6. Data persists across sessions and listings

### Error Handling

**Minimal for MVP:**
- If property detail page fails to fetch: skip, don't break filter
- If estancia minima text not found: treat as "no restriction" (show in all filters)
- If property ID cannot be extracted: skip caching

### Performance Considerations

- Fetch detail pages sequentially or with small concurrency (avoid rate limiting)
- Cache lookup is instant (in-memory after load)
- DOM operations use efficient selectors
- Filter toggle is instant (CSS-based, no re-render)

## Out of Scope

- User authentication or preferences beyond filter state
- Multi-language support (MVP targets Spanish market)
- Visualization/sorting of properties by minimum stay
- Browser history or analytics

## Success Criteria

✅ Extension successfully injects on Idealista listing pages
✅ Estancia minima data extracted and cached correctly
✅ Filter dropdown shows/hides properties accurately
✅ No rework on cached properties (persists across sessions)
✅ Lightweight, no noticeable impact on page load

## Testing Strategy

**Manual Testing:**
- Load real Idealista listing, verify widget appears
- Filter to different month ranges, verify correct properties hidden
- Refresh page, verify cache is used (no re-fetching)
- Test multiple properties with various estancia minima values

**Edge Cases:**
- Properties with no estancia minima listed
- Properties with non-standard text format
- Cache corruption/missing data

## Next Steps

1. Write implementation plan (writing-plans skill)
2. Create manifest.json with permissions
3. Implement content.js with widget injection and data collection
4. Add minimal CSS styling
5. Test on real Idealista pages
6. Package and prepare for installation
