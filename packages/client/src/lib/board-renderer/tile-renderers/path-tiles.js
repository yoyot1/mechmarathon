/**
 * Registers all path-based tile renderers.
 *
 * Import this module to register renderers for all tile types that have
 * SVG path data in tile-paths.js. Tiles without path data continue
 * using the fallback (colored rectangle + symbol).
 */
import { registerRenderer } from './index.js';
import { createPathRenderer } from './path-renderer.js';
import { TILE_PATHS } from '../tile-paths.js';

// --- Static tile types (non-directional) ---
const STATIC_TILES = [
  'floor',
  'pit',
  'trap_pit',
  'gear_cw',
  'gear_ccw',
  'repair',
  'spawn',
  'oil_slick',
  'water',
  'portal',
  'drain',
  'radioactive_drain',
  'teleporter',
  'randomizer',
  'radiation',
  'radioactive_waste',
  'chop_shop',
];

// --- Directional tile types (rotated by tile.direction) ---
const DIRECTIONAL_TILES = [
  'current',
  'ramp',
  'ledge',
];

// Register static tiles
for (const type of STATIC_TILES) {
  const renderer = createPathRenderer(type);
  if (renderer) {
    registerRenderer(type, renderer);
  }
}

// Register directional tiles
for (const type of DIRECTIONAL_TILES) {
  const renderer = createPathRenderer(type, { directional: true });
  if (renderer) {
    registerRenderer(type, renderer);
  }
}

// Register conveyor renderers (handles its own classification logic)
import './conveyor-paths.js';
