import { describe, it, expect, vi } from 'vitest';
import { GAME } from '../../constants.js';
import {
  executeCard,
  moveRobot,
  processExpressConveyors,
  processAllConveyors,
  processCurrents,
  processGears,
  processPushers,
  processCrushers,
  processFlamers,
  processBoardLasers,
  processRobotLasers,
  processCheckpoints,
  processRepair,
  processRadiation,
  processRadioactiveWaste,
  processChopShop,
  handleRobotDeath,
  executeRegister,
  checkWinCondition,
  updateVirtualStatus,
} from '../execution.js';
import { createTestBoard, setTile, createTestRobot, createTestRobots } from './helpers.js';

// --- executeCard ---

describe('executeCard', () => {
  it('executes move1 — moves robot 1 step forward', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const card = { id: 'c1', type: 'move1', priority: 100 };
    const events = executeCard(card, robot, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 4 });
    expect(events.some((e) => e.type === 'move')).toBe(true);
  });

  it('executes move2 — moves robot 2 steps forward', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'east', position: { x: 3, y: 5 } });
    const card = { id: 'c2', type: 'move2', priority: 200 };
    executeCard(card, robot, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('executes move3 — moves robot 3 steps forward', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'south', position: { x: 5, y: 3 } });
    const card = { id: 'c3', type: 'move3', priority: 300 };
    executeCard(card, robot, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 6 });
  });

  it('executes backup — moves robot 1 step backward', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const card = { id: 'c4', type: 'backup', priority: 50 };
    executeCard(card, robot, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 6 });
  });

  it('executes turn_right — rotates CW', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north' });
    const card = { id: 'c5', type: 'turn_right', priority: 150 };
    executeCard(card, robot, [robot], board, 1);
    expect(robot.direction).toBe('east');
  });

  it('executes turn_left — rotates CCW', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north' });
    const card = { id: 'c6', type: 'turn_left', priority: 160 };
    executeCard(card, robot, [robot], board, 1);
    expect(robot.direction).toBe('west');
  });

  it('executes u_turn — rotates 180', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north' });
    const card = { id: 'c7', type: 'u_turn', priority: 10 };
    executeCard(card, robot, [robot], board, 1);
    expect(robot.direction).toBe('south');
  });

  it('does nothing for dead robot', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ health: 0 });
    const card = { id: 'c1', type: 'move1', priority: 100 };
    const events = executeCard(card, robot, [robot], board, 1);
    expect(events).toEqual([]);
  });

  it('triples movement on teleporter tile', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'teleporter' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const card = { id: 'c1', type: 'move1', priority: 100 };
    executeCard(card, robot, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 2 });
  });
});

// --- moveRobot ---

describe('moveRobot', () => {
  it('moves 1 step north', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const events = moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 4 });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('move');
  });

  it('moves 2 steps east', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'east', position: { x: 3, y: 5 } });
    moveRobot(robot, 2, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('moves 3 steps south', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'south', position: { x: 5, y: 3 } });
    moveRobot(robot, 3, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 6 });
  });

  it('moves backward (negative steps)', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, -1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 6 });
  });

  it('wall blocks movement from source side', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'floor', walls: ['north'] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('wall blocks movement from destination side', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'floor', walls: ['south'] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('wall stops multi-step at first wall', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'floor', walls: ['north'] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 3, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 4 });
  });

  it('one-way wall blocks entry', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'floor', oneWayWalls: [{ side: 'south', blocks: 'entry' }] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('one-way wall blocks exit', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'floor', oneWayWalls: [{ side: 'north', blocks: 'exit' }] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('robot dies falling off board', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 0 } });
    const events = moveRobot(robot, 1, [robot], board, 1);
    expect(robot.health).toBe(0);
    expect(robot.lives).toBe(GAME.STARTING_LIVES - 1);
    expect(events.some((e) => e.type === 'fall')).toBe(true);
  });

  it('robot dies falling into pit', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'pit' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const events = moveRobot(robot, 1, [robot], board, 1);
    expect(robot.health).toBe(0);
    expect(events.some((e) => e.type === 'fall' && e.details === 'pit')).toBe(true);
  });

  it('stops moving after death', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'pit' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 3, [robot], board, 1);
    // Robot dies at pit, no further movement
    expect(robot.health).toBe(0);
  });

  it('oil slick deducts first step', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'oil_slick' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 2, [robot], board, 1);
    // Oil slick reduces 2 steps to 1 step
    expect(robot.position).toEqual({ x: 5, y: 4 });
  });

  it('water deducts first step', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'water' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    // Water reduces 1 step to 0 steps
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('ramp costs an extra movement step going up', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'floor', elevation: 0 });
    setTile(board, 5, 4, { type: 'ramp', elevation: 1 });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 2, [robot], board, 1);
    // Ramp going up costs 2 steps total (1 to enter + 1 penalty), so move2 gets only to ramp
    expect(robot.position).toEqual({ x: 5, y: 4 });
  });
});

