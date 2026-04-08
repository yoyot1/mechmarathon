import {
  directionDelta, getTile, isInBounds, isPit, isWallBlocking, oppositeDirection, rotateDirection,
  findSideFeatures, findOverlays, findMatchingPortal, getElevationDamage,
} from './movement.js';
import { hasOption } from './options.js';
import { GAME } from '../constants.js';

// --- Helpers ---

const RANDOM_CARD_TYPES = ['move1', 'move2', 'move3', 'backup', 'turn_right', 'turn_left', 'u_turn'];

function randomizeCard(card) {
  const type = RANDOM_CARD_TYPES[Math.floor(Math.random() * RANDOM_CARD_TYPES.length)];
  return { ...card, type };
}

function posEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isAlive(robot) {
  return robot.lives > 0 && robot.health > 0;
}

function findRobotAt(robots, pos, excludeId) {
  return robots.find(
    (r) => isAlive(r) && posEqual(r.position, pos) && r.id !== excludeId,
  );
}

// --- Card execution ---

/** Execute a single card for a robot, returning events */
export function executeCard(card, robot, robots, board, registerIndex) {
  if (!isAlive(robot)) return [];

  // Teleporter: +2 bonus if robot starts on teleporter AND first destination is clear
  let bonus = 0;
  const onTeleporter = getTile(board, robot.position)?.type === 'teleporter';
  if (onTeleporter && (card.type === 'move1' || card.type === 'move2' || card.type === 'move3' || card.type === 'backup')) {
    const moveDir = card.type === 'backup' ? oppositeDirection(robot.direction) : robot.direction;
    // Check if first destination is clear (no wall, no robot)
    if (!isWallBlocking(board, robot.position, moveDir)) {
      const delta = directionDelta(moveDir);
      const firstDest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };
      if (isInBounds(board, firstDest) && !findRobotAt(robots, firstDest, robot.id)) {
        bonus = 2;
      }
    }
  }

  switch (card.type) {
    case 'move1': return moveRobot(robot, 1 + bonus, robots, board, registerIndex);
    case 'move2': return moveRobot(robot, 2 + bonus, robots, board, registerIndex);
    case 'move3': return moveRobot(robot, 3 + bonus, robots, board, registerIndex);
    case 'backup': return moveRobot(robot, bonus > 0 ? -2 : -1, robots, board, registerIndex);
    case 'turn_right': return rotateRobot(robot, 'cw');
    case 'turn_left': return rotateRobot(robot, 'ccw');
    case 'u_turn': return rotateRobot(robot, '180');
  }
}

function rotateRobot(robot, rotation) {
  const oldDir = robot.direction;
  robot.direction = rotateDirection(robot.direction, rotation);
  return [{
    type: 'rotate',
    robotId: robot.id,
    direction: robot.direction,
    details: `${oldDir} → ${robot.direction}`,
  }];
}

/** Move a robot a number of steps (negative = backward), handling pushing and walls */
export function moveRobot(robot, steps, robots, board, registerIndex) {
  const events = [];
  const direction = steps >= 0 ? robot.direction : oppositeDirection(robot.direction);
  const originalSteps = Math.abs(steps);
  let absSteps = originalSteps;

  // Oil slick / water: starting on these tiles negates the first square of movement
  const startTile = getTile(board, robot.position);
  if (startTile && (startTile.type === 'oil_slick' || startTile.type === 'water') && absSteps > 0) {
    absSteps -= 1;
  }

  for (let i = 0; i < absSteps; i++) {
    const posBefore = { ...robot.position };
    const { events: stepEvents, repulsed } = moveOneStep(robot, direction, robots, board, registerIndex, originalSteps);
    events.push(...stepEvents);
    // If repulsed or robot died, stop all remaining movement
    if (repulsed || !isAlive(robot)) break;
    // Ramp: going up a ramp costs an extra movement step
    if (!posEqual(posBefore, robot.position)) {
      const destTile = getTile(board, robot.position);
      const srcTile = getTile(board, posBefore);
      const srcElev = srcTile?.elevation ?? 0;
      const dstElev = destTile?.elevation ?? 0;
      if (dstElev > srcElev && destTile?.type === 'ramp') {
        absSteps -= 1; // consume extra step
      }
    }
  }

  return events;
}

