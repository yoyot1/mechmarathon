/**
 * Conveyor tile renderer using SVG path data.
 *
 * Classifies conveyors (straight, curve, merge) and maps them to the
 * appropriate SVG path data key + rotation + optional mirror. Falls back
 * to the procedural conveyor.js renderer if no SVG data is available.
 *
 * ## Curve handling
 *
 * A single curve SVG covers one "turn chirality" (e.g. a right turn).
 * Rotation gives 4 orientations of the same chirality. The opposite
 * chirality is produced by mirroring the SVG horizontally before rotating.
 *
 * ## Merge handling
 *
 * `2curve` merges are symmetric — only rotation is needed (4 orientations).
 * `curve_straight` merges have a curve from one specific side. Rotation gives
 * 4 orientations of the same chirality; mirroring gives the other 4 (curve
 * from the opposite side). Only 2-entry merges are supported via SVG;
 * 3-entry merges fall back to the procedural renderer.
 */
import { registerRenderer } from './index.js';
import { drawTilePaths, drawTilePathsMirrored } from './path-renderer.js';
import { TILE_PATHS } from '../tile-paths.js';
import { DIRECTION_RADIANS } from '../constants.js';
import { renderConveyor as proceduralConveyor, renderExpress as proceduralExpress } from './conveyor.js';

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

// ─── Canonical directions ────────────────────────────────────────────
// Change these to match the orientation of your SVG assets.
// The renderer derives all other orientations via rotation and mirroring.

/** Regular conveyor curve SVG: entry → exit */
const CONVEYOR_CURVE_CANONICAL = { entry: 'south', exit: 'west' };

/** Express conveyor curve SVG: entry → exit */
const EXPRESS_CURVE_CANONICAL = { entry: 'south', exit: 'east' };

/**
 * Merge SVGs: canonical directions drawn in the SVG.
 *
 * curve_straight: one curve entry + one straight-through entry.
 *   `exit` = the exit direction, `curveEntry` = which side the curve comes from.
 *   The mirror image (curve from the other side) is produced by horizontal flip.
 *
 * 2curve: two curve entries (from both sides perpendicular to exit).
 *   Only `exit` is needed — the SVG is symmetric about the exit axis.
 */
const CONVEYOR_MERGE_CANONICAL = {
  curve_straight: { exit: 'south', curveEntry: 'east' },
  '2curve': { exit: 'west' },
};

const EXPRESS_MERGE_CANONICAL = {
  curve_straight: { exit: 'south', curveEntry: 'east' },
  '2curve': { exit: 'east' },
};

// ─── Derived lookup tables ───────────────────────────────────────────

function buildCurveTables(canonical) {
  return {
    rotations: buildRotationGroup(canonical.entry, canonical.exit),
    mirrors: buildMirrorGroup(canonical.entry, canonical.exit),
  };
}

const CONVEYOR_CURVE = buildCurveTables(CONVEYOR_CURVE_CANONICAL);
const EXPRESS_CURVE = buildCurveTables(EXPRESS_CURVE_CANONICAL);

// ─── Direction utilities ─────────────────────────────────────────────

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
    map[`${e}->${x}`] = r * (Math.PI / 2);
    e = rotateCW(e);
    x = rotateCW(x);
  }
  return map;
}

function buildMirrorGroup(entry, exit) {
  return buildRotationGroup(mirrorH(entry), mirrorH(exit));
}

// ─── Tile classification ─────────────────────────────────────────────

export function classifyConveyor(tile) {
  const curveEntries = getCurveEntries(tile);
  const straight = hasStraightEntry(tile);
  if (curveEntries.length === 0) return 'straight';
  if (curveEntries.length === 1 && !straight) return 'curve';
  return 'merge';
}

export function getCurveEntries(tile) {
  if (!tile.entry || !Array.isArray(tile.entry) || !tile.direction) return [];
  return tile.entry.filter(e => e !== OPPOSITE[tile.direction]);
}

export function hasStraightEntry(tile) {
  if (!tile.entry || !Array.isArray(tile.entry) || !tile.direction) return false;
  return tile.entry.includes(OPPOSITE[tile.direction]);
}

function classifyMerge(tile) {
  const curveEntries = getCurveEntries(tile);
  const straight = hasStraightEntry(tile);
  if (curveEntries.length === 2 && !straight) return '2curve';
  if (curveEntries.length === 1 && straight) return 'curve_straight';
  return null; // 3-entry or unhandled
}