// --- Push mechanics ---

describe('push mechanics', () => {
  it('pushes a single robot', () => {
    const board = createTestBoard();
    const pusher = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 6 } });
    const target = createTestRobot({ id: 'r2', position: { x: 5, y: 5 } });
    const robots = [pusher, target];
    moveRobot(pusher, 1, robots, board, 1);
    expect(pusher.position).toEqual({ x: 5, y: 5 });
    expect(target.position).toEqual({ x: 5, y: 4 });
  });

  it('chain pushes multiple robots', () => {
    const board = createTestBoard();
    const r1 = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 7 } });
    const r2 = createTestRobot({ id: 'r2', position: { x: 5, y: 6 } });
    const r3 = createTestRobot({ id: 'r3', position: { x: 5, y: 5 } });
    const robots = [r1, r2, r3];
    moveRobot(r1, 1, robots, board, 1);
    expect(r1.position).toEqual({ x: 5, y: 6 });
    expect(r2.position).toEqual({ x: 5, y: 5 });
    expect(r3.position).toEqual({ x: 5, y: 4 });
  });

  it('push blocked by wall — pusher stays too', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'floor', walls: ['north'] });
    const pusher = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 6 } });
    const target = createTestRobot({ id: 'r2', position: { x: 5, y: 5 } });
    const robots = [pusher, target];
    moveRobot(pusher, 1, robots, board, 1);
    expect(pusher.position).toEqual({ x: 5, y: 6 });
    expect(target.position).toEqual({ x: 5, y: 5 });
  });

  it('push robot off board kills it and pusher advances', () => {
    const board = createTestBoard();
    const pusher = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 1 } });
    const target = createTestRobot({ id: 'r2', position: { x: 5, y: 0 } });
    const robots = [pusher, target];
    const events = moveRobot(pusher, 1, robots, board, 1);
    // Push off-board kills target, pusher advances into vacated space
    expect(target.health).toBe(0);
    expect(target.lives).toBe(GAME.STARTING_LIVES - 1);
    expect(pusher.position).toEqual({ x: 5, y: 0 });
    expect(events.some((e) => e.type === 'push' && e.details === 'pushed off board')).toBe(true);
    expect(events.some((e) => e.type === 'fall' && e.details === 'off board')).toBe(true);
  });

  it('push into pit kills pushed robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'pit' });
    const pusher = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 6 } });
    const target = createTestRobot({ id: 'r2', position: { x: 5, y: 5 } });
    const robots = [pusher, target];
    moveRobot(pusher, 1, robots, board, 1);
    expect(target.health).toBe(0);
    expect(pusher.position).toEqual({ x: 5, y: 5 });
  });

  it('virtual robots pass through each other', () => {
    const board = createTestBoard();
    const r1 = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 6 }, virtual: true });
    const r2 = createTestRobot({ id: 'r2', position: { x: 5, y: 5 } });
    const robots = [r1, r2];
    moveRobot(r1, 1, robots, board, 1);
    expect(r1.position).toEqual({ x: 5, y: 5 });
    expect(r2.position).toEqual({ x: 5, y: 5 }); // not pushed
  });
});

// --- Repulsor ---

describe('repulsor', () => {
  it('bounces robot back to origin', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'repulsor' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });
});

// --- Oil slick sliding ---

describe('oil slick sliding', () => {
  it('slides robot until non-oil-slick tile', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'oil_slick' });
    setTile(board, 5, 3, { type: 'oil_slick' });
    // Tile at (5,2) is floor, so robot stops there
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 2 });
  });

  it('slides robot off board — death', () => {
    const board = createTestBoard();
    for (let y = 0; y < 5; y++) setTile(board, 5, y, { type: 'oil_slick' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.health).toBe(0);
  });
});

// --- Portal ---

describe('portal', () => {
  it('teleports robot to matching portal', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'portal', group: 'A' });
    setTile(board, 8, 8, { type: 'portal', group: 'A' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    expect(robot.position).toEqual({ x: 8, y: 8 });
  });
});

// --- Conveyors ---

describe('processExpressConveyors', () => {
  it('moves robot on express conveyor', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'express_conveyor', direction: 'east' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processExpressConveyors([robot], board, 1);
    expect(robot.position).toEqual({ x: 6, y: 5 });
    expect(events.some((e) => e.type === 'conveyor')).toBe(true);
  });

  it('does not move robot on regular conveyor', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'conveyor', direction: 'east' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processExpressConveyors([robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });
});

