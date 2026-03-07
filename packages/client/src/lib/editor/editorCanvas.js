import { Application, Container, Graphics } from 'pixi.js';
import { TileLayer } from '../board-renderer/TileLayer.js';
import { TILE_SIZE, TILE_GAP, BOARD_PADDING, MAX_SCALE } from '../board-renderer/constants.js';
import { BOARD } from '@mechmarathon/shared';

let app = null;
let boardContainer = null;
let tileLayer = null;
let gridOverlay = null;
let selectionOverlay = null;
let hoverOverlay = null;
let resizeObserver = null;
let wrapperEl = null;

const cellPitch = TILE_SIZE + TILE_GAP;

export async function initEditorCanvas(el) {
  if (!el || app) return;
  wrapperEl = el;

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

  gridOverlay = new Graphics();
  boardContainer.addChild(gridOverlay);

  selectionOverlay = new Graphics();
  boardContainer.addChild(selectionOverlay);

  hoverOverlay = new Graphics();
  boardContainer.addChild(hoverOverlay);

  resizeObserver = new ResizeObserver(() => {
    if (app && el.clientWidth > 0 && el.clientHeight > 0) {
      app.renderer.resize(el.clientWidth, el.clientHeight);
      fitBoard();
    }
  });
  resizeObserver.observe(el);
}

function fitBoard() {
  if (!app || !boardContainer || !wrapperEl) return;

  const boardW = BOARD.SIZE * cellPitch - TILE_GAP;
  const boardH = BOARD.SIZE * cellPitch - TILE_GAP;

  const availW = wrapperEl.clientWidth - BOARD_PADDING * 2;
  const availH = wrapperEl.clientHeight - BOARD_PADDING * 2;

  const scale = Math.min(availW / boardW, availH / boardH, MAX_SCALE);

  boardContainer.scale.set(scale, scale);
  boardContainer.x = (wrapperEl.clientWidth - boardW * scale) / 2;
  boardContainer.y = (wrapperEl.clientHeight - boardH * scale) / 2;
}

export function rebuildBoard(tiles) {
  if (!tileLayer) return;

  const board = { width: BOARD.SIZE, height: BOARD.SIZE, tiles };
  tileLayer.build(board, []);
  drawGridOverlay();
  fitBoard();
}

function drawGridOverlay() {
  if (!gridOverlay) return;
  gridOverlay.clear();

  const totalW = BOARD.SIZE * cellPitch - TILE_GAP;
  const totalH = BOARD.SIZE * cellPitch - TILE_GAP;

  gridOverlay.setStrokeStyle({ width: 0.5, color: 0xffffff, alpha: 0.15 });

  // Vertical lines
  for (let x = 1; x < BOARD.SIZE; x++) {
    const px = x * cellPitch - TILE_GAP / 2;
    gridOverlay.moveTo(px, 0).lineTo(px, totalH).stroke();
  }
  // Horizontal lines
  for (let y = 1; y < BOARD.SIZE; y++) {
    const py = y * cellPitch - TILE_GAP / 2;
    gridOverlay.moveTo(0, py).lineTo(totalW, py).stroke();
  }
}

export function setSelectedCell(x, y) {
  if (!selectionOverlay) return;
  selectionOverlay.clear();
  if (x == null || y == null) return;

  const px = x * cellPitch;
  const py = y * cellPitch;
  selectionOverlay.setStrokeStyle({ width: 2, color: 0xffd700 });
  selectionOverlay.rect(px, py, TILE_SIZE, TILE_SIZE).stroke();
}

export function setHoverCell(x, y) {
  if (!hoverOverlay) return;
  hoverOverlay.clear();
  if (x == null || y == null) return;

  const px = x * cellPitch;
  const py = y * cellPitch;
  hoverOverlay.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.25 });
  hoverOverlay.rect(px, py, TILE_SIZE, TILE_SIZE).stroke();
}

export function getGridPosition(e) {
  if (!app || !boardContainer || !wrapperEl) return null;

  const rect = app.canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  const boardX = (canvasX - boardContainer.x) / boardContainer.scale.x;
  const boardY = (canvasY - boardContainer.y) / boardContainer.scale.y;

  const gridX = Math.floor(boardX / cellPitch);
  const gridY = Math.floor(boardY / cellPitch);

  if (gridX < 0 || gridX >= BOARD.SIZE || gridY < 0 || gridY >= BOARD.SIZE) return null;

  const offsetX = boardX - gridX * cellPitch;
  const offsetY = boardY - gridY * cellPitch;

  // Reject clicks in the gap area between tiles
  if (offsetX > TILE_SIZE || offsetY > TILE_SIZE) return null;

  return { gridX, gridY, offsetX, offsetY, cellW: TILE_SIZE, cellH: TILE_SIZE };
}

export function getCanvasElement() {
  return app?.canvas ?? null;
}

export function destroyEditorCanvas() {
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
  gridOverlay = null;
  selectionOverlay = null;
  hoverOverlay = null;
  wrapperEl = null;
}
