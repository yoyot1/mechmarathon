/**
 * Tile Renderer Registry
 *
 * Maps tile types to render functions (PixiJS Graphics-based).
 *
 * Each render function signature:
 *   (container, tile, px, py, tileSize) => void
 *
 * container: PixiJS Container to add children to
 * tile: the tile data object from the board
 * px, py: pixel position (top-left corner of the tile)
 * tileSize: tile width/height in pixels
 */

const registry = new Map();

/**
 * Register a tile renderer for a given tile type.
 * @param {string} tileType - e.g. 'floor', 'pit', 'conveyor'
 * @param {Function} renderFn - (container, tile, px, py, tileSize) => void
 */
export function registerRenderer(tileType, renderFn) {
  registry.set(tileType, renderFn);
}

/**
 * Get the render function for a tile type.
 * Returns null if no renderer is registered.
 */
export function getRenderer(tileType) {
  return registry.get(tileType) ?? null;
}
