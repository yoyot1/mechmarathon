/**
 * Conveyor tile renderer — simple and enhanced modes.
 * Covers both 'conveyor' and 'express_conveyor' types.
 * Supports straight, curve (90°), and T-merge (two 90° entries) conveyors.
 *
 * Visual style based on RoboRally Factory Floor tiles:
 *   Regular: black bg, single arrow with yellow stroke + dark fill, sprocket rails
 *   Express: black bg, double arrows with blue stroke + dark fill, sprocket rails
 */
import { Graphics } from 'pixi.js';
import { registerRenderer } from './index.js';
// --- Colors ---
const CONVEYOR_STROKE = 0xc8a832;
const CONVEYOR_FILL = 0x1a3a1a;
const CONVEYOR_RAIL = 0x555555;
const CONVEYOR_NOTCH = 0xccbb88;

const EXPRESS_STROKE = 0x88bbdd;
const EXPRESS_FILL = 0x2a3a5a;
const EXPRESS_RAIL = 0x555555;
const EXPRESS_NOTCH = 0x8899aa;

const PI = Math.PI;

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const ROTATIONS = { north: 0, east: PI / 2, south: PI, west: -PI / 2 };
const DIR_VEC = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };

// --- Tile classification ---

function classifyConveyor(tile) {
  const curveEntries = getCurveEntries(tile);
  const straight = hasStraightEntry(tile);
  if (curveEntries.length === 0) return 'straight';
  if (curveEntries.length === 1 && !straight) return 'curve';
  return 'merge'; // any combination of curves (±straight)
}

/** Return entry directions that are 90° from exit (not opposite). */
function getCurveEntries(tile) {
  if (!tile.entry || !Array.isArray(tile.entry) || !tile.direction) return [];
  return tile.entry.filter(e => e !== OPPOSITE[tile.direction]);
}

/** Check if opposite-to-exit direction is present (straight-through component). */
function hasStraightEntry(tile) {
  if (!tile.entry || !Array.isArray(tile.entry) || !tile.direction) return false;
  return tile.entry.includes(OPPOSITE[tile.direction]);
}

// --- Curve path (bezier-based squircle) ---
// Straight at entry/exit edges, tight bend in the middle.
// Four curves together form a squircle, not a circle.

const CURVE_K = 0.62; // control point depth: higher = straighter edges, tighter bend

function getEdgeMid(dir) {
  switch (dir) {
    case 'north': return { x: 0.5, y: 0 };
    case 'south': return { x: 0.5, y: 1 };
    case 'east': return { x: 1, y: 0.5 };
    case 'west': return { x: 0, y: 0.5 };
  }
}

function getCurvePath(entry, exit, tileSize) {
  const em = getEdgeMid(entry), xm = getEdgeMid(exit);
  const ei = DIR_VEC[OPPOSITE[entry]], xi = DIR_VEC[OPPOSITE[exit]];
  const k = CURVE_K;

  const p0 = { x: em.x * tileSize, y: em.y * tileSize };
  const p1 = { x: (em.x + ei.x * k) * tileSize, y: (em.y + ei.y * k) * tileSize };
  const p2 = { x: (xm.x + xi.x * k) * tileSize, y: (xm.y + xi.y * k) * tileSize };
  const p3 = { x: xm.x * tileSize, y: xm.y * tileSize };

  // Normal sign: ensure normals always point away from corner
  const cornerX = ((entry === 'east' || exit === 'east') ? 1 : 0) * tileSize;
  const cornerY = ((entry === 'south' || exit === 'south') ? 1 : 0) * tileSize;
  const t0 = bTan(0, p0, p1, p2, p3);
  const len = Math.hypot(t0.x, t0.y) || 1;
  const rn = { x: t0.y / len, y: -t0.x / len };
  const ns = (rn.x * (cornerX - p0.x) + rn.y * (cornerY - p0.y) > 0) ? -1 : 1;

  return { p0, p1, p2, p3, ns };
}

