import { describe, it, expect } from 'vitest';
import { createEmptyBoard, rotateBoard, assembleMap } from '../board.js';

describe('createEmptyBoard', () => {
  const board = createEmptyBoard();

  it('creates a 12x12 board', () => {
    expect(board.width).toBe(12);
    expect(board.height).toBe(12);
    expect(board.tiles).toHaveLength(12);
    expect(board.tiles[0]).toHaveLength(12);
  });

  it('fills all tiles with floor type', () => {
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        expect(board.tiles[y][x]).toEqual({ type: 'floor' });
      }
    }
  });
});

describe('rotateBoard', () => {
  it('rotation 0 returns a copy with same layout', () => {
    const board = createEmptyBoard();
    board.tiles[0][1] = { type: 'pit' };
    const rotated = rotateBoard(board, 0);
    expect(rotated.tiles[0][1]).toEqual({ type: 'pit' });
    // Should be a copy, not the same reference
    expect(rotated.tiles).not.toBe(board.tiles);
  });

  it('rotation 90 moves tiles correctly', () => {
    const board = createEmptyBoard();
    // Place a pit at (1, 0) — col 1, row 0
    board.tiles[0][1] = { type: 'pit' };
    const rotated = rotateBoard(board, 90);
    // After 90° CW: (1, 0) → nx=11, ny=1
    expect(rotated.tiles[1][11].type).toBe('pit');
  });

  it('rotation 180 moves tiles correctly', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = { type: 'pit' };
    const rotated = rotateBoard(board, 180);
    // (0,0) → (11, 11)
    expect(rotated.tiles[11][11].type).toBe('pit');
  });

  it('rotation 270 moves tiles correctly', () => {
    const board = createEmptyBoard();
    board.tiles[0][1] = { type: 'pit' };
    const rotated = rotateBoard(board, 270);
    // (1, 0) → nx=0, ny=10
    expect(rotated.tiles[10][0].type).toBe('pit');
  });

  it('rotates tile directions', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = { type: 'conveyor', direction: 'north' };
    const rotated = rotateBoard(board, 90);
    // direction 'north' → 'east' after 90° CW
    const tile = rotated.tiles[0][11]; // (0,0) → (11, 0) for 90°
    expect(tile.direction).toBe('east');
  });

  it('rotates tile walls', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = { type: 'floor', walls: ['north', 'east'] };
    const rotated = rotateBoard(board, 90);
    const tile = rotated.tiles[0][11];
    expect(tile.walls).toContain('east');
    expect(tile.walls).toContain('south');
  });

  it('rotates entry arrays', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = { type: 'conveyor', direction: 'north', entry: ['south', 'west'] };
    const rotated = rotateBoard(board, 90);
    const tile = rotated.tiles[0][11];
    expect(tile.entry).toContain('west');
    expect(tile.entry).toContain('north');
  });

  it('rotates sideFeatures', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = {
      type: 'floor',
      sideFeatures: [{ type: 'laser', side: 'north', strength: 1 }],
    };
    const rotated = rotateBoard(board, 90);
    const tile = rotated.tiles[0][11];
    expect(tile.sideFeatures[0].side).toBe('east');
  });

  it('rotates oneWayWalls', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = {
      type: 'floor',
      oneWayWalls: [{ side: 'north', blocks: 'exit' }],
    };
    const rotated = rotateBoard(board, 90);
    const tile = rotated.tiles[0][11];
    expect(tile.oneWayWalls[0].side).toBe('east');
    expect(tile.oneWayWalls[0].blocks).toBe('exit');
  });

  it('4x rotation returns to original', () => {
    const board = createEmptyBoard();
    board.tiles[2][3] = { type: 'conveyor', direction: 'north', walls: ['east'] };
    let rotated = board;
    for (let i = 0; i < 4; i++) {
      rotated = rotateBoard(rotated, 90);
    }
    expect(rotated.tiles[2][3].type).toBe('conveyor');
    expect(rotated.tiles[2][3].direction).toBe('north');
    expect(rotated.tiles[2][3].walls).toEqual(['east']);
  });
});

