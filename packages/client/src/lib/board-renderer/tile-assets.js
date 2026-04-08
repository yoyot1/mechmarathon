/**
 * SVG tile asset registry.
 *
 * Vite imports for all available SVG tile files.
 * Exports lookup helpers used by the tile renderer and editor.
 */
import floorUrl from '../../assets/tiles/floor.svg';
import conveyorStraightUrl from '../../assets/tiles/conveyor_straight.svg';
import conveyorCurveUrl from '../../assets/tiles/conveyor_curve.svg';
import conveyorMergeCurveStraightUrl from '../../assets/tiles/conveyor_merge_curve_straight.svg';
import conveyorMerge2curveUrl from '../../assets/tiles/conveyor_merge_2curve.svg';
import expressStraightUrl from '../../assets/tiles/express_straight.svg';
import expressCurveUrl from '../../assets/tiles/express_curve.svg';
import expressMergeCurveStraightUrl from '../../assets/tiles/express_merge_curve_straight.svg';
import expressMerge2curveUrl from '../../assets/tiles/express_merge_2curve.svg';
import gearCwUrl from '../../assets/tiles/gear_cw.svg';
import gearCcwUrl from '../../assets/tiles/gear_ccw.svg';
import hammerWrenchUrl from '../../assets/tiles/hammer_wrench.svg';
import wrenchUrl from '../../assets/tiles/wrench.svg';
import wrenchWrenchUrl from '../../assets/tiles/wrench_wrench.svg';

/** Map of asset key → URL for all available SVG tile images */
export const TILE_ASSETS = {
  floor: floorUrl,
  conveyor_straight: conveyorStraightUrl,
  conveyor_curve: conveyorCurveUrl,
  conveyor_merge_curve_straight: conveyorMergeCurveStraightUrl,
  conveyor_merge_2curve: conveyorMerge2curveUrl,
  express_straight: expressStraightUrl,
  express_curve: expressCurveUrl,
  express_merge_curve_straight: expressMergeCurveStraightUrl,
  express_merge_2curve: expressMerge2curveUrl,
  gear_cw: gearCwUrl,
  gear_ccw: gearCcwUrl,
  repair: wrenchUrl,
  repair_hammer_wrench: hammerWrenchUrl,
  repair_double_wrench: wrenchWrenchUrl,
};

/** Tile types that have a direct asset key in TILE_ASSETS */
const DIRECT_ASSET_TYPES = new Set(['floor']);

/** Tile types that use variant-based or classified asset lookup (always available) */
const LOOKUP_ASSET_TYPES = new Set(['conveyor', 'express_conveyor', 'gear', 'repair']);

/** Check if an asset key exists */
export function hasAsset(key) {
  return key in TILE_ASSETS;
}

/**
 * Get the set of tile types that have SVG assets and can be used in the editor.
 * Tile types without assets are disabled in the editor.
 */
export function getAvailableTileTypes() {
  const available = new Set();
  for (const type of DIRECT_ASSET_TYPES) {
    if (TILE_ASSETS[type]) available.add(type);
  }
  for (const type of LOOKUP_ASSET_TYPES) {
    available.add(type);
  }
  return available;
}

/**
 * Get the SVG asset URL for a gear tile based on its variant.
 * @param {object} tile - Tile data with optional variant property
 * @returns {string}
 */
export function getGearAssetUrl(tile) {
  const variant = tile.variant || 'cw';
  return variant === 'ccw' ? TILE_ASSETS.gear_ccw : TILE_ASSETS.gear_cw;
}

/**
 * Get the SVG asset URL for a repair tile based on its variant.
 * @param {object} tile - Tile data with optional variant property
 * @returns {string}
 */
export function getRepairAssetUrl(tile) {
  const variant = tile.variant || 'wrench';
  if (variant === 'hammer_wrench') return TILE_ASSETS.repair_hammer_wrench;
  if (variant === 'double_wrench') return TILE_ASSETS.repair_double_wrench;
  return TILE_ASSETS.repair;
}

/**
 * Get the SVG asset URL for a conveyor tile given its classification.
 * @param {'conveyor'|'express_conveyor'} tileType
 * @param {'straight'|'curve'|'merge_curve_straight'|'merge_2curve'} shape
 * @returns {string|null}
 */
export function getConveyorAssetUrl(tileType, shape) {
  const prefix = tileType === 'express_conveyor' ? 'express' : 'conveyor';
  const key = `${prefix}_${shape}`;
  return TILE_ASSETS[key] ?? null;
}
