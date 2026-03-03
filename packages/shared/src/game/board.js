/** Create a grid of floor tiles */
function createEmptyGrid(width, height) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: 'floor' });
    }
    tiles.push(row);
  }
  return tiles;
}

/** Create an empty 12x12 board with floor tiles */
export function createEmptyBoard() {
  return {
    width: 12,
    height: 12,
    tiles: createEmptyGrid(12, 12),
  };
}

/** Default 12x12 board with conveyors, gears, pits, repair site, and walls */
export const DEFAULT_BOARD = (() => {
  const tiles = createEmptyGrid(12, 12);

  // --- Conveyors: horizontal belt across row 5 (eastward) ---
  for (let x = 1; x <= 10; x++) {
    tiles[5][x] = { type: 'conveyor', direction: 'east' };
  }

  // --- Express conveyors: vertical belt on column 6 (northward) ---
  for (let y = 2; y <= 9; y++) {
    tiles[y][6] = { type: 'express_conveyor', direction: 'north' };
  }

  // --- Gears ---
  tiles[3][3] = { type: 'gear_cw' };
  tiles[3][8] = { type: 'gear_ccw' };
  tiles[8][3] = { type: 'gear_ccw' };
  tiles[8][8] = { type: 'gear_cw' };

  // --- Pits ---
  tiles[6][2] = { type: 'pit' };
  tiles[6][9] = { type: 'pit' };

  // --- Repair site ---
  tiles[6][5] = { type: 'repair' };

  // --- Walls ---
  tiles[4][4] = { type: 'floor', walls: ['north', 'east'] };
  tiles[4][7] = { type: 'floor', walls: ['north', 'west'] };
  tiles[7][4] = { type: 'floor', walls: ['south', 'east'] };
  tiles[7][7] = { type: 'floor', walls: ['south', 'west'] };
  // Walls near pits
  tiles[6][1] = { type: 'floor', walls: ['east'] };
  tiles[6][10] = { type: 'floor', walls: ['west'] };

  return {
    id: 'default',
    name: 'Factory Floor',
    width: 12,
    height: 12,
    tiles,
  };
})();

/** Default 3 checkpoints for the default board */
export function getDefaultCheckpoints() {
  return [
    { position: { x: 5, y: 10 }, number: 1 },  // south-center — robots start here
    { position: { x: 5, y: 5 }, number: 2 },    // center
    { position: { x: 5, y: 1 }, number: 3 },    // north-center
  ];
}

const DIRECTION_ORDER = ['north', 'east', 'south', 'west'];

/** Rotate a direction string CW by 90° increments (rotation = 0/90/180/270) */
function rotateDirBy(dir, rotation) {
  if (!dir || rotation === 0) return dir;
  const idx = DIRECTION_ORDER.indexOf(dir);
  if (idx === -1) return dir;
  const steps = rotation / 90;
  return DIRECTION_ORDER[(idx + steps) % 4];
}

/** Rotate wall directions CW by 90° increments */
function rotateWalls(walls, rotation) {
  if (!walls || rotation === 0) return walls;
  return walls.map((w) => rotateDirBy(w, rotation));
}

/** Rotate a tile's direction, walls, entry, sideFeatures, and overlays CW by rotation degrees */
function rotateTile(tile, rotation) {
  if (rotation === 0) return { ...tile };
  const rotated = { ...tile };
  if (rotated.direction) {
    rotated.direction = rotateDirBy(rotated.direction, rotation);
  }
  if (rotated.walls) {
    rotated.walls = rotateWalls(rotated.walls, rotation);
  }
  if (rotated.entry) {
    rotated.entry = rotated.entry.map((dir) => rotateDirBy(dir, rotation));
  }
  if (rotated.sideFeatures) {
    rotated.sideFeatures = rotated.sideFeatures.map((f) => ({
      ...f,
      side: rotateDirBy(f.side, rotation),
    }));
  }
  // overlays have no directional properties, just shallow copy
  if (rotated.overlays) {
    rotated.overlays = rotated.overlays.map((o) => ({ ...o }));
  }
  if (rotated.oneWayWalls) {
    rotated.oneWayWalls = rotated.oneWayWalls.map((ow) => ({
      ...ow,
      side: rotateDirBy(ow.side, rotation),
    }));
  }
  return rotated;
}

/**
 * Rotate a 12x12 board by 0/90/180/270 degrees CW.
 * Returns a new board object with rotated tiles.
 */
export function rotateBoard(board, rotation) {
  const r = ((rotation % 360) + 360) % 360;
  if (r === 0) return { ...board, tiles: board.tiles.map((row) => row.map((t) => ({ ...t }))) };

  const size = 12;
  const newTiles = createEmptyGrid(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let nx, ny;
      if (r === 90) {
        nx = size - 1 - y;
        ny = x;
      } else if (r === 180) {
        nx = size - 1 - x;
        ny = size - 1 - y;
      } else {
        // 270
        nx = y;
        ny = size - 1 - x;
      }
      newTiles[ny][nx] = rotateTile(board.tiles[y][x], r);
    }
  }

  return { ...board, tiles: newTiles };
}

/**
 * Assemble a composite board from a map configuration and board data.
 * @param {object} mapConfig - { boards: [{boardId, x, y, rotation}], checkpoints: [{x,y,number}], spawnPoints: [{x,y,number}] }
 * @param {Map|object} boardsById - Map or plain object of boardId → board data (with tiles)
 * @returns {{ board: {width, height, tiles}, checkpoints: Array, spawnPoints: Array }}
 */
export function assembleMap(mapConfig, boardsById) {
  const SIZE = 12;
  const lookup = boardsById instanceof Map ? boardsById : new Map(Object.entries(boardsById));

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const entry of mapConfig.boards) {
    const px = entry.x * SIZE;
    const py = entry.y * SIZE;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px + SIZE > maxX) maxX = px + SIZE;
    if (py + SIZE > maxY) maxY = py + SIZE;
  }

  const width = maxX - minX;
  const height = maxY - minY;

  // Fill with pit tiles by default (gaps = pits)
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: 'pit' });
    }
    tiles.push(row);
  }

  // Track which cells are covered by boards
  const covered = new Set();

  // Place each board
  for (const entry of mapConfig.boards) {
    const boardData = lookup.get(entry.boardId);
    if (!boardData) continue;

    const rotated = rotateBoard(boardData, entry.rotation || 0);
    const offsetX = entry.x * SIZE - minX;
    const offsetY = entry.y * SIZE - minY;

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tx = offsetX + x;
        const ty = offsetY + y;
        if (ty >= 0 && ty < height && tx >= 0 && tx < width) {
          tiles[ty][tx] = rotated.tiles[y][x];
          covered.add(`${tx},${ty}`);
        }
      }
    }
  }

  // Convert checkpoints from map-level coordinates (already in composite space)
  const checkpoints = (mapConfig.checkpoints || []).map((cp) => ({
    position: { x: cp.x, y: cp.y },
    number: cp.number,
  }));

  const spawnPoints = (mapConfig.spawnPoints || []).map((sp) => ({
    position: { x: sp.x, y: sp.y },
    number: sp.number,
  }));

  return {
    board: { width, height, tiles },
    checkpoints,
    spawnPoints,
  };
}