describe('processAllConveyors', () => {
  it('moves robot on regular conveyor', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'conveyor', direction: 'north' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processAllConveyors([robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 4 });
  });

  it('moves robot on express conveyor too', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'express_conveyor', direction: 'south' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processAllConveyors([robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 6 });
  });

  it('cancels conflicting destinations', () => {
    const board = createTestBoard();
    setTile(board, 4, 5, { type: 'conveyor', direction: 'east' });
    setTile(board, 6, 5, { type: 'conveyor', direction: 'west' });
    const r1 = createTestRobot({ id: 'r1', position: { x: 4, y: 5 } });
    const r2 = createTestRobot({ id: 'r2', position: { x: 6, y: 5 } });
    const robots = [r1, r2];
    processAllConveyors(robots, board, 1);
    // Both would move to (5,5) — conflict, neither moves
    expect(r1.position).toEqual({ x: 4, y: 5 });
    expect(r2.position).toEqual({ x: 6, y: 5 });
  });

  it('does not push into stationary robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'conveyor', direction: 'east' });
    const r1 = createTestRobot({ id: 'r1', position: { x: 5, y: 5 } });
    const r2 = createTestRobot({ id: 'r2', position: { x: 6, y: 5 } }); // not on conveyor
    const robots = [r1, r2];
    processAllConveyors(robots, board, 1);
    expect(r1.position).toEqual({ x: 5, y: 5 });
  });

  it('conveyor into pit kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'conveyor', direction: 'east' });
    setTile(board, 6, 5, { type: 'pit' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processAllConveyors([robot], board, 1);
    expect(robot.health).toBe(0);
  });

  it('conveyor curve rotates robot', () => {
    const board = createTestBoard();
    // Robot on northbound conveyor, destination has eastbound conveyor with south entry (curve)
    setTile(board, 5, 5, { type: 'conveyor', direction: 'north' });
    setTile(board, 5, 4, { type: 'conveyor', direction: 'east', entry: ['south'] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    processAllConveyors([robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 4 });
    expect(robot.direction).toBe('east'); // turned CW at curve
  });
});

// --- Currents ---

describe('processCurrents', () => {
  it('moves robot on current tile', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'current', direction: 'west' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processCurrents([robot], board, 1);
    expect(robot.position).toEqual({ x: 4, y: 5 });
  });

  it('does not move robot on non-current tile', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processCurrents([robot], board, 1);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('cancels conflicting current destinations', () => {
    const board = createTestBoard();
    setTile(board, 4, 5, { type: 'current', direction: 'east' });
    setTile(board, 6, 5, { type: 'current', direction: 'west' });
    const r1 = createTestRobot({ id: 'r1', position: { x: 4, y: 5 } });
    const r2 = createTestRobot({ id: 'r2', position: { x: 6, y: 5 } });
    processCurrents([r1, r2], board, 1);
    expect(r1.position).toEqual({ x: 4, y: 5 });
    expect(r2.position).toEqual({ x: 6, y: 5 });
  });
});

// --- Gears ---

describe('processGears', () => {
  it('rotates robot CW on gear_cw', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'gear_cw' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const events = processGears([robot], board);
    expect(robot.direction).toBe('east');
    expect(events.some((e) => e.type === 'gear' && e.details === 'cw')).toBe(true);
  });

  it('rotates robot CCW on gear_ccw', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'gear_ccw' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    processGears([robot], board);
    expect(robot.direction).toBe('west');
  });

  it('does not rotate on floor tile', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    processGears([robot], board);
    expect(robot.direction).toBe('north');
  });

  it('gyroscopic stabilizer grants immunity', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'gear_cw' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 }, options: ['gyroscopic_stabilizer'] });
    processGears([robot], board);
    expect(robot.direction).toBe('north');
  });

  it('does not rotate dead robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'gear_cw' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 }, health: 0 });
    processGears([robot], board);
    expect(robot.direction).toBe('north');
  });
});

// --- Pushers ---

describe('processPushers', () => {
  it('pushes robot on active phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      sideFeatures: [{ type: 'pusher', side: 'north', phases: [1, 3, 5] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processPushers([robot], board, 1);
    // Pusher mounted on north side pushes south (opposite of mount side)
    expect(robot.position).toEqual({ x: 5, y: 6 });
    expect(events.some((e) => e.type === 'push')).toBe(true);
  });

  it('does not push on inactive phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      sideFeatures: [{ type: 'pusher', side: 'north', phases: [1, 3, 5] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processPushers([robot], board, 2);
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('does nothing when no robot on tile', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      sideFeatures: [{ type: 'pusher', side: 'north', phases: [1] }],
    });
    const robot = createTestRobot({ position: { x: 3, y: 3 } });
    const events = processPushers([robot], board, 1);
    expect(events).toHaveLength(0);
  });
});