function moveOneStep(robot, direction, robots, board, registerIndex, originalSteps) {
  const events = [];

  // Check wall blocking
  if (isWallBlocking(board, robot.position, direction)) return { events, repulsed: false };

  // Check repulsor blocking (side feature on exit side of source or entry side of dest)
  if (isRepulsorBlocking(board, robot.position, direction)) {
    const pushBackDir = oppositeDirection(direction);
    const pushBackEvents = pushBackRobot(robot, pushBackDir, originalSteps, robots, board, registerIndex);
    events.push({ type: 'repulsor', robotId: robot.id, from: { ...robot.position }, details: 'repulsor push-back' });
    events.push(...pushBackEvents);
    return { events, repulsed: true };
  }

  const delta = directionDelta(direction);
  const dest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

  // Check out of bounds → death
  if (!isInBounds(board, dest)) {
    const from = { ...robot.position };
    events.push({ type: 'fall', robotId: robot.id, from, details: 'off board' });
    killRobot(robot);
    return { events, repulsed: false };
  }

  // Check for robot at destination (only push non-virtual, and only if we're non-virtual)
  const blocking = findRobotAt(robots, dest, robot.id);
  if (blocking && !robot.virtual && !blocking.virtual) {
    // Try to push the blocking robot
    const pushEvents = pushRobotInDirection(blocking, direction, robots, board, registerIndex);
    // If the blocking robot didn't move (wall blocked), we can't move either
    if (pushEvents.length === 0 || posEqual(blocking.position, dest)) {
      return { events, repulsed: false };
    }
    events.push(...pushEvents);
  }

  // Move the robot
  const from = { ...robot.position };
  robot.position = dest;
  events.push({ type: 'move', robotId: robot.id, from, to: { ...dest } });

  // Check pit
  if (isPit(board, dest, registerIndex)) {
    events.push({ type: 'fall', robotId: robot.id, from: { ...dest }, details: 'pit' });
    killRobot(robot);
    return { events, repulsed: false };
  }

  // Elevation damage: falling from a ledge deals 2 damage
  const elevDmg = getElevationDamage(board, from, dest);
  if (elevDmg > 0) {
    robot.health = Math.max(0, robot.health - elevDmg);
    events.push({ type: 'laser_hit', robotId: robot.id, from: { ...from }, to: { ...dest }, details: `ledge fall (${elevDmg} dmg)` });
    if (robot.health <= 0) {
      killRobot(robot);
      events.push({ type: 'fall', robotId: robot.id, from: { ...dest }, details: 'ledge kill' });
      return { events, repulsed: false };
    }
  }

  // Oil slick: slide in movement direction until hitting wall, non-slick tile, robot, or off-board
  const destTile = getTile(board, dest);
  if (destTile?.type === 'oil_slick') {
    const slideEvents = slideOnOilSlick(robot, direction, robots, board, registerIndex);
    events.push(...slideEvents);
  }

  // Portal: teleport to matching portal tile
  if (destTile?.type === 'portal' && destTile.group) {
    const exitPortal = findMatchingPortal(board, dest, destTile.group);
    if (exitPortal) {
      const portalFrom = { ...robot.position };
      robot.position = { ...exitPortal };
      events.push({ type: 'portal', robotId: robot.id, from: portalFrom, to: { ...exitPortal }, details: `portal ${destTile.group}` });

      // Check pit at exit portal
      if (isPit(board, exitPortal, registerIndex)) {
        events.push({ type: 'fall', robotId: robot.id, from: { ...exitPortal }, details: 'pit' });
        killRobot(robot);
      }
    }
  }

  return { events, repulsed: false };
}

/**
 * Check if a repulsor side feature blocks movement from `pos` in `direction`.
 * Checks both exit side of source tile and entry side of destination tile.
 */
function isRepulsorBlocking(board, pos, direction) {
  // Check source tile: repulsor on exit side
  const srcTile = getTile(board, pos);
  if (srcTile?.sideFeatures) {
    for (const feature of srcTile.sideFeatures) {
      if (feature.type === 'repulsor' && feature.side === direction) return true;
    }
  }
  // Check destination tile: repulsor on entry side (opposite of direction)
  const delta = directionDelta(direction);
  const dest = { x: pos.x + delta.x, y: pos.y + delta.y };
  if (!isInBounds(board, dest)) return false;
  const destTile = getTile(board, dest);
  if (destTile?.sideFeatures) {
    const entrySide = oppositeDirection(direction);
    for (const feature of destTile.sideFeatures) {
      if (feature.type === 'repulsor' && feature.side === entrySide) return true;
    }
  }
  return false;
}

/**
 * Push a robot N steps in a direction, with chain-push, pit, and off-board support.
 * Used by repulsor push-back.
 */
function pushBackRobot(robot, direction, steps, robots, board, registerIndex) {
  const events = [];
  for (let i = 0; i < steps; i++) {
    if (!isAlive(robot)) break;

    if (isWallBlocking(board, robot.position, direction)) break;

    const delta = directionDelta(direction);
    const dest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

    // Off board → death
    if (!isInBounds(board, dest)) {
      const from = { ...robot.position };
      events.push({ type: 'fall', robotId: robot.id, from, details: 'off board' });
      killRobot(robot);
      break;
    }

    // Chain push other robots
    const blocking = findRobotAt(robots, dest, robot.id);
    if (blocking && !robot.virtual && !blocking.virtual) {
      const pushEvents = pushRobotInDirection(blocking, direction, robots, board, registerIndex);
      if (pushEvents.length === 0 || posEqual(blocking.position, dest)) {
        break; // blocked
      }
      events.push(...pushEvents);
    }

    const from = { ...robot.position };
    robot.position = dest;
    events.push({ type: 'move', robotId: robot.id, from, to: { ...dest }, details: 'repulsor push-back' });

    // Check pit
    if (isPit(board, dest, registerIndex)) {
      events.push({ type: 'fall', robotId: robot.id, from: { ...dest }, details: 'pit' });
      killRobot(robot);
      break;
    }
  }
  return events;
}

