#!/usr/bin/env node
/**
 * SVG Path Extraction Script
 *
 * Reads SVG files from packages/client/src/assets/tiles/,
 * extracts all shape elements as path `d` strings with fill/stroke attributes,
 * and writes a generated JS module to packages/client/src/lib/board-renderer/tile-paths.js.
 *
 * Usage: node scripts/extract-svg-paths.js
 *        pnpm extract-tiles
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

// --- Constants ---

const TILES_DIR = join(import.meta.dirname, '..', 'packages', 'client', 'src', 'assets', 'tiles');
const OUTPUT_FILE = join(import.meta.dirname, '..', 'packages', 'client', 'src', 'lib', 'board-renderer', 'tile-paths.js');
const CANVAS_SIZE = 300;

const SHAPE_TAGS = new Set(['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line']);

// --- XML Parser Setup (preserveOrder mode for document-order traversal) ---

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  // In preserveOrder mode, each element is { tagName: [...children], ':@': { attrs } }
});

// --- Shape to Path Conversions ---

function circleToPath(cx, cy, r) {
  return `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy}Z`;
}

function ellipseToPath(cx, cy, rx, ry) {
  return `M${cx - rx},${cy} A${rx},${ry} 0 1,0 ${cx + rx},${cy} A${rx},${ry} 0 1,0 ${cx - rx},${cy}Z`;
}

function rectToPath(x, y, w, h, rx, ry) {
  rx = rx || 0;
  ry = ry || rx;
  if (rx === 0 && ry === 0) {
    return `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h}Z`;
  }
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  return [
    `M${x + rx},${y}`,
    `L${x + w - rx},${y}`, `Q${x + w},${y} ${x + w},${y + ry}`,
    `L${x + w},${y + h - ry}`, `Q${x + w},${y + h} ${x + w - rx},${y + h}`,
    `L${x + rx},${y + h}`, `Q${x},${y + h} ${x},${y + h - ry}`,
    `L${x},${y + ry}`, `Q${x},${y} ${x + rx},${y}`,
    'Z',
  ].join(' ');
}

function polygonToPath(points) {
  const pts = parsePoints(points);
  if (pts.length === 0) return '';
  return `M${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ') + 'Z';
}

function polylineToPath(points) {
  const pts = parsePoints(points);
  if (pts.length === 0) return '';
  return `M${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ');
}

function lineToPath(x1, y1, x2, y2) {
  return `M${x1},${y1} L${x2},${y2}`;
}

function parsePoints(str) {
  const nums = str.trim().split(/[\s,]+/).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}

// --- Transform Parsing ---

function parseTransform(transformStr) {
  if (!transformStr) return null;
  const matrices = [];
  const re = /(\w+)\s*\(([^)]+)\)/g;
  let match;
  while ((match = re.exec(transformStr)) !== null) {
    const fn = match[1];
    const args = match[2].split(/[\s,]+/).map(Number);
    switch (fn) {
      case 'translate':
        matrices.push([1, 0, 0, 1, args[0] || 0, args[1] || 0]);
        break;
      case 'scale': {
        const sx = args[0] || 1, sy = args[1] ?? sx;
        matrices.push([sx, 0, 0, sy, 0, 0]);
        break;
      }
      case 'rotate': {
        const deg = args[0] || 0, cx = args[1] || 0, cy = args[2] || 0;
        const rad = deg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
        if (cx !== 0 || cy !== 0) {
          matrices.push([1, 0, 0, 1, cx, cy]);
          matrices.push([cos, sin, -sin, cos, 0, 0]);
          matrices.push([1, 0, 0, 1, -cx, -cy]);
        } else {
          matrices.push([cos, sin, -sin, cos, 0, 0]);
        }
        break;
      }
      case 'matrix':
        matrices.push([args[0], args[1], args[2], args[3], args[4], args[5]]);
        break;
      case 'skewX': {
        const rad = (args[0] || 0) * Math.PI / 180;
        matrices.push([1, 0, Math.tan(rad), 1, 0, 0]);
        break;
      }
      case 'skewY': {
        const rad = (args[0] || 0) * Math.PI / 180;
        matrices.push([1, Math.tan(rad), 0, 1, 0, 0]);
        break;
      }
    }
  }
  if (matrices.length === 0) return null;
  return matrices.reduce(multiplyMatrices);
}

function multiplyMatrices(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function transformPoint(matrix, x, y) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  };
}

function transformPath(d, matrix) {
  if (!matrix) return d;

  const tokens = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) tokens.push({ type: 'cmd', value: m[1] });
    else tokens.push({ type: 'num', value: parseFloat(m[2]) });
  }

  const result = [];
  let i = 0;
  let curX = 0, curY = 0, startX = 0, startY = 0;

  function getNum() { return tokens[i++]?.value ?? 0; }

  while (i < tokens.length) {
    const tok = tokens[i++];
    if (tok.type !== 'cmd') continue;
    const cmd = tok.value;

    switch (cmd) {
      case 'M': case 'L': case 'T': {
        const parts = [cmd];
        while (i < tokens.length && tokens[i].type === 'num') {
          const x = getNum(), y = getNum();
          const p = transformPoint(matrix, x, y);
          parts.push(`${round(p.x)},${round(p.y)}`);
          curX = x; curY = y;
          if (cmd === 'M') { startX = x; startY = y; }
        }
        result.push(parts.join(' '));
        break;
      }
      case 'm': case 'l': case 't': {
        const absCmd = cmd.toUpperCase();
        const parts = [absCmd];
        while (i < tokens.length && tokens[i].type === 'num') {
          curX += getNum(); curY += getNum();
          const p = transformPoint(matrix, curX, curY);
          parts.push(`${round(p.x)},${round(p.y)}`);
          if (cmd === 'm') { startX = curX; startY = curY; }
        }
        result.push(parts.join(' '));
        break;
      }
      case 'H': {
        while (i < tokens.length && tokens[i].type === 'num') {
          curX = getNum();
          const p = transformPoint(matrix, curX, curY);
          result.push(`L${round(p.x)},${round(p.y)}`);
        }
        break;
      }
      case 'h': {
        while (i < tokens.length && tokens[i].type === 'num') {
          curX += getNum();
          const p = transformPoint(matrix, curX, curY);
          result.push(`L${round(p.x)},${round(p.y)}`);
        }
        break;
      }
      case 'V': {
        while (i < tokens.length && tokens[i].type === 'num') {
          curY = getNum();
          const p = transformPoint(matrix, curX, curY);
          result.push(`L${round(p.x)},${round(p.y)}`);
        }
        break;
      }
      case 'v': {
        while (i < tokens.length && tokens[i].type === 'num') {
          curY += getNum();
          const p = transformPoint(matrix, curX, curY);
          result.push(`L${round(p.x)},${round(p.y)}`);
        }
        break;
      }
      case 'C': {
        const parts = ['C'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const coords = [getNum(), getNum(), getNum(), getNum(), getNum(), getNum()];
          const p1 = transformPoint(matrix, coords[0], coords[1]);
          const p2 = transformPoint(matrix, coords[2], coords[3]);
          const p = transformPoint(matrix, coords[4], coords[5]);
          parts.push(`${round(p1.x)},${round(p1.y)} ${round(p2.x)},${round(p2.y)} ${round(p.x)},${round(p.y)}`);
          curX = coords[4]; curY = coords[5];
        }
        result.push(parts.join(' '));
        break;
      }
      case 'c': {
        const parts = ['C'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const d1 = getNum(), d2 = getNum(), d3 = getNum(), d4 = getNum(), d5 = getNum(), d6 = getNum();
          const p1 = transformPoint(matrix, curX + d1, curY + d2);
          const p2 = transformPoint(matrix, curX + d3, curY + d4);
          const p = transformPoint(matrix, curX + d5, curY + d6);
          parts.push(`${round(p1.x)},${round(p1.y)} ${round(p2.x)},${round(p2.y)} ${round(p.x)},${round(p.y)}`);
          curX += d5; curY += d6;
        }
        result.push(parts.join(' '));
        break;
      }
      case 'S': {
        const parts = ['S'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const x2 = getNum(), y2 = getNum(), x = getNum(), y = getNum();
          const p2 = transformPoint(matrix, x2, y2);
          const p = transformPoint(matrix, x, y);
          parts.push(`${round(p2.x)},${round(p2.y)} ${round(p.x)},${round(p.y)}`);
          curX = x; curY = y;
        }
        result.push(parts.join(' '));
        break;
      }
      case 's': {
        const parts = ['S'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const d1 = getNum(), d2 = getNum(), d3 = getNum(), d4 = getNum();
          const p2 = transformPoint(matrix, curX + d1, curY + d2);
          const p = transformPoint(matrix, curX + d3, curY + d4);
          parts.push(`${round(p2.x)},${round(p2.y)} ${round(p.x)},${round(p.y)}`);
          curX += d3; curY += d4;
        }
        result.push(parts.join(' '));
        break;
      }
      case 'Q': {
        const parts = ['Q'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const x1 = getNum(), y1 = getNum(), x = getNum(), y = getNum();
          const p1 = transformPoint(matrix, x1, y1);
          const p = transformPoint(matrix, x, y);
          parts.push(`${round(p1.x)},${round(p1.y)} ${round(p.x)},${round(p.y)}`);
          curX = x; curY = y;
        }
        result.push(parts.join(' '));
        break;
      }
      case 'q': {
        const parts = ['Q'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const d1 = getNum(), d2 = getNum(), d3 = getNum(), d4 = getNum();
          const p1 = transformPoint(matrix, curX + d1, curY + d2);
          const p = transformPoint(matrix, curX + d3, curY + d4);
          parts.push(`${round(p1.x)},${round(p1.y)} ${round(p.x)},${round(p.y)}`);
          curX += d3; curY += d4;
        }
        result.push(parts.join(' '));
        break;
      }
      case 'A': {
        const parts = ['A'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const rx = getNum(), ry = getNum(), rot = getNum();
          const la = getNum(), sw = getNum(), x = getNum(), y = getNum();
          const p = transformPoint(matrix, x, y);
          const sx = Math.hypot(matrix[0], matrix[1]);
          const sy = Math.hypot(matrix[2], matrix[3]);
          parts.push(`${round(rx * sx)},${round(ry * sy)} ${rot} ${la},${sw} ${round(p.x)},${round(p.y)}`);
          curX = x; curY = y;
        }
        result.push(parts.join(' '));
        break;
      }
      case 'a': {
        const parts = ['A'];
        while (i < tokens.length && tokens[i].type === 'num') {
          const rx = getNum(), ry = getNum(), rot = getNum();
          const la = getNum(), sw = getNum(), dx = getNum(), dy = getNum();
          curX += dx; curY += dy;
          const p = transformPoint(matrix, curX, curY);
          const sx = Math.hypot(matrix[0], matrix[1]);
          const sy = Math.hypot(matrix[2], matrix[3]);
          parts.push(`${round(rx * sx)},${round(ry * sy)} ${rot} ${la},${sw} ${round(p.x)},${round(p.y)}`);
        }
        result.push(parts.join(' '));
        break;
      }
      case 'Z': case 'z':
        result.push('Z');
        curX = startX; curY = startY;
        break;
    }
  }
  return result.join(' ');
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// --- Gradient Extraction ---

function extractGradients(defsChildren) {
  const gradients = {};
  if (!defsChildren) return gradients;

  for (const child of defsChildren) {
    if (child.linearGradient) {
      const attrs = child[':@'] || {};
      const id = attrs.id;
      if (!id) continue;
      const stops = child.linearGradient
        .filter(s => s.stop)
        .map(s => {
          const sa = s[':@'] || {};
          return { offset: parseFloat(sa.offset || '0'), color: extractStopColor(sa) };
        });
      gradients[id] = {
        type: 'linear',
        x0: parseFloat(attrs.x1 || '0'), y0: parseFloat(attrs.y1 || '0'),
        x1: parseFloat(attrs.x2 || '1'), y1: parseFloat(attrs.y2 || '0'),
        stops,
      };
      if (attrs.gradientUnits === 'userSpaceOnUse') gradients[id].units = 'userSpaceOnUse';
    }
    if (child.radialGradient) {
      const attrs = child[':@'] || {};
      const id = attrs.id;
      if (!id) continue;
      const stops = child.radialGradient
        .filter(s => s.stop)
        .map(s => {
          const sa = s[':@'] || {};
          return { offset: parseFloat(sa.offset || '0'), color: extractStopColor(sa) };
        });
      gradients[id] = {
        type: 'radial',
        cx: parseFloat(attrs.cx || '0.5'), cy: parseFloat(attrs.cy || '0.5'),
        r: parseFloat(attrs.r || '0.5'),
        stops,
      };
      if (attrs.gradientUnits === 'userSpaceOnUse') gradients[id].units = 'userSpaceOnUse';
    }
  }
  return gradients;
}

function extractStopColor(attrs) {
  if (attrs['stop-color']) return attrs['stop-color'];
  const style = attrs.style || '';
  const match = style.match(/stop-color:\s*([^;]+)/);
  return match ? match[1].trim() : '#000000';
}

// --- Style helpers ---

function applyInlineStyle(attrs) {
  if (!attrs.style) return;
  // In SVG, style attribute takes precedence over presentation attributes
  for (const decl of attrs.style.split(';')) {
    const [prop, val] = decl.split(':').map(s => s.trim());
    if (!prop || !val) continue;
    attrs[prop] = val;
  }
}

function extractFill(attrs, gradients) {
  const fill = attrs.fill;
  if (fill === 'none') return 'none';
  if (!fill) return undefined;
  const gradMatch = fill.match(/url\(#([^)]+)\)/);
  if (gradMatch) return gradients[gradMatch[1]] || fill;
  return fill;
}

// --- preserveOrder traversal ---

/**
 * Walk children in document order, extracting shapes.
 * In preserveOrder mode, each child is an object like:
 *   { tagName: [...grandchildren], ':@': { attr1: val1, ... } }
 */
