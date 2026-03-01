import {
  directionDelta, getTile, isInBounds, isPit, isWallBlocking, oppositeDirection, rotateDirection,
} from './movement.js';

// --- Helpers ---

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
export function executeCard(card, robot, robots, board) {
  if (!isAlive(robot)) return [];

  switch (card.type) {
    case 'move1': return moveRobot(robot, 1, robots, board);
    case 'move2': return moveRobot(robot, 2, robots, board);
    case 'move3': return moveRobot(robot, 3, robots, board);
    case 'backup': return moveRobot(robot, -1, robots, board);
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
export function moveRobot(robot, steps, robots, board) {
  const events = [];
  const direction = steps >= 0 ? robot.direction : oppositeDirection(robot.direction);
  const absSteps = Math.abs(steps);

  for (let i = 0; i < absSteps; i++) {
    const stepEvents = moveOneStep(robot, direction, robots, board);
    events.push(...stepEvents);
    // If the robot died (fell in pit / off board), stop
    if (!isAlive(robot)) break;
  }

  return events;
}

function moveOneStep(robot, direction, robots, board) {
  const events = [];

  // Check wall blocking
  if (isWallBlocking(board, robot.position, direction)) return events;

  const delta = directionDelta(direction);
  const dest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

  // Check out of bounds → death
  if (!isInBounds(board, dest)) {
    const from = { ...robot.position };
    events.push({ type: 'fall', robotId: robot.id, from, details: 'off board' });
    killRobot(robot);
    return events;
  }

  // Check for robot at destination (only push non-virtual, and only if we're non-virtual)
  const blocking = findRobotAt(robots, dest, robot.id);
  if (blocking && !robot.virtual && !blocking.virtual) {
    // Try to push the blocking robot
    const pushEvents = pushRobot(blocking, direction, robots, board);
    // If the blocking robot didn't move (wall blocked), we can't move either
    if (pushEvents.length === 0 || posEqual(blocking.position, dest)) {
      return events;
    }
    events.push(...pushEvents);
  }

  // Move the robot
  const from = { ...robot.position };
  robot.position = dest;
  events.push({ type: 'move', robotId: robot.id, from, to: { ...dest } });

  // Check pit
  if (isPit(board, dest)) {
    events.push({ type: 'fall', robotId: robot.id, from: { ...dest }, details: 'pit' });
    killRobot(robot);
  }

  return events;
}

function pushRobot(robot, direction, robots, board) {
  const events = [];

  if (isWallBlocking(board, robot.position, direction)) return events;

  const delta = directionDelta(direction);
  const dest = { x: robot.position.x + delta.x, y: robot.position.y + delta.y };

  // Out of bounds → pushed off
  if (!isInBounds(board, dest)) {
    const from = { ...robot.position };
    events.push({ type: 'push', robotId: robot.id, from, details: 'pushed off board' });
    events.push({ type: 'fall', robotId: robot.id, from, details: 'off board' });
    killRobot(robot);
    return events;
  }

  // Chain push: if another robot is at dest
  const nextBlocking = findRobotAt(robots, dest, robot.id);
  if (nextBlocking && !nextBlocking.virtual) {
    const chainEvents = pushRobot(nextBlocking, direction, robots, board);
    if (chainEvents.length === 0 || posEqual(nextBlocking.position, dest)) {
      return events; // chain blocked
    }
    events.push(...chainEvents);
  }

  const from = { ...robot.position };
  robot.position = dest;
  events.push({ type: 'push', robotId: robot.id, from, to: { ...dest } });

  // Check pit
  if (isPit(board, dest)) {
    events.push({ type: 'fall', robotId: robot.id, from: { ...dest }, details: 'pit' });
    killRobot(robot);
  }

  return events;
}

function killRobot(robot) {
  robot.lives -= 1;
  robot.health = 0;
}

// --- Board element processing ---

/** Process express conveyors only (phase 1 of conveyor processing) */
export function processExpressConveyors(robots, board) {
  return processConveyorType(robots, board, 'express_conveyor');
}

/** Process all conveyors (phase 2 of conveyor processing) */
export function processAllConveyors(robots, board) {
  return processConveyorType(robots, board, 'both');
}

function processConveyorType(robots, board, type) {
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

    if (!isInBounds(board, dest)) continue;

    moves.set(robot.id, { robot, from: { ...robot.position }, to: dest });
  }

  // Detect destination conflicts — if two robots would move to the same cell, cancel both
  const destCounts = new Map();
  for (const [robotId, move] of moves) {
    const key = `${move.to.x},${move.to.y}`;
    const list = destCounts.get(key) ?? [];
    list.push(robotId);
    destCounts.set(key, list);
  }

  // Also cancel if destination has a stationary robot (one not being conveyed)
  for (const [robotId, move] of moves) {
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

  // Execute remaining moves
  for (const [, move] of moves) {
    move.robot.position = { ...move.to };
    events.push({ type: 'conveyor', robotId: move.robot.id, from: move.from, to: move.to });

    // Check pit
    if (isPit(board, move.to)) {
      events.push({ type: 'fall', robotId: move.robot.id, from: move.to, details: 'pit' });
      killRobot(move.robot);
    }
  }

  return events;
}

/** Process gears — rotate robots on gear tiles */
export function processGears(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (!tile) continue;

    if (tile.type === 'gear_cw') {
      robot.direction = rotateDirection(robot.direction, 'cw');
      events.push({ type: 'gear', robotId: robot.id, direction: robot.direction, details: 'cw' });
    } else if (tile.type === 'gear_ccw') {
      robot.direction = rotateDirection(robot.direction, 'ccw');
      events.push({ type: 'gear', robotId: robot.id, direction: robot.direction, details: 'ccw' });
    }
  }

  return events;
}

/** Process checkpoints — increment robot.checkpoint when landing on next sequential one.
 *  When excludeFinal is true, the highest-numbered checkpoint is skipped
 *  (it should only be credited after all board elements have executed). */
export function processCheckpoints(robots, checkpoints, excludeFinal = false) {
  const events = [];
  const maxCp = checkpoints.length > 0 ? Math.max(...checkpoints.map((c) => c.number)) : 0;

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const nextCheckpoint = robot.checkpoint + 1;
    if (excludeFinal && nextCheckpoint === maxCp) continue;
    const cp = checkpoints.find((c) => c.number === nextCheckpoint);
    if (cp && posEqual(robot.position, cp.position)) {
      robot.checkpoint = nextCheckpoint;
      robot.archivePosition = { ...cp.position };
      events.push({
        type: 'checkpoint',
        robotId: robot.id,
        to: cp.position,
        details: `checkpoint ${nextCheckpoint}`,
      });
    }
  }

  return events;
}

