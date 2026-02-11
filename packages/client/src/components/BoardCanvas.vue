<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Application, Container } from 'pixi.js';
import { useGameStore } from '../stores/game';
import { useAuthStore } from '../stores/auth';
import { TileLayer } from '../lib/board-renderer/TileLayer';
import { RobotLayer } from '../lib/board-renderer/RobotLayer';
import { AnimationQueue } from '../lib/board-renderer/AnimationQueue';
import { TILE_SIZE, TILE_GAP, BOARD_PADDING, MAX_SCALE } from '../lib/board-renderer/constants';

const game = useGameStore();
const auth = useAuthStore();

const canvasContainer = ref<HTMLDivElement | null>(null);

let app: Application | null = null;
let boardContainer: Container | null = null;
let tileLayer: TileLayer | null = null;
let robotLayer: RobotLayer | null = null;
let animationQueue: AnimationQueue | null = null;
let resizeObserver: ResizeObserver | null = null;
let isAnimating = false;
let initialized = false;

async function initPixi(): Promise<void> {
  if (!canvasContainer.value || initialized) return;

  const state = game.gameState;
  if (!state) return;

  initialized = true;

  const el = canvasContainer.value;

  app = new Application();
  await app.init({
    background: 0x0f0f1a,
    antialias: true,
    width: el.clientWidth || 800,
    height: el.clientHeight || 600,
  });

  el.appendChild(app.canvas as HTMLCanvasElement);

  boardContainer = new Container();
  app.stage.addChild(boardContainer);

  tileLayer = new TileLayer();
  boardContainer.addChild(tileLayer.container);

  robotLayer = new RobotLayer();
  robotLayer.setMyPlayerId(auth.user?.id ?? null);
  boardContainer.addChild(robotLayer.container);

  animationQueue = new AnimationQueue(robotLayer, app.ticker);
  animationQueue.setSpeed(game.executionSpeed);

  // Build initial board
  tileLayer.build(state.board, state.checkpoints);
  robotLayer.syncRobots(state.robots);

  fitBoard();

  // Observe container resizes
  resizeObserver = new ResizeObserver(() => {
    if (app && el.clientWidth > 0 && el.clientHeight > 0) {
      app.renderer.resize(el.clientWidth, el.clientHeight);
      fitBoard();
    }
  });
  resizeObserver.observe(el);
}

function fitBoard(): void {
  if (!app || !boardContainer || !game.gameState) return;

  const container = canvasContainer.value;
  if (!container) return;

  const cellPitch = TILE_SIZE + TILE_GAP;
  const boardW = game.gameState.board.width * cellPitch - TILE_GAP;
  const boardH = game.gameState.board.height * cellPitch - TILE_GAP;

  const availW = container.clientWidth - BOARD_PADDING * 2;
  const availH = container.clientHeight - BOARD_PADDING * 2;

  const scale = Math.min(availW / boardW, availH / boardH, MAX_SCALE);

  boardContainer.scale.set(scale, scale);
  boardContainer.x = (container.clientWidth - boardW * scale) / 2;
  boardContainer.y = (container.clientHeight - boardH * scale) / 2;
}

function destroyPixi(): void {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (app) {
    app.destroy(true, { children: true });
    app = null;
  }
  boardContainer = null;
  tileLayer = null;
  robotLayer = null;
  animationQueue = null;
  initialized = false;
}

onMounted(async () => {
  // Wait a tick so the container has layout dimensions
  await nextTick();
  if (game.gameState) {
    await initPixi();
  }
});

onBeforeUnmount(() => {
  destroyPixi();
});

// Init PixiJS when gameState first becomes available
watch(
  () => game.gameState,
  async (state) => {
    if (state && !initialized) {
      await nextTick();
      await initPixi();
    }
  },
);

// Snap robots when game state robots change (unless animating)
watch(
  () => game.gameState?.robots,
  (robots) => {
    if (!robots || !robotLayer || isAnimating) return;
    robotLayer.syncRobots(robots);
  },
);

// Rebuild board tiles when board changes (rare — basically only on game init)
watch(
  () => game.gameState?.board,
  (board) => {
    if (!board || !tileLayer || !game.gameState) return;
    tileLayer.build(board, game.gameState.checkpoints);
    fitBoard();
  },
);

// Run animation when new execution events arrive
watch(
  () => game.currentRegisterEvents,
  async (events) => {
    if (!events.length || !animationQueue || !robotLayer || !game.gameState) return;

    isAnimating = true;
    try {
      await animationQueue.animate(events, game.gameState.robots);
    } finally {
      isAnimating = false;
      // Final snap to ensure consistency
      if (game.gameState) {
        robotLayer.syncRobots(game.gameState.robots);
      }
    }
  },
);

// Update animation speed when execution speed changes
watch(
  () => game.executionSpeed,
  (speed) => {
    if (animationQueue) {
      animationQueue.setSpeed(speed);
    }
  },
);
</script>

<template>
  <div ref="canvasContainer" class="board-canvas" />
</template>

<style scoped>
.board-canvas {
  flex: 1;
  min-height: 200px;
  position: relative;
  overflow: hidden;
}

.board-canvas :deep(canvas) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;
}
</style>
