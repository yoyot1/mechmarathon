/**
 * Path-based tile renderer.
 *
 * Draws tiles from SVG path data extracted by scripts/extract-svg-paths.js.
 * Each tile is rendered as PixiJS Graphics using GraphicsPath for `d` strings,
 * scaled to fit the current tile size.
 */
import { Graphics, GraphicsPath, FillGradient } from 'pixi.js';
import { TILE_PATHS } from '../tile-paths.js';
import { DIRECTION_RADIANS } from '../constants.js';

/**
 * Draw all paths from a tile path definition onto a PixiJS container.
 *
 * @param {import('pixi.js').Container} container - parent container
 * @param {object} pathDef - { viewBox: { width, height }, paths: [...] }
 * @param {number} px - tile top-left x in pixels
 * @param {number} py - tile top-left y in pixels
 * @param {number} tileSize - tile width/height in pixels
 * @param {number} [rotation=0] - rotation in radians (around tile center)
 */
export function drawTilePaths(container, pathDef, px, py, tileSize, rotation) {
  const g = new Graphics();

  const vw = pathDef.viewBox.width;
  const vh = pathDef.viewBox.height;
  const scale = tileSize / Math.max(vw, vh);

  // Position at tile location, apply scale
  g.position.set(px, py);
  g.scale.set(scale, scale);

  // Apply rotation around the tile center (in viewBox coordinates)
  if (rotation) {
    g.pivot.set(vw / 2, vh / 2);
    g.position.set(px + tileSize / 2, py + tileSize / 2);
    g.rotation = rotation;
  }

  drawPathEntries(g, pathDef);

  container.addChild(g);
  return g;
}

/**
 * Draw tile paths with horizontal mirroring (flip across X axis), then rotate.
 * Used for conveyor curves that need the opposite chirality.
 *
 * Mirroring is applied via negative X scale on the Graphics container.
 * The rotation is applied on top of the mirror so the final orientation is correct.
 */
export function drawTilePathsMirrored(container, pathDef, px, py, tileSize, rotation) {
  const g = new Graphics();

  const vw = pathDef.viewBox.width;
  const vh = pathDef.viewBox.height;
  const scale = tileSize / Math.max(vw, vh);

  // Mirror horizontally: negative X scale, pivot at center, then rotate
  g.pivot.set(vw / 2, vh / 2);
  g.position.set(px + tileSize / 2, py + tileSize / 2);
  g.scale.set(-scale, scale); // negative X = horizontal mirror
  g.rotation = rotation || 0;

  drawPathEntries(g, pathDef);

  container.addChild(g);
  return g;
}

/**
 * Render all path entries onto a Graphics object.
 * The viewBox is mapped to [0,0]-[CANVAS_SIZE,CANVAS_SIZE] space via the
 * extraction script, so path coordinates are used directly.
 */
function drawPathEntries(g, pathDef) {
  for (const path of pathDef.paths) {
    const useEvenodd = path.fillRule === 'evenodd';
    const gp = new GraphicsPath(path.d, useEvenodd);
    g.path(gp);
    applyFillAndStroke(g, path, pathDef.viewBox);
  }
}

/**
 * Apply fill and stroke from a path entry to a Graphics object.
 */
function applyFillAndStroke(g, path, viewBox) {
  if (path.fill === 'none') {
    // No fill — but we still need to close the path instruction
  } else if (path.fill && typeof path.fill === 'object') {
    const gradFill = createGradientFill(path.fill, viewBox);
    if (gradFill) g.fill(gradFill);
  } else if (path.fill) {
    const fillOpts = { color: path.fill };
    if (path.fillOpacity !== undefined) fillOpts.alpha = path.fillOpacity;
    if (path.opacity !== undefined) fillOpts.alpha = (fillOpts.alpha ?? 1) * path.opacity;
    g.fill(fillOpts);
  } else {
    const fillOpts = { color: '#000000' };
    if (path.fillOpacity !== undefined) fillOpts.alpha = path.fillOpacity;
    if (path.opacity !== undefined) fillOpts.alpha = (fillOpts.alpha ?? 1) * path.opacity;
    g.fill(fillOpts);
  }

  if (path.stroke) {
    const strokeOpts = { color: path.stroke, width: path.strokeWidth ?? 1 };
    if (path.opacity !== undefined) strokeOpts.alpha = path.opacity;
    g.stroke(strokeOpts);
  }
}

/**
 * Create a PixiJS FillGradient from a gradient descriptor.
 */
function createGradientFill(grad, viewBox) {
  if (grad.type === 'linear') {
    const fg = new FillGradient({
      type: 'linear',
      start: { x: grad.x0, y: grad.y0 },
      end: { x: grad.x1, y: grad.y1 },
      colorStops: grad.stops.map(s => ({ offset: s.offset, color: s.color })),
    });
    return fg;
  }
  // For unsupported gradient types, fall back to first stop color
  if (grad.stops?.length > 0) {
    return { color: grad.stops[0].color };
  }
  return null;
}

/**
 * Create a renderer function for a path-based tile type.
 *
 * @param {string} tileType - key in TILE_PATHS (e.g. 'gear_cw')
 * @param {object} [options]
 * @param {boolean} [options.directional=false] - if true, rotates based on tile.direction
 * @returns {Function|null} - renderer function or null if no path data exists
 */
export function createPathRenderer(tileType, options = {}) {
  const pathDef = TILE_PATHS[tileType];
  if (!pathDef) return null;

  return (container, tile, px, py, tileSize) => {
    const rotation = options.directional
      ? (DIRECTION_RADIANS[tile.direction] ?? 0)
      : 0;
    drawTilePaths(container, pathDef, px, py, tileSize, rotation);
  };
}
