/**
 * Shared drawing utilities for tile renderers.
 *
 * All functions take a PixiJS Graphics object and draw shapes onto it.
 * Colors are hex numbers (e.g. 0xff0000).
 */

import { Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Draw a rounded rectangle.
 */
export function drawRoundedRect(g, x, y, w, h, radius, color) {
  g.roundRect(x, y, w, h, radius).fill(color);
}

/**
 * Draw an arrow pointing in a direction.
 * @param {Graphics} g
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {string} direction - 'north', 'south', 'east', 'west'
 * @param {number} size - arrow size (length)
 * @param {number} color
 */
export function drawArrow(g, cx, cy, direction, size, color) {
  const half = size / 2;
  const headW = size * 0.4;

  g.setStrokeStyle({ width: 0 });

  // Arrow pointing up by default, rotated per direction
  const points = [];
  // Shaft + head as a single polygon
  points.push({ x: 0, y: half });         // bottom-left of shaft
  points.push({ x: 0, y: -half + headW }); // top of shaft (where head starts)
  points.push({ x: -headW, y: -half + headW }); // head left
  points.push({ x: 0, y: -half });         // tip
  points.push({ x: headW, y: -half + headW });  // head right
  points.push({ x: 0, y: -half + headW }); // back to shaft
  points.push({ x: 0, y: half });          // bottom-right of shaft

  // Simplified: draw as a triangle (arrow head) + line (shaft)
  const rotations = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };
  const rot = rotations[direction] ?? 0;

  // Draw a simple triangle arrowhead
  const tipLen = size * 0.45;
  const tipW = size * 0.35;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  function rotate(px, py) {
    return { x: cx + px * cos - py * sin, y: cy + px * sin + py * cos };
  }

  const tip = rotate(0, -tipLen);
  const left = rotate(-tipW, tipLen * 0.3);
  const right = rotate(tipW, tipLen * 0.3);
  const tailL = rotate(-tipW * 0.35, tipLen * 0.3);
  const tailR = rotate(tipW * 0.35, tipLen * 0.3);
  const bottom = rotate(0, tipLen);

  // Arrow with shaft
  g.moveTo(tip.x, tip.y)
    .lineTo(left.x, left.y)
    .lineTo(tailL.x, tailL.y)
    .lineTo(bottom.x, bottom.y)
    .lineTo(tailR.x, tailR.y)
    .lineTo(right.x, right.y)
    .closePath()
    .fill({ color, alpha: 0.7 });
}

/**
 * Draw chevron arrows (conveyor belt pattern).
 * @param {Graphics} g
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {string} direction
 * @param {number} count - number of chevrons
 * @param {number} size - total area size
 * @param {number} color
 */
export function drawChevrons(g, cx, cy, direction, count, size, color) {
  const rotations = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };
  const rot = rotations[direction] ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  function rotate(px, py) {
    return { x: cx + px * cos - py * sin, y: cy + px * sin + py * cos };
  }

  const spacing = size / (count + 1);
  const chevW = size * 0.3;
  const chevH = size * 0.12;

  for (let i = 0; i < count; i++) {
    const offsetY = (i - (count - 1) / 2) * spacing;

    const tip = rotate(0, offsetY - chevH);
    const left = rotate(-chevW, offsetY + chevH);
    const right = rotate(chevW, offsetY + chevH);

    g.setStrokeStyle({ width: 1.5, color });
    g.moveTo(left.x, left.y)
      .lineTo(tip.x, tip.y)
      .lineTo(right.x, right.y)
      .stroke();
  }
}

/**
 * Draw gear teeth around a circle.
 * @param {Graphics} g
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {number} radius - outer radius
 * @param {number} teeth - number of teeth
 * @param {number} color
 */
export function drawGearTeeth(g, cx, cy, radius, teeth, color) {
  const innerR = radius * 0.7;
  const toothW = (2 * Math.PI) / (teeth * 2);

  g.moveTo(cx + radius, cy);
  for (let i = 0; i < teeth; i++) {
    const angle1 = (i * 2 * Math.PI) / teeth;
    const angle2 = angle1 + toothW;
    const angle3 = angle2;
    const angle4 = angle1 + (2 * Math.PI) / teeth;

    g.lineTo(cx + Math.cos(angle1) * radius, cy + Math.sin(angle1) * radius);
    g.lineTo(cx + Math.cos(angle2) * radius, cy + Math.sin(angle2) * radius);
    g.lineTo(cx + Math.cos(angle3) * innerR, cy + Math.sin(angle3) * innerR);
    g.lineTo(cx + Math.cos(angle4) * innerR, cy + Math.sin(angle4) * innerR);
  }
  g.closePath().fill({ color, alpha: 0.5 });

  // Center hole
  g.circle(cx, cy, innerR * 0.4).fill(0x111111);
}

/**
 * Draw diagonal hazard hatch lines.
 * @param {Graphics} g
 * @param {number} x - top-left x
 * @param {number} y - top-left y
 * @param {number} w - width
 * @param {number} h - height
 * @param {number} color
 */
export function drawHazardHatch(g, x, y, w, h, color) {
  const spacing = 6;
  g.setStrokeStyle({ width: 1, color, alpha: 0.4 });
  for (let i = -h; i < w; i += spacing) {
    const x1 = Math.max(x, x + i);
    const y1 = Math.max(y, y - i);
    const x2 = Math.min(x + w, x + i + h);
    const y2 = Math.min(y + h, y - i + w);
    if (x1 < x + w && y2 > y) {
      g.moveTo(x1, y1).lineTo(x2, y2).stroke();
    }
  }
}

/**
 * Draw phase number badges.
 * @param {Graphics} g
 * @param {number[]} phases - array of phase numbers
 * @param {number} x - position x
 * @param {number} y - position y
 * @returns {Text} - the created text object (caller adds to container)
 */
export function createPhaseBadge(phases, x, y) {
  const style = new TextStyle({
    fontSize: 6,
    fill: 0xf39c12,
    fontFamily: 'sans-serif',
  });
  const text = new Text({ text: phases.join(''), style });
  text.anchor.set(1, 1);
  text.x = x;
  text.y = y;
  text.alpha = 0.8;
  return text;
}

/**
 * Draw a group label badge.
 * @param {string} group - group letter
 * @param {number} x - position x
 * @param {number} y - position y
 * @returns {Text}
 */
export function createGroupBadge(group, x, y) {
  const style = new TextStyle({
    fontSize: 12,
    fill: 0xffffff,
    fontWeight: 'bold',
    fontFamily: 'sans-serif',
  });
  const text = new Text({ text: group, style });
  text.anchor.set(0, 0);
  text.x = x;
  text.y = y;
  text.alpha = 0.7;
  return text;
}
