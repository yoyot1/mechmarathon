/**
 * DOM-based tile renderer.
 *
 * Creates <img> elements (or fallback <div>s) for individual tiles.
 * Conveyors are classified and rotated/mirrored to match their orientation.
 */
import { TILE_ASSETS, getConveyorAssetUrl, getGearAssetUrl, getRepairAssetUrl } from './tile-assets.js';
import { classifyConveyor, getCurveEntries, hasStraightEntry } from './conveyor-classify.js';
import { TILE_COLORS, DIRECTION_RADIANS } from './constants.js';
import { hexToCss } from './constants.js';

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

// ─── Conveyor canonical directions (must match SVG assets) ──────────

const CONVEYOR_CURVE_CANONICAL = { entry: 'south', exit: 'west' };
const EXPRESS_CURVE_CANONICAL = { entry: 'south', exit: 'east' };

const CONVEYOR_MERGE_CANONICAL = {
  curve_straight: { exit: 'south', curveEntry: 'east' },
  '2curve': { exit: 'west' },
};
const EXPRESS_MERGE_CANONICAL = {
  curve_straight: { exit: 'south', curveEntry: 'east' },
  '2curve': { exit: 'east' },
};

// ─── Direction utilities ────────────────────────────────────────────

function rotateCW(dir) {
  const order = ['north', 'east', 'south', 'west'];
  return order[(order.indexOf(dir) + 1) % 4];
}

function mirrorH(dir) {
  if (dir === 'east') return 'west';
  if (dir === 'west') return 'east';
  return dir;
}

function buildRotationGroup(entry, exit) {
  const map = {};
  let e = entry, x = exit;
  for (let r = 0; r < 4; r++) {
    map[`${e}->${x}`] = r * 90;
    e = rotateCW(e);
    x = rotateCW(x);
  }
  return map;
}

function buildMirrorGroup(entry, exit) {
  return buildRotationGroup(mirrorH(entry), mirrorH(exit));
}

const CONVEYOR_CURVE_ROT = buildRotationGroup(CONVEYOR_CURVE_CANONICAL.entry, CONVEYOR_CURVE_CANONICAL.exit);
const CONVEYOR_CURVE_MIR = buildMirrorGroup(CONVEYOR_CURVE_CANONICAL.entry, CONVEYOR_CURVE_CANONICAL.exit);
const EXPRESS_CURVE_ROT = buildRotationGroup(EXPRESS_CURVE_CANONICAL.entry, EXPRESS_CURVE_CANONICAL.exit);
const EXPRESS_CURVE_MIR = buildMirrorGroup(EXPRESS_CURVE_CANONICAL.entry, EXPRESS_CURVE_CANONICAL.exit);

// ─── Transform computation ──────────────────────────────────────────

function straightRotationDeg(dir) {
  const map = { north: 0, east: 90, south: 180, west: 270 };
  return map[dir] ?? 0;
}

function curveTransform(entry, exit, rotTable, mirTable) {
  const key = `${entry}->${exit}`;
  if (key in rotTable) return { rotation: rotTable[key], mirror: false };
  if (key in mirTable) return { rotation: mirTable[key], mirror: true };
  return { rotation: 0, mirror: false };
}

function classifyMerge(tile) {
  const curveEntries = getCurveEntries(tile);
  const straight = hasStraightEntry(tile);
  if (curveEntries.length === 2 && !straight) return '2curve';
  if (curveEntries.length === 1 && straight) return 'curve_straight';
  return null;
}

