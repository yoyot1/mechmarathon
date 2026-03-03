/** Get the x,y delta for a direction (north = up = y-1) */
export function directionDelta(dir) {
  switch (dir) {
    case 'north': return { x: 0, y: -1 };
    case 'south': return { x: 0, y: 1 };
    case 'east':  return { x: 1, y: 0 };
    case 'west':  return { x: -1, y: 0 };
  }
}

const DIRECTION_ORDER = ['north', 'east', 'south', 'west'];

/** Rotate a direction by a given rotation */
export function rotateDirection(dir, rotation) {
  const idx = DIRECTION_ORDER.indexOf(dir);
  switch (rotation) {
    case 'cw':  return DIRECTION_ORDER[(idx + 1) % 4];
    case 'ccw': return DIRECTION_ORDER[(idx + 3) % 4];
    case '180': return DIRECTION_ORDER[(idx + 2) % 4];
  }
}

/** Get the opposite direction */
export function oppositeDirection(dir) {
  return rotateDirection(dir, '180');
}

/** Check if a position is within board bounds */
export function isInBounds(board, pos) {
  return pos.x >= 0 && pos.x < board.width && pos.y >= 0 && pos.y < board.height;
}

/** Get the tile at a position (returns null if out of bounds) */
export function getTile(board, pos) {
  if (!isInBounds(board, pos)) return null;
  return board.tiles[pos.y][pos.x];
}

/**
 * Check if a tile is a pit.
 * trap_pit is only a pit on its active phases (1-indexed register number).
 * If registerIndex is not provided, trap_pit is treated as a pit (safe default).
 */
export function isPit(board, pos, registerIndex) {
  const tile = getTile(board, pos);
  if (!tile) return false;
  if (tile.type === 'pit' || tile.type === 'drain' || tile.type === 'radioactive_drain') return true;
  if (tile.type === 'trap_pit') {
    if (registerIndex == null) return true;
    return tile.phases?.includes(registerIndex) ?? false;
  }
  return false;
}

/** Find a robot at a given position, optionally excluding one by id */
export function findRobotAt(robots, pos, excludeId) {
  return robots.find(
    (r) => r.lives > 0 && r.health > 0 && r.position.x === pos.x && r.position.y === pos.y && r.id !== excludeId,
  );
}

/** Find all tiles with a specific side feature type, returning {x, y, feature} entries */
export function findSideFeatures(board, featureType) {
  const results = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const tile = board.tiles[y]?.[x];
      if (!tile?.sideFeatures) continue;
      for (const feature of tile.sideFeatures) {
        if (feature.type === featureType) {
          results.push({ x, y, feature });
        }
      }
    }
  }
  return results;
}

/** Find all tiles with a specific overlay type, returning {x, y, overlay} entries */
export function findOverlays(board, overlayType) {
  const results = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const tile = board.tiles[y]?.[x];
      if (!tile?.overlays) continue;
      for (const overlay of tile.overlays) {
        if (overlay.type === overlayType) {
          results.push({ x, y, overlay });
        }
      }
    }
  }
  return results;
}

/**
 * Find the matching portal tile for a given position and group.
 * Returns the first portal with the same group at a different position, or null.
 */
export function findMatchingPortal(board, fromPos, group) {
  if (!group) return null;
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (x === fromPos.x && y === fromPos.y) continue;
      const tile = board.tiles[y]?.[x];
      if (tile?.type === 'portal' && tile.group === group) {
        return { x, y };
      }
    }
  }
  return null;
}

/**
 * Check if a wall blocks movement from `from` in the given direction.
 * Checks walls on source tile (leaving) AND destination tile (entering).
 * Also checks one-way walls:
 *   - blocks:'exit' on source tile's side blocks leaving through that side
 *   - blocks:'entry' on destination tile's entering side blocks entering
 */
export function isWallBlocking(board, from, dir) {
  // Check source tile — wall on the side we're leaving through
  const sourceTile = getTile(board, from);
  if (sourceTile?.walls?.includes(dir)) return true;

  // Check source tile — one-way wall blocking exit
  if (sourceTile?.oneWayWalls?.some((ow) => ow.side === dir && ow.blocks === 'exit')) return true;

  // Check destination tile — wall on the side we're entering through
  const delta = directionDelta(dir);
  const dest = { x: from.x + delta.x, y: from.y + delta.y };
  const destTile = getTile(board, dest);
  const enterSide = oppositeDirection(dir);
  if (destTile?.walls?.includes(enterSide)) return true;

  // Check destination tile — one-way wall blocking entry
  if (destTile?.oneWayWalls?.some((ow) => ow.side === enterSide && ow.blocks === 'entry')) return true;

  // Elevation blocking: cannot move upward unless destination is a ramp
  const srcElev = sourceTile?.elevation ?? 0;
  const dstElev = destTile?.elevation ?? 0;
  if (dstElev > srcElev && destTile?.type !== 'ramp') return true;

  return false;
}

/**
 * Get fall damage when moving from one tile to another due to elevation change.
 * Returns 2 if moving downward (source elevation > dest elevation) and source is NOT a ramp.
 * Returns 0 otherwise (same level, going up via ramp, or going down via ramp).
 */
export function getElevationDamage(board, from, to) {
  const srcTile = getTile(board, from);
  const dstTile = getTile(board, to);
  const srcElev = srcTile?.elevation ?? 0;
  const dstElev = dstTile?.elevation ?? 0;
  if (srcElev > dstElev && srcTile?.type !== 'ramp') return 2;
  return 0;
}
