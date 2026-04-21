/**
 * Smart conveyor drawing module.
 * Tracks drag paths and auto-infers direction, curves, and merges.
 * Pure logic — no PixiJS dependency.
 */

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

const DELTA_TO_DIR = {
  '0,-1': 'north',
  '0,1': 'south',
  '1,0': 'east',
  '-1,0': 'west',
};

let active = false;
let path = [];       // [{x, y, entryDir, exitDir}]
let toolType = null;  // 'conveyor' or 'express_conveyor'
let stopped = false;
let visited = null;   // Set of 'x,y' strings

export function start(x, y, type, tiles) {
  active = true;
  stopped = false;
  toolType = type;
  // Capture existing entry info if starting on a same-type conveyor
  const existing = tiles?.[y]?.[x];
  const isExistingConveyor = existing?.type === type;
  // preserveEntry: undefined = not applicable (fresh tile), array = entries to keep from existing
  // When existing conveyor has no explicit entry, the implicit entry is OPPOSITE[direction]
  let preserveEntry;
  if (isExistingConveyor) {
    preserveEntry = existing.entry ? [...existing.entry] : [OPPOSITE[existing.direction]];
  }
  path = [{ x, y, entryDir: null, exitDir: null, preserveEntry }];
  visited = new Set([`${x},${y}`]);
}

export function isActive() {
  return active;
}

export function extend(x, y, tiles, boardSize) {
  if (!active || stopped) return { applied: false };

  const last = path[path.length - 1];
  const dx = x - last.x;
  const dy = y - last.y;
  const dirKey = `${dx},${dy}`;
  const moveDir = DELTA_TO_DIR[dirKey];

  // Must be exactly 1 cardinal step
  if (!moveDir) return { applied: false };

  // Self-intersection: closing loop back to start, or merging into any earlier path cell
  // that has already been rendered (has exitDir). 2-cell paths are too short to merge.
  const isStartCell = path.length > 2 && x === path[0].x && y === path[0].y;
  if (visited.has(`${x},${y}`)) {
    if (path.length <= 2) return { applied: false };
    const pathCell = path.find((c) => c.x === x && c.y === y);
    if (!pathCell || !pathCell.exitDir) return { applied: false };
    // Fall through — the merge branch below will treat this as a same-type merge target.
  }

  // Wall checks: exit wall on current cell, entry wall on target cell
  const currentTile = tiles[last.y]?.[last.x];
  if (currentTile && hasExitWall(currentTile, moveDir)) {
    stopPath(moveDir);
    return { applied: true, cells: applyPath(tiles) };
  }

  // Check bounds
  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) {
    stopPath(moveDir);
    return { applied: true, cells: applyPath(tiles) };
  }

  const targetTile = tiles[y]?.[x];
  if (targetTile && hasEntryWall(targetTile, moveDir)) {
    stopPath(moveDir);
    return { applied: true, cells: applyPath(tiles) };
  }

  // Set exitDir on current path cell
  last.exitDir = moveDir;

  // Set entryDir on current cell (except first cell which has no entry)
  // Actually entryDir is already set from when this cell was added

  // Check target tile type
  if (targetTile) {
    const targetType = targetTile.type;

    if (targetType === toolType) {
      // Same conveyor type — attempt merge
      const newEntryDir = OPPOSITE[moveDir]; // entering from opposite of movement direction
      if (canMerge(targetTile, newEntryDir)) {
        // Record the merge entry where it will survive finalization. Three cases:
        //   - Loop closure into path[0]: append to its preserveEntry.
        //   - Intra-path merge into any other path cell: append to that cell's mergeEntries.
        //   - External conveyor (not in path): mutate tiles directly via doMerge.
        if (isStartCell) {
          const startCell = path[0];
          if (startCell.preserveEntry) {
            if (!startCell.preserveEntry.includes(newEntryDir)) {
              startCell.preserveEntry.push(newEntryDir);
            }
          } else {
            startCell.preserveEntry = [newEntryDir];
          }
        } else {
          const pathCell = path.find((c) => c.x === x && c.y === y);
          if (pathCell) {
            pathCell.mergeEntries = pathCell.mergeEntries || [];
            if (!pathCell.mergeEntries.includes(newEntryDir)) {
              pathCell.mergeEntries.push(newEntryDir);
            }
          } else {
            doMerge(tiles, x, y, newEntryDir);
          }
        }
        stopped = true;
        const cells = applyPath(tiles);
        // External merge also mutated the target tile directly — include it so the editor re-renders.
        if (!isStartCell && !path.some((c) => c.x === x && c.y === y)) cells.push({ x, y });
        return { applied: true, cells };
      } else {
        // Can't merge — stop, last cell exits toward blocked cell
        stopPath(moveDir);
        return { applied: true, cells: applyPath(tiles) };
      }
    } else if (targetType !== 'floor') {
      // Non-floor, non-same-conveyor — stop
      stopPath(moveDir);
      return { applied: true, cells: applyPath(tiles) };
    }
  }

  // Floor tile — extend path
  const entryDir = OPPOSITE[moveDir];
  path.push({ x, y, entryDir, exitDir: null });
  visited.add(`${x},${y}`);
  return { applied: true, cells: applyPath(tiles) };
}

