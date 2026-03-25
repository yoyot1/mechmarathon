/**
 * DOM-based robot layer — replaces the PixiJS RobotLayer.
 *
 * Each robot is an absolutely-positioned <div> with an inline SVG
 * circle + arrow, positioned via CSS transform: translate().
 */
import { ROBOT_RADIUS, ROBOT_COLORS_HEX, hexToCss } from './constants.js';
import { boardToPixel, directionToRadians } from './utils.js';

export class DomRobotLayer {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'robot-layer';
    this.sprites = new Map(); // robotId → { el, x, y, rotation, alpha, visible, color }
    this.myPlayerId = null;
    this.allRobotsRef = [];
  }

  setMyPlayerId(id) {
    this.myPlayerId = id;
  }

  syncRobots(robots) {
    this.allRobotsRef = robots;
    const currentIds = new Set(robots.map((r) => r.id));

    // Remove sprites for robots no longer present
    for (const [id, sprite] of this.sprites) {
      if (!currentIds.has(id)) {
        this.element.removeChild(sprite.el);
        this.sprites.delete(id);
      }
    }

    // Create or update each robot
    for (const robot of robots) {
      let sprite = this.sprites.get(robot.id);
      if (!sprite) {
        sprite = this._createRobotSprite(robot);
        this.sprites.set(robot.id, sprite);
        this.element.appendChild(sprite.el);
      }
      this._updateSprite(sprite, robot);
    }
  }

  _createRobotSprite(robot) {
    const idx = this.allRobotsRef.indexOf(robot);
    const colorHex = ROBOT_COLORS_HEX[idx % ROBOT_COLORS_HEX.length];
    const colorCss = hexToCss(colorHex);
    const isMine = robot.playerId === this.myPlayerId;
    const borderColor = isMine ? '#ffd700' : 'rgba(255,255,255,0.3)';
    const borderWidth = 2;
    const r = ROBOT_RADIUS;
    const size = (r + borderWidth + 1) * 2;

    const el = document.createElement('div');
    el.className = 'robot';
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // SVG for circle + border + arrow
    const cx = size / 2;
    const cy = size / 2;
    el.innerHTML = `
      <svg class="robot-circle" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${cx}" cy="${cy}" r="${r + borderWidth}" fill="none" stroke="${borderColor}" stroke-width="${borderWidth}" opacity="${isMine ? 1 : 0.3}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${colorCss}" class="robot-body"/>
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="central"
              fill="white" font-size="12" font-weight="bold" font-family="sans-serif"
              class="robot-arrow">\u25B2</text>
      </svg>
    `;

    if (isMine) {
      const label = document.createElement('span');
      label.className = 'robot-label';
      label.textContent = 'YOU';
      el.appendChild(label);
    }

    return {
      el,
      x: 0,
      y: 0,
      rotation: 0,
      alpha: 1,
      visible: true,
      color: colorHex,
      size,
    };
  }

  _updateSprite(sprite, robot) {
    const pos = boardToPixel(robot.position);
    sprite.x = pos.x;
    sprite.y = pos.y;
    sprite.rotation = directionToRadians(robot.direction);
    sprite.visible = robot.lives > 0;
    sprite.alpha = robot.virtual ? 0.5 : 1;
    this._applyTransform(sprite);
  }

  _applyTransform(sprite) {
    const halfSize = sprite.size / 2;
    sprite.el.style.transform = `translate(${sprite.x - halfSize}px, ${sprite.y - halfSize}px)`;
    sprite.el.style.opacity = sprite.alpha;
    sprite.el.style.display = sprite.visible ? '' : 'none';

    // Rotate the arrow text inside SVG
    const arrow = sprite.el.querySelector('.robot-arrow');
    if (arrow) {
      const cx = sprite.size / 2;
      const cy = sprite.size / 2;
      const deg = sprite.rotation * (180 / Math.PI);
      arrow.setAttribute('transform', `rotate(${deg}, ${cx}, ${cy - 2})`);
    }
  }

  // --- Granular setters for animation system ---

  setRobotPosition(robotId, x, y) {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.x = x;
      sprite.y = y;
      this._applyTransform(sprite);
    }
  }

  setRobotRotation(robotId, radians) {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.rotation = radians;
      this._applyTransform(sprite);
    }
  }

  setRobotAlpha(robotId, alpha) {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.alpha = alpha;
      sprite.el.style.opacity = alpha;
    }
  }

  setRobotVisible(robotId, visible) {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.visible = visible;
      sprite.el.style.display = visible ? '' : 'none';
    }
  }

  getRobotPosition(robotId) {
    const sprite = this.sprites.get(robotId);
    if (!sprite) return null;
    return { x: sprite.x, y: sprite.y };
  }

  getRobotRotation(robotId) {
    const sprite = this.sprites.get(robotId);
    if (!sprite) return null;
    return sprite.rotation;
  }

  setRobotTint(robotId, color) {
    const sprite = this.sprites.get(robotId);
    if (!sprite) return;
    const body = sprite.el.querySelector('.robot-body');
    if (body) {
      body.setAttribute('fill', color === 0xffffff ? hexToCss(sprite.color) : hexToCss(color));
    }
  }
}