function mergeTransform(exitDir, curveEntries, mergeCanonical, variant) {
  const canonical = mergeCanonical[variant];
  if (!canonical) return { rotation: straightRotationDeg(exitDir), mirror: false };

  const order = ['north', 'east', 'south', 'west'];
  const canonIdx = order.indexOf(canonical.exit);
  const actualIdx = order.indexOf(exitDir);
  const steps = (actualIdx - canonIdx + 4) % 4;
  const rotation = steps * 90;

  if (variant !== 'curve_straight' || !canonical.curveEntry || curveEntries.length === 0) {
    return { rotation, mirror: false };
  }

  let expectedCurve = canonical.curveEntry;
  for (let i = 0; i < steps; i++) expectedCurve = rotateCW(expectedCurve);

  const mirror = curveEntries[0] !== expectedCurve;
  return { rotation, mirror };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Create a tile <img> or fallback <div> for a given tile.
 * @param {object} tile - Tile data { type, direction, entry, ... }
 * @returns {{ element: HTMLElement, isFloorBase: boolean }}
 *   isFloorBase: true if this tile type is NOT a base tile (needs floor underneath)
 */
export function renderTile(tile) {
  const type = tile.type;

  // Conveyor types: classify and look up correct asset + transform
  if (type === 'conveyor' || type === 'express_conveyor') {
    return renderConveyorTile(tile);
  }

  // Gear tiles: variant-aware asset lookup + optional rotation
  if (type === 'gear') {
    const url = getGearAssetUrl(tile);
    if (url) {
      const img = createTileImg(url);
      if (tile.direction) {
        img.style.transform = `rotate(${straightRotationDeg(tile.direction)}deg)`;
      }
      return img;
    }
    return createFallbackDiv(type);
  }

  // Repair tiles: variant-aware asset lookup + optional rotation
  if (type === 'repair') {
    const url = getRepairAssetUrl(tile);
    if (url) {
      const img = createTileImg(url);
      if (tile.direction) {
        img.style.transform = `rotate(${straightRotationDeg(tile.direction)}deg)`;
      }
      return img;
    }
    return createFallbackDiv(type);
  }

  // Direct asset lookup
  const url = TILE_ASSETS[type];
  if (url) {
    const img = createTileImg(url);
    // Directional tiles: rotate by direction
    if ((type === 'current' || type === 'ramp' || type === 'ledge') && tile.direction) {
      img.style.transform = `rotate(${straightRotationDeg(tile.direction)}deg)`;
    }
    return img;
  }

  // Fallback: colored div
  return createFallbackDiv(type);
}

/**
 * Create a floor base <img> element.
 */
export function renderFloorBase() {
  if (TILE_ASSETS.floor) {
    return createTileImg(TILE_ASSETS.floor);
  }
  return createFallbackDiv('floor');
}

function renderConveyorTile(tile) {
  const isExpress = tile.type === 'express_conveyor';
  const prefix = isExpress ? 'express' : 'conveyor';
  const dir = tile.direction || 'north';
  const shape = classifyConveyor(tile);

  let assetShape, rotation, mirror = false;

  if (shape === 'straight') {
    assetShape = 'straight';
    rotation = straightRotationDeg(dir);
  } else if (shape === 'curve') {
    assetShape = 'curve';
    const entries = getCurveEntries(tile);
    const rotTable = isExpress ? EXPRESS_CURVE_ROT : CONVEYOR_CURVE_ROT;
    const mirTable = isExpress ? EXPRESS_CURVE_MIR : CONVEYOR_CURVE_MIR;
    const xform = curveTransform(entries[0], dir, rotTable, mirTable);
    rotation = xform.rotation;
    mirror = xform.mirror;
  } else {
    // merge
    const variant = classifyMerge(tile);
    if (!variant) {
      // 3-entry or unhandled: fallback
      return createFallbackDiv(tile.type);
    }
    assetShape = `merge_${variant}`;
    const curveEntries = getCurveEntries(tile);
    const mergeCanon = isExpress ? EXPRESS_MERGE_CANONICAL : CONVEYOR_MERGE_CANONICAL;
    const xform = mergeTransform(dir, curveEntries, mergeCanon, variant);
    rotation = xform.rotation;
    mirror = xform.mirror;
  }

  const url = getConveyorAssetUrl(tile.type, assetShape);
  if (!url) return createFallbackDiv(tile.type);

  const img = createTileImg(url);
  // CSS transforms apply right-to-left: list rotate first (applied second),
  // then scaleX (applied first) to match the old PixiJS mirror-then-rotate order.
  const transforms = [];
  if (rotation) transforms.push(`rotate(${rotation}deg)`);
  if (mirror) transforms.push('scaleX(-1)');
  if (transforms.length) img.style.transform = transforms.join(' ');

  return img;
}

function createTileImg(url) {
  const img = document.createElement('img');
  img.src = url;
  img.className = 'tile-img';
  img.draggable = false;
  return img;
}

function createFallbackDiv(type) {
  const div = document.createElement('div');
  div.className = 'tile-fallback';
  const color = TILE_COLORS[type] ?? TILE_COLORS.floor;
  div.style.backgroundColor = hexToCss(color);
  return div;
}
