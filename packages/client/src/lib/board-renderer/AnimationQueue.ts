import { Ticker } from 'pixi.js';
import type { ExecutionEvent, Robot, Direction } from '@mechmarathon/shared';
import { BASE_TWEEN_DURATION_MS } from './constants';
import { boardToPixel, directionToRadians, lerp, lerpAngle, easeInOutCubic } from './utils';
import type { RobotLayer } from './RobotLayer';

interface Tween {
  robotId: string;
  type: 'position' | 'rotation' | 'fade_out' | 'fade_in';
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  fromAngle?: number;
  toAngle?: number;
  fromAlpha?: number;
  toAlpha?: number;
}

interface TweenGroup {
  tweens: Tween[];
  durationMs: number;
}

export class AnimationQueue {
  private robotLayer: RobotLayer;
  private ticker: Ticker;
  private speed = 1;
  private cancelled = false;
  private resolvePromise: (() => void) | null = null;

  constructor(robotLayer: RobotLayer, ticker: Ticker) {
    this.robotLayer = robotLayer;
    this.ticker = ticker;
  }

  setSpeed(speed: 1 | 2 | 3): void {
    this.speed = speed;
  }

  /**
   * Animate a sequence of execution events, then resolve.
   * The caller should snap robots to final positions after this resolves.
   */
  async animate(
    events: ExecutionEvent[],
    updatedRobots: Robot[],
  ): Promise<void> {
    this.cancelled = false;
    const groups = this.buildTweenGroups(events);

    for (const group of groups) {
      if (this.cancelled) break;
      await this.runGroup(group);
    }

    // After animation, sync robots to their final server state
    this.robotLayer.syncRobots(updatedRobots);
  }