// --- Crushers ---

describe('processCrushers', () => {
  it('kills robot on active phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      overlays: [{ type: 'crusher', phases: [2, 4] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processCrushers([robot], board, 2);
    expect(robot.health).toBe(0);
    expect(events.some((e) => e.type === 'crusher')).toBe(true);
  });

  it('does not kill on inactive phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      overlays: [{ type: 'crusher', phases: [2, 4] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processCrushers([robot], board, 1);
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
  });
});

// --- Flamers ---

describe('processFlamers', () => {
  it('deals 1 damage on active phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      overlays: [{ type: 'flamer', phases: [1, 3] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processFlamers([robot], board, 1);
    expect(robot.health).toBe(GAME.STARTING_HEALTH - 1);
    expect(events.some((e) => e.type === 'flamer')).toBe(true);
  });

  it('does not damage on inactive phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      overlays: [{ type: 'flamer', phases: [1, 3] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processFlamers([robot], board, 2);
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
  });

  it('kills robot when health reaches 0', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      overlays: [{ type: 'flamer', phases: [1] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 5 }, health: 1 });
    const events = processFlamers([robot], board, 1);
    expect(robot.health).toBe(0);
    expect(robot.lives).toBe(GAME.STARTING_LIVES - 1);
    expect(events.some((e) => e.type === 'fall' && e.details === 'flamer kill')).toBe(true);
  });
});

// --- Board lasers ---

describe('processBoardLasers', () => {
  it('hits first robot in laser path', () => {
    const board = createTestBoard();
    setTile(board, 5, 0, {
      type: 'floor',
      sideFeatures: [{ type: 'laser', side: 'north', strength: 1 }],
    });
    // Laser mounted on north side fires south
    const robot = createTestRobot({ position: { x: 5, y: 3 } });
    const events = processBoardLasers([robot], board);
    expect(robot.health).toBe(GAME.STARTING_HEALTH - 1);
    expect(events.some((e) => e.type === 'laser_hit')).toBe(true);
  });

  it('multi-strength laser deals more damage', () => {
    const board = createTestBoard();
    setTile(board, 5, 0, {
      type: 'floor',
      sideFeatures: [{ type: 'laser', side: 'north', strength: 3 }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 3 } });
    processBoardLasers([robot], board);
    expect(robot.health).toBe(GAME.STARTING_HEALTH - 3);
  });

  it('laser blocked by wall', () => {
    const board = createTestBoard();
    setTile(board, 5, 0, {
      type: 'floor',
      sideFeatures: [{ type: 'laser', side: 'north', strength: 1 }],
    });
    setTile(board, 5, 2, { type: 'floor', walls: ['south'] });
    const robot = createTestRobot({ position: { x: 5, y: 3 } });
    processBoardLasers([robot], board);
    // Wall at (5,2) south blocks the laser from reaching (5,3)
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
  });

  it('laser hits only first robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 0, {
      type: 'floor',
      sideFeatures: [{ type: 'laser', side: 'north', strength: 1 }],
    });
    const r1 = createTestRobot({ id: 'r1', position: { x: 5, y: 2 } });
    const r2 = createTestRobot({ id: 'r2', position: { x: 5, y: 5 } });
    processBoardLasers([r1, r2], board);
    expect(r1.health).toBe(GAME.STARTING_HEALTH - 1);
    expect(r2.health).toBe(GAME.STARTING_HEALTH); // shielded by r1
  });
});

// --- Robot lasers ---

