/**
 * Tile Cycler — modify-in-place framework for board editor.
 *
 * In pointer mode (or when tool matches existing tile), clicking an
 * already-selected tile cycles its properties.  Modifier keys control
 * which property cycles:
 *
 *   Click        → primary   (rotate CW, cycle phases/group, swap gear)
 *   Alt+Click    → reverse   (rotate CCW, reverse cycle)
 *   Shift+Click  → secondary (conveyors: keep entry, cycle exit)
 *   Shift+Alt    → secondaryReverse
 *   Ctrl+Click   → tertiary  (conveyors: cycle shape)
 *
 * Edge clicks (within 20% of tile edge) use edgeCyclers instead:
 *   Click        → toggle wall
 *   Shift+Click  → cycle side feature
 *   Ctrl+Click   → cycle one-way wall
 *   Alt+Click    → remove side feature
 */

import { rotateTile, DIRECTION_ORDER } from '@mechmarathon/shared';

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

// ── Helpers ──────────────────────────────────────────────────────────

function nextDir(dir) {
  return DIRECTION_ORDER[(DIRECTION_ORDER.indexOf(dir) + 1) % 4];
}

function prevDir(dir) {
  return DIRECTION_ORDER[(DIRECTION_ORDER.indexOf(dir) + 3) % 4];
}

/** Perpendiculars of a direction in CW order relative to dir */
function perpendiculars(dir) {
  // CW from dir: next is the CW perpendicular, prev is the CCW perpendicular
  return [nextDir(dir), prevDir(dir)];
}

// ── Cycling functions ────────────────────────────────────────────────

function rotateCW(tile) {
  return rotateTile(tile, 90);
}

function rotateCCW(tile) {
  return rotateTile(tile, 270);
}

/**
 * Shift+click behavior for conveyors:
 *   Straight/Curve: keep entry fixed, cycle exit CW (skipping illegal dirs)
 *   T-merge/Y-merge: mirror curve entries across the exit axis
 */
function shiftConveyor(tile) {
  const dir = tile.direction;
  const opp = OPPOSITE[dir];
  const entries = tile.entry || [];

  // Straight or curve: cycle exit, keep entry fixed
  if (entries.length <= 1) {
    let lockedEntries = entries;
    if (lockedEntries.length === 0) {
      // Straight → lock implicit entry (opposite of exit)
      lockedEntries = [opp];
    }
    let d = dir;
    for (let i = 0; i < 4; i++) {
      d = nextDir(d);
      if (!lockedEntries.includes(d)) {
        return { ...tile, direction: d, entry: [...lockedEntries] };
      }
    }
    return null;
  }

  // Merge: mirror curve entries
  return mirrorMerge(tile);
}

function shiftConveyorReverse(tile) {
  const dir = tile.direction;
  const opp = OPPOSITE[dir];
  const entries = tile.entry || [];

  if (entries.length <= 1) {
    let lockedEntries = entries;
    if (lockedEntries.length === 0) {
      lockedEntries = [opp];
    }
    let d = dir;
    for (let i = 0; i < 4; i++) {
      d = prevDir(d);
      if (!lockedEntries.includes(d)) {
        return { ...tile, direction: d, entry: [...lockedEntries] };
      }
    }
    return null;
  }

  return mirrorMerge(tile);
}

/** Mirror a merge's curve entries across the exit axis. */
function mirrorMerge(tile) {
  const dir = tile.direction;
  const opp = OPPOSITE[dir];
  const entries = tile.entry || [];
  const curveEntries = entries.filter((e) => e !== opp);
  const hasStraight = entries.includes(opp);
  const perps = perpendiculars(dir);

  const flipped = curveEntries.map((e) => perps.find((p) => p !== e) || e);
  const newEntries = hasStraight ? [...flipped, opp] : [...flipped];

  // Y-merge is symmetric — no change
  if (entries.length === newEntries.length && entries.every((e) => newEntries.includes(e))) {
    return null;
  }
  const flippedPref = flipped[0];
  return { ...tile, entry: newEntries, _preferredSide: flippedPref };
}

/**
 * Determine which perpendicular side is "preferred" based on existing
 * curve entries or a saved hint. Returns perps ordered so [0] is the
 * preferred side. This preserves mirror state through shape cycling.
 */
function preferredPerps(dir, tile) {
  const perps = perpendiculars(dir);
  const opp = OPPOSITE[dir];
  const curveEntries = (tile.entry || []).filter((e) => e !== opp);
  // Check curve entries first
  if (curveEntries.length >= 1 && curveEntries[0] === perps[1]) {
    return [perps[1], perps[0]];
  }
  // Fall back to saved hint (survives through straight state)
  if (tile._preferredSide === perps[1]) {
    return [perps[1], perps[0]];
  }
  return perps;
}