  /** Cancel current animation and snap robots to final positions */
  cancelAndSnap(robots: Robot[]): void {
    this.cancelled = true;
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
    }
    this.robotLayer.syncRobots(robots);
  }

  private buildTweenGroups(events: ExecutionEvent[]): TweenGroup[] {
    const groups: TweenGroup[] = [];
    let i = 0;

    while (i < events.length) {
      const ev = events[i];

      // Batch consecutive conveyor events into one group
      if (ev.type === 'conveyor') {
        const conveyorTweens: Tween[] = [];
        while (i < events.length && events[i].type === 'conveyor') {
          const cev = events[i];
          const tween = this.eventToTween(cev);
          if (tween) conveyorTweens.push(tween);
          i++;
        }
        if (conveyorTweens.length > 0) {
          groups.push({ tweens: conveyorTweens, durationMs: this.tweenDuration() });
        }
        continue;
      }

      const tween = this.eventToTween(ev);
      if (tween) {
        const duration = (ev.type === 'fall' || ev.type === 'respawn')
          ? this.tweenDuration() * 1.5
          : this.tweenDuration();
        groups.push({ tweens: [tween], durationMs: duration });
      }
      i++;
    }

    return groups;
  }

  private eventToTween(ev: ExecutionEvent): Tween | null {
    switch (ev.type) {
      case 'move':
      case 'push':
      case 'conveyor': {
        if (!ev.from || !ev.to) return null;
        const from = boardToPixel(ev.from);
        const to = boardToPixel(ev.to);
        // Set robot to start position before tweening
        this.robotLayer.setRobotPosition(ev.robotId, from.x, from.y);
        return {
          robotId: ev.robotId,
          type: 'position',
          fromX: from.x,
          fromY: from.y,
          toX: to.x,
          toY: to.y,
        };
      }

      case 'rotate': {
        // details: "north → east"
        const dirs = this.parseRotationDetails(ev.details);
        if (!dirs) return null;
        const fromAngle = directionToRadians(dirs.from);
        const toAngle = directionToRadians(dirs.to);
        this.robotLayer.setRobotRotation(ev.robotId, fromAngle);
        return {
          robotId: ev.robotId,
          type: 'rotation',
          fromAngle,
          toAngle,
        };
      }

      case 'gear': {
        // details: "cw" or "ccw"
        const currentRotation = this.robotLayer.getRobotRotation(ev.robotId);
        if (currentRotation === null) return null;
        const delta = ev.details === 'cw' ? Math.PI / 2 : -Math.PI / 2;
        return {
          robotId: ev.robotId,
          type: 'rotation',
          fromAngle: currentRotation,
          toAngle: currentRotation + delta,
        };
      }

      case 'fall': {
        // Fade out with slight downward drift
        const pos = this.robotLayer.getRobotPosition(ev.robotId);
        if (!pos) return null;
        return {
          robotId: ev.robotId,
          type: 'fade_out',
          fromX: pos.x,
          fromY: pos.y,
          toX: pos.x,
          toY: pos.y + 10,
          fromAlpha: 1,
          toAlpha: 0,
        };
      }

      case 'respawn': {
        // Fade in at new position
        if (!ev.to) return null;
        const to = boardToPixel(ev.to);
        this.robotLayer.setRobotPosition(ev.robotId, to.x, to.y);
        this.robotLayer.setRobotVisible(ev.robotId, true);
        this.robotLayer.setRobotAlpha(ev.robotId, 0);
        return {
          robotId: ev.robotId,
          type: 'fade_in',
          fromAlpha: 0,
          toAlpha: 1,
        };
      }

      case 'checkpoint':
      case 'repair':
        // No visual tween needed
        return null;

      default:
        return null;
    }
  }

  private parseRotationDetails(
    details?: string,
  ): { from: Direction; to: Direction } | null {
    if (!details) return null;
    // Format: "north → east" or "north -> east"
    const match = details.match(/^(\w+)\s*(?:→|->)\s*(\w+)$/);
    if (!match) return null;
    return {
      from: match[1] as Direction,
      to: match[2] as Direction,
    };
  }

  private runGroup(group: TweenGroup): Promise<void> {
    return new Promise<void>((resolve) => {
      this.resolvePromise = resolve;
      let elapsed = 0;
      const duration = group.durationMs;

      const onTick = (tick: Ticker) => {
        if (this.cancelled) {
          this.ticker.remove(onTick);
          resolve();
          return;
        }

        elapsed += tick.deltaMS;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(t);

        for (const tween of group.tweens) {
          this.applyTween(tween, eased);
        }

        if (t >= 1) {
          this.ticker.remove(onTick);
          this.resolvePromise = null;
          resolve();
        }
      };

      this.ticker.add(onTick);
    });
  }

  private applyTween(tween: Tween, t: number): void {
    switch (tween.type) {
      case 'position':
        if (tween.fromX != null && tween.toX != null && tween.fromY != null && tween.toY != null) {
          this.robotLayer.setRobotPosition(
            tween.robotId,
            lerp(tween.fromX, tween.toX, t),
            lerp(tween.fromY, tween.toY, t),
          );
        }
        break;

      case 'rotation':
        if (tween.fromAngle != null && tween.toAngle != null) {
          this.robotLayer.setRobotRotation(
            tween.robotId,
            lerpAngle(tween.fromAngle, tween.toAngle, t),
          );
        }
        break;

      case 'fade_out':
        if (tween.fromAlpha != null && tween.toAlpha != null) {
          this.robotLayer.setRobotAlpha(tween.robotId, lerp(tween.fromAlpha, tween.toAlpha, t));
        }
        if (tween.fromX != null && tween.toX != null && tween.fromY != null && tween.toY != null) {
          this.robotLayer.setRobotPosition(
            tween.robotId,
            lerp(tween.fromX, tween.toX, t),
            lerp(tween.fromY, tween.toY, t),
          );
        }
        if (t >= 1) {
          this.robotLayer.setRobotVisible(tween.robotId, false);
        }
        break;

      case 'fade_in':
        if (tween.fromAlpha != null && tween.toAlpha != null) {
          this.robotLayer.setRobotAlpha(tween.robotId, lerp(tween.fromAlpha, tween.toAlpha, t));
        }
        break;
    }
  }

  private tweenDuration(): number {
    return BASE_TWEEN_DURATION_MS / this.speed;
  }
}
