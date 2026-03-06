import { describe, it, expect } from 'vitest';
import {
  directionDelta,
  rotateDirection,
  oppositeDirection,
  isInBounds,
  getTile,
  isPit,
  isWallBlocking,
  getElevationDamage,
  findMatchingPortal,
  findRobotAt,
  findSideFeatures,
  findOverlays,
} from '../movement.js';
import { createTestBoard, setTile, createTestRobot } from './helpers.js';

describe('directionDelta', () => {
  it('returns correct delta for each direction', () => {
    expect(directionDelta('north')).toEqual({ x: 0, y: -1 });
    expect(directionDelta('south')).toEqual({ x: 0, y: 1 });
    expect(directionDelta('east')).toEqual({ x: 1, y: 0 });
    expect(directionDelta('west')).toEqual({ x: -1, y: 0 });
  });
});

describe('rotateDirection', () => {
  it('rotates clockwise', () => {
    expect(rotateDirection('north', 'cw')).toBe('east');
    expect(rotateDirection('east', 'cw')).toBe('south');
    expect(rotateDirection('south', 'cw')).toBe('west');
    expect(rotateDirection('west', 'cw')).toBe('north');
  });

  it('rotates counter-clockwise', () => {
    expect(rotateDirection('north', 'ccw')).toBe('west');
    expect(rotateDirection('east', 'ccw')).toBe('north');
    expect(rotateDirection('south', 'ccw')).toBe('east');
    expect(rotateDirection('west', 'ccw')).toBe('south');
  });

  it('rotates 180 degrees', () => {
    expect(rotateDirection('north', '180')).toBe('south');
    expect(rotateDirection('east', '180')).toBe('west');
    expect(rotateDirection('south', '180')).toBe('north');
    expect(rotateDirection('west', '180')).toBe('east');
  });
});

describe('oppositeDirection', () => {
  it('returns opposite direction', () => {
    expect(oppositeDirection('north')).toBe('south');
    expect(oppositeDirection('south')).toBe('north');
    expect(oppositeDirection('east')).toBe('west');
    expect(oppositeDirection('west')).toBe('east');
  });
});

describe('isInBounds', () => {
  const board = createTestBoard(12, 12);

  it('returns true for valid positions', () => {
    expect(isInBounds(board, { x: 0, y: 0 })).toBe(true);
    expect(isInBounds(board, { x: 11, y: 11 })).toBe(true);
    expect(isInBounds(board, { x: 5, y: 5 })).toBe(true);
  });

  it('returns false for out-of-bounds positions', () => {
    expect(isInBounds(board, { x: -1, y: 0 })).toBe(false);
    expect(isInBounds(board, { x: 0, y: -1 })).toBe(false);
    expect(isInBounds(board, { x: 12, y: 0 })).toBe(false);
    expect(isInBounds(board, { x: 0, y: 12 })).toBe(false);
  });

  it('works with non-square boards', () => {
    const rect = createTestBoard(6, 3);
    expect(isInBounds(rect, { x: 5, y: 2 })).toBe(true);
    expect(isInBounds(rect, { x: 6, y: 2 })).toBe(false);
    expect(isInBounds(rect, { x: 5, y: 3 })).toBe(false);
  });
});

describe('getTile', () => {
  const board = createTestBoard(12, 12);

  it('returns tile at valid position', () => {
    expect(getTile(board, { x: 0, y: 0 })).toEqual({ type: 'floor' });
  });

  it('returns null for out-of-bounds position', () => {
    expect(getTile(board, { x: -1, y: 0 })).toBeNull();
    expect(getTile(board, { x: 12, y: 0 })).toBeNull();
  });

  it('returns modified tile data', () => {
    setTile(board, 3, 4, { type: 'pit' });
    expect(getTile(board, { x: 3, y: 4 })).toEqual({ type: 'pit' });
  });
});

