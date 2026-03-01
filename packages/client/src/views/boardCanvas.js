import '../styles/board-canvas.css';
import { Application, Container } from 'pixi.js';
import { TileLayer } from '../lib/board-renderer/TileLayer.js';
import { RobotLayer } from '../lib/board-renderer/RobotLayer.js';
import { AnimationQueue } from '../lib/board-renderer/AnimationQueue.js';
import { TILE_SIZE, TILE_GAP, BOARD_PADDING, MAX_SCALE } from '../lib/board-renderer/constants.js';

let app = null;
let boardContainer = null;
let tileLayer = null;
let robotLayer = null;
let animationQueue = null;
let resizeObserver = null;
let initialized = false;
let containerEl = null;
let isAnimating = false;
let currentBoard = null;

export async function initBoardCanvas(el, gameState, myPlayerId) {
  if (!el || initialized || !gameState) return;

  initialized = true;
  containerEl = el;
  currentBoard = gameState.board;

  app = new Application();
  await app.init({
    background: 0x0f0f1a,
    antialias: true,
    width: el.clientWidth || 800,
    height: el.clientHeight || 600,
  });

  el.appendChild(app.canvas);

  boardContainer = new Container();
  app.stage.addChild(boardContainer);

  tileLayer = new TileLayer();
  boardContainer.addChild(tileLayer.container);

  robotLayer = new RobotLayer();
  robotLayer.setMyPlayerId(myPlayerId);
  boardContainer.addChild(robotLayer.container);

  animationQueue = new AnimationQueue(robotLayer, app.ticker);

  // Build initial board
  tileLayer.build(gameState.board, gameState.checkpoints);
  robotLayer.syncRobots(gameState.robots);

  fitBoard(gameState);

  // Observe container resizes
  resizeObserver = new ResizeObserver(() => {
    if (app && el.clientWidth > 0 && el.clientHeight > 0) {
      app.renderer.resize(el.clientWidth, el.clientHeight);
      fitBoard();
    }
  });
  resizeObserver.observe(el);
}

function fitBoard(gameState) {
  if (!app || !boardContainer || !containerEl) return;

  const board = gameState?.board ?? currentBoard;
  if (!board) return;

  const cellPitch = TILE_SIZE + TILE_GAP;
  const boardW = board.width * cellPitch - TILE_GAP;
  const boardH = board.height * cellPitch - TILE_GAP;

  const availW = containerEl.clientWidth - BOARD_PADDING * 2;
  const availH = containerEl.clientHeight - BOARD_PADDING * 2;

  const scale = Math.min(availW / boardW, availH / boardH, MAX_SCALE);

  boardContainer.scale.set(scale, scale);
  boardContainer.x = (containerEl.clientWidth - boardW * scale) / 2;
  boardContainer.y = (containerEl.clientHeight - boardH * scale) / 2;
}

export function destroyBoardCanvas() {
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
  containerEl = null;
  isAnimating = false;
  currentBoard = null;
}

export function updateRobots(robots) {
  if (!robotLayer || isAnimating) return;
  robotLayer.syncRobots(robots);
}

export function updateBoard(board, checkpoints, gameState) {
  if (!tileLayer) return;
  currentBoard = board;
  tileLayer.build(board, checkpoints);
  fitBoard(gameState);
}

export async function animateEvents(events, robots) {
  if (!events.length || !animationQueue || !robotLayer) return;

  isAnimating = true;
  try {
    await animationQueue.animate(events, robots);
  } finally {
    isAnimating = false;
    // Final snap to ensure consistency
    if (robots) robotLayer.syncRobots(robots);
  }
}

export function updateSpeed(speed) {
  if (animationQueue) {
    animationQueue.setSpeed(speed);
  }
}

export function isInitialized() {
  return initialized;
}