/**
 * Slide a robot on oil slick tiles in the given direction.
 * Continues sliding until hitting a wall, leaving oil slick, hitting a robot, or going off-board.
 */
function slideOnOilSlick(robot, direction, robots, board, registerIndex) {
  const events = [];

  while (isAlive(robot)) {
    // Check wall blocking from current position
    if (isWallBlocking(board, robot.position, direction)) break;

    const delta = directionDelta(direction);
    const next = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

    // Off-board → death
    if (!isInBounds(board, next)) {
      const from = { ...robot.position };
      events.push({ type: 'fall', robotId: robot.id, from, details: 'slid off board' });
      killRobot(robot);
      break;
    }

    // Blocked by another robot → stop
    const blocking = findRobotAt(robots, next, robot.id);
    if (blocking && !robot.virtual && !blocking.virtual) break;

    // Slide to next cell
    const from = { ...robot.position };
    robot.position = next;
    events.push({ type: 'move', robotId: robot.id, from, to: { ...next } });

    // Check pit at destination
    if (isPit(board, next, registerIndex)) {
      events.push({ type: 'fall', robotId: robot.id, from: { ...next }, details: 'pit' });
      killRobot(robot);
      break;
    }

    // Stop sliding if no longer on oil slick
    const nextTile = getTile(board, next);
    if (!nextTile || nextTile.type !== 'oil_slick') break;
  }

  return events;
}

function pushRobotInDirection(robot, direction, robots, board, registerIndex) {
  const events = [];

  if (isWallBlocking(board, robot.position, direction)) return events;

  const delta = directionDelta(direction);
  const dest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

  // Out of bounds → pushed off
  if (!isInBounds(board, dest)) {
    const from = { ...robot.position };
    robot.position = dest;
    events.push({ type: 'push', robotId: robot.id, from, details: 'pushed off board' });
    events.push({ type: 'fall', robotId: robot.id, from, details: 'off board' });
    killRobot(robot);
    return events;
  }

  // Chain push: if another robot is at dest
  const nextBlocking = findRobotAt(robots, dest, robot.id);
  if (nextBlocking && !nextBlocking.virtual) {
    const chainEvents = pushRobotInDirection(nextBlocking, direction, robots, board, registerIndex);
    if (chainEvents.length === 0 || posEqual(nextBlocking.position, dest)) {
      return events; // chain blocked
    }
    events.push(...chainEvents);
  }

  const from = { ...robot.position };
  robot.position = dest;
  events.push({ type: 'push', robotId: robot.id, from, to: { ...dest } });

  // Check pit
  if (isPit(board, dest, registerIndex)) {
    events.push({ type: 'fall', robotId: robot.id, from: { ...dest }, details: 'pit' });
    killRobot(robot);
    return events;
  }

  // Elevation damage: pushed off a ledge
  const elevDmg = getElevationDamage(board, from, dest);
  if (elevDmg > 0) {
    robot.health = Math.max(0, robot.health - elevDmg);
    events.push({ type: 'laser_hit', robotId: robot.id, from: { ...from }, to: { ...dest }, details: `ledge fall (${elevDmg} dmg)` });
    if (robot.health <= 0) {
      killRobot(robot);
      events.push({ type: 'fall', robotId: robot.id, from: { ...dest }, details: 'ledge kill' });
    }
  }

  return events;
}

function killRobot(robot) {
  robot.lives -= 1;
  robot.health = 0;
}

// --- Board element processing ---

/** Process express conveyors only (phase 1 of conveyor processing) */
export function processExpressConveyors(robots, board, registerIndex) {
  return processConveyorType(robots, board, 'express_conveyor', registerIndex);
}

/** Process all conveyors (phase 2 of conveyor processing) */
export function processAllConveyors(robots, board, registerIndex) {
  return processConveyorType(robots, board, 'both', registerIndex);
}