/**
 * Conveyors: cycle through all 4 shapes, keeping exit direction fixed.
 * Preserves the current perpendicular side (mirror state) through cycling.
 *
 *   straight → curve → curve_straight merge → 2curve merge → straight
 */
function cycleShape(tile) {
  const dir = tile.direction;
  const opp = OPPOSITE[dir];
  const entries = tile.entry || [];
  const curveEntries = entries.filter((e) => e !== opp);
  const hasStraight = entries.includes(opp);
  const prefs = preferredPerps(dir, tile);

  if (curveEntries.length === 0) {
    // Straight → Curve: use preferred perpendicular
    return { ...tile, entry: [prefs[0]], _preferredSide: prefs[0] };
  }
  if (curveEntries.length === 1 && !hasStraight) {
    // Curve → T-merge: add opposite (straight) entry
    return { ...tile, entry: [curveEntries[0], opp], _preferredSide: curveEntries[0] };
  }
  if (curveEntries.length === 1 && hasStraight) {
    // T-merge → Y-merge: replace opposite with 2nd perpendicular
    return { ...tile, entry: [curveEntries[0], prefs[1]], _preferredSide: curveEntries[0] };
  }
  // Y-merge → Straight: remove entries but preserve preferred side hint
  const newTile = { ...tile, _preferredSide: curveEntries[0] };
  delete newTile.entry;
  return newTile;
}

/** Reverse: straight ← curve ← T-merge ← Y-merge ← straight */
function cycleShapeReverse(tile) {
  const dir = tile.direction;
  const opp = OPPOSITE[dir];
  const entries = tile.entry || [];
  const curveEntries = entries.filter((e) => e !== opp);
  const hasStraight = entries.includes(opp);
  const prefs = preferredPerps(dir, tile);

  if (curveEntries.length === 0) {
    // Straight → Y-merge (reverse wraps around)
    return { ...tile, entry: [prefs[0], prefs[1]], _preferredSide: prefs[0] };
  }
  if (curveEntries.length === 1 && !hasStraight) {
    // Curve → Straight: preserve side hint
    const newTile = { ...tile, _preferredSide: curveEntries[0] };
    delete newTile.entry;
    return newTile;
  }
  if (curveEntries.length === 1 && hasStraight) {
    // T-merge → Curve: remove straight entry
    return { ...tile, entry: [curveEntries[0]], _preferredSide: curveEntries[0] };
  }
  // Y-merge → T-merge: replace 2nd perpendicular with opposite
  return { ...tile, entry: [curveEntries[0], opp], _preferredSide: curveEntries[0] };
}

/** Cycle gear variant: cw ↔ ccw */
function cycleGearVariant(tile) {
  const current = tile.variant || 'cw';
  return { ...tile, variant: current === 'cw' ? 'ccw' : 'cw' };
}

function cycleGearVariantReverse(tile) {
  return cycleGearVariant(tile);
}

/** Phase presets for trap_pit and similar */
const PHASE_PRESETS = [[1, 3, 5], [2, 4], [1, 2, 3, 4, 5], [1], [2], [3], [4], [5]];

function cyclePhases(tile) {
  const current = JSON.stringify(tile.phases || []);
  let nextIdx = 0;
  for (let i = 0; i < PHASE_PRESETS.length; i++) {
    if (JSON.stringify(PHASE_PRESETS[i]) === current) {
      nextIdx = (i + 1) % PHASE_PRESETS.length;
      break;
    }
  }
  return { ...tile, phases: [...PHASE_PRESETS[nextIdx]] };
}

function cyclePhasesReverse(tile) {
  const current = JSON.stringify(tile.phases || []);
  let nextIdx = PHASE_PRESETS.length - 1;
  for (let i = 0; i < PHASE_PRESETS.length; i++) {
    if (JSON.stringify(PHASE_PRESETS[i]) === current) {
      nextIdx = (i - 1 + PHASE_PRESETS.length) % PHASE_PRESETS.length;
      break;
    }
  }
  return { ...tile, phases: [...PHASE_PRESETS[nextIdx]] };
}

const PORTAL_GROUPS = ['A', 'B', 'C', 'D'];

function cycleGroup(tile) {
  const idx = PORTAL_GROUPS.indexOf(tile.group || 'A');
  return { ...tile, group: PORTAL_GROUPS[(idx + 1) % 4] };
}

function cycleGroupReverse(tile) {
  const idx = PORTAL_GROUPS.indexOf(tile.group || 'A');
  return { ...tile, group: PORTAL_GROUPS[(idx + 3) % 4] };
}

