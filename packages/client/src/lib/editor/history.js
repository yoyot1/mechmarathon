/**
 * Snapshot-based undo/redo history for the board editor.
 *
 * Stores deep clones of the 12x12 tiles array. At 144 tiles this is
 * cheap to clone, so we use full snapshots rather than diffs.
 *
 * API:
 *   push(tiles)   — save a snapshot (before a mutation)
 *   undo()        — return previous snapshot or null
 *   redo()        — return next snapshot or null
 *   canUndo()     — boolean
 *   canRedo()     — boolean
 *   clear()       — reset all history
 */

const MAX_DEPTH = 50;

let undoStack = [];
let redoStack = [];

function cloneTiles(tiles) {
  return tiles.map((row) =>
    row.map((tile) => {
      const copy = { ...tile };
      if (tile.walls) copy.walls = [...tile.walls];
      if (tile.entry) copy.entry = [...tile.entry];
      if (tile.phases) copy.phases = [...tile.phases];
      if (tile.oneWayWalls) copy.oneWayWalls = tile.oneWayWalls.map((ow) => ({ ...ow }));
      if (tile.sideFeatures) copy.sideFeatures = tile.sideFeatures.map((f) => {
        const fc = { ...f };
        if (f.phases) fc.phases = [...f.phases];
        return fc;
      });
      if (tile.overlays) copy.overlays = tile.overlays.map((o) => {
        const oc = { ...o };
        if (o.phases) oc.phases = [...o.phases];
        return oc;
      });
      return copy;
    }),
  );
}

/** Save a snapshot before a mutation. Clears the redo stack. */
export function push(tiles) {
  undoStack.push(cloneTiles(tiles));
  if (undoStack.length > MAX_DEPTH) undoStack.shift();
  redoStack = [];
}

/**
 * Undo: pops the last snapshot and returns it.
 * The caller must pass the *current* tiles so they can be saved to the redo stack.
 * Returns the restored tiles array, or null if nothing to undo.
 */
export function undo(currentTiles) {
  if (undoStack.length === 0) return null;
  redoStack.push(cloneTiles(currentTiles));
  return undoStack.pop();
}

/**
 * Redo: pops the next snapshot from the redo stack.
 * The caller must pass the *current* tiles so they can be saved to the undo stack.
 * Returns the restored tiles array, or null if nothing to redo.
 */
export function redo(currentTiles) {
  if (redoStack.length === 0) return null;
  undoStack.push(cloneTiles(currentTiles));
  return redoStack.pop();
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export function clear() {
  undoStack = [];
  redoStack = [];
}