describe('processRobotLasers', () => {
  it('robot fires forward and hits another robot', () => {
    const board = createTestBoard();
    const shooter = createTestRobot({ id: 'r1', direction: 'east', position: { x: 3, y: 5 } });
    const target = createTestRobot({ id: 'r2', position: { x: 6, y: 5 } });
    const events = processRobotLasers([shooter, target], board);
    expect(target.health).toBe(GAME.STARTING_HEALTH - 1);
    expect(events.some((e) => e.type === 'laser_hit' && e.robotId === 'r2')).toBe(true);
  });

  it('robot laser blocked by wall', () => {
    const board = createTestBoard();
    setTile(board, 4, 5, { type: 'floor', walls: ['east'] });
    const shooter = createTestRobot({ id: 'r1', direction: 'east', position: { x: 3, y: 5 } });
    const target = createTestRobot({ id: 'r2', position: { x: 6, y: 5 } });
    processRobotLasers([shooter, target], board);
    expect(target.health).toBe(GAME.STARTING_HEALTH);
  });

  it('dead robot does not fire', () => {
    const board = createTestBoard();
    const shooter = createTestRobot({ id: 'r1', direction: 'east', position: { x: 3, y: 5 }, health: 0 });
    const target = createTestRobot({ id: 'r2', position: { x: 6, y: 5 } });
    processRobotLasers([shooter, target], board);
    expect(target.health).toBe(GAME.STARTING_HEALTH);
  });

  it('rear_firing_laser fires backward too', () => {
    const board = createTestBoard();
    const shooter = createTestRobot({
      id: 'r1', direction: 'east', position: { x: 5, y: 5 },
      options: ['rear_firing_laser'],
    });
    const front = createTestRobot({ id: 'r2', position: { x: 8, y: 5 } });
    const rear = createTestRobot({ id: 'r3', position: { x: 2, y: 5 } });
    processRobotLasers([shooter, front, rear], board);
    expect(front.health).toBe(GAME.STARTING_HEALTH - 1);
    expect(rear.health).toBe(GAME.STARTING_HEALTH - 1);
  });
});

// --- Checkpoints ---

describe('processCheckpoints', () => {
  it('increments checkpoint when robot is on next checkpoint', () => {
    const checkpoints = [
      { number: 1, position: { x: 3, y: 3 } },
      { number: 2, position: { x: 7, y: 7 } },
    ];
    const robot = createTestRobot({ position: { x: 3, y: 3 }, checkpoint: 0 });
    const events = processCheckpoints([robot], checkpoints);
    expect(robot.checkpoint).toBe(1);
    expect(robot.archivePosition).toEqual({ x: 3, y: 3 });
    expect(events.some((e) => e.type === 'checkpoint')).toBe(true);
  });

  it('does not skip checkpoints', () => {
    const checkpoints = [
      { number: 1, position: { x: 3, y: 3 } },
      { number: 2, position: { x: 7, y: 7 } },
    ];
    const robot = createTestRobot({ position: { x: 7, y: 7 }, checkpoint: 0 });
    processCheckpoints([robot], checkpoints);
    expect(robot.checkpoint).toBe(0); // must get checkpoint 1 first
  });

  it('excludeFinal skips the last checkpoint', () => {
    const checkpoints = [
      { number: 1, position: { x: 3, y: 3 } },
      { number: 2, position: { x: 7, y: 7 } },
    ];
    const robot = createTestRobot({ position: { x: 7, y: 7 }, checkpoint: 1 });
    processCheckpoints([robot], checkpoints, true);
    expect(robot.checkpoint).toBe(1); // checkpoint 2 excluded
  });
});

// --- Repair ---

describe('processRepair', () => {
  it('restores 1 health on repair tile', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'repair' });
    const robot = createTestRobot({ position: { x: 5, y: 5 }, health: 8 });
    const events = processRepair([robot], board);
    expect(robot.health).toBe(9);
    expect(robot.archivePosition).toEqual({ x: 5, y: 5 });
    expect(events.some((e) => e.type === 'repair')).toBe(true);
  });

  it('does not exceed max health', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'repair' });
    const robot = createTestRobot({ position: { x: 5, y: 5 }, health: GAME.STARTING_HEALTH });
    processRepair([robot], board);
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
  });

  it('does not repair on floor tile', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ position: { x: 5, y: 5 }, health: 5 });
    processRepair([robot], board);
    expect(robot.health).toBe(5);
  });
});

// --- Radiation ---

describe('processRadiation', () => {
  it('deals 1 damage on register 5 only', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'radiation' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processRadiation([robot], board, 5);
    expect(robot.health).toBe(GAME.STARTING_HEALTH - 1);
  });

  it('does not deal damage on other registers', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'radiation' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processRadiation([robot], board, 1);
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
  });
});

// --- Radioactive Waste ---

describe('processRadioactiveWaste', () => {
  it('deals 1 damage every register', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'radioactive_waste' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processRadioactiveWaste([robot], board);
    expect(robot.health).toBe(GAME.STARTING_HEALTH - 1);
  });

  it('kills robot when health reaches 0', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'radioactive_waste' });
    const robot = createTestRobot({ position: { x: 5, y: 5 }, health: 1 });
    processRadioactiveWaste([robot], board);
    expect(robot.health).toBe(0);
    expect(robot.lives).toBe(GAME.STARTING_LIVES - 1);
  });
});

// --- Chop Shop ---

describe('processChopShop', () => {
  it('returns chop_shop event for robot on tile', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'chop_shop' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processChopShop([robot], board);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('chop_shop');
  });

  it('returns nothing when not on chop_shop', () => {
    const board = createTestBoard();
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processChopShop([robot], board);
    expect(events).toHaveLength(0);
  });
});