/** Small bezier path for the inner rail near the corner. */
function getInnerRailPath(entry, exit, tileSize, railW) {
  const entryMid = getEdgeMid(entry), exitMid = getEdgeMid(exit);
  const ei = DIR_VEC[OPPOSITE[entry]], xi = DIR_VEC[OPPOSITE[exit]];
  const half = tileSize / 2;
  const shift = half - railW / 2; // distance from edge midpoint toward corner

  // Direction along each edge toward the corner
  const cornerX = ((entry === 'east' || exit === 'east') ? 1 : 0) * tileSize;
  const cornerY = ((entry === 'south' || exit === 'south') ? 1 : 0) * tileSize;
  const toCornerEntry = {
    x: cornerX - entryMid.x * tileSize,
    y: cornerY - entryMid.y * tileSize,
  };
  const ceLen = Math.hypot(toCornerEntry.x, toCornerEntry.y) || 1;
  const toCornerExit = {
    x: cornerX - exitMid.x * tileSize,
    y: cornerY - exitMid.y * tileSize,
  };
  const cxLen = Math.hypot(toCornerExit.x, toCornerExit.y) || 1;

  // Start/end on entry/exit edges, shifted toward corner
  const p0 = {
    x: entryMid.x * tileSize + (toCornerEntry.x / ceLen) * shift,
    y: entryMid.y * tileSize + (toCornerEntry.y / ceLen) * shift,
  };
  const p3 = {
    x: exitMid.x * tileSize + (toCornerExit.x / cxLen) * shift,
    y: exitMid.y * tileSize + (toCornerExit.y / cxLen) * shift,
  };

  // Control points: push into tile from each endpoint
  const depth = railW * CURVE_K;
  const p1 = { x: p0.x + ei.x * depth, y: p0.y + ei.y * depth };
  const p2 = { x: p3.x + xi.x * depth, y: p3.y + xi.y * depth };

  // Normal sign: ensure normals point away from corner
  const t0 = bTan(0, p0, p1, p2, p3);
  const len = Math.hypot(t0.x, t0.y) || 1;
  const rn = { x: t0.y / len, y: -t0.x / len };
  const ns = (rn.x * (cornerX - p0.x) + rn.y * (cornerY - p0.y) > 0) ? -1 : 1;

  return { p0, p1, p2, p3, ns };
}

// --- Bezier math ---