function processConveyorType(robots, board, type, registerIndex) {
  const events = [];

  // Calculate intended destinations for all robots on conveyors
  const moves = new Map();

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (!tile || !tile.direction) continue;
    if (type === 'express_conveyor' && tile.type !== 'express_conveyor') continue;
    if (type === 'both' && tile.type !== 'conveyor' && tile.type !== 'express_conveyor') continue;

    // Check wall blocking on source and destination
    if (isWallBlocking(board, robot.position, tile.direction)) continue;

    const delta = directionDelta(tile.direction);
    const dest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

    if (!isInBounds(board, dest)) {
      moves.set(robot.id, { robot, from: { ...robot.position }, to: dest, offBoard: true });
      continue;
    }

    moves.set(robot.id, { robot, from: { ...robot.position }, to: dest, sourceTile: tile });
  }

  // Detect destination conflicts — if two robots would move to the same cell, cancel both
  const destCounts = new Map();
  for (const [robotId, move] of moves) {
    if (move.offBoard) continue;
    const key = `${move.to.x},${move.to.y}`;
    const list = destCounts.get(key) ?? [];
    list.push(robotId);
    destCounts.set(key, list);
  }

  // Also cancel if destination has a stationary robot (one not being conveyed)
  for (const [robotId, move] of moves) {
    if (move.offBoard) continue;
    const stationary = findRobotAt(robots, move.to, robotId);
    if (stationary && !moves.has(stationary.id)) {
      // Destination occupied by non-conveyed robot, cancel
      moves.delete(robotId);
    }
  }

  // Remove conflicting moves
  for (const [, robotIds] of destCounts) {
    if (robotIds.length > 1) {
      for (const id of robotIds) moves.delete(id);
    }
  }

  // Execute remaining moves + conveyor curve rotation
  for (const [, move] of moves) {
    // Off-board: kill the robot
    if (move.offBoard) {
      events.push({ type: 'conveyor', robotId: move.robot.id, from: move.from, to: move.to });
      events.push({ type: 'fall', robotId: move.robot.id, from: move.from, details: 'off board' });
      killRobot(move.robot);
      continue;
    }

    move.robot.position = { ...move.to };
    events.push({ type: 'conveyor', robotId: move.robot.id, from: move.from, to: move.to });

    // Check pit
    if (isPit(board, move.to, registerIndex)) {
      events.push({ type: 'fall', robotId: move.robot.id, from: move.to, details: 'pit' });
      killRobot(move.robot);
      continue;
    }

    // Elevation damage from conveyor movement
    const elevDmg = getElevationDamage(board, move.from, move.to);
    if (elevDmg > 0) {
      move.robot.health = Math.max(0, move.robot.health - elevDmg);
      events.push({ type: 'laser_hit', robotId: move.robot.id, from: move.from, to: move.to, details: `ledge fall (${elevDmg} dmg)` });
      if (move.robot.health <= 0) {
        killRobot(move.robot);
        events.push({ type: 'fall', robotId: move.robot.id, from: move.to, details: 'ledge kill' });
        continue;
      }
    }

    // Conveyor curve rotation: check if the destination conveyor has an entry array
    // and if the robot entered from a matching entry side, resulting in a turn
    const destTile = getTile(board, move.to);
    if (destTile && (destTile.type === 'conveyor' || destTile.type === 'express_conveyor') && destTile.entry && destTile.direction) {
      // The robot entered from the direction of move.from relative to move.to
      const enteredFromSide = getEnteredSide(move.from, move.to);
      if (enteredFromSide && destTile.entry.includes(enteredFromSide)) {
        // Determine rotation: from enteredFromSide's opposite (the direction we were going)
        // to the destination conveyor's exit direction
        const curveRotation = getCurveRotation(oppositeDirection(enteredFromSide), destTile.direction);
        if (curveRotation) {
          const oldDir = move.robot.direction;
          move.robot.direction = rotateDirection(move.robot.direction, curveRotation);
          events.push({
            type: 'rotate',
            robotId: move.robot.id,
            direction: move.robot.direction,
            details: `${oldDir} → ${move.robot.direction}`,
          });
        }
      }
    }
  }

  return events;
}

/**
 * Given two adjacent positions, determine which side of 'to' the movement came from.
 * e.g. if from is directly south of to, the robot entered from the 'south' side.
 */
function getEnteredSide(from, to) {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  if (dx === 0 && dy === -1) return 'north';
  if (dx === 0 && dy === 1) return 'south';
  if (dx === 1 && dy === 0) return 'east';
  if (dx === -1 && dy === 0) return 'west';
  return null;
}

/**
 * Determine if a direction change is CW or CCW rotation.
 * Returns 'cw', 'ccw', or null if same/opposite direction.
 */
function getCurveRotation(fromDir, toDir) {
  if (fromDir === toDir) return null;
  if (oppositeDirection(fromDir) === toDir) return null; // 180 not valid for conveyor curve
  // CW: north→east, east→south, south→west, west→north
  if (rotateDirection(fromDir, 'cw') === toDir) return 'cw';
  if (rotateDirection(fromDir, 'ccw') === toDir) return 'ccw';
  return null;
}

/**
 * Process currents — like conveyors, move robots 1 square in the current's direction.
 * Uses same conflict resolution as conveyors (no two robots can be pushed to same cell).
 */