// --- handleRobotDeath ---

describe('handleRobotDeath', () => {
  it('respawns robot at archive position', () => {
    const robot = createTestRobot({
      position: { x: 10, y: 10 },
      archivePosition: { x: 2, y: 2 },
      health: 0,
      lives: 2,
      direction: 'east',
    });
    const events = handleRobotDeath(robot);
    expect(robot.position).toEqual({ x: 2, y: 2 });
    expect(robot.direction).toBe('north');
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
    expect(robot.virtual).toBe(true);
    expect(events.some((e) => e.type === 'respawn')).toBe(true);
  });

  it('returns empty events when no lives left', () => {
    const robot = createTestRobot({ health: 0, lives: 0 });
    const events = handleRobotDeath(robot);
    expect(events).toEqual([]);
  });
});

// --- checkWinCondition ---

describe('checkWinCondition', () => {
  it('returns playerId when robot reached all checkpoints', () => {
    const robot = createTestRobot({ playerId: 'player-1', checkpoint: 3 });
    const result = checkWinCondition([robot], 3);
    expect(result).toBe('player-1');
  });

  it('returns null when no robot has all checkpoints', () => {
    const robot = createTestRobot({ playerId: 'player-1', checkpoint: 1 });
    const result = checkWinCondition([robot], 3);
    expect(result).toBeNull();
  });

  it('returns first winner when multiple qualify', () => {
    const r1 = createTestRobot({ id: 'r1', playerId: 'p1', checkpoint: 3 });
    const r2 = createTestRobot({ id: 'r2', playerId: 'p2', checkpoint: 3 });
    const result = checkWinCondition([r1, r2], 3);
    expect(result).toBe('p1');
  });
});

// --- updateVirtualStatus ---

describe('updateVirtualStatus', () => {
  it('makes virtual robot non-virtual when alone', () => {
    const robot = createTestRobot({ virtual: true, position: { x: 5, y: 5 } });
    updateVirtualStatus([robot]);
    expect(robot.virtual).toBe(false);
  });

  it('keeps robot virtual when stacked with another', () => {
    const r1 = createTestRobot({ id: 'r1', virtual: true, position: { x: 5, y: 5 } });
    const r2 = createTestRobot({ id: 'r2', virtual: false, position: { x: 5, y: 5 } });
    updateVirtualStatus([r1, r2]);
    expect(r1.virtual).toBe(true);
  });

  it('does not change non-virtual robots', () => {
    const robot = createTestRobot({ virtual: false });
    updateVirtualStatus([robot]);
    expect(robot.virtual).toBe(false);
  });
});

// --- Pusher extended tests ---

describe('processPushers (extended)', () => {
  it('chain pushes two robots in line', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, {
      type: 'floor',
      sideFeatures: [{ type: 'pusher', side: 'north', phases: [1] }],
    });
    const r1 = createTestRobot({ id: 'r1', position: { x: 5, y: 5 } });
    const r2 = createTestRobot({ id: 'r2', position: { x: 5, y: 6 } });
    const robots = [r1, r2];
    const events = processPushers(robots, board, 1);
    // Pusher on north side pushes south — r1 to (5,6), r2 chain-pushed to (5,7)
    expect(r1.position).toEqual({ x: 5, y: 6 });
    expect(r2.position).toEqual({ x: 5, y: 7 });
    expect(events.filter((e) => e.type === 'push')).toHaveLength(2);
  });

  it('pushes robot off board — robot dies', () => {
    const board = createTestBoard();
    setTile(board, 5, 11, {
      type: 'floor',
      sideFeatures: [{ type: 'pusher', side: 'north', phases: [1] }],
    });
    const robot = createTestRobot({ position: { x: 5, y: 11 } });
    const events = processPushers([robot], board, 1);
    // Pusher on north side pushes south — off the south edge (y=12 out of bounds)
    expect(robot.health).toBe(0);
    expect(robot.lives).toBe(GAME.STARTING_LIVES - 1);
    expect(events.some((e) => e.type === 'fall' && e.details === 'off board')).toBe(true);
  });
});

// --- Conveyor off-board ---

describe('processAllConveyors (off-board)', () => {
  it('conveyor pointing off west edge kills robot', () => {
    const board = createTestBoard();
    setTile(board, 0, 5, { type: 'conveyor', direction: 'west' });
    const robot = createTestRobot({ position: { x: 0, y: 5 } });
    const events = processAllConveyors([robot], board, 1);
    expect(robot.health).toBe(0);
    expect(robot.lives).toBe(GAME.STARTING_LIVES - 1);
    expect(events.some((e) => e.type === 'fall' && e.details === 'off board')).toBe(true);
  });

  it('express conveyor pointing off north edge kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 0, { type: 'express_conveyor', direction: 'north' });
    const robot = createTestRobot({ position: { x: 5, y: 0 } });
    const events = processExpressConveyors([robot], board, 1);
    expect(robot.health).toBe(0);
    expect(events.some((e) => e.type === 'fall')).toBe(true);
  });
});