// ── Repair variant cycling ───────────────────────────────────────────

const REPAIR_VARIANTS = ['wrench', 'hammer_wrench', 'double_wrench'];

function cycleRepairVariant(tile) {
  const current = tile.variant || 'wrench';
  const idx = REPAIR_VARIANTS.indexOf(current);
  const next = REPAIR_VARIANTS[(idx + 1) % REPAIR_VARIANTS.length];
  return { ...tile, variant: next === 'wrench' ? undefined : next };
}

function cycleRepairVariantReverse(tile) {
  const current = tile.variant || 'wrench';
  const idx = REPAIR_VARIANTS.indexOf(current);
  const next = REPAIR_VARIANTS[(idx + 2) % REPAIR_VARIANTS.length];
  return { ...tile, variant: next === 'wrench' ? undefined : next };
}

// ── Tile-type registry ───────────────────────────────────────────────

const cyclers = {
  conveyor: {
    primary: rotateCW, reverse: rotateCCW,
    secondary: shiftConveyor, secondaryReverse: shiftConveyorReverse,
    tertiary: cycleShape, tertiaryReverse: cycleShapeReverse,
  },
  express_conveyor: {
    primary: rotateCW, reverse: rotateCCW,
    secondary: shiftConveyor, secondaryReverse: shiftConveyorReverse,
    tertiary: cycleShape, tertiaryReverse: cycleShapeReverse,
  },
  current: { primary: rotateCW, reverse: rotateCCW },
  ramp: { primary: rotateCW, reverse: rotateCCW },
  trap_pit: { primary: cyclePhases, reverse: cyclePhasesReverse },
  portal: { primary: cycleGroup, reverse: cycleGroupReverse },
  gear: {
    primary: (tile) => rotateCW({ direction: 'north', ...tile }),
    reverse: (tile) => rotateCCW({ direction: 'north', ...tile }),
    tertiary: cycleGearVariant,
    tertiaryReverse: cycleGearVariantReverse,
  },
  repair: {
    primary: (tile) => rotateCW({ direction: 'north', ...tile }),
    reverse: (tile) => rotateCCW({ direction: 'north', ...tile }),
    tertiary: cycleRepairVariant,
    tertiaryReverse: cycleRepairVariantReverse,
  },
};

// ── Edge cycling ─────────────────────────────────────────────────────

function toggleWall(tile, edgeDir) {
  const walls = tile.walls ? [...tile.walls] : [];
  const idx = walls.indexOf(edgeDir);
  if (idx >= 0) {
    walls.splice(idx, 1);
  } else {
    walls.push(edgeDir);
  }
  return { ...tile, walls: walls.length > 0 ? walls : undefined };
}

function cycleSideFeature(tile, edgeDir) {
  const features = tile.sideFeatures ? tile.sideFeatures.map((f) => ({ ...f })) : [];
  const idx = features.findIndex((f) => f.side === edgeDir);

  if (idx === -1) {
    // None → Laser str 1
    features.push({ type: 'laser', side: edgeDir, strength: 1 });
  } else {
    const existing = features[idx];
    if (existing.type === 'laser') {
      const str = existing.strength || 1;
      if (str < 3) {
        features[idx] = { ...existing, strength: str + 1 };
      } else {
        // Laser str 3 → Pusher
        features[idx] = { type: 'pusher', side: edgeDir, phases: [1, 3, 5] };
      }
    } else if (existing.type === 'pusher') {
      // Pusher → None
      features.splice(idx, 1);
    } else {
      // Unknown feature type → remove
      features.splice(idx, 1);
    }
  }
  return { ...tile, sideFeatures: features.length > 0 ? features : undefined };
}

function cycleOneWayWall(tile, edgeDir) {
  const owWalls = tile.oneWayWalls ? tile.oneWayWalls.map((ow) => ({ ...ow })) : [];
  const idx = owWalls.findIndex((ow) => ow.side === edgeDir);

  if (idx === -1) {
    // None → blocks entry
    owWalls.push({ side: edgeDir, blocks: 'entry' });
  } else if (owWalls[idx].blocks === 'entry') {
    // Blocks entry → blocks exit
    owWalls[idx] = { side: edgeDir, blocks: 'exit' };
  } else {
    // Blocks exit → None
    owWalls.splice(idx, 1);
  }
  return { ...tile, oneWayWalls: owWalls.length > 0 ? owWalls : undefined };
}

function removeSideFeature(tile, edgeDir) {
  if (!tile.sideFeatures) return null;
  const features = tile.sideFeatures.filter((f) => f.side !== edgeDir);
  if (features.length === tile.sideFeatures.length) return null; // nothing to remove
  return { ...tile, sideFeatures: features.length > 0 ? features : undefined };
}