function bPt(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function bTan(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

function pNorm(t, path) {
  const tan = bTan(t, path.p0, path.p1, path.p2, path.p3);
  const len = Math.hypot(tan.x, tan.y) || 1;
  return { x: path.ns * tan.y / len, y: path.ns * -tan.x / len };
}

function pPt(t, path) {
  return bPt(t, path.p0, path.p1, path.p2, path.p3);
}

// --- Bezier drawing helpers ---

/** Draw a filled band along a bezier path between two normal offsets.
 *  tMin/tMax optionally restrict to a sub-range of the curve (default 0–1). */
function drawBezierBand(g, px, py, path, offA, offB, segs, color, tMin, tMax) {
  const t0 = tMin ?? 0, t1 = tMax ?? 1;
  const fwd = [];
  for (let i = 0; i <= segs; i++) {
    const t = t0 + (t1 - t0) * i / segs, pt = pPt(t, path), n = pNorm(t, path);
    fwd.push({ x: px + pt.x + n.x * offB, y: py + pt.y + n.y * offB });
  }
  g.moveTo(fwd[0].x, fwd[0].y);
  for (let i = 1; i < fwd.length; i++) g.lineTo(fwd[i].x, fwd[i].y);
  for (let i = segs; i >= 0; i--) {
    const t = t0 + (t1 - t0) * i / segs, pt = pPt(t, path), n = pNorm(t, path);
    g.lineTo(px + pt.x + n.x * offA, py + pt.y + n.y * offA);
  }
  g.closePath().fill(color);
}

/** Draw notch rectangles along a bezier path at a given normal offset.
 *  tMin/tMax optionally restrict to a sub-range of the curve (default 0–1). */
function drawBezierNotches(g, px, py, path, offset, notchLen, notchW, count, color, tMin, tMax) {
  const t0 = tMin ?? 0, t1 = tMax ?? 1;
  for (let i = 0; i < count; i++) {
    const t = t0 + (t1 - t0) * (i + 0.5) / count;
    const pt = pPt(t, path), n = pNorm(t, path);
    const tan = bTan(t, path.p0, path.p1, path.p2, path.p3);
    const tl = Math.hypot(tan.x, tan.y) || 1;
    const tx = tan.x / tl, ty = tan.y / tl;
    const cx = px + pt.x + n.x * offset, cy = py + pt.y + n.y * offset;
    const hw = notchLen / 2, hl = notchW / 2; // hw along belt (thin), hl across rail (wide)
    g.moveTo(cx + tx * hw - n.x * hl, cy + ty * hw - n.y * hl);
    g.lineTo(cx - tx * hw - n.x * hl, cy - ty * hw - n.y * hl);
    g.lineTo(cx - tx * hw + n.x * hl, cy - ty * hw + n.y * hl);
    g.lineTo(cx + tx * hw + n.x * hl, cy + ty * hw + n.y * hl);
    g.closePath().fill(color);
  }
}

/** Approximate path length at a given normal offset. */
function approxLen(path, offset, segs) {
  let len = 0;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const a = pPt(t0, path), na = pNorm(t0, path);
    const b = pPt(t1, path), nb = pNorm(t1, path);
    len += Math.hypot(
      (b.x + nb.x * offset) - (a.x + na.x * offset),
      (b.y + nb.y * offset) - (a.y + na.y * offset));
  }
  return len;
}

// --- Straight drawing helpers ---

function drawSprocketRails(g, px, py, tileSize, direction, railColor, notchColor) {
  const railW = Math.max(3, tileSize * 0.16);
  const notchLen = Math.max(2, tileSize * 0.08);
  const notchSpacing = Math.max(4, tileSize * 0.16);
  const notchW = railW * 1.0;
  const isVertical = direction === 'north' || direction === 'south';

  if (isVertical) {
    g.rect(px, py, railW, tileSize).fill(railColor);
    g.rect(px + tileSize - railW, py, railW, tileSize).fill(railColor);
    const notchX1 = px + (railW - notchW) / 2;
    const notchX2 = px + tileSize - railW + (railW - notchW) / 2;
    for (let y = notchSpacing / 2; y < tileSize; y += notchSpacing) {
      g.rect(notchX1, py + y - notchLen / 2, notchW, notchLen).fill(notchColor);
      g.rect(notchX2, py + y - notchLen / 2, notchW, notchLen).fill(notchColor);
    }
  } else {
    g.rect(px, py, tileSize, railW).fill(railColor);
    g.rect(px, py + tileSize - railW, tileSize, railW).fill(railColor);
    const notchY1 = py + (railW - notchW) / 2;
    const notchY2 = py + tileSize - railW + (railW - notchW) / 2;
    for (let x = notchSpacing / 2; x < tileSize; x += notchSpacing) {
      g.rect(px + x - notchLen / 2, notchY1, notchLen, notchW).fill(notchColor);
      g.rect(px + x - notchLen / 2, notchY2, notchLen, notchW).fill(notchColor);
    }
  }
}

function drawStrokedArrow(g, cx, cy, direction, size, strokeColor, fillColor) {
  const rot = ROTATIONS[direction] ?? 0;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const r = (px, py) => ({ x: cx + px * cos - py * sin, y: cy + px * sin + py * cos });

  const headW = size * 0.44;
  const headLen = size * 0.30;
  const shaftW = size * 0.16;
  const totalLen = size * 0.50;

  const pts = [
    r(-shaftW, totalLen),
    r(-shaftW, totalLen - headLen * 1.4),
    r(-headW, totalLen - headLen * 1.4),
    r(0, -totalLen),
    r(headW, totalLen - headLen * 1.4),
    r(shaftW, totalLen - headLen * 1.4),
    r(shaftW, totalLen),
  ];

  g.setStrokeStyle({ width: 2, color: strokeColor });
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath().fill({ color: fillColor }).stroke();
}

function drawDoubleArrows(g, cx, cy, direction, size, strokeColor, fillColor) {
  const gap = size * 0.22;
  const arrowSize = size * 0.7;
  const rot = ROTATIONS[direction] ?? 0;
  const perpX = -Math.sin(rot), perpY = Math.cos(rot);

  drawStrokedArrow(g, cx - gap * perpX, cy - gap * perpY, direction, arrowSize, strokeColor, fillColor);
  drawStrokedArrow(g, cx + gap * perpX, cy + gap * perpY, direction, arrowSize, strokeColor, fillColor);
}

// --- Curved drawing helpers (bezier-based) ---

function drawCurvedRails(g, px, py, tileSize, entry, exit, railColor, notchColor) {
  const path = getCurvePath(entry, exit, tileSize);
  const railW = Math.max(3, tileSize * 0.16);
  const notchLen = Math.max(2, tileSize * 0.08);
  const notchSpacing = Math.max(4, tileSize * 0.16);
  const notchW = railW * 1.0;
  const half = tileSize / 2;
  const segs = 16;

  // Inside rail: small bezier curve near the corner
  const innerPath = getInnerRailPath(entry, exit, tileSize, railW);
  drawBezierBand(g, px, py, innerPath, -railW / 2, railW / 2, segs, railColor);
  drawBezierNotches(g, px, py, innerPath, 0, notchLen, notchW, 1, notchColor);

  // Outside rail (away from corner = positive offset)
  drawBezierBand(g, px, py, path, half - railW, half, segs, railColor);
  const outerOff = half - railW / 2;
  const outerLen = approxLen(path, outerOff, segs);
  const outerCount = Math.max(2, Math.round(outerLen / notchSpacing));
  drawBezierNotches(g, px, py, path, outerOff, notchLen, notchW, outerCount, notchColor);
}

/**
 * Curved arrow as a single unified shape following the bezier path.
 * Proportions match the straight arrow (drawStrokedArrow) for visual consistency.
 * opts.tStart/tEnd override the t-parameter range (0-1, default padded).
 */
function drawCurvedArrow(g, px, py, tileSize, entry, exit, strokeColor, fillColor, opts) {
  const path = getCurvePath(entry, exit, tileSize);
  const padT = 0.15;
  const tStart = opts?.tStart ?? padT;
  const tEnd = opts?.tEnd ?? (1 - padT);

  // Match straight arrow proportions: shaftW=size*0.16, headW=size*0.44, head≈40% of length
  const size = tileSize * 0.6;
  const shaftW = size * 0.16;  // = tileSize * 0.096
  const headW = size * 0.44;   // = tileSize * 0.264
  const range = tEnd - tStart;
  const headT = range * 0.40;  // arrowhead is 40% of total arrow length
  const shaftEndT = tEnd - headT;
  const segs = 20;

  // Sample shaft edges
  const outer = [], inner = [];
  for (let i = 0; i <= segs; i++) {
    const t = tStart + (shaftEndT - tStart) * i / segs;
    const pt = pPt(t, path), n = pNorm(t, path);
    outer.push({ x: px + pt.x + n.x * shaftW, y: py + pt.y + n.y * shaftW });
    inner.push({ x: px + pt.x - n.x * shaftW, y: py + pt.y - n.y * shaftW });
  }

  // Head base and tip
  const hbPt = pPt(shaftEndT, path), hbN = pNorm(shaftEndT, path);
  const tip = pPt(tEnd, path);

  g.setStrokeStyle({ width: 1.5, color: strokeColor });
  g.moveTo(outer[0].x, outer[0].y);
  for (let i = 1; i < outer.length; i++) g.lineTo(outer[i].x, outer[i].y);
  g.lineTo(px + hbPt.x + hbN.x * headW, py + hbPt.y + hbN.y * headW);
  g.lineTo(px + tip.x, py + tip.y);
  g.lineTo(px + hbPt.x - hbN.x * headW, py + hbPt.y - hbN.y * headW);
  for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i].x, inner[i].y);
  g.closePath().fill({ color: fillColor }).stroke();
}

