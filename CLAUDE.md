# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

StreetGuess is a GeoGuessr-style browser game written as a **single self-contained HTML file** (`index.html`). There is no build step, no package manager, and no bundler. Open the file directly in a browser or serve it with any static file server.

The app requires a user-supplied Google Maps API key (stored in `localStorage` under `streetguess_api_key`). Required APIs: **Maps JavaScript API** and **Street View Static API**.

## Running locally

```sh
# Any static server works, e.g.:
python -m http.server 8080
# Then open http://localhost:8080
```

Referenced but not yet created files: `manifest.json`, `sw.js`, `icon-192.png` (PWA assets).

## Architecture

Everything lives in `index.html`:

- **CSS** (`:root` variables, layout) — inline `<style>` block. Color palette uses CSS variables (`--ink`, `--paper`, `--accent`, `--good`). Responsive breakpoint at `max-width: 560px` switches from fixed sidebar overlay to a stacked mobile layout.
- **HTML** — three main regions: `#pano` (Street View full-screen), `#sidebar` (right/bottom panel with minimap and buttons), and `#keyModal` (API key setup overlay).
- **JS** — inline `<script>`. No modules or frameworks. Key globals:
  - `map` / `pano` — Google Maps `Map` and `StreetViewPanorama` instances, initialized in `window.initGame()` (the Maps API callback).
  - `truePos` / `guessPos` — `{lat, lng}` for the hidden answer and the player's pin.
  - `roundHistory` — array of `{truePos, guessPos, km}` used to draw cumulative overlays on the result map.
  - `isReviewing` — boolean guard that blocks new pins during the result phase.
  - `svSource` — `"official"` | `"all"`, controls `StreetViewSource` passed to `getPanorama`.

### Game flow

1. **Startup**: reads `localStorage` for saved key → if found, calls `loadMaps(key)` which injects the Maps JS SDK `<script>` tag with `callback=initGame`; otherwise shows `#keyModal`.
2. **`initGame()`**: creates `StreetViewPanorama` and `Map`, attaches listeners, calls `findRandomPano()`.
3. **`findRandomPano()`**: calls `svService.getPanorama` with a random lat/lng (global land/sea), retries up to 120 times until `status === OK`.
4. **`startRound(data)`**: sets panorama position, resets UI state.
5. **Player clicks map** → `onMapClick` places/moves `guessMarker`, enables "確定する" button.
6. **`submitGuess()`**: computes Haversine distance, pushes to `roundHistory`, draws overlays (past rounds faded, current round bold), calls `fitBounds`.
7. **"もう一回遊ぶ" / "別の問題"**: resets state and restarts from step 3.

### Map expand behavior

- **Mobile**: `#mapWrap.expanded` class toggled on touch events (`touchstart` on map = expand, on pano = collapse).
- **PC**: `#sidebar.expanded-pc` toggled on `mousedown` events, doubling sidebar width and map height.