// Tags to skip entirely (not renderable shapes, handled separately or ignored)
const SKIP_TAGS = new Set(['defs', 'clipPath', 'mask', 'symbol', 'use', 'title', 'desc', 'metadata']);

function extractShapes(children, parentMatrix, gradients) {
  const shapes = [];
  if (!children || !Array.isArray(children)) return shapes;

  for (const child of children) {
    // Skip text nodes and comments
    if (child['#text'] !== undefined) continue;

    // Find which tag this element is
    const tag = Object.keys(child).find(k => k !== ':@' && k !== '#text');
    if (!tag) continue;

    if (SKIP_TAGS.has(tag)) continue;

    const attrs = child[':@'] || {};
    applyInlineStyle(attrs);

    // Compute transform
    const elemTransform = parseTransform(attrs.transform);
    const matrix = parentMatrix && elemTransform
      ? multiplyMatrices(parentMatrix, elemTransform)
      : elemTransform || parentMatrix;

    if (tag === 'g') {
      // Recurse into group children (ignore clip-path attribute — we just render all shapes)
      shapes.push(...extractShapes(child.g, matrix, gradients));
      continue;
    }

    if (!SHAPE_TAGS.has(tag)) continue;

    // Skip invisible shapes (Affinity bounding boxes, clip rects, etc.)
    const noFill = attrs.fill === 'none' || attrs['fill-opacity'] === '0';
    const noStroke = !attrs.stroke || attrs.stroke === 'none';
    if (noFill && noStroke) continue;

    let d;
    switch (tag) {
      case 'path': d = attrs.d; break;
      case 'circle': d = circleToPath(n(attrs.cx), n(attrs.cy), n(attrs.r)); break;
      case 'rect': d = rectToPath(n(attrs.x), n(attrs.y), n(attrs.width), n(attrs.height), n(attrs.rx), n(attrs.ry)); break;
      case 'ellipse': d = ellipseToPath(n(attrs.cx), n(attrs.cy), n(attrs.rx), n(attrs.ry)); break;
      case 'polygon': d = polygonToPath(attrs.points); break;
      case 'polyline': d = polylineToPath(attrs.points); break;
      case 'line': d = lineToPath(n(attrs.x1), n(attrs.y1), n(attrs.x2), n(attrs.y2)); break;
    }

    if (!d) continue;
    if (matrix) d = transformPath(d, matrix);

    const entry = { d };
    const fill = extractFill(attrs, gradients);
    if (fill !== undefined) entry.fill = fill;
    if (attrs['fill-opacity'] !== undefined && attrs['fill-opacity'] !== '0') {
      entry.fillOpacity = parseFloat(attrs['fill-opacity']);
    }
    const stroke = attrs.stroke;
    if (stroke && stroke !== 'none') entry.stroke = stroke;
    if (attrs['stroke-width'] !== undefined) entry.strokeWidth = parseFloat(attrs['stroke-width']);
    if (attrs.opacity !== undefined) entry.opacity = parseFloat(attrs.opacity);
    if (attrs['fill-rule'] === 'evenodd') entry.fillRule = 'evenodd';

    shapes.push(entry);
  }
  return shapes;
}