/**
 * Express curved: straight tail arrow near entry + curved head arrow.
 * Uses same arrow size as straight express (drawDoubleArrows: size * 0.7).
 */
function drawExpressCurvedArrows(g, px, py, tileSize, entry, exit, strokeColor, fillColor) {
  const path = getCurvePath(entry, exit, tileSize);

  // Tail: small straight arrow near entry edge, pointing into tile
  // Matches straight express arrow size: tileSize * 0.6 * 0.7 = tileSize * 0.42
  const tailDir = OPPOSITE[entry];
  const dv = DIR_VEC[tailDir];
  const tailPt = pPt(0.15, path);
  drawStrokedArrow(g,
    px + tailPt.x + dv.x * tileSize * 0.06, py + tailPt.y + dv.y * tileSize * 0.06,
    tailDir, tileSize * 0.42, strokeColor, fillColor);

  // Head: curved arrow for the exit portion
  drawCurvedArrow(g, px, py, tileSize, entry, exit, strokeColor, fillColor, {
    tStart: 0.45,
    tEnd: 0.85,
  });
}

// --- Merge drawing helpers ---

/**
 * Draw rails for a merge tile (multiple entries converging to one exit).
 * Instead of drawing independent per-curve rails that overlap, we draw:
 *   1. Shared exit-side outer rails (straight strips along exit edge)
 *   2. Per-curve entry-side outer rails (curved portions only, stopping at center)
 *   3. Per-curve inner rails near each corner
 *   4. Straight-through rails from opposite edge (if present)
 */