export function processCurrents(robots, board, registerIndex) {
  const events = [];
  const moves = new Map();

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (!tile || tile.type !== 'current' || !tile.direction) continue;

    if (isWallBlocking(board, robot.position, tile.direction)) continue;

    const delta = directionDelta(tile.direction);
    const dest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

    if (!isInBounds(board, dest)) {
      moves.set(robot.id, { robot, from: { ...robot.position }, to: dest, offBoard: true });
      continue;
    }

    moves.set(robot.id, { robot, from: { ...robot.position }, to: dest });
  }

  // Conflict resolution: cancel if two robots would land on the same cell
  const destCounts = new Map();
  for (const [robotId, move] of moves) {
    if (move.offBoard) continue;
    const key = `${move.to.x},${move.to.y}`;
    const list = destCounts.get(key) ?? [];
    list.push(robotId);
    destCounts.set(key, list);
  }

  // Cancel if destination has a stationary robot
  for (const [robotId, move] of moves) {
    if (move.offBoard) continue;
    const stationary = findRobotAt(robots, move.to, robotId);
    if (stationary && !moves.has(stationary.id)) {
      moves.delete(robotId);
    }
  }

  // Remove conflicting moves
  for (const [, robotIds] of destCounts) {
    if (robotIds.length > 1) {
      for (const id of robotIds) moves.delete(id);
    }
  }

  // Execute remaining moves
  for (const [, move] of moves) {
    // Off-board: kill the robot
    if (move.offBoard) {
      events.push({ type: 'current', robotId: move.robot.id, from: move.from, to: move.to });
      events.push({ type: 'fall', robotId: move.robot.id, from: move.from, details: 'off board' });
      killRobot(move.robot);
      continue;
    }

    move.robot.position = { ...move.to };
    events.push({ type: 'current', robotId: move.robot.id, from: move.from, to: move.to });

    if (isPit(board, move.to, registerIndex)) {
      events.push({ type: 'fall', robotId: move.robot.id, from: move.to, details: 'pit' });
      killRobot(move.robot);
      continue;
    }

    // Elevation damage from current movement
    const elevDmg = getElevationDamage(board, move.from, move.to);
    if (elevDmg > 0) {
      move.robot.health = Math.max(0, move.robot.health - elevDmg);
      events.push({ type: 'laser_hit', robotId: move.robot.id, from: move.from, to: move.to, details: `ledge fall (${elevDmg} dmg)` });
      if (move.robot.health <= 0) {
        killRobot(move.robot);
        events.push({ type: 'fall', robotId: move.robot.id, from: move.to, details: 'ledge kill' });
      }
    }
  }

  return events;
}

/** Process gears — rotate robots on gear tiles (gyroscopic_stabilizer grants immunity) */
export function processGears(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    if (hasOption(robot, 'gyroscopic_stabilizer')) continue;
    const tile = getTile(board, robot.position);
    if (!tile) continue;

    if (tile.type === 'gear') {
      const gearDir = tile.variant || 'cw';
      robot.direction = rotateDirection(robot.direction, gearDir);
      events.push({ type: 'gear', robotId: robot.id, direction: robot.direction, details: gearDir });
    }
  }

  return events;
}

// --- Phase-based board elements ---

/**
 * Process pushers (side features).
 * Active on specific phases (register numbers). Push robot in opposite direction from mount side.
 */
export function processPushers(robots, board, registerIndex) {
  const events = [];
  const pusherMounts = findSideFeatures(board, 'pusher');

  for (const { x, y, feature } of pusherMounts) {
    // Check if this pusher is active on this register
    if (!feature.phases?.includes(registerIndex)) continue;

    const pushDir = oppositeDirection(feature.side);
    const robot = findRobotAt(robots, { x, y });
    if (!robot) continue;

    // Push robot using the standard push logic (supports chain pushing)
    const pushEvents = pushRobotInDirection(robot, pushDir, robots, board, registerIndex);
    if (pushEvents.length > 0) {
      events.push(...pushEvents);
    }
  }

  return events;
}

/**
 * Process crushers (overlays).
 * Active on specific phases. Destroy any robot on the tile.
 */
export function processCrushers(robots, board, registerIndex) {
  const events = [];
  const crushers = findOverlays(board, 'crusher');

  for (const { x, y, overlay } of crushers) {
    if (!overlay.phases?.includes(registerIndex)) continue;

    const robot = findRobotAt(robots, { x, y });
    if (!robot) continue;

    events.push({
      type: 'crusher',
      robotId: robot.id,
      from: { x, y },
      details: 'crushed',
    });
    killRobot(robot);
  }

  return events;
}

/**
 * Process flamers (overlays).
 * Active on specific phases. Deal 1 damage to any robot on the tile.
 */
export function processFlamers(robots, board, registerIndex) {
  const events = [];
  const flamers = findOverlays(board, 'flamer');

  for (const { x, y, overlay } of flamers) {
    if (!overlay.phases?.includes(registerIndex)) continue;

    const robot = findRobotAt(robots, { x, y });
    if (!robot) continue;

    robot.health = Math.max(0, robot.health - 1);
    events.push({
      type: 'flamer',
      robotId: robot.id,
      from: { x, y },
      details: 'flamer (1 dmg)',
    });
    if (robot.health <= 0) {
      killRobot(robot);
      events.push({ type: 'fall', robotId: robot.id, from: { x, y }, details: 'flamer kill' });
    }
  }

  return events;
}

// --- Laser processing ---

/**
 * Process board lasers (side features).
 * Each laser fires from its mounted side in the opposite direction,
 * hitting the first robot in its path. Blocked by walls.
 */
export function processBoardLasers(robots, board) {
  const events = [];
  const laserMounts = findSideFeatures(board, 'laser');

  for (const { x, y, feature } of laserMounts) {
    const fireDir = oppositeDirection(feature.side);
    const strength = feature.strength || 1;
    const hitEvents = fireLaser(x, y, fireDir, strength, robots, board, 'board_laser');
    events.push(...hitEvents);
  }

  return events;
}

/**
 * Process robot lasers — each alive robot fires forward, hitting the first other robot.
 * Robots with rear_firing_laser also fire backward.
 */
