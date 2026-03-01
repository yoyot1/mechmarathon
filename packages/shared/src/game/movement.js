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

/** Check if a tile is a pit */
export function isPit(board, pos) {
  const tile = getTile(board, pos);
  return tile?.type === 'pit';
}

/**
 * Check if a wall blocks movement from `from` in the given direction.
 * Checks walls on source tile (leaving) AND destination tile (entering).
 */
export function isWallBlocking(board, from, dir) {
  // Check source tile — wall on the side we're leaving through
  const sourceTile = getTile(board, from);
  if (sourceTile?.walls?.includes(dir)) return true;

  // Check destination tile — wall on the side we're entering through
  const delta = directionDelta(dir);
  const dest = { x: from.x + delta.x, y: from.y + delta.y };
  const destTile = getTile(board, dest);
  if (destTile?.walls?.includes(oppositeDirection(dir))) return true;

  return false;
}