describe('isPit', () => {
  it('returns true for pit tiles', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, { type: 'pit' });
    expect(isPit(board, { x: 2, y: 2 })).toBe(true);
  });

  it('returns true for drain tiles', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, { type: 'drain' });
    expect(isPit(board, { x: 2, y: 2 })).toBe(true);
  });

  it('returns true for radioactive_drain tiles', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, { type: 'radioactive_drain' });
    expect(isPit(board, { x: 2, y: 2 })).toBe(true);
  });

  it('returns false for floor tiles', () => {
    const board = createTestBoard(5, 5);
    expect(isPit(board, { x: 2, y: 2 })).toBe(false);
  });

  it('returns false for out-of-bounds', () => {
    const board = createTestBoard(5, 5);
    expect(isPit(board, { x: -1, y: 0 })).toBe(false);
  });

  describe('trap_pit', () => {
    it('returns true when no registerIndex provided', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, { type: 'trap_pit', phases: [1, 3, 5] });
      expect(isPit(board, { x: 2, y: 2 })).toBe(true);
    });

    it('returns true when registerIndex matches active phase', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, { type: 'trap_pit', phases: [1, 3, 5] });
      expect(isPit(board, { x: 2, y: 2 }, 1)).toBe(true);
      expect(isPit(board, { x: 2, y: 2 }, 3)).toBe(true);
      expect(isPit(board, { x: 2, y: 2 }, 5)).toBe(true);
    });

    it('returns false when registerIndex does not match', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, { type: 'trap_pit', phases: [1, 3, 5] });
      expect(isPit(board, { x: 2, y: 2 }, 2)).toBe(false);
      expect(isPit(board, { x: 2, y: 2 }, 4)).toBe(false);
    });

    it('returns false when trap_pit has no phases array', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, { type: 'trap_pit' });
      // No phases → falls through to `tile.phases?.includes(registerIndex) ?? false`
      expect(isPit(board, { x: 2, y: 2 }, 1)).toBe(false);
    });
  });
});

describe('isWallBlocking', () => {
  it('blocks when source tile has wall on exit side', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, { type: 'floor', walls: ['north'] });
    expect(isWallBlocking(board, { x: 2, y: 2 }, 'north')).toBe(true);
    expect(isWallBlocking(board, { x: 2, y: 2 }, 'south')).toBe(false);
  });

  it('blocks when destination tile has wall on entry side', () => {
    const board = createTestBoard(5, 5);
    // Moving north from (2,3) to (2,2), destination has south wall
    setTile(board, 2, 2, { type: 'floor', walls: ['south'] });
    expect(isWallBlocking(board, { x: 2, y: 3 }, 'north')).toBe(true);
  });

  it('does not block when walls are on unrelated sides', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, { type: 'floor', walls: ['east'] });
    expect(isWallBlocking(board, { x: 2, y: 2 }, 'north')).toBe(false);
  });

  describe('one-way walls', () => {
    it('blocks exit through one-way wall', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, {
        type: 'floor',
        oneWayWalls: [{ side: 'north', blocks: 'exit' }],
      });
      expect(isWallBlocking(board, { x: 2, y: 2 }, 'north')).toBe(true);
    });

    it('allows entry through exit-only one-way wall', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, {
        type: 'floor',
        oneWayWalls: [{ side: 'south', blocks: 'exit' }],
      });
      // Moving north from (2,3) into (2,2) — entering from south side
      // The one-way wall on (2,2) blocks exit from south, not entry from south
      expect(isWallBlocking(board, { x: 2, y: 3 }, 'north')).toBe(false);
    });

    it('blocks entry through entry-blocking one-way wall', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, {
        type: 'floor',
        oneWayWalls: [{ side: 'south', blocks: 'entry' }],
      });
      // Moving north from (2,3) to (2,2) — entering (2,2) from the south side
      expect(isWallBlocking(board, { x: 2, y: 3 }, 'north')).toBe(true);
    });
  });

  describe('elevation', () => {
    it('blocks movement upward to non-ramp tile', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 1, { type: 'floor', elevation: 1 });
      expect(isWallBlocking(board, { x: 2, y: 2 }, 'north')).toBe(true);
    });

    it('allows movement upward to ramp tile', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 1, { type: 'ramp', elevation: 1 });
      expect(isWallBlocking(board, { x: 2, y: 2 }, 'north')).toBe(false);
    });

    it('allows movement downward (higher to lower)', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, { type: 'floor', elevation: 1 });
      // Moving north from elevated (2,2) to ground-level (2,1)
      expect(isWallBlocking(board, { x: 2, y: 2 }, 'north')).toBe(false);
    });

    it('allows movement at same elevation', () => {
      const board = createTestBoard(5, 5);
      setTile(board, 2, 2, { type: 'floor', elevation: 1 });
      setTile(board, 2, 1, { type: 'floor', elevation: 1 });
      expect(isWallBlocking(board, { x: 2, y: 2 }, 'north')).toBe(false);
    });
  });
});