export function processRobotLasers(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const hitEvents = fireLaser(
      robot.position.x, robot.position.y, robot.direction, 1, robots, board, 'robot_laser', robot.id,
    );
    events.push(...hitEvents);

    // Rear-firing laser option: also fire backward
    if (hasOption(robot, 'rear_firing_laser') && isAlive(robot)) {
      const rearDir = oppositeDirection(robot.direction);
      const rearEvents = fireLaser(
        robot.position.x, robot.position.y, rearDir, 1, robots, board, 'robot_laser', robot.id,
      );
      events.push(...rearEvents);
    }
  }

  return events;
}

/**
 * Fire a laser from (startX, startY) in direction, dealing strength damage to first robot hit.
 * Source is 'board_laser' or 'robot_laser'. excludeId skips the firing robot.
 * The laser starts checking from the NEXT cell in direction (not the source cell).
 */
function fireLaser(startX, startY, direction, strength, robots, board, source, excludeId) {
  const events = [];
  const delta = directionDelta(direction);
  let cx = startX;
  let cy = startY;

  // Walk cells in firing direction
  while (true) {
    // Check wall on current cell leaving in direction
    const currentTile = getTile(board, { x: cx, y: cy });
    if (currentTile?.walls?.includes(direction)) break;
    if (currentTile?.oneWayWalls?.some((ow) => ow.side === direction && ow.blocks === 'exit')) break;

    const nx = cx + delta.x;
    const ny = cy + delta.y;

    if (!isInBounds(board, { x: nx, y: ny })) break;

    // Check wall on destination cell entering from opposite direction
    const enterSide = oppositeDirection(direction);
    const nextTile = getTile(board, { x: nx, y: ny });
    if (nextTile?.walls?.includes(enterSide)) break;
    if (nextTile?.oneWayWalls?.some((ow) => ow.side === enterSide && ow.blocks === 'entry')) break;

    // Check for robot at (nx, ny)
    const hitRobot = findRobotAt(robots, { x: nx, y: ny }, excludeId);
    if (hitRobot) {
      hitRobot.health = Math.max(0, hitRobot.health - strength);
      events.push({
        type: 'laser_hit',
        robotId: hitRobot.id,
        from: { x: startX, y: startY },
        to: { x: nx, y: ny },
        details: `${source} (${strength} dmg)`,
      });
      if (hitRobot.health <= 0) {
        killRobot(hitRobot);
        events.push({ type: 'fall', robotId: hitRobot.id, from: { x: nx, y: ny }, details: 'laser kill' });
      }
      break; // Laser stops at first robot hit
    }

    cx = nx;
    cy = ny;
  }

  return events;
}

/** Process flags — increment robot.flag when landing on next sequential one.
 *  When excludeFinal is true, the highest-numbered flag is skipped
 *  (it should only be credited after all board elements have executed). */
export function processFlags(robots, flags, excludeFinal = false) {
  const events = [];
  const maxFlag = flags.length > 0 ? Math.max(...flags.map((c) => c.number)) : 0;

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const nextFlag = robot.flag + 1;
    if (excludeFinal && nextFlag === maxFlag) continue;
    const flag = flags.find((c) => c.number === nextFlag);
    if (flag && posEqual(robot.position, flag.position)) {
      robot.flag = nextFlag;
      robot.archivePosition = { ...flag.position };
      events.push({
        type: 'flag',
        robotId: robot.id,
        to: flag.position,
        details: `flag ${nextFlag}`,
      });
    }
  }

  return events;
}

/** Process repair sites — update archive position (called per register) */
export function processRepairArchive(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (tile?.type === 'repair') {
      robot.archivePosition = { ...robot.position };
      events.push({ type: 'repair_archive', robotId: robot.id, to: robot.position });
    }
  }

  return events;
}

/** Process flag repair — heal 1 HP for robots on flag positions (called end-of-turn only) */
export function processFlagRepair(robots, flags) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const onFlag = flags.some((f) => posEqual(robot.position, f.position));
    if (onFlag) {
      robot.health = Math.min(robot.health + 1, GAME.STARTING_HEALTH);
      events.push({ type: 'flag_repair', robotId: robot.id, to: { ...robot.position } });
    }
  }

  return events;
}

/** Process repair sites — heal based on variant (called end-of-turn only) */
export function processRepairHeal(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (tile?.type !== 'repair') continue;

    const variant = tile.variant || 'wrench';
    const healAmount = variant === 'double_wrench' ? 2 : 1;
    robot.health = Math.min(robot.health + healAmount, GAME.STARTING_HEALTH);
    events.push({ type: 'repair', robotId: robot.id, to: { ...robot.position } });

    if (variant === 'hammer_wrench') {
      events.push({ type: 'option_draw', robotId: robot.id, to: { ...robot.position } });
    }
  }

  return events;
}

/**
 * Process radiation tiles — deal 1 damage on the 5th register only.
 */
export function processRadiation(robots, board, registerIndex) {
  if (registerIndex !== 5) return [];
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (tile?.type !== 'radiation') continue;

    robot.health = Math.max(0, robot.health - 1);
    events.push({
      type: 'laser_hit',
      robotId: robot.id,
      from: { ...robot.position },
      to: { ...robot.position },
      details: 'radiation (1 dmg)',
    });
    if (robot.health <= 0) {
      killRobot(robot);
      events.push({ type: 'fall', robotId: robot.id, from: { ...robot.position }, details: 'radiation kill' });
    }
  }

  return events;
}