function n(val) { return parseFloat(val) || 0; }

// --- ViewBox Parsing ---

function parseViewBox(attrs) {
  const vb = attrs.viewBox;
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
  }
  return { minX: 0, minY: 0, width: parseFloat(attrs.width) || CANVAS_SIZE, height: parseFloat(attrs.height) || CANVAS_SIZE };
}

// --- Main ---

function processSvgFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const parsed = parser.parse(content);

  // In preserveOrder mode, result is an array. Find the <svg> element.
  const svgNode = parsed.find(n => n.svg);
  if (!svgNode) {
    console.warn(`  Warning: No <svg> root element in ${filePath}`);
    return null;
  }

  const svgAttrs = svgNode[':@'] || {};
  const svgChildren = svgNode.svg;
  const viewBox = parseViewBox(svgAttrs);

  // Extract gradients from <defs>
  let gradients = {};
  for (const child of svgChildren) {
    if (child.defs) {
      gradients = { ...gradients, ...extractGradients(child.defs) };
    }
  }

  // Extract all shapes in document order
  const paths = extractShapes(svgChildren, null, gradients);

  if (paths.length === 0) {
    console.warn(`  Warning: No shapes found in ${filePath}`);
    return null;
  }

  return {
    viewBox: { width: viewBox.width, height: viewBox.height },
    paths,
  };
}

