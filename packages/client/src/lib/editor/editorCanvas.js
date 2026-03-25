import '../../styles/board-dom.css';
import { DomTileLayer } from '../board-renderer/DomTileLayer.js';
import { TILE_SIZE, TILE_GAP, BOARD_PADDING, MAX_SCALE } from '../board-renderer/constants.js';
import { BOARD } from '@mechmarathon/shared';

let tileLayer = null;
let scalerEl = null;
let selectionEl = null;
let hoverEl = null;
let gridSvg = null;
let resizeObserver = null;
let wrapperEl = null;
let currentScale = 1;
let offsetX = 0;
let offsetY = 0;
let initialized = false;

const cellPitch = TILE_SIZE + TILE_GAP;

export async function initEditorCanvas(el) {
  if (!el || initialized) return;
  initialized = true;
  wrapperEl = el;

  // Container structure: wrapper > board-dom-container > scaler > tileLayer + overlays
  const container = document.createElement('div');
  container.className = 'board-dom-container';

  scalerEl = document.createElement('div');
  scalerEl.className = 'board-scaler';
  container.appendChild(scalerEl);

  tileLayer = new DomTileLayer();
  scalerEl.appendChild(tileLayer.element);

  // Grid overlay (SVG)
  gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gridSvg.setAttribute('class', 'grid-overlay');
  scalerEl.appendChild(gridSvg);

  // Selection highlight
  selectionEl = document.createElement('div');
  selectionEl.className = 'selection-highlight';
  selectionEl.style.display = 'none';
  selectionEl.style.width = TILE_SIZE + 'px';
  selectionEl.style.height = TILE_SIZE + 'px';
  scalerEl.appendChild(selectionEl);

  // Hover highlight
  hoverEl = document.createElement('div');
  hoverEl.className = 'hover-highlight';
  hoverEl.style.display = 'none';
  hoverEl.style.width = TILE_SIZE + 'px';
  hoverEl.style.height = TILE_SIZE + 'px';
  scalerEl.appendChild(hoverEl);

  el.appendChild(container);

  // Wait for the wrapper to have layout dimensions.
  // The wrapper uses flex: 1 with no explicit width — dimensions are 0
  // until the browser computes flex layout. The old PixiJS app.init() was
  // truly async so .then() naturally ran after layout; DOM creation is
  // synchronous so we must explicitly wait.
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
  // Persistent resize observer for window/container resizes
  resizeObserver = new ResizeObserver(() => {
    if (wrapperEl && wrapperEl.clientWidth > 0 && wrapperEl.clientHeight > 0) {
      fitBoard();
    }
  });
  resizeObserver.observe(el);
}

function fitBoard() {
  if (!scalerEl || !wrapperEl) return;
  // Skip if the wrapper hasn't been laid out yet — ResizeObserver will call us back
  if (wrapperEl.clientWidth <= 0 || wrapperEl.clientHeight <= 0) return;

  const boardW = BOARD.SIZE * cellPitch - TILE_GAP;
  const boardH = BOARD.SIZE * cellPitch - TILE_GAP;

  const availW = wrapperEl.clientWidth - BOARD_PADDING * 2;
  const availH = wrapperEl.clientHeight - BOARD_PADDING * 2;

  currentScale = Math.min(availW / boardW, availH / boardH, MAX_SCALE);
  offsetX = (wrapperEl.clientWidth - boardW * currentScale) / 2;
  offsetY = (wrapperEl.clientHeight - boardH * currentScale) / 2;

  scalerEl.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${currentScale})`;
}

export function rebuildBoard(tiles) {
  if (!tileLayer) return;

  const board = { width: BOARD.SIZE, height: BOARD.SIZE, tiles };
  tileLayer.build(board, []);
  drawGridOverlay();
  fitBoard();
}

export function updateTile(x, y, tiles) {
  if (!tileLayer) return;
  const board = { width: BOARD.SIZE, height: BOARD.SIZE, tiles };
  tileLayer.updateTile(board, x, y, []);
}

function drawGridOverlay() {
  if (!gridSvg) return;

  const totalW = BOARD.SIZE * cellPitch - TILE_GAP;
  const totalH = BOARD.SIZE * cellPitch - TILE_GAP;

  gridSvg.setAttribute('width', totalW);
  gridSvg.setAttribute('height', totalH);
  gridSvg.style.width = totalW + 'px';
  gridSvg.style.height = totalH + 'px';
  gridSvg.innerHTML = '';

  // Vertical lines
  for (let x = 1; x < BOARD.SIZE; x++) {
    const px = x * cellPitch - TILE_GAP / 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', px);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', px);
    line.setAttribute('y2', totalH);
    line.setAttribute('stroke', 'rgba(255,255,255,0.15)');
    line.setAttribute('stroke-width', 0.5);
    gridSvg.appendChild(line);
  }
  // Horizontal lines
  for (let y = 1; y < BOARD.SIZE; y++) {
    const py = y * cellPitch - TILE_GAP / 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', py);
    line.setAttribute('x2', totalW);
    line.setAttribute('y2', py);
    line.setAttribute('stroke', 'rgba(255,255,255,0.15)');
    line.setAttribute('stroke-width', 0.5);
    gridSvg.appendChild(line);
  }
}

export function setSelectedCell(x, y) {
  if (!selectionEl) return;
  if (x == null || y == null) {
    selectionEl.style.display = 'none';
    return;
  }
  selectionEl.style.display = 'block';
  selectionEl.style.left = (x * cellPitch) + 'px';
  selectionEl.style.top = (y * cellPitch) + 'px';
}

export function setHoverCell(x, y) {
  if (!hoverEl) return;
  if (x == null || y == null) {
    hoverEl.style.display = 'none';
    return;
  }
  hoverEl.style.display = 'block';
  hoverEl.style.left = (x * cellPitch) + 'px';
  hoverEl.style.top = (y * cellPitch) + 'px';
}

export function getGridPosition(e) {
  if (!scalerEl || !wrapperEl) return null;

  const rect = wrapperEl.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Reverse the CSS transform: translate then scale
  const boardX = (mouseX - offsetX) / currentScale;
  const boardY = (mouseY - offsetY) / currentScale;

  const gridX = Math.floor(boardX / cellPitch);
  const gridY = Math.floor(boardY / cellPitch);

  if (gridX < 0 || gridX >= BOARD.SIZE || gridY < 0 || gridY >= BOARD.SIZE) return null;

  const cellOffsetX = boardX - gridX * cellPitch;
  const cellOffsetY = boardY - gridY * cellPitch;

  // Reject clicks in the gap area between tiles
  if (cellOffsetX > TILE_SIZE || cellOffsetY > TILE_SIZE) return null;

  return { gridX, gridY, offsetX: cellOffsetX, offsetY: cellOffsetY, cellW: TILE_SIZE, cellH: TILE_SIZE };
}

export function getCanvasElement() {
  return wrapperEl?.querySelector('.board-dom-container') ?? null;
}

export function destroyEditorCanvas() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  tileLayer = null;
  scalerEl = null;
  gridSvg = null;
  selectionEl = null;
  hoverEl = null;
  wrapperEl = null;
  currentScale = 1;
  offsetX = 0;
  offsetY = 0;
  initialized = false;
}