const edgeCyclers = {
  primary: toggleWall,
  secondary: cycleSideFeature,
  tertiary: cycleOneWayWall,
  reverse: removeSideFeature,
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Cycle a tile property based on action and optional edge direction.
 * @param {object} tile - current tile data
 * @param {string} action - 'primary'|'reverse'|'secondary'|'secondaryReverse'|'tertiary'
 * @param {string|null} edgeDir - 'north'|'south'|'east'|'west' if clicking near an edge, null otherwise
 * @returns {object|null} new tile object, or null if no change
 */
export function cycleTile(tile, action, edgeDir) {
  if (edgeDir) {
    const handler = edgeCyclers[action];
    if (handler) return handler(tile, edgeDir);
    return null;
  }

  const cycler = cyclers[tile.type];
  if (!cycler) return null;

  const handler = cycler[action];
  if (handler) return handler(tile);
  return null;
}

/**
 * Map a MouseEvent's modifier keys to an action string.
 */
export function getActionFromEvent(e) {
  const alt = e.altKey;
  const shift = e.shiftKey;
  const ctrl = e.ctrlKey || e.metaKey;

  if (shift && alt) return 'secondaryReverse';
  if (ctrl && alt) return 'tertiaryReverse';
  if (shift && !ctrl) return 'secondary';
  if (ctrl && !shift) return 'tertiary';
  if (alt) return 'reverse';
  return 'primary';
}

/**
 * Detect if a click position is near a tile edge.
 * @param {{ offsetX: number, offsetY: number, cellW: number, cellH: number }} pos
 * @returns {string|null} edge direction or null if center
 */
export function detectEdge(pos) {
  const threshold = pos.cellW * 0.2;
  if (pos.offsetY < threshold) return 'north';
  if (pos.offsetY > pos.cellH - threshold) return 'south';
  if (pos.offsetX < threshold) return 'west';
  if (pos.offsetX > pos.cellW - threshold) return 'east';
  return null;
}

/** Labels for the modifier hint table, keyed by tile type */
const HINT_TABLE = {
  conveyor: [
    { modifier: 'Click', description: 'Rotate CW' },
    { modifier: 'Alt', description: 'Rotate CCW' },
    { modifier: 'Shift', description: 'Cycle exit / mirror merge' },
    { modifier: 'Ctrl', description: 'Cycle shape (str/curve/T-merge/Y-merge)' },
  ],
  express_conveyor: [
    { modifier: 'Click', description: 'Rotate CW' },
    { modifier: 'Alt', description: 'Rotate CCW' },
    { modifier: 'Shift', description: 'Cycle exit / mirror merge' },
    { modifier: 'Ctrl', description: 'Cycle shape (str/curve/T-merge/Y-merge)' },
  ],
  current: [
    { modifier: 'Click', description: 'Rotate CW' },
    { modifier: 'Alt', description: 'Rotate CCW' },
  ],
  ramp: [
    { modifier: 'Click', description: 'Rotate CW' },
    { modifier: 'Alt', description: 'Rotate CCW' },
  ],
  trap_pit: [
    { modifier: 'Click', description: 'Cycle phases' },
    { modifier: 'Alt', description: 'Cycle phases (reverse)' },
  ],
  portal: [
    { modifier: 'Click', description: 'Cycle group' },
    { modifier: 'Alt', description: 'Cycle group (reverse)' },
  ],
  gear: [
    { modifier: 'Click', description: 'Rotate CW' },
    { modifier: 'Alt', description: 'Rotate CCW' },
    { modifier: 'Ctrl', description: 'Cycle variant (CW / CCW)' },
  ],
  repair: [
    { modifier: 'Click', description: 'Rotate CW' },
    { modifier: 'Alt', description: 'Rotate CCW' },
    { modifier: 'Ctrl', description: 'Cycle variant (wrench / hammer+wrench / double wrench)' },
  ],
};

const EDGE_HINTS = [
  { modifier: 'Edge click', description: 'Toggle wall' },
  { modifier: 'Shift+Edge', description: 'Cycle side feature' },
  { modifier: 'Ctrl+Edge', description: 'Cycle one-way wall' },
  { modifier: 'Alt+Edge', description: 'Remove side feature' },
];

/**
 * Get human-readable modifier hints for a tile type.
 * @param {object} tile
 * @returns {Array<{modifier: string, description: string}>}
 */
export function getModifierHints(tile) {
  const hints = HINT_TABLE[tile.type] || [];
  return [...hints, ...EDGE_HINTS];
}