/** Process repair sites — restore 1 health */
export function processRepair(robots, board) {
  const events = [];

  for (const robot of robots) {
    if (!isAlive(robot)) continue;
    const tile = getTile(board, robot.position);
    if (tile?.type === 'repair') {
      robot.health = Math.min(robot.health + 1, 10);
      robot.archivePosition = { ...robot.position };
      events.push({ type: 'repair', robotId: robot.id, to: robot.position });
    }
  }

  return events;
}

/** Handle robot death: respawn at archive position (last checkpoint or repair site) */
export function handleRobotDeath(robot) {
  if (robot.lives <= 0) return [];
  robot.position = { ...robot.archivePosition };
  robot.direction = 'north';
  robot.health = 10;
  robot.virtual = true;
  return [{ type: 'respawn', robotId: robot.id, to: { ...robot.archivePosition } }];
}

// --- Register execution ---

/** Execute a full register for all players */
export function executeRegister(registerIndex, playerCards, robots, board, checkpoints) {
  const events = [];

  // Sort cards by priority (highest first)
  const entries = [...playerCards.entries()]
    .map(([playerId, card]) => ({
      playerId,
      card,
      robot: robots.find((r) => r.playerId === playerId),
    }))
    .filter((e) => e.robot && isAlive(e.robot))
    .sort((a, b) => b.card.priority - a.card.priority);

  // Execute each player's card in priority order
  for (const entry of entries) {
    events.push(...executeCard(entry.card, entry.robot, robots, board));
  }

  // Board elements: express conveyors, then all conveyors, then gears
  events.push(...processExpressConveyors(robots, board));
  events.push(...processAllConveyors(robots, board));
  events.push(...processGears(robots, board));

  // Intermediate checkpoints (after board elements, excludes the final flag —
  // the final flag only counts at the end of the full turn)
  events.push(...processCheckpoints(robots, checkpoints, true));
  events.push(...processRepair(robots, board));

  // NOTE: Respawn is NOT handled here. Dead robots are out for the rest of the
  // round and respawn during the cleanup phase in GameInstance.

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
  }));
}

/** Execute a register broken into granular sub-steps with robot snapshots after each */
export function executeRegisterSteps(registerIndex, playerCards, robots, board, checkpoints) {
  const steps = [];

  // Sort cards by priority (highest first)
  const entries = [...playerCards.entries()]
    .map(([playerId, card]) => ({
      playerId,
      card,
      robot: robots.find((r) => r.playerId === playerId),
    }))
    .filter((e) => e.robot && isAlive(e.robot))
    .sort((a, b) => b.card.priority - a.card.priority);

  // Execute each player's card individually
  for (const entry of entries) {
    const events = executeCard(entry.card, entry.robot, robots, board);
    if (events.length > 0) {
      const label = CARD_TYPE_LABELS[entry.card.type] ?? entry.card.type;
      steps.push({
        label: `${label} (P:${entry.card.priority})`,
        events,
        robotsAfter: snapshotRobots(robots),
      });
    }
  }

  // Express conveyors
  const ecEvents = processExpressConveyors(robots, board);
  if (ecEvents.length > 0) {
    steps.push({ label: 'Express Conveyors', events: ecEvents, robotsAfter: snapshotRobots(robots) });
  }

  // All conveyors
  const acEvents = processAllConveyors(robots, board);
  if (acEvents.length > 0) {
    steps.push({ label: 'All Conveyors', events: acEvents, robotsAfter: snapshotRobots(robots) });
  }

  // Gears
  const gearEvents = processGears(robots, board);
  if (gearEvents.length > 0) {
    steps.push({ label: 'Gears', events: gearEvents, robotsAfter: snapshotRobots(robots) });
  }

  // Intermediate checkpoints (after board elements, excludes the final flag —
  // the final flag only counts at the end of the full turn)
  const cpEvents = processCheckpoints(robots, checkpoints, true);
  if (cpEvents.length > 0) {
    steps.push({ label: 'Checkpoints', events: cpEvents, robotsAfter: snapshotRobots(robots) });
  }

  // Repair
  const repairEvents = processRepair(robots, board);
  if (repairEvents.length > 0) {
    steps.push({ label: 'Repair', events: repairEvents, robotsAfter: snapshotRobots(robots) });
  }

  // NOTE: Respawn is NOT handled here. Dead robots are out for the rest of the
  // round and respawn during the cleanup phase in GameInstance.

  return steps;
}

/** Check if any robot has reached all checkpoints */
export function checkWinCondition(robots, totalCheckpoints) {
  for (const robot of robots) {
    if (robot.checkpoint >= totalCheckpoints) {
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
