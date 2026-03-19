# Idealista Estancia Minima Filter Extension

A lightweight browser extension that filters Idealista property listings by minimum stay duration.

## Features

- 🔍 Automatically extracts "estancia mínima" (minimum stay) from property detail pages
- 💾 Caches results to avoid re-fetching the same properties
- 🎛️ Simple dropdown filter widget on listing pages (1-12 months or "All")
- ⚡ Instant filtering with CSS-based show/hide
- 🔒 Zero data collection - everything stays local in your browser

## Installation

1. Clone or download this repository
2. Open Brave or Chrome and navigate to `brave://extensions` or `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select this project directory

## How It Works

1. When you visit an Idealista listing page, the extension injects a filter widget at the top
2. It automatically extracts property IDs from the visible listings
3. For each property not yet cached, it quietly fetches the detail page and extracts the estancia mínima duration
4. Results are stored locally in your browser
5. Use the dropdown filter to show only properties matching your minimum stay requirements
6. Properties matching your filter are displayed; others are hidden with CSS

## Usage

1. Go to `idealista.com` and search for properties
2. The filter widget appears at the top of the listing
3. Select your minimum stay duration from the dropdown (1-12 months or "All")
4. Properties not matching your criteria are hidden
5. On subsequent visits, cached data is used instantly

## Performance

- First load: Takes 1-2 seconds to fetch all property details (runs in background)
- Subsequent visits: Instant filtering (uses cached data)
- Cache persists indefinitely across browser sessions

## Privacy

No data is sent to external servers:
- Everything is extracted and stored locally
- Filter preferences stay on your machine
- Extension only reads from Idealista.com

## Technical Details

- **Manifest Version:** 3
- **JavaScript:** Vanilla (no dependencies)
- **Storage:** Chrome Storage Local API
- **Content Script:** Runs on idealista.com only
