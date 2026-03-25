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
  repair: hammerWrenchUrl,
  spawn: wrenchUrl,
};

/** Tile types that have a direct asset (non-conveyor, non-directional) */
const DIRECT_ASSET_TYPES = new Set(['floor', 'gear_cw', 'gear_ccw', 'repair', 'spawn']);

/** Tile types that use conveyor asset lookup (classify → straight/curve/merge) */
const CONVEYOR_ASSET_TYPES = new Set(['conveyor', 'express_conveyor']);

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
  for (const type of CONVEYOR_ASSET_TYPES) {
    available.add(type);
  }
  return available;
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
