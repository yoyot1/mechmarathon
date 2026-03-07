/**
 * Tile Renderer Registry
 *
 * Maps tile types to render functions. Supports two modes:
 *   - 'simple': current symbol/text-based rendering (default)
 *   - 'enhanced': vector graphics rendering with PixiJS Graphics shapes
 *
 * Each render function signature:
 *   (container, tile, px, py, tileSize) => void
 *
 * container: PixiJS Container to add children to
 * tile: the tile data object from the board
 * px, py: pixel position (top-left corner of the tile)
 * tileSize: tile width/height in pixels
 */

const STORAGE_KEY = 'mechmarathon.renderMode';

const registry = new Map();
let currentMode = 'simple';

// Load persisted preference
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'simple' || stored === 'enhanced') {
    currentMode = stored;
  }
} catch {
  // localStorage unavailable
}

/**
 * Register a tile renderer for a given tile type.
 * @param {string} tileType - e.g. 'floor', 'pit', 'conveyor'
 * @param {{ simple?: Function, enhanced?: Function }} renderers
 */
export function registerRenderer(tileType, renderers) {
  registry.set(tileType, renderers);
}

/**
 * Get the render function for a tile type in the current mode.
 * Falls back to the other mode if the requested one isn't registered,
 * then returns null if neither exists.
 */
export function getRenderer(tileType) {
  const entry = registry.get(tileType);
  if (!entry) return null;
  return entry[currentMode] ?? entry.simple ?? entry.enhanced ?? null;
}

/**
 * Set the render mode ('simple' or 'enhanced').
 * Persists to localStorage.
 */
export function setRenderMode(mode) {
  if (mode !== 'simple' && mode !== 'enhanced') return;
  currentMode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable
  }
}

/** Get the current render mode. */
export function getRenderMode() {
  return currentMode;
}

/** Check if a tile type has an enhanced renderer. */
export function hasEnhancedRenderer(tileType) {
  const entry = registry.get(tileType);
  return !!entry?.enhanced;
}
