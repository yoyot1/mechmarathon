import { GAME } from '../../constants.js';

/**
 * Create a test board filled with floor tiles.
 * @param {number} [width=12] - Board width
 * @param {number} [height=12] - Board height
 * @returns {{ width: number, height: number, tiles: object[][] }}
 */
export function createTestBoard(width = 12, height = 12) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: 'floor' });
    }
    tiles.push(row);
  }
  return { width, height, tiles };
}

/**
 * Mutate a single tile on a board.
 * @param {object} board - Board object
 * @param {number} x - Column
 * @param {number} y - Row
 * @param {object} tileData - Tile data to set (merged with existing)
 */
export function setTile(board, x, y, tileData) {
  board.tiles[y][x] = { ...board.tiles[y][x], ...tileData };
}

/**
 * Create a test robot with sensible defaults.
 * @param {object} [overrides] - Override any default properties
 * @returns {object} Robot object
 */
export function createTestRobot(overrides = {}) {
  const id = overrides.id ?? 'robot-1';
  const position = overrides.position ?? { x: 5, y: 5 };
  return {
    id,
    position: { ...position },
    direction: 'north',
    health: GAME.STARTING_HEALTH,
    lives: GAME.STARTING_LIVES,
    checkpoint: 0,
    archivePosition: { ...position },
    virtual: false,
    options: [],
    ...overrides,
    // Ensure nested objects are properly spread
    position: { ...(overrides.position ?? position) },
    archivePosition: { ...(overrides.archivePosition ?? overrides.position ?? position) },
  };
}

/**
 * Create multiple test robots at distinct positions.
 * @param {number} count - Number of robots to create
 * @returns {object[]} Array of robot objects
 */
export function createTestRobots(count) {
  const robots = [];
  for (let i = 0; i < count; i++) {
    robots.push(
      createTestRobot({
        id: `robot-${i + 1}`,
        position: { x: 2 + i * 2, y: 5 },
      }),
    );
  }
  return robots;
}
