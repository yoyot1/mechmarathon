import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Robot, Direction } from '@mechmarathon/shared';
import { ROBOT_RADIUS, ROBOT_COLORS_HEX } from './constants';
import { boardToPixel, directionToRadians } from './utils';

const DIRECTION_ARROW_STYLE = new TextStyle({
  fontSize: 12,
  fill: 0xffffff,
  fontFamily: 'sans-serif',
  fontWeight: 'bold',
});

const YOU_LABEL_STYLE = new TextStyle({
  fontSize: 7,
  fill: 0xffd700,
  fontFamily: 'sans-serif',
  fontWeight: 'bold',
  letterSpacing: 0.5,
});

interface RobotSprite {
  container: Container;
  circle: Graphics;
  arrow: Text;
  youLabel: Text | null;
  border: Graphics;
}

export class RobotLayer {
  readonly container = new Container();
  private sprites = new Map<string, RobotSprite>();
  private myPlayerId: string | null = null;
  private allRobotsRef: Robot[] = [];

  setMyPlayerId(id: string | null): void {
    this.myPlayerId = id;
  }

  /** Create/remove/update robot sprites to match current state */
  syncRobots(robots: Robot[]): void {
    this.allRobotsRef = robots;
    const currentIds = new Set(robots.map((r) => r.id));

    // Remove sprites for robots no longer present
    for (const [id, sprite] of this.sprites) {
      if (!currentIds.has(id)) {
        this.container.removeChild(sprite.container);
        this.sprites.delete(id);
      }
    }

    // Create or update each robot
    for (const robot of robots) {
      let sprite = this.sprites.get(robot.id);
      if (!sprite) {
        sprite = this.createRobotSprite(robot);
        this.sprites.set(robot.id, sprite);
        this.container.addChild(sprite.container);
      }
      this.updateSprite(sprite, robot);
    }
  }

  private createRobotSprite(robot: Robot): RobotSprite {
    const c = new Container();
    const idx = this.allRobotsRef.indexOf(robot);
    const color = ROBOT_COLORS_HEX[idx % ROBOT_COLORS_HEX.length];

    // Border circle (slightly larger)
    const border = new Graphics();
    const isMine = robot.playerId === this.myPlayerId;
    const borderColor = isMine ? 0xffd700 : 0xffffff;
    border.circle(0, 0, ROBOT_RADIUS + 2)
      .fill({ color: 0x000000, alpha: 0 })
      .stroke({ width: 2, color: borderColor, alpha: isMine ? 1 : 0.3 });
    c.addChild(border);

    // Main circle
    const circle = new Graphics();
    circle.circle(0, 0, ROBOT_RADIUS).fill(color);
    c.addChild(circle);

    // Direction arrow
    const arrow = new Text({ text: '\u25B2', style: DIRECTION_ARROW_STYLE });
    arrow.anchor.set(0.5, 0.5);
    arrow.y = -2;
    c.addChild(arrow);

    // "YOU" label
    let youLabel: Text | null = null;
    if (isMine) {
      youLabel = new Text({ text: 'YOU', style: YOU_LABEL_STYLE });
      youLabel.anchor.set(0.5, 0);
      youLabel.y = ROBOT_RADIUS + 3;
      c.addChild(youLabel);
    }

    return { container: c, circle, arrow, youLabel, border };
  }

  private updateSprite(sprite: RobotSprite, robot: Robot): void {
    const pos = boardToPixel(robot.position);
    sprite.container.x = pos.x;
    sprite.container.y = pos.y;

    // Rotation
    sprite.arrow.rotation = directionToRadians(robot.direction);

    // Visibility: hide dead robots
    sprite.container.visible = robot.lives > 0;

    // Virtual robots at 50% opacity
    sprite.container.alpha = robot.virtual ? 0.5 : 1;
  }

  // --- Granular setters for animation system ---

  setRobotPosition(robotId: string, x: number, y: number): void {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.container.x = x;
      sprite.container.y = y;
    }
  }

  setRobotRotation(robotId: string, radians: number): void {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.arrow.rotation = radians;
    }
  }

  setRobotAlpha(robotId: string, alpha: number): void {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.container.alpha = alpha;
    }
  }

  setRobotVisible(robotId: string, visible: boolean): void {
    const sprite = this.sprites.get(robotId);
    if (sprite) {
      sprite.container.visible = visible;
    }
  }

  getRobotPosition(robotId: string): { x: number; y: number } | null {
    const sprite = this.sprites.get(robotId);
    if (!sprite) return null;
    return { x: sprite.container.x, y: sprite.container.y };
  }

  getRobotRotation(robotId: string): number | null {
    const sprite = this.sprites.get(robotId);
    if (!sprite) return null;
    return sprite.arrow.rotation;
  }
}