// --- Current extended tests ---

describe('processCurrents (extended)', () => {
  it('emits event type "current" not "conveyor"', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'current', direction: 'east' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processCurrents([robot], board, 1);
    expect(events[0].type).toBe('current');
  });

  it('current pointing off board kills robot', () => {
    const board = createTestBoard();
    setTile(board, 11, 5, { type: 'current', direction: 'east' });
    const robot = createTestRobot({ position: { x: 11, y: 5 } });
    const events = processCurrents([robot], board, 1);
    expect(robot.health).toBe(0);
    expect(robot.lives).toBe(GAME.STARTING_LIVES - 1);
    expect(events.some((e) => e.type === 'fall' && e.details === 'off board')).toBe(true);
  });

  it('current into pit kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'current', direction: 'east' });
    setTile(board, 6, 5, { type: 'pit' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    const events = processCurrents([robot], board, 1);
    expect(robot.health).toBe(0);
    expect(events.some((e) => e.type === 'fall' && e.details === 'pit')).toBe(true);
  });
});

// --- Drain / radioactive_drain ---

describe('drain tiles', () => {
  it('walking into drain kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'drain' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const events = moveRobot(robot, 1, [robot], board, 1);
    expect(robot.health).toBe(0);
    expect(events.some((e) => e.type === 'fall' && e.details === 'pit')).toBe(true);
  });

  it('walking into radioactive_drain kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'radioactive_drain' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const events = moveRobot(robot, 1, [robot], board, 1);
    expect(robot.health).toBe(0);
    expect(events.some((e) => e.type === 'fall' && e.details === 'pit')).toBe(true);
  });

  it('push into drain kills pushed robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'drain' });
    const pusher = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 6 } });
    const target = createTestRobot({ id: 'r2', position: { x: 5, y: 5 } });
    const robots = [pusher, target];
    moveRobot(pusher, 1, robots, board, 1);
    expect(target.health).toBe(0);
    expect(pusher.position).toEqual({ x: 5, y: 5 });
  });

  it('conveyor into drain kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'conveyor', direction: 'east' });
    setTile(board, 6, 5, { type: 'drain' });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processAllConveyors([robot], board, 1);
    expect(robot.health).toBe(0);
  });
});

// --- Trap pit ---

describe('trap_pit', () => {
  it('kills robot on active phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'trap_pit', phases: [1, 3, 5] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    const events = moveRobot(robot, 1, [robot], board, 1);
    expect(robot.health).toBe(0);
    expect(events.some((e) => e.type === 'fall' && e.details === 'pit')).toBe(true);
  });

  it('does not kill robot on inactive phase', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'trap_pit', phases: [1, 3, 5] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 2);
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
    expect(robot.position).toEqual({ x: 5, y: 4 });
  });

  it('active on non-phase-1 register', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'trap_pit', phases: [2, 4] });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 4);
    expect(robot.health).toBe(0);
  });

  it('no phases array defaults to always closed (safe)', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'trap_pit' });
    const robot = createTestRobot({ direction: 'north', position: { x: 5, y: 5 } });
    moveRobot(robot, 1, [robot], board, 1);
    // No phases = phases?.includes() returns false, so not a pit
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
    expect(robot.position).toEqual({ x: 5, y: 4 });
  });

  it('conveyor into trap_pit on active phase kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'conveyor', direction: 'east' });
    setTile(board, 6, 5, { type: 'trap_pit', phases: [1] });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processAllConveyors([robot], board, 1);
    expect(robot.health).toBe(0);
  });

  it('conveyor into trap_pit on inactive phase — robot survives', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'conveyor', direction: 'east' });
    setTile(board, 6, 5, { type: 'trap_pit', phases: [1] });
    const robot = createTestRobot({ position: { x: 5, y: 5 } });
    processAllConveyors([robot], board, 2);
    expect(robot.health).toBe(GAME.STARTING_HEALTH);
    expect(robot.position).toEqual({ x: 6, y: 5 });
  });

  it('push into trap_pit on active phase kills robot', () => {
    const board = createTestBoard();
    setTile(board, 5, 4, { type: 'trap_pit', phases: [1] });
    const pusher = createTestRobot({ id: 'r1', direction: 'north', position: { x: 5, y: 6 } });
    const target = createTestRobot({ id: 'r2', position: { x: 5, y: 5 } });
    const robots = [pusher, target];
    moveRobot(pusher, 1, robots, board, 1);
    expect(target.health).toBe(0);
    expect(pusher.position).toEqual({ x: 5, y: 5 });
  });
});