describe('assembleMap', () => {
  it('assembles a single board at origin', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = { type: 'repair' };
    const mapConfig = {
      boards: [{ boardId: 'b1', x: 0, y: 0, rotation: 0 }],
      flags: [{ x: 5, y: 5, number: 1 }],
      spawnPoints: [{ x: 0, y: 11, number: 1 }],
    };
    const result = assembleMap(mapConfig, { b1: board });
    expect(result.board.width).toBe(12);
    expect(result.board.height).toBe(12);
    expect(result.board.tiles[0][0].type).toBe('repair');
    expect(result.flags).toEqual([{ position: { x: 5, y: 5 }, number: 1 }]);
    expect(result.spawnPoints).toEqual([{ position: { x: 0, y: 11 }, number: 1 }]);
  });

  it('assembles two boards side by side', () => {
    const board1 = createEmptyBoard();
    board1.tiles[0][0] = { type: 'repair' };
    const board2 = createEmptyBoard();
    board2.tiles[0][0] = { type: 'pit' };
    const mapConfig = {
      boards: [
        { boardId: 'b1', x: 0, y: 0, rotation: 0 },
        { boardId: 'b2', x: 1, y: 0, rotation: 0 },
      ],
      flags: [],
      spawnPoints: [],
    };
    const result = assembleMap(mapConfig, { b1: board1, b2: board2 });
    expect(result.board.width).toBe(24);
    expect(result.board.height).toBe(12);
    expect(result.board.tiles[0][0].type).toBe('repair');
    expect(result.board.tiles[0][12].type).toBe('pit');
  });

  it('assembles two boards vertically', () => {
    const board1 = createEmptyBoard();
    const board2 = createEmptyBoard();
    board2.tiles[0][0] = { type: 'gear_cw' };
    const mapConfig = {
      boards: [
        { boardId: 'b1', x: 0, y: 0, rotation: 0 },
        { boardId: 'b2', x: 0, y: 1, rotation: 0 },
      ],
      flags: [],
      spawnPoints: [],
    };
    const result = assembleMap(mapConfig, { b1: board1, b2: board2 });
    expect(result.board.width).toBe(12);
    expect(result.board.height).toBe(24);
    expect(result.board.tiles[12][0].type).toBe('gear_cw');
  });

  it('fills gaps with pit tiles', () => {
    const board1 = createEmptyBoard();
    const board2 = createEmptyBoard();
    const mapConfig = {
      boards: [
        { boardId: 'b1', x: 0, y: 0, rotation: 0 },
        { boardId: 'b2', x: 2, y: 0, rotation: 0 }, // gap at x=1
      ],
      flags: [],
      spawnPoints: [],
    };
    const result = assembleMap(mapConfig, { b1: board1, b2: board2 });
    expect(result.board.width).toBe(36);
    // Gap area (x=12..23) should be pits
    expect(result.board.tiles[0][12].type).toBe('pit');
    expect(result.board.tiles[5][18].type).toBe('pit');
  });

  it('applies rotation to placed boards', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = { type: 'conveyor', direction: 'north' };
    const mapConfig = {
      boards: [{ boardId: 'b1', x: 0, y: 0, rotation: 90 }],
      flags: [],
      spawnPoints: [],
    };
    const result = assembleMap(mapConfig, { b1: board });
    // (0,0) rotated 90° → (11, 0), direction north→east
    expect(result.board.tiles[0][11].type).toBe('conveyor');
    expect(result.board.tiles[0][11].direction).toBe('east');
  });

  it('skips unknown board IDs', () => {
    const mapConfig = {
      boards: [{ boardId: 'nonexistent', x: 0, y: 0, rotation: 0 }],
      flags: [],
      spawnPoints: [],
    };
    const result = assembleMap(mapConfig, {});
    // Still creates a board from bounding box, all pits
    expect(result.board.width).toBe(12);
    expect(result.board.tiles[0][0].type).toBe('pit');
  });

  it('handles empty flags and spawnPoints', () => {
    const board = createEmptyBoard();
    const mapConfig = {
      boards: [{ boardId: 'b1', x: 0, y: 0, rotation: 0 }],
    };
    const result = assembleMap(mapConfig, { b1: board });
    expect(result.flags).toEqual([]);
    expect(result.spawnPoints).toEqual([]);
  });

  it('accepts Map as boardsById', () => {
    const board = createEmptyBoard();
    board.tiles[0][0] = { type: 'repair' };
    const boardsMap = new Map([['b1', board]]);
    const mapConfig = {
      boards: [{ boardId: 'b1', x: 0, y: 0, rotation: 0 }],
      flags: [],
      spawnPoints: [],
    };
    const result = assembleMap(mapConfig, boardsMap);
    expect(result.board.tiles[0][0].type).toBe('repair');
  });
});
