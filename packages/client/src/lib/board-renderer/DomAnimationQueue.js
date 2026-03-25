/**
 * DOM-based animation queue — replaces the PixiJS AnimationQueue.
 *
 * Uses requestAnimationFrame for manual tweening (same approach as the
 * PixiJS ticker-based version), maintaining identical animation logic.
 */
import { BASE_TWEEN_DURATION_MS } from './constants.js';
import { boardToPixel, directionToRadians, lerp, lerpAngle, easeInOutCubic } from './utils.js';

export class DomAnimationQueue {
  constructor(robotLayer) {
    this.robotLayer = robotLayer;
    this.speed = 1;
    this.cancelled = false;
    this.resolvePromise = null;
    this._rafId = null;
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  async animate(events, updatedRobots) {
    this.cancelled = false;
    const groups = this._buildTweenGroups(events);

    for (const group of groups) {
      if (this.cancelled) break;
      await this._runGroup(group);
    }

    this.robotLayer.syncRobots(updatedRobots);
  }

  cancelAndSnap(robots) {
    this.cancelled = true;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.resolvePromise) {
      this.resolvePromise();
      this.resolvePromise = null;
    }
    this.robotLayer.syncRobots(robots);
  }

  _buildTweenGroups(events) {
    const groups = [];
    let i = 0;

    while (i < events.length) {
      const ev = events[i];

      // Batch consecutive conveyor events into one group
      if (ev.type === 'conveyor') {
        const conveyorTweens = [];
        while (i < events.length && events[i].type === 'conveyor') {
          const cev = events[i];
          const tween = this._eventToTween(cev);
          if (tween) conveyorTweens.push(tween);
          i++;
        }
        if (conveyorTweens.length > 0) {
          groups.push({ tweens: conveyorTweens, durationMs: this._tweenDuration() });
        }
        continue;
      }

      const tween = this._eventToTween(ev);
      if (tween) {
        const duration = (ev.type === 'fall' || ev.type === 'respawn')
          ? this._tweenDuration() * 1.5
          : this._tweenDuration();
        groups.push({ tweens: [tween], durationMs: duration });
      }
      i++;
    }

    return groups;
  }

  _eventToTween(ev) {
    switch (ev.type) {
      case 'move':
      case 'push':
      case 'conveyor': {
        if (!ev.from || !ev.to) return null;
        const from = boardToPixel(ev.from);
        const to = boardToPixel(ev.to);
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
        const dirs = this._parseRotationDetails(ev.details);
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

      case 'laser_hit':
      case 'flamer': {
        return {
          robotId: ev.robotId,
          type: 'flash',
          color: ev.type === 'flamer' ? 0xff6600 : 0xff0000,
        };
      }

      case 'crusher': {
        const crusherPos = this.robotLayer.getRobotPosition(ev.robotId);
        if (!crusherPos) return null;
        return {
          robotId: ev.robotId,
          type: 'fade_out',
          fromX: crusherPos.x,
          fromY: crusherPos.y,
          toX: crusherPos.x,
          toY: crusherPos.y,
          fromAlpha: 1,
          toAlpha: 0,
        };
      }

      case 'portal': {
        if (!ev.from || !ev.to) return null;
        const portalTo = boardToPixel(ev.to);
        this.robotLayer.setRobotPosition(ev.robotId, portalTo.x, portalTo.y);
        this.robotLayer.setRobotAlpha(ev.robotId, 0);
        return {
          robotId: ev.robotId,
          type: 'fade_in',
          fromAlpha: 0,
          toAlpha: 1,
        };
      }

      case 'flag':
      case 'repair':
        return null;

      default:
        return null;
    }
  }

  _parseRotationDetails(details) {
    if (!details) return null;
    const match = details.match(/^(\w+)\s*(?:→|->)\s*(\w+)$/);
    if (!match) return null;
    return { from: match[1], to: match[2] };
  }

  _runGroup(group) {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      const duration = group.durationMs;
      let startTime = null;

      const onFrame = (timestamp) => {
        if (this.cancelled) {
          this.resolvePromise = null;
          resolve();
          return;
        }

        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(t);

        for (const tween of group.tweens) {
          this._applyTween(tween, eased);
        }

        if (t >= 1) {
          this._rafId = null;
          this.resolvePromise = null;
          resolve();
        } else {
          this._rafId = requestAnimationFrame(onFrame);
        }
      };

      this._rafId = requestAnimationFrame(onFrame);
    });
  }

  _applyTween(tween, t) {
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

      case 'flash':
        if (t < 0.5) {
          this.robotLayer.setRobotTint(tween.robotId, tween.color);
        } else {
          this.robotLayer.setRobotTint(tween.robotId, 0xffffff);
        }
        break;
    }
  }

  _tweenDuration() {
    return BASE_TWEEN_DURATION_MS / this.speed;
  }
}