// --- Randomizer ---

describe('randomizer', () => {
  it('randomizes card for robot on randomizer tile', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'randomizer' });
    const robot = createTestRobot({ id: 'r1', playerId: 'p1', direction: 'north', position: { x: 5, y: 5 } });

    // Mock Math.random to return a deterministic value
    vi.spyOn(Math, 'random').mockReturnValue(0); // index 0 = 'move1'

    const playerCards = new Map();
    playerCards.set('p1', { id: 'c1', type: 'u_turn', priority: 100 });

    const events = executeRegister(1, playerCards, [robot], board, []);
    // With Math.random() = 0, the card becomes move1, so robot moves north
    expect(robot.position).toEqual({ x: 5, y: 4 });

    vi.restoreAllMocks();
  });

  it('does NOT randomize card for robot NOT on randomizer tile', () => {
    const board = createTestBoard();
    // No randomizer on tile (5,5) — it's a floor
    const robot = createTestRobot({ id: 'r1', playerId: 'p1', direction: 'north', position: { x: 5, y: 5 } });

    const playerCards = new Map();
    playerCards.set('p1', { id: 'c1', type: 'u_turn', priority: 100 });

    executeRegister(1, playerCards, [robot], board, []);
    // u_turn should execute normally — robot turns south
    expect(robot.direction).toBe('south');
    expect(robot.position).toEqual({ x: 5, y: 5 });
  });

  it('only affects robot on the randomizer tile, not others', () => {
    const board = createTestBoard();
    setTile(board, 5, 5, { type: 'randomizer' });
    const r1 = createTestRobot({ id: 'r1', playerId: 'p1', direction: 'north', position: { x: 5, y: 5 } });
    const r2 = createTestRobot({ id: 'r2', playerId: 'p2', direction: 'north', position: { x: 3, y: 5 } });

    vi.spyOn(Math, 'random').mockReturnValue(0); // move1

    const playerCards = new Map();
    playerCards.set('p1', { id: 'c1', type: 'u_turn', priority: 100 });
    playerCards.set('p2', { id: 'c2', type: 'u_turn', priority: 50 });

    executeRegister(1, playerCards, [r1, r2], board, []);
    // r1 on randomizer gets move1 (moves north)
    expect(r1.position).toEqual({ x: 5, y: 4 });
    // r2 NOT on randomizer keeps u_turn
    expect(r2.direction).toBe('south');
    expect(r2.position).toEqual({ x: 3, y: 5 });

    vi.restoreAllMocks();
  });
});

// --- executeRegister ---

describe('executeRegister', () => {
  it('executes cards by priority (highest first)', () => {
    const board = createTestBoard();
    const r1 = createTestRobot({ id: 'r1', playerId: 'p1', direction: 'north', position: { x: 3, y: 5 } });
    const r2 = createTestRobot({ id: 'r2', playerId: 'p2', direction: 'north', position: { x: 7, y: 5 } });
    const robots = [r1, r2];

    const playerCards = new Map();
    playerCards.set('p1', { id: 'c1', type: 'move1', priority: 100 });
    playerCards.set('p2', { id: 'c2', type: 'move1', priority: 200 });

    executeRegister(1, playerCards, robots, board, []);
    // Both should have moved north
    expect(r1.position).toEqual({ x: 3, y: 4 });
    expect(r2.position).toEqual({ x: 7, y: 4 });
  });

  it('processes board elements in correct order', () => {
    const board = createTestBoard();
    // Put robot on an express conveyor going east, then a gear_cw
    setTile(board, 5, 5, { type: 'express_conveyor', direction: 'east' });
    setTile(board, 6, 5, { type: 'gear_cw' });

    const robot = createTestRobot({
      id: 'r1', playerId: 'p1', direction: 'north', position: { x: 5, y: 5 },
    });

    const playerCards = new Map();
    // Use u-turn so robot doesn't move off conveyor
    playerCards.set('p1', { id: 'c1', type: 'u_turn', priority: 100 });

    executeRegister(1, playerCards, [robot], board, []);
    // After u-turn: direction = south
    // Express conveyor moves east to (6,5) — gear_cw tile
    // All conveyors also fire: robot is now on gear_cw (not a conveyor), so no additional move
    // Gear rotates: south → west
    expect(robot.position).toEqual({ x: 6, y: 5 });
    expect(robot.direction).toBe('west');
  });
});