// ─── Rotation + mirror computation ───────────────────────────────────

function straightRotation(dir) {
  return DIRECTION_RADIANS[dir] ?? 0;
}

function curveTransform(entry, exit, curveTables) {
  const key = `${entry}->${exit}`;
  if (key in curveTables.rotations) {
    return { rotation: curveTables.rotations[key], mirror: false };
  }
  if (key in curveTables.mirrors) {
    return { rotation: curveTables.mirrors[key], mirror: true };
  }
  return { rotation: 0, mirror: false };
}

/**
 * Compute rotation + mirror for a merge tile.
 *
 * For `2curve`: symmetric, so only rotation (no mirror needed).
 * For `curve_straight`: the SVG has one specific curve side. If the actual
 * curve entry is on the opposite side (relative to exit), we mirror.
 *
 * @returns {{ rotation: number, mirror: boolean }}
 */
function mergeTransform(exitDir, curveEntries, mergeCanonical, variant) {
  const canonical = mergeCanonical[variant];
  if (!canonical) return { rotation: DIRECTION_RADIANS[exitDir] ?? 0, mirror: false };

  const order = ['north', 'east', 'south', 'west'];
  const canonIdx = order.indexOf(canonical.exit);
  const actualIdx = order.indexOf(exitDir);
  const steps = (actualIdx - canonIdx + 4) % 4;
  const rotation = steps * (Math.PI / 2);

  if (variant !== 'curve_straight' || !canonical.curveEntry || curveEntries.length === 0) {
    return { rotation, mirror: false };
  }

  // Rotate the canonical curveEntry by the same steps to find expected side
  let expectedCurve = canonical.curveEntry;
  for (let i = 0; i < steps; i++) expectedCurve = rotateCW(expectedCurve);

  // If actual curve entry doesn't match expected, mirror
  const actualCurve = curveEntries[0];
  const mirror = actualCurve !== expectedCurve;

  return { rotation, mirror };
}

// ─── Renderer ────────────────────────────────────────────────────────

function renderConveyorType(prefix, proceduralFallback, curveTables, mergeCanonical) {
  return (container, tile, px, py, tileSize) => {
    const type = classifyConveyor(tile);
    const dir = tile.direction || 'north';

    let pathKey, rotation, mirror = false;

    if (type === 'straight') {
      pathKey = `${prefix}_straight`;
      rotation = straightRotation(dir);
    } else if (type === 'curve') {
      const entries = getCurveEntries(tile);
      pathKey = `${prefix}_curve`;
      const xform = curveTransform(entries[0], dir, curveTables);
      rotation = xform.rotation;
      mirror = xform.mirror;
    } else {
      const variant = classifyMerge(tile);
      if (!variant) {
        proceduralFallback(container, tile, px, py, tileSize);
        return;
      }
      pathKey = `${prefix}_merge_${variant}`;
      const curveEntries = getCurveEntries(tile);
      const xform = mergeTransform(dir, curveEntries, mergeCanonical, variant);
      rotation = xform.rotation;
      mirror = xform.mirror;
      if (!TILE_PATHS[pathKey]) {
        pathKey = `${prefix}_merge`;
      }
    }

    const pathDef = TILE_PATHS[pathKey];
    if (!pathDef) {
      proceduralFallback(container, tile, px, py, tileSize);
      return;
    }

    if (mirror) {
      drawTilePathsMirrored(container, pathDef, px, py, tileSize, rotation);
    } else {
      drawTilePaths(container, pathDef, px, py, tileSize, rotation);
    }
  };
}

// ─── Registration ────────────────────────────────────────────────────

const hasConveyorPaths = Object.keys(TILE_PATHS).some(k => k.startsWith('conveyor_'));
const hasExpressPaths = Object.keys(TILE_PATHS).some(k => k.startsWith('express_'));

if (hasConveyorPaths) {
  registerRenderer('conveyor', renderConveyorType(
    'conveyor', proceduralConveyor, CONVEYOR_CURVE, CONVEYOR_MERGE_CANONICAL));
}
if (hasExpressPaths) {
  registerRenderer('express_conveyor', renderConveyorType(
    'express', proceduralExpress, EXPRESS_CURVE, EXPRESS_MERGE_CANONICAL));
}