function drawMergeRails(g, px, py, tileSize, exitDir, curveEntries, hasStraight, railColor, notchColor) {
  const railW = Math.max(3, tileSize * 0.16);
  const notchLen = Math.max(2, tileSize * 0.08);
  const notchSpacing = Math.max(4, tileSize * 0.16);
  const notchW = railW * 1.0;
  const half = tileSize / 2;
  const segs = 16;
  const isVertical = exitDir === 'north' || exitDir === 'south';

  // 1. Exit-side outer rails: full straight strips along exit edge
  //    These cover the shared "trunk" where all paths converge
  if (isVertical) {
    const yStart = exitDir === 'north' ? py : py + half;
    g.rect(px, yStart, railW, half).fill(railColor);
    g.rect(px + tileSize - railW, yStart, railW, half).fill(railColor);
    const notchX1 = px + (railW - notchW) / 2;
    const notchX2 = px + tileSize - railW + (railW - notchW) / 2;
    for (let y = notchSpacing / 2; y < half; y += notchSpacing) {
      g.rect(notchX1, yStart + y - notchLen / 2, notchW, notchLen).fill(notchColor);
      g.rect(notchX2, yStart + y - notchLen / 2, notchW, notchLen).fill(notchColor);
    }
  } else {
    const xStart = exitDir === 'west' ? px : px + half;
    g.rect(xStart, py, half, railW).fill(railColor);
    g.rect(xStart, py + tileSize - railW, half, railW).fill(railColor);
    const notchY1 = py + (railW - notchW) / 2;
    const notchY2 = py + tileSize - railW + (railW - notchW) / 2;
    for (let x = notchSpacing / 2; x < half; x += notchSpacing) {
      g.rect(xStart + x - notchLen / 2, notchY1, notchLen, notchW).fill(notchColor);
      g.rect(xStart + x - notchLen / 2, notchY2, notchLen, notchW).fill(notchColor);
    }
  }

  // 2. Per-curve entry: entry-side outer rail + inner rail + notches
  for (const entry of curveEntries) {
    const path = getCurvePath(entry, exitDir, tileSize);

    // Entry-side outer rail: draw from t=0 (entry edge) to t=0.5 (roughly center)
    // This avoids the exit-side overlap — the straight exit rails cover that half
    drawBezierBand(g, px, py, path, half - railW, half, segs, railColor, 0, 0.5);

    // Outer rail notches on entry half
    const outerOff = half - railW / 2;
    const outerLen = approxLen(path, outerOff, segs) / 2;
    const outerCount = Math.max(1, Math.round(outerLen / notchSpacing));
    drawBezierNotches(g, px, py, path, outerOff, notchLen, notchW, outerCount, notchColor, 0, 0.5);

    // Inner rail near corner
    const innerPath = getInnerRailPath(entry, exitDir, tileSize, railW);
    drawBezierBand(g, px, py, innerPath, -railW / 2, railW / 2, segs, railColor);
    drawBezierNotches(g, px, py, innerPath, 0, notchLen, notchW, 1, notchColor);
  }

  // 3. Straight-through entry: rails from opposite edge to center
  if (hasStraight) {
    if (isVertical) {
      const yStart = exitDir === 'north' ? py + half : py;
      g.rect(px, yStart, railW, half).fill(railColor);
      g.rect(px + tileSize - railW, yStart, railW, half).fill(railColor);
      const notchX1 = px + (railW - notchW) / 2;
      const notchX2 = px + tileSize - railW + (railW - notchW) / 2;
      for (let y = notchSpacing / 2; y < half; y += notchSpacing) {
        g.rect(notchX1, yStart + y - notchLen / 2, notchW, notchLen).fill(notchColor);
        g.rect(notchX2, yStart + y - notchLen / 2, notchW, notchLen).fill(notchColor);
      }
    } else {
      const xStart = exitDir === 'west' ? px + half : px;
      g.rect(xStart, py, half, railW).fill(railColor);
      g.rect(xStart, py + tileSize - railW, half, railW).fill(railColor);
      const notchY1 = py + (railW - notchW) / 2;
      const notchY2 = py + tileSize - railW + (railW - notchW) / 2;
      for (let x = notchSpacing / 2; x < half; x += notchSpacing) {
        g.rect(xStart + x - notchLen / 2, notchY1, notchLen, notchW).fill(notchColor);
        g.rect(xStart + x - notchLen / 2, notchY2, notchLen, notchW).fill(notchColor);
      }
    }
  }
}

