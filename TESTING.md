# Testing Notes

## Manual Test Results

- [ ] Widget appears on Idealista listing pages
- [ ] Property IDs extracted correctly
- [ ] Background fetching begins without blocking page
- [ ] Cache populated with property data
- [ ] Filter dropdown works as expected
- [ ] Properties hide/show based on filter selection
- [ ] Cache persists across page refreshes

## Installation for Testing

1. Navigate to `brave://extensions` or `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the project directory

## Testing Steps

### Step 1: Verify Widget Appears
1. Visit https://www.idealista.com/
2. Perform a property search
3. Look for the gray filter bar at the top of listings
4. Check browser console (F12) for any errors

### Step 2: Test Property ID Extraction
1. Open DevTools (F12)
2. Go to Console tab
3. You should see: `Cache has X properties, fetching Y new ones`
4. Verify the numbers make sense

### Step 3: Test Caching
1. Keep the listing page open
2. Wait 30 seconds for background fetching to complete
3. Open DevTools → Application → Local Storage
4. Look for the extension's storage (chrome-extension://)
5. Find the `estancia_cache` key
6. It should contain JSON like: `{"87140652": 4, "87140653": 6}`

### Step 4: Test Filter Functionality
1. Select "3 months" from the dropdown
2. Properties with estancia minima > 3 should disappear
3. Select "6 months" - more properties should disappear
4. Select "All" - all properties should reappear

### Step 5: Test Cache Persistence
1. Close the browser tab
2. Reopen the listing page
3. The dropdown should work instantly (no "fetching X new ones" message)
4. This means the cache is persisting

## Known Limitations

- Properties without estancia minima text are treated as "no restriction" (always shown)
- May take 1-2 seconds to fetch all properties depending on network
- Extension only works on Idealista.com listing pages

## Debugging

If something doesn't work:
1. Check browser console (F12) for error messages
2. Verify the extension is loaded in Extensions page
3. Try reloading the extension (click reload icon)
4. Clear storage: DevTools → Application → Local Storage → Right click → Delete All
5. Reload the page

## Performance Expectations

- **First visit:** 1-2 seconds to crawl all property details
- **Subsequent visits:** Instant (using cache)
- **Cache size:** ~100 bytes per property
