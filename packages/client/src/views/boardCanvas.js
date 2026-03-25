import '../styles/board-dom.css';
import { DomTileLayer } from '../lib/board-renderer/DomTileLayer.js';
import { DomRobotLayer } from '../lib/board-renderer/DomRobotLayer.js';
import { DomAnimationQueue } from '../lib/board-renderer/DomAnimationQueue.js';
import { TILE_SIZE, TILE_GAP, BOARD_PADDING, MAX_SCALE } from '../lib/board-renderer/constants.js';

let tileLayer = null;
let robotLayer = null;
let animationQueue = null;
let scalerEl = null;
let containerEl = null;
let resizeObserver = null;
let initialized = false;
let isAnimating = false;
let currentBoard = null;
let currentFlags = null;

export async function initBoardCanvas(el, gameState, myPlayerId) {
  if (!el || initialized || !gameState) return;

  initialized = true;
  containerEl = el;
  currentBoard = gameState.board;

  // Container structure
  const domContainer = document.createElement('div');
  domContainer.className = 'board-dom-container';

  scalerEl = document.createElement('div');
  scalerEl.className = 'board-scaler';
  domContainer.appendChild(scalerEl);

  tileLayer = new DomTileLayer();
  scalerEl.appendChild(tileLayer.element);

  robotLayer = new DomRobotLayer();
  robotLayer.setMyPlayerId(myPlayerId);
  scalerEl.appendChild(robotLayer.element);

  animationQueue = new DomAnimationQueue(robotLayer);

  // Build initial board
  currentFlags = gameState.flags;
  tileLayer.build(gameState.board, currentFlags);
  robotLayer.syncRobots(gameState.robots);

  el.appendChild(domContainer);

  // Wait for layout dimensions (flex container may not have width yet)
  await new Promise(resolve => {
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      resolve();
      return;
    }
    const layoutObserver = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        layoutObserver.disconnect();
        resolve();
      }
    });
    layoutObserver.observe(el);
  });

  fitBoard(gameState);

  resizeObserver = new ResizeObserver(() => {
    if (containerEl && containerEl.clientWidth > 0 && containerEl.clientHeight > 0) {
      fitBoard();
    }
  });
  resizeObserver.observe(el);
}

function fitBoard(gameState) {
  if (!scalerEl || !containerEl) return;

  const board = gameState?.board ?? currentBoard;
  if (!board) return;

  const cellPitch = TILE_SIZE + TILE_GAP;
  const boardW = board.width * cellPitch - TILE_GAP;
  const boardH = board.height * cellPitch - TILE_GAP;

  const availW = containerEl.clientWidth - BOARD_PADDING * 2;
  const availH = containerEl.clientHeight - BOARD_PADDING * 2;

  const scale = Math.min(availW / boardW, availH / boardH, MAX_SCALE);

  const offsetX = (containerEl.clientWidth - boardW * scale) / 2;
  const offsetY = (containerEl.clientHeight - boardH * scale) / 2;

  scalerEl.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

export function destroyBoardCanvas() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  tileLayer = null;
  robotLayer = null;
  animationQueue = null;
  scalerEl = null;
  initialized = false;
  containerEl = null;
  isAnimating = false;
  currentBoard = null;
  currentFlags = null;
}

export function updateRobots(robots) {
  if (!robotLayer || isAnimating) return;
  robotLayer.syncRobots(robots);
}

export function updateBoard(board, flags, gameState) {
  if (!tileLayer) return;
  currentBoard = board;
  currentFlags = flags;
  tileLayer.build(board, flags);
  fitBoard(gameState);
}

export async function animateEvents(events, robots) {
  if (!events.length || !animationQueue || !robotLayer) return;

  isAnimating = true;
  try {
    await animationQueue.animate(events, robots);
  } finally {
    isAnimating = false;
    if (robots) robotLayer.syncRobots(robots);
  }
}

export function updateSpeed(speed) {
  if (animationQueue) {
    animationQueue.setSpeed(speed);
  }
}

export function rebuildBoard() {
  if (!tileLayer || !currentBoard) return;
  tileLayer.build(currentBoard, currentFlags);
}

export function isInitialized() {
  return initialized;
}
