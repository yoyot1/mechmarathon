/** Create a 16x16 grid of floor tiles */
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

/** Default 16x16 board with conveyors, gears, pits, repair site, and walls */
export const DEFAULT_BOARD = (() => {
  const tiles = createEmptyGrid(16, 16);

  // --- Conveyors: horizontal belt across row 6 (eastward) ---
  for (let x = 2; x <= 13; x++) {
    tiles[6][x] = { type: 'conveyor', direction: 'east' };
  }

  // --- Express conveyors: vertical belt on column 8 (northward) ---
  for (let y = 3; y <= 12; y++) {
    tiles[y][8] = { type: 'express_conveyor', direction: 'north' };
  }

  // --- Gears ---
  tiles[4][4] = { type: 'gear_cw' };
  tiles[4][11] = { type: 'gear_ccw' };
  tiles[11][4] = { type: 'gear_ccw' };
  tiles[11][11] = { type: 'gear_cw' };

  // --- Pits ---
  tiles[7][3] = { type: 'pit' };
  tiles[7][12] = { type: 'pit' };

  // --- Repair site ---
  tiles[8][7] = { type: 'repair' };

  // --- Walls ---
  tiles[5][5] = { type: 'floor', walls: ['north', 'east'] };
  tiles[5][10] = { type: 'floor', walls: ['north', 'west'] };
  tiles[10][5] = { type: 'floor', walls: ['south', 'east'] };
  tiles[10][10] = { type: 'floor', walls: ['south', 'west'] };
  // Walls near pits
  tiles[7][2] = { type: 'floor', walls: ['east'] };
  tiles[7][13] = { type: 'floor', walls: ['west'] };

  return {
    id: 'default',
    name: 'Factory Floor',
    width: 16,
    height: 16,
    tiles,
  };
})();

/** Default 3 checkpoints for the default board */
export function getDefaultCheckpoints() {
  return [
    { position: { x: 7, y: 13 }, number: 1 },  // south-center — robots start here
    { position: { x: 7, y: 7 }, number: 2 },    // center (off the express conveyor)
    { position: { x: 7, y: 2 }, number: 3 },    // north-center
  ];
}