function main() {
  if (!existsSync(TILES_DIR)) {
    console.log(`Tiles directory not found: ${TILES_DIR}`);
    writeOutput({});
    return;
  }

  const files = readdirSync(TILES_DIR).filter(f => f.endsWith('.svg')).sort();
  if (files.length === 0) {
    console.log('No SVG files found in', TILES_DIR);
    writeOutput({});
    return;
  }

  console.log(`Processing ${files.length} SVG file(s) from ${TILES_DIR}`);
  const tiles = {};

  for (const file of files) {
    const key = basename(file, '.svg');
    console.log(`  ${file} -> ${key}`);
    const result = processSvgFile(join(TILES_DIR, file));
    if (result) tiles[key] = result;
  }

  writeOutput(tiles);
  console.log(`\nWrote ${Object.keys(tiles).length} tile(s) to ${OUTPUT_FILE}`);
}

function writeOutput(tiles) {
  const json = JSON.stringify(tiles, null, 2);
  writeFileSync(OUTPUT_FILE, [
    '// AUTO-GENERATED by scripts/extract-svg-paths.js -- do not edit manually',
    `export const CANVAS_SIZE = ${CANVAS_SIZE};`,
    `export const TILE_PATHS = ${json};`,
    '',
  ].join('\n'), 'utf-8');
}

main();