describe('getElevationDamage', () => {
  it('returns 2 for falling from higher elevation (non-ramp source)', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, { type: 'floor', elevation: 1 });
    // (2,2) elev 1 → (2,1) elev 0
    expect(getElevationDamage(board, { x: 2, y: 2 }, { x: 2, y: 1 })).toBe(2);
  });

  it('returns 0 for falling from ramp', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, { type: 'ramp', elevation: 1 });
    expect(getElevationDamage(board, { x: 2, y: 2 }, { x: 2, y: 1 })).toBe(0);
  });

  it('returns 0 at same elevation', () => {
    const board = createTestBoard(5, 5);
    expect(getElevationDamage(board, { x: 2, y: 2 }, { x: 2, y: 1 })).toBe(0);
  });

  it('returns 0 when going upward', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 1, { type: 'ramp', elevation: 1 });
    expect(getElevationDamage(board, { x: 2, y: 2 }, { x: 2, y: 1 })).toBe(0);
  });
});

describe('findMatchingPortal', () => {
  it('finds the paired portal with same group', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 1, 1, { type: 'portal', group: 'A' });
    setTile(board, 3, 3, { type: 'portal', group: 'A' });
    expect(findMatchingPortal(board, { x: 1, y: 1 }, 'A')).toEqual({ x: 3, y: 3 });
    expect(findMatchingPortal(board, { x: 3, y: 3 }, 'A')).toEqual({ x: 1, y: 1 });
  });

  it('returns null when no matching portal exists', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 1, 1, { type: 'portal', group: 'A' });
    expect(findMatchingPortal(board, { x: 1, y: 1 }, 'A')).toBeNull();
  });

  it('returns null for null/undefined group', () => {
    const board = createTestBoard(5, 5);
    expect(findMatchingPortal(board, { x: 0, y: 0 }, null)).toBeNull();
    expect(findMatchingPortal(board, { x: 0, y: 0 }, undefined)).toBeNull();
  });

  it('does not match portals with different groups', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 1, 1, { type: 'portal', group: 'A' });
    setTile(board, 3, 3, { type: 'portal', group: 'B' });
    expect(findMatchingPortal(board, { x: 1, y: 1 }, 'A')).toBeNull();
  });
});

describe('findRobotAt', () => {
  it('finds an alive robot at position', () => {
    const robots = [
      createTestRobot({ id: 'r1', position: { x: 3, y: 3 } }),
    ];
    expect(findRobotAt(robots, { x: 3, y: 3 })).toBe(robots[0]);
  });

  it('returns undefined when no robot at position', () => {
    const robots = [
      createTestRobot({ id: 'r1', position: { x: 3, y: 3 } }),
    ];
    expect(findRobotAt(robots, { x: 0, y: 0 })).toBeUndefined();
  });

  it('excludes robot with given id', () => {
    const robots = [
      createTestRobot({ id: 'r1', position: { x: 3, y: 3 } }),
    ];
    expect(findRobotAt(robots, { x: 3, y: 3 }, 'r1')).toBeUndefined();
  });

  it('ignores dead robots (0 lives)', () => {
    const robots = [
      createTestRobot({ id: 'r1', position: { x: 3, y: 3 }, lives: 0 }),
    ];
    expect(findRobotAt(robots, { x: 3, y: 3 })).toBeUndefined();
  });

  it('ignores robots with 0 health', () => {
    const robots = [
      createTestRobot({ id: 'r1', position: { x: 3, y: 3 }, health: 0 }),
    ];
    expect(findRobotAt(robots, { x: 3, y: 3 })).toBeUndefined();
  });
});

describe('findSideFeatures', () => {
  it('finds all tiles with matching side feature', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 1, 1, {
      type: 'floor',
      sideFeatures: [{ type: 'laser', side: 'north', strength: 1 }],
    });
    setTile(board, 3, 3, {
      type: 'floor',
      sideFeatures: [{ type: 'laser', side: 'east', strength: 2 }],
    });
    const results = findSideFeatures(board, 'laser');
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ x: 1, y: 1, feature: { type: 'laser', side: 'north', strength: 1 } });
    expect(results[1]).toEqual({ x: 3, y: 3, feature: { type: 'laser', side: 'east', strength: 2 } });
  });

  it('returns empty array when no matching features', () => {
    const board = createTestBoard(5, 5);
    expect(findSideFeatures(board, 'laser')).toEqual([]);
  });
});

describe('findOverlays', () => {
  it('finds all tiles with matching overlay', () => {
    const board = createTestBoard(5, 5);
    setTile(board, 2, 2, {
      type: 'floor',
      overlays: [{ type: 'crusher', phases: [1, 3, 5] }],
    });
    const results = findOverlays(board, 'crusher');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ x: 2, y: 2, overlay: { type: 'crusher', phases: [1, 3, 5] } });
  });

  it('returns empty array when no matching overlays', () => {
    const board = createTestBoard(5, 5);
    expect(findOverlays(board, 'flamer')).toEqual([]);
  });
});