/**
 * Process radioactive waste tiles — deal 1 damage every register.
 */
export function processRadioactiveWaste(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (tile?.type !== 'radioactive_waste') continue;

    robot.health = Math.max(0, robot.health - 1);
    events.push({
      type: 'laser_hit',
      robotId: robot.id,
      from: { ...robot.position },
      to: { ...robot.position },
      details: 'radioactive waste (1 dmg)',
    });
    if (robot.health <= 0) {
      killRobot(robot);
      events.push({ type: 'fall', robotId: robot.id, from: { ...robot.position }, details: 'waste kill' });
    }
  }

  return events;
}

/**
 * Process chop shop tiles — robots on a chop shop can draw an option card.
 * Returns events indicating which robots should draw. Actual drawing is handled by the caller.
 */
export function processChopShop(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (tile?.type !== 'chop_shop') continue;

    events.push({
      type: 'chop_shop',
      robotId: robot.id,
      to: { ...robot.position },
      details: 'draw option card',
    });
  }

  return events;
}

/**
 * Process radioactive waste tiles — robots on radioactive waste can draw an option card.
 * Returns events indicating which robots should draw. Actual drawing is handled by the caller.
 */
export function processRadioactiveWasteOptionDraw(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (tile?.type !== 'radioactive_waste') continue;

    events.push({
      type: 'option_draw',
      robotId: robot.id,
      to: { ...robot.position },
      details: 'radioactive waste option card',
    });
  }

  return events;
}

/** Handle robot death: respawn at archive position (last flag or repair site) */
export function handleRobotDeath(robot) {
  if (robot.lives <= 0) return [];
  robot.position = { ...robot.archivePosition };
  robot.direction = 'north';
  robot.health = GAME.STARTING_HEALTH;
  robot.virtual = true;
  return [{ type: 'respawn', robotId: robot.id, to: { ...robot.archivePosition } }];
}

// --- Register execution ---

/**
 * Execute a full register for all players.
 * Follows the corrected RoboRally execution order:
 * 1. Robots move (card execution by priority)
 * 2. Board elements: express conveyors → all conveyors → pushers → gears → crushers
 * 3. Lasers: board lasers → robot lasers → flamers
 * 4. Flags + repair
 */
export function executeRegister(registerIndex, playerCards, robots, board, flags) {
  const events = [];

  // 1. Sort cards by priority (highest first) and execute
  const entries = [...playerCards.entries()]
    .map(([playerId, card]) => ({
      playerId,
      card,
      robot: robots.find((r) => r.playerId === playerId),
    }))
    .filter((e) => e.robot && isAlive(e.robot))
    .sort((a, b) => b.card.priority - a.card.priority);

  for (const entry of entries) {
    // Randomizer: replace card with random type if robot is on a randomizer tile
    let card = entry.card;
    if (isAlive(entry.robot) && getTile(board, entry.robot.position)?.type === 'randomizer') {
      card = randomizeCard(card);
    }
    events.push(...executeCard(card, entry.robot, robots, board, registerIndex));
  }

  // 2. Board elements
  events.push(...processExpressConveyors(robots, board, registerIndex));
  events.push(...processAllConveyors(robots, board, registerIndex));
  events.push(...processCurrents(robots, board, registerIndex));
  events.push(...processPushers(robots, board, registerIndex));
  events.push(...processGears(robots, board));
  events.push(...processCrushers(robots, board, registerIndex));

  // 3. Lasers + flamers + damage zones
  events.push(...processBoardLasers(robots, board));
  events.push(...processRobotLasers(robots, board));
  events.push(...processFlamers(robots, board, registerIndex));
  events.push(...processRadiation(robots, board, registerIndex));
  events.push(...processRadioactiveWaste(robots, board));

  // 4. Flags + repair archive + chop shop
  events.push(...processFlags(robots, flags, true));
  events.push(...processRepairArchive(robots, board));
  events.push(...processChopShop(robots, board));
  events.push(...processRadioactiveWasteOptionDraw(robots, board));

  return events;
}

/** Card type to readable label */
const CARD_TYPE_LABELS = {
  move1: 'Move 1', move2: 'Move 2', move3: 'Move 3',
  backup: 'Backup', turn_left: 'Turn Left', turn_right: 'Turn Right', u_turn: 'U-Turn',
};

/** Deep-copy robots array (for snapshots) */
function snapshotRobots(robots) {
  return robots.map((r) => ({
    ...r,
    position: { ...r.position },
    archivePosition: { ...r.archivePosition },
    options: r.options ? [...r.options] : undefined,
  }));
}