export function finish(tiles, selectedDirection) {
  if (!active) return null;

  if (path.length === 1 && !stopped) {
    const pos = path[0];
    cancel();
    return { singleClick: true, pos };
  }

  // Finalize: last cell's exitDir = opposite of its entryDir (continues straight)
  const last = path[path.length - 1];
  if (!last.exitDir && last.entryDir) {
    last.exitDir = OPPOSITE[last.entryDir];
  }

  const cells = applyPath(tiles);
  const result = { applied: true, cells };
  cancel();
  return result;
}

export function cancel() {
  active = false;
  path = [];
  toolType = null;
  stopped = false;
  visited = null;
}

// --- Internal helpers ---

function stopPath(moveDir) {
  // Last cell exits toward the blocked cell
  const last = path[path.length - 1];
  last.exitDir = moveDir;
  stopped = true;
}

function applyPath(tiles) {
  const affected = [];
  for (const cell of path) {
    if (!cell.exitDir) continue; // Not finalized yet (e.g. single cell mid-drag)

    const existing = tiles[cell.y][cell.x];
    const newTile = { type: toolType, direction: cell.exitDir };

    // Build entry list from three sources:
    //   - preserveEntry (start cell: pre-existing entries and/or loop-closure entry)
    //   - entryDir       (non-first cells: the curve/straight entry from path traversal)
    //   - mergeEntries  (intra-path merges from later parts of the same gesture)
    const entries = [];
    if (cell.preserveEntry !== undefined) {
      entries.push(...cell.preserveEntry);
    } else if (cell.entryDir) {
      entries.push(cell.entryDir);
    }
    const hasMerge = cell.mergeEntries?.length > 0;
    if (hasMerge) entries.push(...cell.mergeEntries);

    // Dedupe and drop entries equal to the exit direction.
    const deduped = [];
    for (const e of entries) {
      if (e === cell.exitDir) continue;
      if (!deduped.includes(e)) deduped.push(e);
    }

    // When the cell is being merged into, keep implicit-straight explicit (matches doMerge
    // for external conveyors). Otherwise drop it — a plain straight/curve cell doesn't
    // need the implicit entry listed.
    const implicit = OPPOSITE[cell.exitDir];
    const final = hasMerge ? deduped : deduped.filter((e) => e !== implicit);
    if (final.length > 0) newTile.entry = final;

    // Preserve walls, sideFeatures, overlays, oneWayWalls from existing tile
    if (existing.walls?.length > 0) newTile.walls = existing.walls;
    if (existing.sideFeatures?.length > 0) newTile.sideFeatures = existing.sideFeatures;
    if (existing.overlays?.length > 0) newTile.overlays = existing.overlays;
    if (existing.oneWayWalls?.length > 0) newTile.oneWayWalls = existing.oneWayWalls;
    if (existing.elevation > 0) newTile.elevation = existing.elevation;

    tiles[cell.y][cell.x] = newTile;
    affected.push({ x: cell.x, y: cell.y });
  }
  return affected;
}

function canMerge(tile, newEntryDir) {
  // Can't enter from the exit side
  if (newEntryDir === tile.direction) return false;

  // Check if this entry already exists
  const implicitEntry = OPPOSITE[tile.direction];
  if (newEntryDir === implicitEntry) return false;

  if (tile.entry) {
    if (tile.entry.includes(newEntryDir)) return false;
  }

  return true;
}

function doMerge(tiles, x, y, newEntryDir) {
  const tile = tiles[y][x];
  const entries = tile.entry ? [...tile.entry] : [];

  // If tile had no entry array, the implicit straight entry is OPPOSITE[direction]
  // Make it explicit before adding the new one
  if (entries.length === 0) {
    const implicitEntry = OPPOSITE[tile.direction];
    entries.push(implicitEntry);
  }

  entries.push(newEntryDir);
  tiles[y][x] = { ...tile, entry: entries };
}

function hasExitWall(tile, side) {
  if (tile.walls?.includes(side)) return true;
  if (tile.oneWayWalls) {
    return tile.oneWayWalls.some((ow) => ow.side === side && ow.blocks === 'exit');
  }
  return false;
}

function hasEntryWall(tile, side) {
  // Entry wall on the target tile is on the side we're entering from (opposite of move dir)
  const entrySide = OPPOSITE[side];
  const targetTile = tile;
  if (targetTile.walls?.includes(entrySide)) return true;
  if (targetTile.oneWayWalls) {
    return targetTile.oneWayWalls.some((ow) => ow.side === entrySide && ow.blocks === 'entry');
  }
  return false;
}