// --- Renderers ---

function renderConveyor(container, tile, px, py, tileSize) {
  const g = new Graphics();

  const type = classifyConveyor(tile);
  const dir = tile.direction || 'north';

  if (type === 'straight') {
    drawSprocketRails(g, px, py, tileSize, dir, CONVEYOR_RAIL, CONVEYOR_NOTCH);
    if (tile.direction) {
      drawStrokedArrow(g, px + tileSize / 2, py + tileSize / 2,
        dir, tileSize * 0.6, CONVEYOR_STROKE, CONVEYOR_FILL);
    }
  } else if (type === 'curve') {
    const entries = getCurveEntries(tile);
    drawCurvedRails(g, px, py, tileSize, entries[0], dir, CONVEYOR_RAIL, CONVEYOR_NOTCH);
    drawCurvedArrow(g, px, py, tileSize, entries[0], dir, CONVEYOR_STROKE, CONVEYOR_FILL);
  } else {
    // merge: composite rails + per-entry arrows
    const curveEntries = getCurveEntries(tile);
    const straight = hasStraightEntry(tile);
    drawMergeRails(g, px, py, tileSize, dir, curveEntries, straight, CONVEYOR_RAIL, CONVEYOR_NOTCH);
    for (const entry of curveEntries) {
      drawCurvedArrow(g, px, py, tileSize, entry, dir, CONVEYOR_STROKE, CONVEYOR_FILL);
    }
    if (straight) {
      // Offset the straight arrow slightly toward opposite edge to avoid overlapping curve arrows
      const dv = DIR_VEC[OPPOSITE[dir]];
      const offset = tileSize * 0.08;
      drawStrokedArrow(g,
        px + tileSize / 2 + dv.x * offset, py + tileSize / 2 + dv.y * offset,
        dir, tileSize * 0.5, CONVEYOR_STROKE, CONVEYOR_FILL);
    }
  }

  container.addChild(g);
}

function renderExpress(container, tile, px, py, tileSize) {
  const g = new Graphics();

  const type = classifyConveyor(tile);
  const dir = tile.direction || 'north';

  if (type === 'straight') {
    drawSprocketRails(g, px, py, tileSize, dir, EXPRESS_RAIL, EXPRESS_NOTCH);
    if (tile.direction) {
      drawDoubleArrows(g, px + tileSize / 2, py + tileSize / 2,
        dir, tileSize * 0.6, EXPRESS_STROKE, EXPRESS_FILL);
    }
  } else if (type === 'curve') {
    const entries = getCurveEntries(tile);
    drawCurvedRails(g, px, py, tileSize, entries[0], dir, EXPRESS_RAIL, EXPRESS_NOTCH);
    drawExpressCurvedArrows(g, px, py, tileSize, entries[0], dir, EXPRESS_STROKE, EXPRESS_FILL);
  } else {
    // merge: composite rails + per-entry arrows
    const curveEntries = getCurveEntries(tile);
    const straight = hasStraightEntry(tile);
    drawMergeRails(g, px, py, tileSize, dir, curveEntries, straight, EXPRESS_RAIL, EXPRESS_NOTCH);
    for (const entry of curveEntries) {
      drawExpressCurvedArrows(g, px, py, tileSize, entry, dir, EXPRESS_STROKE, EXPRESS_FILL);
    }
    if (straight) {
      const dv = DIR_VEC[OPPOSITE[dir]];
      const offset = tileSize * 0.08;
      drawDoubleArrows(g,
        px + tileSize / 2 + dv.x * offset, py + tileSize / 2 + dv.y * offset,
        dir, tileSize * 0.5, EXPRESS_STROKE, EXPRESS_FILL);
    }
  }

  container.addChild(g);
}

registerRenderer('conveyor', renderConveyor);
registerRenderer('express_conveyor', renderExpress);