/** Execute a register broken into granular sub-steps with robot snapshots after each */
export function executeRegisterSteps(registerIndex, playerCards, robots, board, flags) {
  const steps = [];

  // 1. Sort cards by priority (highest first) and execute
  const entries = [...playerCards.entries()]
    .map(([playerId, card]) => ({
      playerId,
      card,
      robot: robots.find((r) => r.playerId === playerId),
    }))
    .filter((e) => e.robot && isAlive(e.robot))
    .sort((a, b) => b.card.priority - a.card.priority);

  for (const entry of entries) {
    // Randomizer: replace card with random type if robot is on a randomizer tile
    let card = entry.card;
    let randomized = false;
    if (isAlive(entry.robot) && getTile(board, entry.robot.position)?.type === 'randomizer') {
      card = randomizeCard(card);
      randomized = true;
    }
    const events = executeCard(card, entry.robot, robots, board, registerIndex);
    if (events.length > 0) {
      const label = CARD_TYPE_LABELS[card.type] ?? card.type;
      const suffix = randomized ? ' [Randomized]' : '';
      steps.push({
        label: `${label} (P:${card.priority})${suffix}`,
        events,
        robotsAfter: snapshotRobots(robots),
      });
    }
  }

  // 2. Board elements
  const ecEvents = processExpressConveyors(robots, board, registerIndex);
  if (ecEvents.length > 0) {
    steps.push({ label: 'Express Conveyors', events: ecEvents, robotsAfter: snapshotRobots(robots) });
  }

  const acEvents = processAllConveyors(robots, board, registerIndex);
  if (acEvents.length > 0) {
    steps.push({ label: 'All Conveyors', events: acEvents, robotsAfter: snapshotRobots(robots) });
  }

  const currentEvents = processCurrents(robots, board, registerIndex);
  if (currentEvents.length > 0) {
    steps.push({ label: 'Currents', events: currentEvents, robotsAfter: snapshotRobots(robots) });
  }

  const pusherEvents = processPushers(robots, board, registerIndex);
  if (pusherEvents.length > 0) {
    steps.push({ label: 'Pushers', events: pusherEvents, robotsAfter: snapshotRobots(robots) });
  }

  const gearEvents = processGears(robots, board);
  if (gearEvents.length > 0) {
    steps.push({ label: 'Gears', events: gearEvents, robotsAfter: snapshotRobots(robots) });
  }

  const crusherEvents = processCrushers(robots, board, registerIndex);
  if (crusherEvents.length > 0) {
    steps.push({ label: 'Crushers', events: crusherEvents, robotsAfter: snapshotRobots(robots) });
  }

  // 3. Lasers + flamers
  const boardLaserEvents = processBoardLasers(robots, board);
  if (boardLaserEvents.length > 0) {
    steps.push({ label: 'Board Lasers', events: boardLaserEvents, robotsAfter: snapshotRobots(robots) });
  }

  const robotLaserEvents = processRobotLasers(robots, board);
  if (robotLaserEvents.length > 0) {
    steps.push({ label: 'Robot Lasers', events: robotLaserEvents, robotsAfter: snapshotRobots(robots) });
  }

  const flamerEvents = processFlamers(robots, board, registerIndex);
  if (flamerEvents.length > 0) {
    steps.push({ label: 'Flamers', events: flamerEvents, robotsAfter: snapshotRobots(robots) });
  }

  const radiationEvents = processRadiation(robots, board, registerIndex);
  if (radiationEvents.length > 0) {
    steps.push({ label: 'Radiation', events: radiationEvents, robotsAfter: snapshotRobots(robots) });
  }

  const wasteEvents = processRadioactiveWaste(robots, board);
  if (wasteEvents.length > 0) {
    steps.push({ label: 'Radioactive Waste', events: wasteEvents, robotsAfter: snapshotRobots(robots) });
  }

  // 4. Flags + repair + chop shop
  const flagEvents = processFlags(robots, flags, true);
  if (flagEvents.length > 0) {
    steps.push({ label: 'Flags', events: flagEvents, robotsAfter: snapshotRobots(robots) });
  }

  const repairArchiveEvents = processRepairArchive(robots, board);
  if (repairArchiveEvents.length > 0) {
    steps.push({ label: 'Repair Archive', events: repairArchiveEvents, robotsAfter: snapshotRobots(robots) });
  }

  const chopShopEvents = processChopShop(robots, board);
  if (chopShopEvents.length > 0) {
    steps.push({ label: 'Chop Shop', events: chopShopEvents, robotsAfter: snapshotRobots(robots) });
  }

  const wasteOptionEvents = processRadioactiveWasteOptionDraw(robots, board);
  if (wasteOptionEvents.length > 0) {
    steps.push({ label: 'Radioactive Waste Options', events: wasteOptionEvents, robotsAfter: snapshotRobots(robots) });
  }

  return steps;
}

/** Check if any robot has reached all flags */
export function checkWinCondition(robots, totalFlags) {
  for (const robot of robots) {
    if (robot.flag >= totalFlags) {
      return robot.playerId;
    }
  }
  return null;
}

/** Update virtual status: robots are non-virtual if no other robot is on the same position */
export function updateVirtualStatus(robots) {
  for (const robot of robots) {
    if (!isAlive(robot) || !robot.virtual) continue;
    const stacked = robots.some(
      (other) =>
        other.id !== robot.id &&
        isAlive(other) &&
        posEqual(other.position, robot.position),
    );
    if (!stacked) {
      robot.virtual = false;
    }
  }
}
